import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vyntex.phone",
  appName: "Vyntex POS Phone",
  webDir: "dist-phone",
  plugins: {
    App: {
      urlScheme: "com.vyntex.phone",
    },
  },
};

export default config;
