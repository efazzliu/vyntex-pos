import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import hercules from "@usehercules/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, type Plugin } from "vite";
import { createInstallerMiddleware } from "./scripts/vite-installer-middleware.ts";

function viteInstallerPlugin(): Plugin {
  return {
    name: "vite-installer-middleware",
    configureServer(server) {
      const publicDir = path.resolve(server.config.root, server.config.publicDir);
      server.middlewares.use(createInstallerMiddleware(publicDir));
    },
    configurePreviewServer(server) {
      const publicDir = path.resolve(server.config.root, server.config.publicDir);
      server.middlewares.use(createInstallerMiddleware(publicDir));
    },
  };
}

/** Vercel/dist: duplicate installer under a versioned filename (no extra git blob). */
function copyVersionedInstallerToDistPlugin(): Plugin {
  let outDir = "dist";
  let appVersion = "0.0.0";
  return {
    name: "vyntex-copy-versioned-installer",
    configResolved(c) {
      outDir = c.build.outDir;
      try {
        const pkg = JSON.parse(
          fs.readFileSync(path.resolve(__dirname, "package.json"), "utf8"),
        ) as { version?: string };
        if (typeof pkg.version === "string" && pkg.version.trim()) {
          appVersion = pkg.version.trim();
        }
      } catch {
        /* ignore */
      }
    },
    closeBundle() {
      // Installer copies to dist/ run after update:*-pos (purge-published-installers).
      // Web-only `vite build` without a fresh .exe skips dist installer copies.
      const x64 = path.resolve(__dirname, "public/RestaurantPOSSetup.exe");
      if (!fs.existsSync(x64) || fs.statSync(x64).size < 50_000) return;
      const distDir = path.resolve(__dirname, outDir);
      for (const name of fs.readdirSync(distDir)) {
        if (/^(Restaurant|Vyntex|Fitness|Bar|Hotel)POSSetup.*\.exe$/i.test(name)) {
          const full = path.join(distDir, name);
          try {
            fs.unlinkSync(full);
          } catch (err) {
            const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
            if (code === "EBUSY" || code === "EPERM") {
              console.warn(`[vyntex] Locked installer left in place: ${name}`);
              continue;
            }
            throw err;
          }
        }
      }
      const pairs = [
        { src: x64, dest: "RestaurantPOSSetup.exe" },
        { src: x64, dest: `RestaurantPOSSetup-${appVersion}-x64.exe` },
        {
          src: path.resolve(__dirname, "public/RestaurantPOSSetup-arm64.exe"),
          dest: `RestaurantPOSSetup-${appVersion}-arm64.exe`,
        },
        {
          src: path.resolve(__dirname, "public/RestaurantPOSSetup-arm64.exe"),
          dest: "RestaurantPOSSetup-arm64.exe",
        },
      ];
      for (const { src, dest } of pairs) {
        if (!fs.existsSync(src) || fs.statSync(src).size < 50_000) continue;
        const outPath = path.join(distDir, dest);
        try {
          fs.copyFileSync(src, outPath);
        } catch (err) {
          const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
          if (code === "EBUSY" || code === "EPERM") {
            console.warn(`[vyntex] Could not copy installer (locked): ${dest}`);
            continue;
          }
          throw err;
        }
        console.log(`[vyntex] Copied installer -> ${path.relative(__dirname, outPath)}`);
      }
    },
  };
}

/** Static deploy: `fetch(build-meta.json)` matches dev live JSON from middleware. */
function writeBuildMetaJsonPlugin(): Plugin {
  let outDir = "dist";
  return {
    name: "vyntex-write-build-meta",
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const pkgPath = path.resolve(__dirname, "package.json");
      const exePath = path.resolve(__dirname, "public/RestaurantPOSSetup.exe");
      let appVersion = "0.0.0";
      let installerUpdatedAt: string | null = null;
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version?: string };
        if (typeof pkg.version === "string" && pkg.version.trim()) {
          appVersion = pkg.version.trim();
        }
      } catch {
        /* ignore */
      }
      try {
        if (fs.existsSync(exePath)) {
          installerUpdatedAt = fs.statSync(exePath).mtime.toISOString();
        }
      } catch {
        /* ignore */
      }
      const outPath = path.resolve(__dirname, outDir, "build-meta.json");
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(
        outPath,
        JSON.stringify({ appVersion, installerUpdatedAt }, null, 0),
        "utf8",
      );
    },
  };
}

const arm64InstallerPath = path.resolve(__dirname, "public/RestaurantPOSSetup-arm64.exe");
const arm64InstallerPresent =
  fs.existsSync(arm64InstallerPath) &&
  fs.statSync(arm64InstallerPath).size >= 50_000;
const x64InstallerPath = path.resolve(__dirname, "public/RestaurantPOSSetup.exe");
const installerUpdatedAt = fs.existsSync(x64InstallerPath)
  ? fs.statSync(x64InstallerPath).mtime.toISOString()
  : "";

const appVersion = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "package.json"), "utf8"),
).version as string;

// https://vite.dev/config/
export default defineConfig(() => {
  const phoneStoreBuild = process.env.VITE_PHONE_STORE_BUILD === "true";
  /** Web (Vercel): `/` so refresh on /admin/settings loads /assets/* not /admin/assets/*. */
  const relativeBase =
    phoneStoreBuild || process.env.VITE_RELATIVE_BASE === "true";
  const base = relativeBase ? "./" : "/";
  return {
    define: {
      /** Reliable at dev + build time (some setups do not surface `import.meta.env.VITE_*` from `define`). */
      __APP_VERSION__: JSON.stringify(appVersion),
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
      "import.meta.env.VITE_ARM64_INSTALLER_AVAILABLE": JSON.stringify(
        arm64InstallerPresent ? "true" : "false",
      ),
      "import.meta.env.VITE_INSTALLER_UPDATED_AT": JSON.stringify(installerUpdatedAt),
      __INSTALLER_UPDATED_AT__: JSON.stringify(installerUpdatedAt),
      "import.meta.env.VITE_PHONE_STORE_BUILD": JSON.stringify(
        phoneStoreBuild ? "true" : "false",
      ),
    },
    base,
    server: {
      host: "0.0.0.0",
      port: 5173,
      allowedHosts: true,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      viteInstallerPlugin(),
      writeBuildMetaJsonPlugin(),
      copyVersionedInstallerToDistPlugin(),
      react(),
      tailwindcss(),
      hercules(),
    ],
    resolve: {
      alias: {
        "convex/react": path.resolve(__dirname, "./src/lib/convex-react-supabase.tsx"),
        "@/convex": path.resolve(__dirname, "./convex"),
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      outDir: phoneStoreBuild ? "dist-phone" : "dist",
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        input: phoneStoreBuild
          ? {
              phone: path.resolve(__dirname, "phone.html"),
            }
          : {
              main: path.resolve(__dirname, "index.html"),
              phone: path.resolve(__dirname, "phone.html"),
            },
      },
    },
  };
});
