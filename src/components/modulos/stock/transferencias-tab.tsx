"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, ArrowRight, PackageCheck, Plus, Printer, Truck, X } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePosiciones, usePuede } from "@/store/selectors";
import type { TransferenciaStock } from "@/domain/types";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { ItemsGrid, type LineaBase } from "@/components/shared/items-grid";
import { PrintLayout, PrintPreview, PrintTable } from "@/components/shared/print-layout";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";
import { formatDate, formatDateTime, formatQty } from "@/lib/format";
import { nombreUsuario } from "@/lib/referencias";
import { newId } from "@/lib/utils";

export function TransferenciasTab({ abrirId, nuevo, productoInicial }: { abrirId?: string | null; nuevo?: boolean; productoInicial?: string | null }) {
  const db = useDb();
  const router = useRouter();
  const puede = usePuede("stock.transferir");
  const [creando, setCreando] = React.useState(!!nuevo);
  React.useEffect(() => setCreando(!!nuevo), [nuevo]);
  const dep = (id: string) => db.depositos.find((d) => d.id === id)?.nombre.replace("Depósito ", "") ?? "";
  const filas = [...db.transferencias].sort((a, b) => b.fecha.localeCompare(a.fecha));

  const columnas: Column<TransferenciaStock>[] = [
    { key: "numero", header: "Número", sortable: true, sortValue: (t) => t.numero, cell: (t) => <span className="whitespace-nowrap font-mono text-[12px]">{t.numero}</span> },
    { key: "ruta", header: "Origen → Destino", cell: (t) => <span className="inline-flex items-center gap-1.5 whitespace-nowrap">{dep(t.depositoOrigenId)} <ArrowRight className="size-3.5 text-muted" /> {dep(t.depositoDestinoId)}</span> },
    { key: "items", header: "Ítems", cell: (t) => <span className="block max-w-[320px] truncate text-muted">{t.items.map((i) => `${formatQty(i.cantidad, db.productos.find((p) => p.id === i.productoId)?.unidad ?? "UN")} ${db.productos.find((p) => p.id === i.productoId)?.nombre}`).join(" · ")}</span> },
    { key: "estado", header: "Estado", sortable: true, sortValue: (t) => t.estado, cell: (t) => <StatusBadge tipo="TRANSFERENCIA" estado={t.estado} /> },
    { key: "fecha", header: "Fecha", sortable: true, sortValue: (t) => t.fecha, cell: (t) => <span className="text-muted">{formatDate(t.fecha)}</span> },
    { key: "usuario", header: "Usuario", hideOnMobile: true, cell: (t) => <span className="text-muted">{nombreUsuario(db, t.usuarioId)}</span> },
  ];

  return (
    <>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(t) => t.id}
        searchText={(t) => `${t.numero} ${t.items.map((i) => db.productos.find((p) => p.id === i.productoId)?.nombre).join(" ")}`}
        onRowClick={(t) => router.replace(`/stock?tab=transferencias&id=${t.id}`, { scroll: false })}
        initialSort={{ key: "fecha", dir: "desc" }}
        empty={{ icono: ArrowLeftRight, titulo: "Sin transferencias", descripcion: "Mové mercadería entre depósitos con trazabilidad completa.", accion: puede ? <Button size="sm" onClick={() => setCreando(true)}><Plus />Nueva transferencia</Button> : undefined }}
        actions={
          puede && (
            <Button size="sm" onClick={() => setCreando(true)}>
              <Plus /> Nueva transferencia
            </Button>
          )
        }
      />
      <NuevaTransferencia
        open={creando}
        productoInicial={productoInicial}
        onClose={(id) => {
          setCreando(false);
          router.replace(id ? `/stock?tab=transferencias&id=${id}` : "/stock?tab=transferencias", { scroll: false });
        }}
      />
      <DetalleTransferencia id={abrirId} onClose={() => router.replace("/stock?tab=transferencias", { scroll: false })} />
    </>
  );
}

type Linea = LineaBase;

function NuevaTransferencia({ open, onClose, productoInicial }: { open: boolean; onClose: (id?: string) => void; productoInicial?: string | null }) {
  const db = useDb();
  const posiciones = usePosiciones();
  const crear = useStore((s) => s.crearTransferencia);
  const [origen, setOrigen] = React.useState("dep_central");
  const [destino, setDestino] = React.useState("dep_2");
  const [items, setItems] = React.useState<Linea[]>([]);
  const [obs, setObs] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    setItems(productoInicial ? [{ id: newId("l"), productoId: productoInicial, cantidad: 1 }] : []);
    setObs("");
  }, [open, productoInicial]);
  const excede = items.some((i) => i.cantidad > (posiciones.get(i.productoId)?.porDeposito[origen]?.disponible ?? 0));

  const guardar = () => {
    const r = crear({ depositoOrigenId: origen, depositoDestinoId: destino, items: items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })), observacion: obs || undefined });
    if (r.ok) {
      toast.success(`Transferencia ${r.data.numero} creada`, { description: "Queda pendiente de despacho." });
      onClose(r.data.id);
    } else toast.error(r.error);
  };

  return (
    <EntitySheet
      open={open}
      onOpenChange={(v) => !v && onClose()}
      titulo="Nueva transferencia"
      subtitulo="La mercadería sale del origen al despachar y entra al destino al recibir."
      width={760}
      footer={
        <>
          <Button variant="secondary" onClick={() => onClose()}>Cancelar</Button>
          <Button onClick={guardar} disabled={!items.length || excede || origen === destino}>Crear transferencia</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Depósito origen">
            <Select value={origen} onValueChange={(v) => { setOrigen(v); if (v === destino) setDestino(db.depositos.find((d) => d.id !== v)?.id ?? ""); }} options={db.depositos.map((d) => ({ value: d.id, label: d.nombre }))} />
          </FormField>
          <FormField label="Depósito destino" error={origen === destino ? "Debe ser distinto del origen." : undefined}>
            <Select value={destino} onValueChange={setDestino} options={db.depositos.map((d) => ({ value: d.id, label: d.nombre }))} />
          </FormField>
        </div>
        <ItemsGrid
          items={items}
          onChange={setItems}
          crearItem={(p) => ({ id: newId("l"), productoId: p.id, cantidad: 1 })}
          depositoId={origen}
          conPrecio={false}
          avisoLinea={(i, p) => {
            const disp = posiciones.get(p.id)?.porDeposito[origen]?.disponible ?? 0;
            return i.cantidad > disp ? { texto: `Supera el disponible en origen (${formatQty(Math.max(0, disp), p.unidad)})`, tono: "danger" } : undefined;
          }}
        />
        <FormField label="Observación" htmlFor="trf-obs">
          <Textarea id="trf-obs" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ej. Reposición para obra de la zona sur" />
        </FormField>
      </div>
    </EntitySheet>
  );
}

function DetalleTransferencia({ id, onClose }: { id?: string | null; onClose: () => void }) {
  const db = useDb();
  const t = id ? db.transferencias.find((x) => x.id === id) : undefined;
  const { despacharTransferencia, recibirTransferencia, cancelarTransferencia } = useStore.getState();
  const puede = usePuede("stock.transferir");
  const [imprimir, setImprimir] = React.useState(false);
  const { confirmar, dialog } = useConfirm();
  if (!t) return null;
  const dep = (x: string) => db.depositos.find((d) => d.id === x)?.nombre ?? "";
  const prod = (x: string) => db.productos.find((p) => p.id === x);
  const run = (r: { ok: boolean; error?: string }, msg: string) => (r.ok ? toast.success(msg) : toast.error(r.error));

  return (
    <>
      <EntitySheet
        open
        onOpenChange={(v) => !v && onClose()}
        titulo={`Transferencia ${t.numero}`}
        estado={<StatusBadge tipo="TRANSFERENCIA" estado={t.estado} />}
        subtitulo={`${dep(t.depositoOrigenId)} → ${dep(t.depositoDestinoId)} · ${formatDateTime(t.fecha)} · ${nombreUsuario(db, t.usuarioId)}`}
        acciones={
          <>
            {puede && t.estado === "PENDIENTE" && (
              <Button size="sm" onClick={() => run(despacharTransferencia(t.id), "Transferencia despachada: el stock salió del origen")}>
                <Truck /> Despachar
              </Button>
            )}
            {puede && t.estado === "EN_TRANSITO" && (
              <Button size="sm" onClick={() => run(recibirTransferencia(t.id), "Transferencia recibida: el stock ingresó al destino")}>
                <PackageCheck /> Recibir
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setImprimir(true)}>
              <Printer /> Imprimir
            </Button>
            {puede && t.estado === "PENDIENTE" && (
              <Button size="sm" variant="ghost" onClick={() => confirmar({ titulo: `Cancelar ${t.numero}`, confirmLabel: "Cancelar transferencia", variant: "danger", onConfirm: () => { run(cancelarTransferencia(t.id), "Transferencia cancelada"); } })}>
                <X /> Cancelar
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <table className="w-full text-table">
            <thead>
              <tr className="border-b border-border text-[12px] text-muted">
                <th className="py-2 text-left font-medium">Producto</th>
                <th className="py-2 text-right font-medium">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {t.items.map((i) => (
                <tr key={i.productoId} className="border-b border-border">
                  <td className="py-2"><span className="mr-2 whitespace-nowrap font-mono text-[11px] text-muted">{prod(i.productoId)?.codigo}</span>{prod(i.productoId)?.nombre}</td>
                  <td className="py-2 text-right tnum">{formatQty(i.cantidad, prod(i.productoId)?.unidad ?? "UN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="grid grid-cols-2 gap-2 text-[13px]">
            <dt className="text-muted">Despachada</dt>
            <dd>{t.fechaDespacho ? formatDateTime(t.fechaDespacho) : "—"}</dd>
            <dt className="text-muted">Recibida</dt>
            <dd>{t.fechaRecepcion ? formatDateTime(t.fechaRecepcion) : "—"}</dd>
            {t.observacion && (
              <>
                <dt className="text-muted">Observación</dt>
                <dd>{t.observacion}</dd>
              </>
            )}
          </dl>
        </div>
      </EntitySheet>
      <PrintPreview open={imprimir} onOpenChange={setImprimir} titulo={`Transferencia ${t.numero}`}>
        <PrintLayout titulo="Transferencia entre depósitos" numero={t.numero} fecha={formatDate(t.fecha)} subtitulo={<div className="grid grid-cols-2 gap-4"><div><b>Origen:</b> {dep(t.depositoOrigenId)}</div><div><b>Destino:</b> {dep(t.depositoDestinoId)}</div></div>} pie="Firma despacho ______________________   Firma recepción ______________________">
          <PrintTable head={["Código", "Producto", "Cantidad", "Control"]} rows={t.items.map((i) => [prod(i.productoId)?.codigo, prod(i.productoId)?.nombre, formatQty(i.cantidad, prod(i.productoId)?.unidad ?? "UN"), "☐"])} />
          {t.observacion && <p className="mt-3"><b>Observación:</b> {t.observacion}</p>}
        </PrintLayout>
      </PrintPreview>
      {dialog}
    </>
  );
}
