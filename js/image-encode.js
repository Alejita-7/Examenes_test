// Reduce y codifica una imagen subida por el profesor (solo navegador: usa canvas).
// Objetivo: que pese poco para guardarse en una celda de Google Sheets y cargar rápido en los móviles.
import { MAX_IMAGE_CHARS, ALLOWED_MIME, fitSize, parseDataUrl } from "./images.js";

const SIZES = [1000, 800, 640, 480]; // lado mayor, en píxeles
const PNG_PREFERRED_CHARS = 160000; // si el PNG cabe en esto (dibujos, esquemas), se conserva como PNG
const JPEG_QUALITIES = [0.85, 0.72, 0.6];

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("No se ha podido leer la imagen."));
    r.readAsDataURL(blob);
  });

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * @param {File} file PNG, JPEG, WebP o GIF
 * @returns {Promise<{mime:string, data:string, chars:number, width:number, height:number, url:string}>}
 */
export async function prepareImage(file) {
  if (!ALLOWED_MIME.includes(file.type)) throw new Error(`«${file.name}» no es una imagen PNG, JPEG, WebP o GIF.`);
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`«${file.name}» no se puede abrir como imagen.`);
  }
  try {
    for (const max of SIZES) {
      const { width, height } = fitSize(bitmap.width, bitmap.height, max);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      // Fondo blanco: los PNG con transparencia no se vuelven negros al pasar a JPEG.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);

      const candidates = [];
      const png = await toBlob(canvas, "image/png");
      if (png) candidates.push(png);
      if (!png || png.size * (4 / 3) > PNG_PREFERRED_CHARS) {
        for (const q of JPEG_QUALITIES) {
          const jpg = await toBlob(canvas, "image/jpeg", q);
          if (jpg) candidates.push(jpg);
          if (jpg && jpg.size * (4 / 3) <= MAX_IMAGE_CHARS) break;
        }
      }
      // Entre los que caben, el PNG si es pequeño (nítido en esquemas); si no, el más ligero.
      const fits = candidates.filter((b) => b.size * (4 / 3) <= MAX_IMAGE_CHARS);
      const best = fits.find((b) => b.type === "image/png" && b.size * (4 / 3) <= PNG_PREFERRED_CHARS) ?? fits.sort((a, b) => a.size - b.size)[0];
      if (best) {
        const url = await blobToDataUrl(best);
        const parsed = parseDataUrl(url);
        if (parsed) return { mime: parsed.mime, data: parsed.data, chars: parsed.data.length, width, height, url };
      }
    }
  } finally {
    bitmap.close?.();
  }
  throw new Error(`«${file.name}» es demasiado detallada para reducirla lo suficiente. Prueba con una imagen más pequeña.`);
}
