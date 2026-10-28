import { supabase } from "@/lib/supabase.ts";
import { getRestaurantByLicense } from "./restaurant.ts";

const BUCKET = "menu-photos";
const MAX_OFFLINE_EDGE_PX = 1280;
const OFFLINE_JPEG_QUALITY = 0.82;

function safeImageExt(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
}

function isDataImageUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

async function fileToCompressedDataUrl(file: File): Promise<string> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(
        1,
        MAX_OFFLINE_EDGE_PX / Math.max(bitmap.width, bitmap.height, 1),
      );
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      return canvas.toDataURL("image/jpeg", OFFLINE_JPEG_QUALITY);
    } catch {
      /* fall through to FileReader */
    }
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string" && result.startsWith("data:")) {
        resolve(result);
      } else {
        reject(new Error("Could not read image"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image data URL");
  const mime = match[1].toLowerCase();
  const b64 = match[2];
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext =
    mime.includes("png")
      ? "png"
      : mime.includes("webp")
        ? "webp"
        : mime.includes("gif")
          ? "gif"
          : "jpg";
  return { blob: new Blob([bytes], { type: mime }), ext };
}

export async function uploadMenuItemPhoto(args: {
  licenseKey: string;
  file: File;
  itemId?: string;
}): Promise<string> {
  const restaurant = await getRestaurantByLicense(args.licenseKey);
  const ext = safeImageExt(args.file);
  const objectId = args.itemId?.trim() || crypto.randomUUID();
  const path = `${restaurant.id}/${objectId}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, args.file, {
    upsert: true,
    contentType: args.file.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = data.publicUrl;
  if (!url) throw new Error("Could not resolve menu photo URL");
  return `${url}?v=${Date.now()}`;
}

/** Persist a data: URL into Supabase Storage and return the public URL. */
export async function uploadMenuItemPhotoDataUrl(args: {
  licenseKey: string;
  dataUrl: string;
  itemId?: string;
}): Promise<string> {
  if (!isDataImageUrl(args.dataUrl)) {
    throw new Error("Expected a data:image URL");
  }
  const restaurant = await getRestaurantByLicense(args.licenseKey);
  const { blob, ext } = dataUrlToBlob(args.dataUrl);
  const objectId = args.itemId?.trim() || crypto.randomUUID();
  const path = `${restaurant.id}/${objectId}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
  });
  if (uploadError) throw new Error(uploadError.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = data.publicUrl;
  if (!url) throw new Error("Could not resolve menu photo URL");
  return `${url}?v=${Date.now()}`;
}

/**
 * Online: upload to Storage.
 * Offline / upload failure: return a compressed data URL so the item can still
 * be saved locally and uploaded when the offline mutation queue syncs.
 */
export async function resolveMenuItemPhotoForSave(args: {
  licenseKey: string;
  file: File;
  itemId?: string;
}): Promise<{ imageUrl: string; deferredUpload: boolean }> {
  const online =
    typeof navigator === "undefined" ? true : navigator.onLine !== false;
  if (online) {
    try {
      const imageUrl = await uploadMenuItemPhoto(args);
      return { imageUrl, deferredUpload: false };
    } catch {
      /* fall through to local data URL */
    }
  }
  const imageUrl = await fileToCompressedDataUrl(args.file);
  return { imageUrl, deferredUpload: true };
}

/** If mutation args carry a data: image, upload it and replace with a public URL. */
export async function materializeMenuItemImageUrlArg(
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!isDataImageUrl(args.imageUrl)) return args;
  const licenseKey = String(args.licenseKey ?? "");
  if (!licenseKey) return args;
  const itemId =
    typeof args.itemId === "string"
      ? args.itemId
      : typeof args.id === "string"
        ? args.id
        : undefined;
  const imageUrl = await uploadMenuItemPhotoDataUrl({
    licenseKey,
    dataUrl: args.imageUrl,
    itemId,
  });
  return { ...args, imageUrl };
}
