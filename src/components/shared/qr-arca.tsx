"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** QR de la factura electrónica (RG 4892) como imagen. La URL sale de `urlQrArca`. */
export function QrArca({ url, size = 96, className }: { url: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    import("qrcode")
      .then((q) => q.toDataURL(url, { margin: 0, width: size * 2, errorCorrectionLevel: "M" }))
      .then((d) => vigente && setSrc(d))
      .catch(() => vigente && setSrc(null));
    return () => {
      vigente = false;
    };
  }, [url, size]);

  if (!src) return <div className={cn("bg-subtle", className)} style={{ width: size, height: size }} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="Código QR de ARCA" className={className} />;
}
