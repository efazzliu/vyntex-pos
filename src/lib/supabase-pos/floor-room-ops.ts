import {
  FLOOR_ROOMS_PREF_KEY,
  GENERAL_PREFS_NEED_COLUMN,
  patchGeneralPrefsKey,
  readGeneralPrefsKey,
} from "./general-prefs-store.ts";

export { FLOOR_ROOMS_PREF_KEY };

/** Room size the owner set in the Floor Plan editor (metres), per zone name. */
export type FloorRoomSize = { widthM: number; heightM: number };

/** Thrown when the database has no `pos_general_prefs` column (migration 044 not applied). */
export const FLOOR_ROOMS_NEED_COLUMN = GENERAL_PREFS_NEED_COLUMN;

function parseRooms(raw: unknown): Record<string, FloorRoomSize> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, FloorRoomSize> = {};
  for (const [zone, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const o = value as Record<string, unknown>;
    const widthM = Number(o.widthM);
    const heightM = Number(o.heightM);
    if (Number.isFinite(widthM) && Number.isFinite(heightM) && widthM > 0 && heightM > 0) {
      out[zone] = { widthM, heightM };
    }
  }
  return out;
}

function writeRooms(
  licenseKey: string,
  mutate: (rooms: Record<string, FloorRoomSize>) => Record<string, FloorRoomSize>,
) {
  return patchGeneralPrefsKey(licenseKey, FLOOR_ROOMS_PREF_KEY, (current) => mutate(parseRooms(current)));
}

export async function getFloorRooms(licenseKey: string): Promise<Record<string, FloorRoomSize>> {
  try {
    return parseRooms(await readGeneralPrefsKey(licenseKey, FLOOR_ROOMS_PREF_KEY));
  } catch {
    return {};
  }
}

/** `widthM`/`heightM` null: back to the automatic size (tables + 2 m). */
export async function setFloorRoom(args: {
  licenseKey: string;
  zone: string;
  widthM: number | null;
  heightM: number | null;
}) {
  const zone = args.zone.trim();
  if (!zone) throw new Error("Zone is required");
  await writeRooms(args.licenseKey, (rooms) => {
    const next = { ...rooms };
    if (args.widthM == null || args.heightM == null) {
      delete next[zone];
    } else {
      next[zone] = {
        widthM: Math.round(args.widthM * 100) / 100,
        heightM: Math.round(args.heightM * 100) / 100,
      };
    }
    return next;
  });
}

/** Keeps a zone's room size when the zone is renamed or drops it when the zone is deleted. */
export async function moveFloorRoom(licenseKey: string, from: string, to: string | null) {
  const rooms = await getFloorRooms(licenseKey);
  if (!rooms[from]) return;
  await writeRooms(licenseKey, (current) => {
    const next = { ...current };
    const size = next[from];
    delete next[from];
    if (to && size) next[to] = size;
    return next;
  });
}
