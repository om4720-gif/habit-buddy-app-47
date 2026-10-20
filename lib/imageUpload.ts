/** Shrinks a photo to a JPEG of at most `maxDim` pixels so it uploads quickly. */
export async function toJpegBase64(file: File, maxDim = 1600, quality = 0.82): Promise<{ base64: string; mime: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't prepare that image.");
  ctx.fillStyle = "#fff"; // transparent screenshots become white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return { base64: canvas.toDataURL("image/jpeg", quality).split(",")[1] ?? "", mime: "image/jpeg" };
}
