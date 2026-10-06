"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FileSpreadsheet, Plus } from "lucide-react";
import { usePuede } from "@/store/selectors";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PedidosTab } from "./pedidos-tab";
import { PresupuestosTab } from "./presupuestos-tab";
import { ComprobantesTab } from "./comprobantes-tab";
import { ClientesTab } from "./clientes-tab";

export function VentasView() {
  const params = useSearchParams();
  const router = useRouter();
  const puedeCrear = usePuede("ventas.editar");
  const tab = params.get("tab") ?? (params.get("cliente") ? "clientes" : "pedidos");
  return (
    <>
      <PageHeader
        titulo="Ventas"
        descripcion="Presupuestos, pedidos, facturación y clientes, con la rentabilidad de cada operación."
        acciones={
          puedeCrear && (
            <>
              <Button variant="secondary" onClick={() => router.push("/ventas/presupuestos/nuevo")}>
                <FileSpreadsheet /> Nuevo presupuesto
              </Button>
              <Button onClick={() => router.push("/ventas/pedidos/nuevo")}>
                <Plus /> Nuevo pedido
              </Button>
            </>
          )
        }
      />
      <Tabs value={tab} onValueChange={(v) => router.replace(`/ventas?tab=${v}`, { scroll: false })}>
        <TabsList className="mb-4">
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="presupuestos">Presupuestos</TabsTrigger>
          <TabsTrigger value="comprobantes">Comprobantes</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
        </TabsList>
        <TabsContent value="pedidos"><PedidosTab /></TabsContent>
        <TabsContent value="presupuestos"><PresupuestosTab /></TabsContent>
        <TabsContent value="comprobantes"><ComprobantesTab /></TabsContent>
        <TabsContent value="clientes"><ClientesTab abrirId={params.get("cliente")} /></TabsContent>
      </Tabs>
    </>
  );
}
