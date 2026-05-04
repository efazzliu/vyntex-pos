Dashboard download links expect BOTH files under public/:

  public/VyntexPOSSetup.exe           (x64 — Intel / AMD)
  public/VyntexPOSSetup-arm64.exe     (ARM64)

Do not commit fake .exe text files — Windows will show "This app can't run on your PC".

Desktop .exe must be built with Supabase env vars baked in (Vite), or end users cannot
activate a license (they will see a clear warning on the activation screen instead of a crash):

  VITE_SUPABASE_URL=...
  VITE_SUPABASE_ANON_KEY=...

Put them in `.env.local` (dev) and/or `.env.production.local` (packaged .exe) before `npm run dist:win`.
Copy `/.env.production.example` to `.env.production.local` and paste URL + anon key from Supabase.
`npm run build:web` fails fast if these are missing (see scripts/ensure-vite-supabase-env.mjs).

Default Windows build:

  npm run dist:win

Before electron-builder, `predist:win` stops Vyntex POS / electron.exe and tries
to delete or rename `release\win-unpacked\resources\app.asar` if it is locked.

If predist still errors (file held by antivirus, Search, etc.), build into a clean folder:

  npm run dist:win:fresh

Outputs go to `release-eb-staging\` and are copied to `public\` (no predist hook).

Normal flow still copies from `release\` (postdist:win after `npm run dist:win`).

For a clean tree first (delete/rename release\win-unpacked), close dev, Explorer,
and Vyntex POS, then:

  npm run dist:win:full

Manual clean only:

  npm run clean:electron-release

If clean cannot delete the folder, it may rename it to win-unpacked.__trash_<time>;
delete that folder later in Explorer. `dist:win:skip-clean` is the same as `dist:win`.

Outputs in release/ (before copy):
  VyntexPOSSetup-<version>-x64.exe
  VyntexPOSSetup-<version>-arm64.exe

If you already built but skipped copy:
  npm run copy-installers

Optional env vars (e.g. CDN URLs) in .env when building the web app:
  VITE_RESTAURANT_POS_EXE_URL         legacy: single x64 URL (overrides default x64 path)
  VITE_RESTAURANT_POS_EXE_URL_X64     explicit x64 URL
  VITE_RESTAURANT_POS_EXE_URL_ARM64   explicit ARM64 URL

If Windows says "This app can't run on your PC":
  - You likely ran the wrong architecture (use arm64 on ARM laptops, x64 on normal PCs).
  - Or the file is corrupted / not a real installer (re-download or rebuild).
  - 32-bit Windows cannot run current Electron builds (need 64-bit Windows 10/11).

After replacing the file, restart the dev server.

Legacy URLs /dev still serve old filenames if present; canonical installers are VyntexPOSSetup*.exe.
