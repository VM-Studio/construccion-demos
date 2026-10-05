"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PackageCheck, Plus } from "lucide-react";
import { usePuede } from "@/store/selectors";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { OrdenesTab } from "./ordenes-tab";
import { RecepcionesTab } from "./recepciones-tab";
import { ProveedoresTab } from "./proveedores-tab";

export function ComprasView() {
  const params = useSearchParams();
  const router = useRouter();
  const puedeCrear = usePuede("compras.editar");
  const puedeProv = usePuede("proveedores.editar");
  const verProveedores = puedeCrear || puedeProv;
  const tab = params.get("tab") ?? (params.get("proveedor") ? "proveedores" : "ordenes");
  return (
    <>
      <PageHeader
        titulo="Compras"
        descripcion={puedeCrear ? "Órdenes de compra, ingreso de mercadería y proveedores." : "Ingreso de mercadería contra órdenes de compra."}
        acciones={
          puedeCrear ? (
            <Button onClick={() => router.push("/compras/oc/nueva")}>
              <Plus /> Nueva orden de compra
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => router.replace("/compras?tab=ordenes")}>
              <PackageCheck /> Recibir mercadería
            </Button>
          )
        }
      />
      <Tabs value={tab} onValueChange={(v) => router.replace(`/compras?tab=${v}`, { scroll: false })}>
        <TabsList className="mb-4">
          <TabsTrigger value="ordenes">Órdenes de compra</TabsTrigger>
          <TabsTrigger value="recepciones">Recepciones</TabsTrigger>
          {verProveedores && <TabsTrigger value="proveedores">Proveedores</TabsTrigger>}
        </TabsList>
        <TabsContent value="ordenes">
          <OrdenesTab filtroInicial={params.get("filtro")} />
        </TabsContent>
        <TabsContent value="recepciones">
          <RecepcionesTab abrirId={params.get("id")} />
        </TabsContent>
        {verProveedores && (
          <TabsContent value="proveedores">
            <ProveedoresTab abrirId={params.get("proveedor")} />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
