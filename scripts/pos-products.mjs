/**
 * POS product lines — one place for installer names, public paths, and build flags.
 * Add fitness / bar / hotel when each has its own electron branding & routes.
 */
export const POS_PRODUCTS = {
  restaurant: {
    id: "restaurant",
    label: "Restaurant POS",
    enabled: true,
    artifactPrefix: "RestaurantPOSSetup",
    publicExe: "RestaurantPOSSetup.exe",
    publicExeArm64: "RestaurantPOSSetup-arm64.exe",
    appId: "com.vyntex.restaurantpos",
    productName: "Vyntex Restaurant POS",
    shortcutName: "Vyntex Restaurant POS",
  },
  fitness: {
    id: "fitness",
    label: "Fitness POS",
    enabled: false,
    artifactPrefix: "FitnessPOSSetup",
    publicExe: "FitnessPOSSetup.exe",
    publicExeArm64: "FitnessPOSSetup-arm64.exe",
    appId: "com.vyntex.fitnesspos",
    productName: "Vyntex Fitness POS",
    shortcutName: "Vyntex Fitness POS",
  },
  bar: {
    id: "bar",
    label: "Bar POS",
    enabled: false,
    artifactPrefix: "BarPOSSetup",
    publicExe: "BarPOSSetup.exe",
    publicExeArm64: "BarPOSSetup-arm64.exe",
    appId: "com.vyntex.barpos",
    productName: "Vyntex Bar POS",
    shortcutName: "Vyntex Bar POS",
  },
  hotel: {
    id: "hotel",
    label: "Hotel POS",
    enabled: false,
    artifactPrefix: "HotelPOSSetup",
    publicExe: "HotelPOSSetup.exe",
    publicExeArm64: "HotelPOSSetup-arm64.exe",
    appId: "com.vyntex.hotelpos",
    productName: "Vyntex Hotel POS",
    shortcutName: "Vyntex Hotel POS",
  },
};

/** @param {string} raw */
export function resolvePosProductId(raw) {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-pos$/, "");
  if (key in POS_PRODUCTS) return key;
  const aliases = {
    rest: "restaurant",
    gym: "fitness",
    pub: "bar",
  };
  return aliases[key] ?? null;
}

export function listPosProductIds() {
  return Object.keys(POS_PRODUCTS);
}
