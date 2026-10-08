"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Plus, ShoppingCart } from "lucide-react";
import { useDb, usePuede, useSucursalActiva } from "@/store/selectors";
import type { OrdenCompra } from "@/domain/types";
import { ESTADOS } from "@/domain/estados";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { DateRangePicker } from "@/components/shared/filter-bar";
import { Combobox } from "@/components/shared/combobox";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDate, formatMoney } from "@/lib/format";
import { diaLocal, enPeriodo, periodoDesdePreset, type Periodo } from "@/lib/periodos";
import { nombreUsuario } from "@/lib/referencias";
import { cn } from "@/lib/utils";
import { RecepcionDialog } from "./recepcion-dialog";

const ESTADOS_OC = Object.keys(ESTADOS)
  .filter((k) => k.startsWith("OC."))
  .map((k) => ({ value: k.slice(3), label: ESTADOS[k].label }));

/** Porcentaje recibido ponderado por valor (no por unidades, que mezclan bolsas con ladrillos). */
const pctRecibido = (o: OrdenCompra) => {
  const p = o.items.reduce((a, i) => a + i.cantidadPedida * i.costoUnitario, 0);
  return p ? o.items.reduce((a, i) => a + Math.min(i.cantidadPedida, i.cantidadRecibida) * i.costoUnitario, 0) / p : 0;
};

export function OrdenesTab({ filtroInicial }: { filtroInicial?: string | null }) {
  const db = useDb();
  const router = useRouter();
  const sucursalId = useSucursalActiva();
  const verCostos = usePuede("margenes.ver");
  const puedeCrear = usePuede("compras.editar");
  const puedeRecibir = usePuede("compras.recibir");
  const [estado, setEstado] = React.useState("");
  const [proveedor, setProveedor] = React.useState("");
  const [deposito, setDeposito] = React.useState("");
  const [atrasadas, setAtrasadas] = React.useState(filtroInicial === "atrasadas");
  const [periodo, setPeriodo] = React.useState<Periodo>(() => periodoDesdePreset("90D"));
  const [buscarOC, setBuscarOC] = React.useState(false);
  const [ocRecibir, setOcRecibirId] = React.useState<string | null>(null);
  const [recibirOpen, setRecibirOpen] = React.useState(false);
  const setOcRecibir = (id: string) => {
    setOcRecibirId(id);
    setRecibirOpen(true);
  };
  React.useEffect(() => setAtrasadas(filtroInicial === "atrasadas"), [filtroInicial]);

  const hoy = diaLocal(new Date());
  const esAtrasada = (o: OrdenCompra) => (o.estado === "CONFIRMADA" || o.estado === "RECIBIDA_PARCIAL") && diaLocal(o.fechaEntregaEstimada) < hoy;
  const base = db.ordenesCompra.filter((o) => !sucursalId || o.sucursalId === sucursalId);
  const filas = base.filter(
    (o) =>
      (!estado || o.estado === estado) &&
      (!proveedor || o.proveedorId === proveedor) &&
      (!deposito || o.depositoDestinoId === deposito) &&
      (!atrasadas || esAtrasada(o)) &&
      (atrasadas || estado || o.estado === "BORRADOR" || o.estado === "ENVIADA" || o.estado === "CONFIRMADA" || o.estado === "RECIBIDA_PARCIAL" || enPeriodo(o.fechaEmision, periodo)),
  );
  const abiertas = base.filter((o) => ["ENVIADA", "CONFIRMADA", "RECIBIDA_PARCIAL"].includes(o.estado));
  const comprometido = abiertas.reduce((a, o) => a + o.total * (1 - pctRecibido(o)), 0);
  const mesActual = diaLocal(new Date()).slice(0, 7);
  const retirosAcopioMes = base.filter((o) => o.origen === "ACOPIO" && diaLocal(o.fechaEmision).slice(0, 7) === diaLocal(new Date()).slice(0, 7)).length;
  const recibidasMes = db.recepciones.filter((r) => diaLocal(r.fecha).slice(0, 7) === mesActual && (!sucursalId || db.ordenesCompra.find((o) => o.id === r.ordenCompraId)?.sucursalId === sucursalId)).length;
  const prov = (id: string) => db.proveedores.find((p) => p.id === id)?.razonSocial ?? "";

  const columnas: Column<OrdenCompra>[] = [
    { key: "numero", header: "Número", sortable: true, sortValue: (o) => o.numero, cell: (o) => <span className="whitespace-nowrap font-mono text-[12px]">{o.numero}</span> },
    { key: "origen", header: "Origen", cell: (o) => (o.origen === "ACOPIO" ? <Badge variant="accent" className="whitespace-nowrap">Acopio {db.acopiosProveedor.find((a) => a.id === o.acopioProveedorId)?.numero.replace(/^ACP\d /, "")}</Badge> : <Badge>Nueva</Badge>) },
    { key: "circ", header: "Circuito", cell: (o) => <CircuitoBadge circuito={o.circuito} corto /> },
    { key: "proveedor", header: "Proveedor", sortable: true, sortValue: (o) => prov(o.proveedorId), cell: (o) => <span className="block min-w-[180px]">{prov(o.proveedorId)}</span> },
    { key: "deposito", header: "Destino", hideOnMobile: true, cell: (o) => <span className="whitespace-nowrap text-muted">{db.depositos.find((d) => d.id === o.depositoDestinoId)?.nombre}</span> },
    { key: "emision", header: "Emisión", sortable: true, sortValue: (o) => o.fechaEmision, cell: (o) => <span className="text-muted">{formatDate(o.fechaEmision)}</span> },
    { key: "entrega", header: "Entrega est.", sortable: true, sortValue: (o) => o.fechaEntregaEstimada, cell: (o) => <span className={cn("whitespace-nowrap", esAtrasada(o) ? "font-medium text-danger" : "text-muted")}>{formatDate(o.fechaEntregaEstimada)}</span> },
    { key: "estado", header: "Estado", sortable: true, sortValue: (o) => o.estado, cell: (o) => <StatusBadge tipo="OC" estado={o.estado} /> },
    ...(verCostos ? [{ key: "total", header: "Total", align: "right" as const, sortable: true, sortValue: (o: OrdenCompra) => o.total, cell: (o: OrdenCompra) => <span className="tnum">{formatMoney(o.total, { decimals: false })}</span> }] : []),
    {
      key: "recibido",
      header: "% recibido",
      width: 120,
      sortable: true,
      sortValue: pctRecibido,
      cell: (o) => (
        <div className="flex items-center gap-2">
          <Progress value={pctRecibido(o)} className="w-16" tone={pctRecibido(o) >= 1 ? "success" : "ink"} />
          <span className="text-[12px] text-muted tnum">{Math.round(pctRecibido(o) * 100)} %</span>
        </div>
      ),
    },
    { key: "usuario", header: "Usuario", hideOnMobile: true, cell: (o) => <span className="whitespace-nowrap text-muted">{nombreUsuario(db, o.usuarioId)}</span> },
  ];

  const pendientes = base.filter((o) => o.estado === "CONFIRMADA" || o.estado === "RECIBIDA_PARCIAL");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="OC abiertas" valor={String(abiertas.length)} subtexto="enviadas, confirmadas o parciales" />
        {verCostos ? <KpiCard label="$ comprometido en compras" valor={formatMoney(comprometido, { compact: true })} acento subtexto="saldo sin recibir" /> : <KpiCard label="Por recibir" valor={String(pendientes.length)} acento />}
        <KpiCard label="Atrasadas" valor={String(base.filter(esAtrasada).length)} subtexto={<button className="font-medium text-danger hover:underline" onClick={() => setAtrasadas(true)}>Ver atrasadas</button>} />
        <KpiCard label="Retiradas de acopio este mes" valor={String(retirosAcopioMes)} subtexto={`${recibidasMes} recepciones este mes`} />
      </div>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(o) => o.id}
        searchText={(o) => `${o.numero} ${prov(o.proveedorId)}`}
        searchPlaceholder="Número o proveedor"
        onRowClick={(o) => router.push(`/compras/oc/${o.id}`)}
        initialSort={{ key: "emision", dir: "desc" }}
        rowClassName={(o) => (esAtrasada(o) ? "bg-danger-soft/40" : undefined)}
        empty={base.length ? { icono: ShoppingCart, titulo: "No hay órdenes de compra para el filtro" } : <VacioGuiado pagina="ordenesCompra" icono={ShoppingCart} puedeAccion={puedeCrear} />}
        filters={
          <>
            <DateRangePicker value={periodo} onChange={setPeriodo} presets={[{ value: "MES", label: "Este mes" }, { value: "30D", label: "30 días" }, { value: "90D", label: "90 días" }]} />
            <Select size="sm" className="w-[150px]" aria-label="Estado" value={estado} onValueChange={setEstado} options={[{ value: "", label: "Todos los estados" }, ...ESTADOS_OC]} />
            <Select size="sm" className="w-[190px]" aria-label="Proveedor" value={proveedor} onValueChange={setProveedor} options={[{ value: "", label: "Todos los proveedores" }, ...db.proveedores.map((p) => ({ value: p.id, label: p.razonSocial }))]} />
            <Select size="sm" className="w-[160px]" aria-label="Depósito" value={deposito} onValueChange={setDeposito} options={[{ value: "", label: "Todos los depósitos" }, ...db.depositos.map((d) => ({ value: d.id, label: d.nombre }))]} />
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <Checkbox checked={atrasadas} onCheckedChange={(v) => setAtrasadas(!!v)} /> Atrasadas
            </label>
          </>
        }
        actions={
          <>
            {puedeRecibir && (
              <Button size="sm" variant="secondary" onClick={() => setBuscarOC(true)}>
                <PackageCheck /> Recibir mercadería
              </Button>
            )}
            {puedeCrear && (
              <Button size="sm" onClick={() => router.push("/compras/oc/nueva")}>
                <Plus /> Nueva OC
              </Button>
            )}
          </>
        }
      />
      <Dialog open={buscarOC} onOpenChange={setBuscarOC}>
        <DialogContent title="Recibir mercadería" description="Llegó el camión: buscá la orden de compra por número o proveedor.">
          <Combobox
            aria-label="Orden de compra pendiente"
            value=""
            onChange={(v) => {
              setBuscarOC(false);
              setOcRecibir(v);
            }}
            placeholder="Buscar OC pendiente…"
            vacio="No hay órdenes pendientes de recibir"
            opciones={pendientes.map((o) => ({ value: o.id, label: `${o.numero} · ${prov(o.proveedorId)}`, detalle: `llega ${formatDate(o.fechaEntregaEstimada)}` }))}
          />
          {!pendientes.length && (
            <div className="mt-3 rounded-card border border-border bg-subtle p-3 text-[13px] text-muted">
              Para recibir mercadería tiene que haber una orden de compra confirmada: creala, enviala al proveedor y confirmala; ahí aparece acá.
              {puedeCrear && (
                <div className="mt-2">
                  <Button size="sm" variant="secondary" onClick={() => router.push("/compras/oc/nueva")}><Plus /> Nueva orden de compra</Button>
                </div>
              )}
            </div>
          )}
          <ul className={cn("mt-3 divide-y divide-border rounded-card border border-border", !pendientes.length && "hidden")}>
            {pendientes.map((o) => (
              <li key={o.id}>
                <button
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] hover:bg-subtle"
                  onClick={() => {
                    setBuscarOC(false);
                    setOcRecibir(o.id);
                  }}
                >
                  <span className="font-mono text-[12px]">{o.numero}</span>
                  <span className="flex-1 truncate">{prov(o.proveedorId)}</span>
                  <StatusBadge tipo="OC" estado={o.estado} />
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
      <RecepcionDialog ordenCompraId={ocRecibir} open={recibirOpen} onOpenChange={setRecibirOpen} />
    </div>
  );
}
