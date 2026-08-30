import { ok, fail, withErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { uploadFromFile, isCloudinaryConfigured } from "@/lib/cloudinary";

const ALLOWED_KINDS = new Set(["image", "video", "auto", "raw"]);

export const POST = withErrorHandling(async (request) => {
  await requireAuth();

  if (!isCloudinaryConfigured()) {
    return fail("Cloudinary is not configured on the server.", 500);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return fail("Invalid upload request.", 400);
  }

  const file = form.get("file");
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return fail("No file provided.", 400);
  }

  const folderParam = String(form.get("folder") || "").trim();
  const kindParam = String(form.get("kind") || "auto").trim();
  const kind = ALLOWED_KINDS.has(kindParam) ? kindParam : "auto";
  const folder = folderParam
    ? `estovia/${folderParam.replace(/[^a-zA-Z0-9_-]/g, "")}`
    : "estovia/uploads";

  // Videos may be up to 30 MB. Images and documents are capped at 10 MB.
  const videoMaxBytes = 30 * 1024 * 1024; // 30 MB
  const docMaxBytes = 10 * 1024 * 1024; // 10 MB
  const isVideo = kind === "video" || file.type?.startsWith("video/");

  if (isVideo && file.size > videoMaxBytes) {
    return fail("Video is too large. Maximum size is 30 MB.", 400);
  }
  if (!isVideo && file.size > docMaxBytes) {
    return fail("File is too large. Maximum size is 10 MB.", 400);
  }

  // Cloudinary resource type: video for videos, image for images, otherwise
  // "auto" (Cloudinary inspects the uploaded file).
  const resourceType = isVideo ? "video" : kind === "image" ? "image" : "auto";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFromFile(buffer, folder, { resourceType });
    return ok({
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      mediaType: isVideo ? "video" : file.type?.startsWith("image/") ? "image" : "document",
      width: result.width,
      height: result.height,
      bytes: result.bytes,
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return fail("Upload failed. Please try again.", 500);
  }
});
