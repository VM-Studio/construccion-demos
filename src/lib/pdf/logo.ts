/**
 * Logo sin fondo (`/logo-sinfondo.png`) listo para jsPDF: se recorta al contenido visible
 * (sin el margen transparente) y se achica para que el PDF no pese de más. Se carga una vez.
 */
export const LOGO_SIN_FONDO = "/logo-sinfondo.png";

export interface LogoPdf {
  dataUrl: string;
  /** Proporción ancho / alto del logo recortado. */
  proporcion: number;
}

let cache: Promise<LogoPdf | null> | null = null;

export function cargarLogoPdf(): Promise<LogoPdf | null> {
  cache ??= leer().catch(() => {
    cache = null;
    return null;
  });
  return cache;
}

async function leer(): Promise<LogoPdf | null> {
  if (typeof document === "undefined") return null;
  const img = new Image();
  img.src = LOGO_SIN_FONDO;
  await img.decode();
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const base = document.createElement("canvas");
  base.width = w;
  base.height = h;
  const ctx = base.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  // Caja del contenido visible (alfa > 0).
  const px = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (px[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const escala = Math.min(1, 600 / ch);
  const out = document.createElement("canvas");
  out.width = Math.round(cw * escala);
  out.height = Math.round(ch * escala);
  out.getContext("2d")!.drawImage(base, x0, y0, cw, ch, 0, 0, out.width, out.height);
  return { dataUrl: out.toDataURL("image/png"), proporcion: cw / ch };
}
