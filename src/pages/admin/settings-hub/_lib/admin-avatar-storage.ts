import { supabase } from "@/lib/supabase.ts";

const BUCKET = "admin-avatars";

export async function uploadAdminAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const path = `${userId}/avatar.${safeExt}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || `image/${safeExt === "jpg" ? "jpeg" : safeExt}`,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = data.publicUrl;
  if (!url) throw new Error("Could not resolve avatar URL");
  return `${url}?v=${Date.now()}`;
}

export async function uploadAdminAvatarFromDataUrl(userId: string, dataUrl: string): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], "avatar.jpg", { type: blob.type || "image/jpeg" });
  return uploadAdminAvatar(userId, file);
}
