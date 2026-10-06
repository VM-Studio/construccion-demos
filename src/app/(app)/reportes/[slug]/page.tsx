import type { Metadata } from "next";
import { REPORTES } from "@/components/modulos/reportes/catalogo";
import { ReporteSlug } from "@/components/modulos/reportes/reporte-slug";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: REPORTES.find((r) => r.slug === slug)?.titulo ?? "Reporte" };
}

export function generateStaticParams() {
  return REPORTES.map((r) => ({ slug: r.slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <RequierePermiso permiso="reportes.ver">
      <ReporteSlug slug={slug} />
    </RequierePermiso>
  );
}
