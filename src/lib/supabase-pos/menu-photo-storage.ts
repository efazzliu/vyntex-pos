import { supabase } from "@/lib/supabase.ts";
import { getRestaurantByLicense } from "./restaurant.ts";

const BUCKET = "menu-photos";

function safeImageExt(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
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
