"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarPlus, PackageCheck } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede } from "@/store/selectors";
import type { LineaPendiente } from "@/domain/stock";
import type { ModalidadEntrega } from "@/domain/types";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { cn } from "@/lib/utils";
import { Impacto, medir } from "@/capacitacion";

export interface FilaPendiente extends LineaPendiente {
  key: string;
  numeroNP: string;
  origen: string;
  acopioId?: string;
  fechaNP: string;
  programada?: string;
  despacho?: { id: string; numero: string; estado: string; vehiculo?: string; chofer?: string };
  vendedorId: string;
  modalidad: "ENVIO" | "RETIRA";
  dias: number;
}

/** Enriquecer líneas pendientes con NP, acopio y despacho asignado. */
export function useFilasPendientes(lineas: LineaPendiente[]): FilaPendiente[] {
  const db = useDb();
  return React.useMemo(() => {
    const np = new Map(db.notasPedido.map((n) => [n.id, n]));
    const aco = new Map(db.acopios.map((a) => [a.id, a]));
    const desPorItem = new Map<string, (typeof db.despachos)[number]>();
    for (const d of db.despachos) if (d.estado === "ESPERA" || d.estado === "PREPARACION") for (const it of d.items) if (it.itemNPId) desPorItem.set(it.itemNPId, d);
    const hoy = Date.now();
    return lineas.map((l) => {
      const n = np.get(l.notaPedidoId)!;
      const d = desPorItem.get(l.itemId);
      const a = n.acopioId ? aco.get(n.acopioId) : undefined;
      return {
        ...l,
        key: l.itemId,
        numeroNP: n.numero,
        origen: a ? `Acopio ${a.numero}` : "Nueva",
        acopioId: a?.id,
        fechaNP: n.fecha,
        programada: d?.fechaProgramada ?? n.fechaEntregaProgramada,
        despacho: d ? { id: d.id, numero: d.numero, estado: d.estado, vehiculo: db.vehiculos.find((v) => v.id === d.vehiculoId)?.patente, chofer: db.choferes.find((c) => c.id === d.choferId)?.nombre } : undefined,
        vendedorId: n.vendedorId,
        modalidad: d?.modalidad ?? n.modalidadEntrega,
        dias: Math.floor((hoy - Date.parse(n.fecha)) / 86_400_000),
      };
    });
  }, [db, lineas]);
}

/** Diálogo para programar la entrega de líneas pendientes (crea despachos en espera). */
export function ProgramarEntregaDialog({ filas, open, onOpenChange, onListo }: { filas: FilaPendiente[]; open: boolean; onOpenChange: (v: boolean) => void; onListo?: () => void }) {
  const db = useDb();
  const [fecha, setFecha] = React.useState(diaLocal(new Date()));
  const [modalidad, setModalidad] = React.useState<ModalidadEntrega>("ENVIO");
  React.useEffect(() => {
    if (!open || !filas[0]) return;
    setFecha(diaLocal(new Date()));
    setModalidad(db.notasPedido.find((n) => n.id === filas[0].notaPedidoId)?.modalidadEntrega ?? "ENVIO");
  }, [open, filas, db.notasPedido]);
  const confirmar = async () => {
    const [y, m, d] = fecha.split("-").map(Number);
    const r = await medir(
      "programarEntrega",
      { clienteId: filas[0]?.clienteId, productoIds: filas.map((f) => f.productoId), depositoIds: [...new Set(filas.map((f) => f.depositoId))], notaPedidoId: filas[0]?.notaPedidoId },
      () =>
        useStore.getState().programarEntregas(
          filas.map((f) => ({ notaPedidoId: f.notaPedidoId, itemId: f.itemId, cantidad: f.pendiente })),
          { fechaProgramada: new Date(y, m - 1, d, 9).toISOString(), modalidad },
        ),
    );
    if (!r.ok) return toast.error(r.error);
    toast.success(`Entrega programada: ${r.data.join(", ")}`, { description: "Quedó en espera en Despachos." });
    onOpenChange(false);
    onListo?.();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title="Programar entrega" description={`${filas.length} línea${filas.length === 1 ? "" : "s"} · crea el despacho en espera`} footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={confirmar}><CalendarPlus /> Programar</Button></>}>
        <div className="space-y-4">
          <FormField label="Modalidad">
            <Segmented value={modalidad} onChange={setModalidad} options={[{ value: "ENVIO", label: "Envío a obra" }, { value: "RETIRA", label: "Cliente retira" }]} />
          </FormField>
          <FormField label="Fecha programada" htmlFor="pe-f">
            <Input id="pe-f" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </FormField>
          <Impacto accion="programarEntrega" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Tabla de líneas pendientes de entrega con acciones Programar entrega / Retirado en mostrador. */
export function PendientesTabla({ lineas, mostrarCliente, vacio = "No hay entregas pendientes", bare }: { lineas: LineaPendiente[]; mostrarCliente?: boolean; vacio?: string; bare?: boolean }) {
  const db = useDb();
  const puede = usePuede("ventas.editar");
  const filas = useFilasPendientes(lineas);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [programar, setProgramar] = React.useState<FilaPendiente[] | null>(null);
  const prod = (id: string) => db.productos.find((p) => p.id === id);
  const elegidas = filas.filter((f) => sel.has(f.key));

  const retirado = async (fs: FilaPendiente[]) => {
    const porNP = new Map<string, FilaPendiente[]>();
    for (const f of fs) porNP.set(f.notaPedidoId, [...(porNP.get(f.notaPedidoId) ?? []), f]);
    const nums: string[] = [];
    const r = await medir(
      "retiroEnMostrador",
      { clienteId: fs[0]?.clienteId, productoIds: fs.map((f) => f.productoId), depositoIds: [...new Set(fs.map((f) => f.depositoId))], notaPedidoId: fs[0]?.notaPedidoId },
      (): { ok: true } | { ok: false; error: string } => {
        for (const [npId, ls] of porNP) {
          const x = useStore.getState().retiroEnMostrador(npId, ls.map((l) => ({ itemId: l.itemId, cantidad: l.pendiente })));
          if (!x.ok) return { ok: false, error: x.error };
          nums.push(x.data.numero);
        }
        return { ok: true };
      },
    );
    if (!r.ok) return toast.error(r.error);
    toast.success(`Remito hecho: ${nums.join(", ")}`, { description: "Se descontó el stock y se actualizó lo entregado." });
    setSel(new Set());
  };

  const columnas: Column<FilaPendiente>[] = [
    ...(mostrarCliente ? [{ key: "cli", header: "Cliente", sortable: true, sortValue: (f: FilaPendiente) => db.clientes.find((c) => c.id === f.clienteId)?.razonSocial ?? "", cell: (f: FilaPendiente) => <Link href={`/clientes/${f.clienteId}`} onClick={(e) => e.stopPropagation()} className="block min-w-[130px] hover:underline">{db.clientes.find((c) => c.id === f.clienteId)?.nombreFantasia ?? db.clientes.find((c) => c.id === f.clienteId)?.razonSocial}</Link> }] : []),
    { key: "p", header: "Producto", sortable: true, sortValue: (f) => prod(f.productoId)?.codigo ?? "", cell: (f) => <span className="block min-w-[180px]"><span className="mr-1.5 font-mono text-[11px] text-muted">{prod(f.productoId)?.codigo}</span>{prod(f.productoId)?.nombre}</span> },
    { key: "o", header: "Obra", cell: (f) => <span className="text-muted">{db.obras.find((o) => o.id === f.obraId)?.nombre ?? "—"}</span> },
    { key: "q", header: "Pendiente", align: "right", sortable: true, sortValue: (f) => f.pendiente, cell: (f) => <span className="font-medium tnum">{formatQty(f.pendiente, prod(f.productoId)?.unidad ?? "UN")}</span> },
    { key: "$", header: "$ pendiente", align: "right", sortable: true, sortValue: (f) => f.pendiente * f.precio, cell: (f) => <span className="tnum">{formatMoney(f.pendiente * f.precio, { decimals: false })}</span> },
    { key: "np", header: "Origen", cell: (f) => <span className="block whitespace-nowrap"><Link href={`/ventas/notas-pedido/${f.notaPedidoId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[12px] hover:underline">{f.numeroNP}</Link><span className="block text-[11px] text-muted">{f.origen}</span></span> },
    { key: "mo", header: "Modalidad", cell: (f) => <span className="whitespace-nowrap text-[12px] text-muted">{f.modalidad === "ENVIO" ? "Envío" : "Retira"}</span>, hideOnMobile: true },
    { key: "di", header: "Días", align: "right", sortable: true, sortValue: (f) => f.dias, cell: (f) => <span className={cn("tnum", !f.despacho && f.dias > 30 ? "font-semibold text-danger" : "text-muted")}>{f.dias}</span>, hideOnMobile: true },
    { key: "f", header: "Programado", sortable: true, sortValue: (f) => f.programada ?? "9", cell: (f) => <span className={cn("whitespace-nowrap", !f.programada && f.dias > 30 && "font-medium text-danger")}>{f.programada ? formatDate(f.programada) : `Sin fecha · hace ${f.dias} d`}</span> },
    {
      key: "d",
      header: "Despacho",
      cell: (f) =>
        f.despacho ? (
          <Link href={`/despachos?despacho=${f.despacho.id}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-mono text-[11px]">{f.despacho.numero}</span>
            <StatusBadge tipo="DESPACHO" estado={f.despacho.estado} />
            {f.despacho.vehiculo && <span className="text-[11px] text-muted">{f.despacho.vehiculo}{f.despacho.chofer ? ` · ${f.despacho.chofer}` : ""}</span>}
          </Link>
        ) : (
          <Badge variant="warning">Sin programar</Badge>
        ),
    },
    ...(mostrarCliente ? [{ key: "v", header: "Vendedor", cell: (f: FilaPendiente) => <span className="whitespace-nowrap text-[12px] text-muted">{db.usuarios.find((u) => u.id === f.vendedorId)?.nombre ?? "—"}</span>, hideOnMobile: true }] : []),
  ];
  return (
    <>
      <DataTable
        bare={bare}
        rows={filas}
        columns={columnas}
        getRowId={(f) => f.key}
        selectable={puede}
        selected={sel}
        onSelectionChange={setSel}
        searchText={(f) => `${prod(f.productoId)?.nombre} ${f.numeroNP} ${db.obras.find((o) => o.id === f.obraId)?.nombre ?? ""} ${db.clientes.find((c) => c.id === f.clienteId)?.razonSocial ?? ""}`}
        initialSort={{ key: "f", dir: "asc" }}
        empty={{ icono: PackageCheck, titulo: vacio }}
        actions={
          puede ? (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={!elegidas.length} onClick={() => setProgramar(elegidas)}>
                <CalendarPlus /> Programar entrega
              </Button>
              <Button size="sm" variant="secondary" disabled={!elegidas.length} onClick={() => retirado(elegidas)}>
                <PackageCheck /> Retirado en mostrador
              </Button>
            </div>
          ) : undefined
        }
      />
      {puede && elegidas.length > 0 && <Impacto accion="retiroEnMostrador" className="mt-2" />}
      <ProgramarEntregaDialog filas={programar ?? []} open={!!programar} onOpenChange={(v) => !v && setProgramar(null)} onListo={() => setSel(new Set())} />
    </>
  );
}
