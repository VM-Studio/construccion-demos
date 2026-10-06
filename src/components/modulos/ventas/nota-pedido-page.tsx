"use client";
import { useRouter } from "next/navigation";
import { useDb } from "@/store/selectors";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NotaPedidoEditor } from "./nota-pedido-editor";
import { NotaPedidoDetalle } from "./nota-pedido-detalle";

/** Borrador → editor; confirmada → detalle. */
export function NotaPedidoPage({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const np = db.notasPedido.find((n) => n.id === id);
  if (!np)
    return (
      <Card>
        <EmptyState titulo="Nota de pedido inexistente" accion={<Button onClick={() => router.push("/ventas/notas-pedido")}>Volver</Button>} />
      </Card>
    );
  return np.estado === "BORRADOR" ? <NotaPedidoEditor key={np.id} borrador={np} /> : <NotaPedidoDetalle np={np} />;
}
