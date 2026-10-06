"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DespachosLista } from "./despachos-lista";
import { HojaRutaTab } from "./hoja-ruta";
import { FlotaTab } from "./flota";
import { DespachoSheet } from "./despacho-sheet";

export function DespachosView() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") ?? "despachos";
  const despachoId = params.get("despacho");
  const url = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(extra)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const q = p.toString();
    return q ? `/despachos?${q}` : "/despachos";
  };
  const abrir = (id: string) => router.replace(url({ despacho: id }), { scroll: false });
  return (
    <>
      <PageHeader titulo="Despachos" descripcion="Remitos, hoja de ruta por vehículo y entregas. El stock se descuenta cuando el camión sale." />
      <Tabs value={tab} onValueChange={(v) => router.replace(url({ tab: v, despacho: null, fecha: null }), { scroll: false })}>
        <TabsList className="mb-4">
          <TabsTrigger value="despachos">Despachos</TabsTrigger>
          <TabsTrigger value="hoja">Hoja de ruta</TabsTrigger>
          <TabsTrigger value="flota">Vehículos y choferes</TabsTrigger>
        </TabsList>
        <TabsContent value="despachos"><DespachosLista fechaFiltro={params.get("fecha")} onAbrir={abrir} /></TabsContent>
        <TabsContent value="hoja"><HojaRutaTab onAbrir={abrir} /></TabsContent>
        <TabsContent value="flota"><FlotaTab onAbrirDespacho={abrir} /></TabsContent>
      </Tabs>
      <DespachoSheet id={despachoId} onClose={() => router.replace(url({ despacho: null }), { scroll: false })} />
    </>
  );
}
