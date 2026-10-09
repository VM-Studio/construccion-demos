import type { Metadata } from "next";
import { Suspense } from "react";
import { AyudaView } from "@/components/modulos/ayuda/ayuda-view";

export const metadata: Metadata = { title: "Ayuda" };
export const dynamic = "force-dynamic";

/** Guía de uso, preguntas frecuentes y contacto de soporte (de variables de entorno). */
export default function AyudaPage() {
  const soporte = { email: process.env.SOPORTE_EMAIL ?? null, whatsapp: process.env.SOPORTE_WHATSAPP ?? null };
  return (
    <Suspense>
      <AyudaView soporte={soporte} />
    </Suspense>
  );
}
