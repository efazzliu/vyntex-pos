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

const arm64InstallerPath = path.resolve(__dirname, "public/VyntexPOSSetup-arm64.exe");
const arm64InstallerPresent =
  fs.existsSync(arm64InstallerPath) &&
  fs.statSync(arm64InstallerPath).size >= 50_000;
const x64InstallerPath = path.resolve(__dirname, "public/VyntexPOSSetup.exe");
const installerUpdatedAt = fs.existsSync(x64InstallerPath)
  ? fs.statSync(x64InstallerPath).mtime.toISOString()
  : "";

const appVersion = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "package.json"), "utf8"),
).version as string;

// https://vite.dev/config/
export default defineConfig(() => {
  const phoneStoreBuild = process.env.VITE_PHONE_STORE_BUILD === "true";
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
    base: "./",
    server: {
      host: "0.0.0.0",
      port: 5173,
      allowedHosts: true,
      hmr: {
        overlay: false,
      },
    },
    plugins: [viteInstallerPlugin(), react(), tailwindcss(), hercules()],
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
