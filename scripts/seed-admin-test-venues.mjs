/**
 * Creates 3 assigned test licenses for endfazzliu@outlook.com and fills
 * each venue with rooms, tables, staff, categories, and menu items.
 *
 * Usage: node scripts/seed-admin-test-venues.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OWNER_EMAIL = "endfazzliu@outlook.com";
const OWNER_NAME = "Endrit";

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const eq = s.indexOf("=");
    if (eq <= 0) continue;
    const key = s.slice(0, eq).trim();
    let val = s.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = {
  ...parseDotEnv(path.join(root, ".env")),
  ...parseDotEnv(path.join(root, ".env.local")),
};

const url = String(env.VITE_SUPABASE_URL ?? "").trim();
const anon = String(env.VITE_SUPABASE_ANON_KEY ?? "").trim();
if (!url || !anon) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function sha256(input) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function randomLicenseKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let key = "";
  for (let i = 0; i < 16; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return `${key.slice(0, 4)}-${key.slice(4, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}`;
}

function must(error, label) {
  if (!error) return;
  throw new Error(`${label}: ${error.message}`);
}

const MENU = {
  starter: [
    { name: "Pije", color: "#0066FF", icon: "🥤", station: "bar", items: [
      ["Coca-Cola 0.33", 150, true],
      ["Fanta 0.33", 150, false],
      ["Sprite 0.33", 150, false],
      ["Ujë 0.33", 80, true],
      ["Ujë 0.75", 150, false],
      ["Red Bull", 250, false],
    ]},
    { name: "Kafe", color: "#7c3aed", icon: "☕", station: "bar", items: [
      ["Kafe ekspres", 80, true],
      ["Macchiato", 100, true],
      ["Cappuccino", 120, false],
      ["Makiato e madhe", 130, false],
      ["Çaj", 80, false],
    ]},
    { name: "Kryesor", color: "#ea580c", icon: "🍽️", station: "kitchen", items: [
      ["Hamburger", 450, true],
      ["Cheeseburger", 500, false],
      ["Pule e pjekur", 550, false],
      ["Pomfrit", 200, true],
      ["Sallatë e përzier", 280, false],
      ["Sandwich pule", 350, false],
    ]},
    { name: "Pizza", color: "#dc2626", icon: "🍕", station: "kitchen", items: [
      ["Margherita", 400, true],
      ["Capricciosa", 500, false],
      ["Tuna", 520, false],
      ["Prosciutto", 480, false],
    ]},
  ],
  professional: [
    { name: "Pije", color: "#0066FF", icon: "🥤", station: "bar", items: [
      ["Coca-Cola 0.33", 150, true], ["Fanta 0.33", 150, false], ["Sprite 0.33", 150, false],
      ["Schweppes", 160, false], ["Ujë 0.33", 80, true], ["Ujë 0.75", 150, false],
      ["Red Bull", 250, false], ["Ice Tea", 180, false],
    ]},
    { name: "Kafe", color: "#7c3aed", icon: "☕", station: "bar", items: [
      ["Kafe ekspres", 90, true], ["Macchiato", 110, true], ["Cappuccino", 140, false],
      ["Latte", 160, false], ["Mocha", 180, false], ["Çaj mali", 90, false],
    ]},
    { name: "Kokteje", color: "#db2777", icon: "🍸", station: "bar", items: [
      ["Mojito", 450, true], ["Aperol Spritz", 480, false], ["Gin Tonic", 420, false],
      ["Whiskey Sour", 500, false], ["Piña Colada", 520, false],
    ]},
    { name: "Bira", color: "#ca8a04", icon: "🍺", station: "bar", items: [
      ["Peja 0.33", 180, true], ["Peja 0.5", 250, false], ["Heineken 0.33", 280, false],
      ["Corona", 320, false], ["Bira e çezës 0.3", 200, true], ["Bira e çezës 0.5", 280, false],
    ]},
    { name: "Antipasta", color: "#16a34a", icon: "🥗", station: "kitchen", items: [
      ["Bruschetta", 320, false], ["Carpaccio", 650, false], ["Sallatë Cezar", 420, true],
      ["Sallatë e përzier", 300, false], ["Supë e ditës", 280, false],
    ]},
    { name: "Kryesor", color: "#ea580c", icon: "🍽️", station: "kitchen", items: [
      ["Fileto viçi", 1200, true], ["Pule e pjekur", 650, false], ["Salmon", 1100, false],
      ["Risotto kërpudhash", 700, false], ["Pasta Carbonara", 620, true], ["Pasta Bolognese", 580, false],
    ]},
    { name: "Pizza", color: "#dc2626", icon: "🍕", station: "kitchen", items: [
      ["Margherita", 450, true], ["Capricciosa", 550, false], ["Diavola", 560, false],
      ["Quattro Formaggi", 580, false], ["Tuna", 570, false], ["Prosciutto e rucola", 620, false],
    ]},
    { name: "Ëmbëlsira", color: "#9333ea", icon: "🍰", station: "kitchen", items: [
      ["Tiramisu", 320, true], ["Cheesecake", 340, false], ["Bakllava", 250, false],
      ["Akullore 2 topa", 200, false],
    ]},
  ],
  enterprise: [
    { name: "Pije", color: "#0066FF", icon: "🥤", station: "bar", items: [
      ["Coca-Cola 0.33", 160, true], ["Fanta 0.33", 160, false], ["Sprite 0.33", 160, false],
      ["Schweppes", 170, false], ["Tonic", 170, false], ["Ujë 0.33", 90, true],
      ["Ujë 0.75", 160, false], ["San Pellegrino", 250, false], ["Red Bull", 280, false],
      ["Ice Tea", 190, false],
    ]},
    { name: "Kafe", color: "#7c3aed", icon: "☕", station: "bar", items: [
      ["Kafe ekspres", 100, true], ["Doppio", 140, false], ["Macchiato", 120, true],
      ["Cappuccino", 160, false], ["Flat White", 180, false], ["Latte", 180, false],
      ["Mocha", 200, false], ["Çaj mali", 100, false], ["Çaj i gjelbër", 110, false],
    ]},
    { name: "Kokteje", color: "#db2777", icon: "🍸", station: "bar", items: [
      ["Mojito", 550, true], ["Aperol Spritz", 580, false], ["Negroni", 620, false],
      ["Gin Tonic", 500, false], ["Old Fashioned", 680, false], ["Espresso Martini", 650, false],
      ["Whiskey Sour", 600, false], ["Piña Colada", 580, false],
    ]},
    { name: "Bira & Verë", color: "#ca8a04", icon: "🍷", station: "bar", items: [
      ["Peja 0.5", 280, true], ["Heineken 0.33", 320, false], ["Corona", 360, false],
      ["Bira e çezës 0.3", 220, false], ["Bira e çezës 0.5", 320, true],
      ["Verë e kuqe gotë", 450, false], ["Verë e bardhë gotë", 450, false],
      ["Prosecco gotë", 500, false], ["Shishe Cabernet", 2200, false],
    ]},
    { name: "Antipasta", color: "#16a34a", icon: "🥗", station: "kitchen", items: [
      ["Bruschetta", 380, false], ["Carpaccio viçi", 780, true], ["Tartar salmoni", 820, false],
      ["Sallatë Cezar", 480, true], ["Sallatë e përzier", 340, false], ["Burrata", 720, false],
      ["Supë e ditës", 320, false],
    ]},
    { name: "Kryesor", color: "#ea580c", icon: "🥩", station: "kitchen", items: [
      ["Fileto viçi 250g", 1650, true], ["Rib-eye 300g", 1850, false], ["Pule e pjekur", 780, false],
      ["Salmon i pjekur", 1450, false], ["Risotto kërpudhash", 850, false],
      ["Pasta Carbonara", 720, true], ["Pasta Bolognese", 680, false], ["Gnocchi 4 djathra", 740, false],
      ["Risotto deti", 980, false],
    ]},
    { name: "Pizza", color: "#dc2626", icon: "🍕", station: "kitchen", items: [
      ["Margherita", 520, true], ["Capricciosa", 640, false], ["Diavola", 650, false],
      ["Quattro Formaggi", 680, false], ["Tuna", 660, false], ["Prosciutto e rucola", 720, false],
      ["Truffle", 890, false], ["Calzone", 700, false],
    ]},
    { name: "Ëmbëlsira", color: "#9333ea", icon: "🍰", station: "kitchen", items: [
      ["Tiramisu", 380, true], ["Cheesecake", 400, false], ["Crème brûlée", 420, false],
      ["Bakllava", 280, false], ["Akullore 3 topa", 280, false], ["Panna cotta", 360, false],
    ]},
  ],
};

const FLOORS = {
  starter: [
    { zone: "Interior", tables: 8, seats: 4, shape: "square" },
    { zone: "Terasa", tables: 6, seats: 4, shape: "square" },
  ],
  professional: [
    { zone: "Interior", tables: 10, seats: 4, shape: "square" },
    { zone: "Terasa", tables: 8, seats: 4, shape: "rectangle" },
    { zone: "VIP", tables: 4, seats: 6, shape: "circle" },
    { zone: "Bar", tables: 6, seats: 2, shape: "square" },
  ],
  enterprise: [
    { zone: "Interior", tables: 12, seats: 4, shape: "square" },
    { zone: "Terasa", tables: 10, seats: 4, shape: "rectangle" },
    { zone: "VIP", tables: 6, seats: 8, shape: "circle" },
    { zone: "Lounge", tables: 8, seats: 4, shape: "square" },
    { zone: "Garden", tables: 8, seats: 4, shape: "rectangle" },
  ],
};

const STAFF = {
  starter: [
    { name: "Admin", role: "admin", pin: "1234" },
    { name: "Arta", role: "waiter", pin: "1111" },
    { name: "Blerim", role: "waiter", pin: "2222" },
    { name: "Kuzhina", role: "kitchen", pin: "3333" },
  ],
  professional: [
    { name: "Admin", role: "admin", pin: "1234" },
    { name: "Menaxher", role: "manager", pin: "0000" },
    { name: "Arta", role: "waiter", pin: "1111" },
    { name: "Blerim", role: "waiter", pin: "2222" },
    { name: "Drita", role: "waiter", pin: "4444" },
    { name: "Kuzhina", role: "kitchen", pin: "3333" },
    { name: "Stoku", role: "inventory", pin: "5555" },
  ],
  enterprise: [
    { name: "Admin", role: "admin", pin: "1234" },
    { name: "Menaxher", role: "manager", pin: "0000" },
    { name: "Arta", role: "waiter", pin: "1111" },
    { name: "Blerim", role: "waiter", pin: "2222" },
    { name: "Drita", role: "waiter", pin: "4444" },
    { name: "Erion", role: "waiter", pin: "6666" },
    { name: "Kuzhina", role: "kitchen", pin: "3333" },
    { name: "Barman", role: "waiter", pin: "7777" },
    { name: "Stoku", role: "inventory", pin: "5555" },
    { name: "Kontabiliteti", role: "accountant", pin: "8888" },
  ],
};

const CUSTOMERS = {
  starter: [{ name: "Klienti Test", phone: "044111111", creditLimit: 5000 }],
  professional: [
    { name: "Firma ABC", phone: "044222222", creditLimit: 20000 },
    { name: "Hotel Test", phone: "044333333", creditLimit: 15000 },
    { name: "Ana Berisha", phone: "044444444", creditLimit: 3000 },
  ],
  enterprise: [
    { name: "Kompania Delta", phone: "044555555", creditLimit: 50000 },
    { name: "Hotel Grand", phone: "044666666", creditLimit: 40000 },
    { name: "Ana Berisha", phone: "044444444", creditLimit: 5000 },
    { name: "Besnik Gashi", phone: "044777777", creditLimit: 8000 },
    { name: "Restorant Partner", phone: "044888888", creditLimit: 12000 },
  ],
};

const VENUES = [
  {
    name: "Starter Test Venue",
    plan: "starter",
    type: "cafe",
    address: "Rruga Test 1, Prishtinë",
    phone: "038111111",
    maxTerminals: 1,
  },
  {
    name: "Professional Test Venue",
    plan: "professional",
    type: "restaurant",
    address: "Rruga Test 2, Prishtinë",
    phone: "038222222",
    maxTerminals: 5,
  },
  {
    name: "Enterprise Test Venue",
    plan: "enterprise",
    type: "restaurant",
    address: "Rruga Test 3, Prishtinë",
    phone: "038333333",
    maxTerminals: 15,
  },
];

async function findOwnerUserId() {
  const { data, error } = await supabase
    .from("restaurants")
    .select("owner_user_id, owner_email, owner_name")
    .ilike("owner_email", OWNER_EMAIL)
    .not("owner_user_id", "is", null)
    .limit(1);
  must(error, "lookup owner");
  return data?.[0] ?? null;
}

async function ensureVenue(spec, owner) {
  const { data: existing, error: findErr } = await supabase
    .from("restaurants")
    .select("id, name, plan, license_key, license_status")
    .eq("name", spec.name)
    .ilike("owner_email", OWNER_EMAIL)
    .maybeSingle();
  if (findErr && findErr.code !== "PGRST116") must(findErr, `find ${spec.name}`);
  if (existing?.id) {
    console.log(`  exists: ${spec.name}  key=${existing.license_key}`);
    const { error: locErr } = await supabase
      .from("restaurants")
      .update({
        language: "en",
        currency: "EUR",
        currency_symbol: "€",
        currency_position: "prefix",
        currency_decimals: 2,
      })
      .eq("id", existing.id);
    if (locErr) console.warn(`  locale patch skipped: ${locErr.message}`);
    return existing;
  }

  const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  let lastError = null;
  for (let i = 0; i < 8; i++) {
    const licenseKey = randomLicenseKey();
    const { data, error } = await supabase
      .from("restaurants")
      .insert({
        name: spec.name,
        type: spec.type,
        address: spec.address,
        phone: spec.phone,
        currency: "EUR",
        language: "en",
        currency_symbol: "€",
        currency_position: "prefix",
        currency_decimals: 2,
        plan: spec.plan,
        license_key: licenseKey,
        license_expiry: expiry,
        license_status: "active",
        owner_user_id: owner?.owner_user_id ?? null,
        owner_email: OWNER_EMAIL,
        owner_name: owner?.owner_name || OWNER_NAME,
        max_terminals: spec.maxTerminals,
        registered_devices: [],
        mobile_access_enabled: true,
      })
      .select("id, name, plan, license_key, license_status")
      .single();
    if (!error && data) {
      console.log(`  created: ${spec.name}  key=${data.license_key}`);
      return data;
    }
    lastError = error;
    if (error?.message?.toLowerCase().includes("duplicate key")) continue;
    break;
  }
  throw new Error(`create ${spec.name}: ${lastError?.message ?? "unknown"}`);
}

async function seedTables(restaurantId, plan) {
  const { count } = await supabase
    .from("pos_floor_tables")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);
  if ((count ?? 0) > 0) {
    console.log(`    tables already ${count}`);
    return;
  }
  const rows = [];
  let yBase = 80;
  for (const room of FLOORS[plan]) {
    for (let i = 0; i < room.tables; i++) {
      const col = i % 6;
      const row = Math.floor(i / 6);
      rows.push({
        restaurant_id: restaurantId,
        name: `T${i + 1}`,
        seats: room.seats,
        zone: room.zone,
        pos_x: 80 + col * 140,
        pos_y: yBase + row * 120,
        shape: room.shape,
        status: "available",
        table_scale: 1,
      });
    }
    yBase += 280;
  }
  const { error } = await supabase.from("pos_floor_tables").insert(rows);
  must(error, "tables");
  console.log(`    tables ${rows.length}`);
}

async function seedStaff(restaurantId, plan) {
  const { count } = await supabase
    .from("staff")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);
  if ((count ?? 0) > 0) {
    console.log(`    staff already ${count}`);
    return;
  }
  const rows = STAFF[plan].map((s) => ({
    restaurant_id: restaurantId,
    name: s.name,
    role: s.role,
    pin_hash: sha256(s.pin),
    is_active: true,
    permissions: null,
  }));
  const { error } = await supabase.from("staff").insert(rows);
  must(error, "staff");
  console.log(`    staff ${rows.length}`);
}

async function seedMenu(restaurantId, plan) {
  const { count } = await supabase
    .from("menu_categories")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);
  if ((count ?? 0) > 0) {
    console.log(`    menu already has ${count} categories`);
    return;
  }

  let itemCount = 0;
  for (let i = 0; i < MENU[plan].length; i++) {
    const cat = MENU[plan][i];
    const baseCat = {
      restaurant_id: restaurantId,
      name: cat.name,
      color: cat.color,
      display_order: i + 1,
      is_active: true,
    };
    let { data, error } = await supabase
      .from("menu_categories")
      .insert({ ...baseCat, icon: cat.icon })
      .select("id")
      .single();
    if (error && /icon/i.test(error.message ?? "")) {
      ({ data, error } = await supabase
        .from("menu_categories")
        .insert(baseCat)
        .select("id")
        .single());
    }
    must(error, `category ${cat.name}`);
    const items = cat.items.map(([name, price, fav], idx) => ({
      restaurant_id: restaurantId,
      category_id: data.id,
      name,
      price,
      available: true,
      display_order: idx,
      station: cat.station,
      vat_rate: 0.18,
      is_favorite: Boolean(fav),
      staff_meal_allowed: true,
      track_stock: false,
    }));
    const { error: itemErr } = await supabase.from("menu_items").insert(items);
    must(itemErr, `items ${cat.name}`);
    itemCount += items.length;
  }
  console.log(`    menu ${MENU[plan].length} categories / ${itemCount} items`);
}

async function seedCustomers(restaurantId, plan) {
  const { count } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);
  if ((count ?? 0) > 0) {
    console.log(`    customers already ${count}`);
    return;
  }
  const rows = CUSTOMERS[plan].map((c) => ({
    restaurant_id: restaurantId,
    name: c.name,
    phone: c.phone,
    credit_limit: c.creditLimit,
  }));
  const { error } = await supabase.from("customers").insert(rows);
  must(error, "customers");
  console.log(`    customers ${rows.length}`);
}

async function main() {
  console.log(`\nSeeding test venues for ${OWNER_EMAIL}\n`);
  const owner = await findOwnerUserId();
  if (owner?.owner_user_id) {
    console.log(`Found owner_user_id ${owner.owner_user_id}`);
  } else {
    console.log("No existing owner_user_id — licenses will be assigned by email only.");
  }

  const created = [];
  for (const spec of VENUES) {
    console.log(`\n[${spec.plan}] ${spec.name}`);
    const venue = await ensureVenue(spec, owner);
    await seedTables(venue.id, spec.plan);
    await seedStaff(venue.id, spec.plan);
    await seedMenu(venue.id, spec.plan);
    await seedCustomers(venue.id, spec.plan);
    created.push({ ...spec, licenseKey: venue.license_key, id: venue.id });
  }

  console.log("\nDone.\n");
  for (const v of created) {
    console.log(`${v.name} (${v.plan})`);
    console.log(`  License: ${v.licenseKey}`);
    console.log(`  PIN admin: 1234   waiter: 1111`);
  }
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  process.exit(1);
});
