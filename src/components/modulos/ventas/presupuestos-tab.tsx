"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { addDays, differenceInCalendarDays } from "date-fns";
import { FileSpreadsheet, Plus } from "lucide-react";
import { useDb, usePuede, useSucursalActiva } from "@/store/selectors";
import type { Presupuesto } from "@/domain/types";
import { ESTADOS } from "@/domain/estados";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { nombreUsuario } from "@/lib/referencias";
import { cn } from "@/lib/utils";

/** Estado derivado: un presupuesto enviado pasa a VENCIDO cuando se cumple la validez. */
export function estadoPresupuesto(p: Presupuesto): Presupuesto["estado"] {
  if (p.estado === "ENVIADO" && differenceInCalendarDays(new Date(), addDays(new Date(p.fecha), p.validezDias)) > 0) return "VENCIDO";
  return p.estado;
}

export function PresupuestosTab() {
  const db = useDb();
  const router = useRouter();
  const sucursalId = useSucursalActiva();
  const puedeCrear = usePuede("ventas.editar");
  const [estado, setEstado] = React.useState("");
  const cli = (id: string) => db.clientes.find((c) => c.id === id);
  const filas = db.presupuestos.filter((p) => (!sucursalId || p.sucursalId === sucursalId) && (!estado || estadoPresupuesto(p) === estado));

  const columnas: Column<Presupuesto>[] = [
    { key: "numero", header: "Número", sortable: true, sortValue: (p) => p.numero, cell: (p) => <span className="whitespace-nowrap font-mono text-[12px]">{p.numero}</span> },
    { key: "cliente", header: "Cliente", sortable: true, sortValue: (p) => cli(p.clienteId)?.razonSocial ?? "", cell: (p) => <span className="block min-w-[160px]">{cli(p.clienteId)?.nombreFantasia ?? cli(p.clienteId)?.razonSocial}</span> },
    { key: "vendedor", header: "Vendedor", hideOnMobile: true, cell: (p) => <span className="whitespace-nowrap text-muted">{nombreUsuario(db, p.vendedorId)}</span> },
    { key: "fecha", header: "Fecha", sortable: true, sortValue: (p) => p.fecha, cell: (p) => <span className="text-muted">{formatDate(p.fecha)}</span> },
    {
      key: "vence",
      header: "Vence en",
      sortable: true,
      sortValue: (p) => addDays(new Date(p.fecha), p.validezDias).toISOString(),
      cell: (p) => {
        const d = differenceInCalendarDays(addDays(new Date(p.fecha), p.validezDias), new Date());
        const abierto = p.estado === "BORRADOR" || p.estado === "ENVIADO";
        return abierto ? <span className={cn("whitespace-nowrap tnum", d < 0 ? "text-danger" : d <= 2 ? "text-warning" : "text-muted")}>{d < 0 ? `venció hace ${-d} d` : d === 0 ? "hoy" : `${d} días`}</span> : <span className="text-disabled">—</span>;
      },
    },
    { key: "estado", header: "Estado", sortable: true, sortValue: (p) => estadoPresupuesto(p), cell: (p) => <StatusBadge tipo="PRESUPUESTO" estado={estadoPresupuesto(p)} /> },
    { key: "pedido", header: "Pedido", hideOnMobile: true, cell: (p) => (p.pedidoId ? <span className="font-mono text-[12px]">{db.pedidos.find((x) => x.id === p.pedidoId)?.numero}</span> : <span className="text-disabled">—</span>) },
    { key: "total", header: "Total", align: "right", sortable: true, sortValue: (p) => p.total, cell: (p) => <span className="tnum">{formatMoney(p.total, { decimals: false })}</span> },
  ];

  return (
    <DataTable
      rows={filas}
      columns={columnas}
      getRowId={(p) => p.id}
      searchText={(p) => `${p.numero} ${cli(p.clienteId)?.razonSocial}`}
      searchPlaceholder="Número o cliente"
      onRowClick={(p) => router.push(`/ventas/presupuestos/${p.id}`)}
      initialSort={{ key: "fecha", dir: "desc" }}
      empty={{ icono: FileSpreadsheet, titulo: "No hay presupuestos", accion: puedeCrear ? <Button size="sm" onClick={() => router.push("/ventas/presupuestos/nuevo")}><Plus />Nuevo presupuesto</Button> : undefined }}
      filters={<Select size="sm" className="w-[160px]" aria-label="Estado" value={estado} onValueChange={setEstado} options={[{ value: "", label: "Todos los estados" }, ...Object.keys(ESTADOS).filter((k) => k.startsWith("PRESUPUESTO.")).map((k) => ({ value: k.slice(12), label: ESTADOS[k].label }))]} />}
      actions={puedeCrear && <Button size="sm" onClick={() => router.push("/ventas/presupuestos/nuevo")}><Plus /> Nuevo presupuesto</Button>}
    />
  );
}
