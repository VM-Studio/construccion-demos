"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { usePuede } from "@/store/selectors";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { OrdenesTab } from "./ordenes-tab";
import { RecepcionesTab } from "./recepciones-tab";

export function ComprasView({ tab }: { tab: "ordenes" | "recepciones" }) {
  const params = useSearchParams();
  const router = useRouter();
  const puedeCrear = usePuede("compras.editar");
  return (
    <>
      <PageHeader
        titulo={tab === "ordenes" ? "Órdenes de compra" : "Ingreso de mercadería"}
        descripcion={tab === "ordenes" ? "Órdenes nuevas y retiros de acopios con proveedores." : "Recepciones contra órdenes de compra: actualizan stock y costo promedio."}
        acciones={
          puedeCrear && tab === "ordenes" ? (
            <Button onClick={() => router.push("/compras/oc/nueva")}>
              <Plus /> Nueva orden de compra
            </Button>
          ) : undefined
        }
      />
      {tab === "ordenes" ? <OrdenesTab filtroInicial={params.get("filtro")} /> : <RecepcionesTab abrirId={params.get("id")} />}
    </>
  );
}
