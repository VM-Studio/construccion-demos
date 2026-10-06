"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Printer, SlidersHorizontal } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePosiciones, usePuede } from "@/store/selectors";
import type { AjusteStock } from "@/domain/types";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { ItemsGrid, type LineaBase } from "@/components/shared/items-grid";
import { PrintLayout, PrintPreview, PrintTable } from "@/components/shared/print-layout";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, formatMoney, formatQty } from "@/lib/format";
import { nombreUsuario } from "@/lib/referencias";
import { cn, newId } from "@/lib/utils";

type Linea = LineaBase & { signo: 1 | -1; motivo: string };

export function AjustesTab({ abrirId, nuevo, productoInicial }: { abrirId?: string | null; nuevo?: boolean; productoInicial?: string | null }) {
  const db = useDb();
  const router = useRouter();
  const puede = usePuede("stock.ajustar");
  const verCostos = usePuede("margenes.ver");
  const [creando, setCreando] = React.useState(!!nuevo);
  React.useEffect(() => setCreando(!!nuevo), [nuevo]);
  const valor = (a: AjusteStock) => a.items.reduce((s, i) => s + i.signo * i.cantidad * (db.productos.find((p) => p.id === i.productoId)?.costoPromedio ?? 0), 0);
  const filas = [...db.ajustes].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const motivo = (c: string) => db.config.motivosAjuste.find((m) => m.codigo === c)?.nombre ?? c;

  const columnas: Column<AjusteStock>[] = [
    { key: "numero", header: "Número", sortable: true, sortValue: (a) => a.numero, cell: (a) => <span className="whitespace-nowrap font-mono text-[12px]">{a.numero}</span> },
    { key: "deposito", header: "Depósito", cell: (a) => db.depositos.find((d) => d.id === a.depositoId)?.nombre },
    { key: "items", header: "Ítems", cell: (a) => <span className="block max-w-[300px] truncate text-muted">{a.items.length} productos · {[...new Set(a.items.map((i) => motivo(i.motivo)))].join(", ")}</span> },
    ...(verCostos ? [{ key: "valor", header: "Valor", align: "right" as const, sortable: true, sortValue: (a: AjusteStock) => valor(a), cell: (a: AjusteStock) => { const v = valor(a); return <span className={cn("tnum", v >= 0 ? "text-success" : "text-danger")}>{formatMoney(v, { decimals: false })}</span>; } }] : []),
    { key: "fecha", header: "Fecha", sortable: true, sortValue: (a) => a.fecha, cell: (a) => <span className="text-muted">{formatDate(a.fecha)}</span> },
    { key: "usuario", header: "Usuario", hideOnMobile: true, cell: (a) => <span className="text-muted">{nombreUsuario(db, a.usuarioId)}</span> },
    { key: "obs", header: "Observación", hideOnMobile: true, cell: (a) => <span className="block max-w-[260px] truncate text-muted">{a.observacion}</span> },
  ];

  return (
    <>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(a) => a.id}
        searchText={(a) => `${a.numero} ${a.observacion ?? ""}`}
        onRowClick={(a) => router.replace(`/stock/ajustes?id=${a.id}`, { scroll: false })}
        initialSort={{ key: "fecha", dir: "desc" }}
        empty={{ icono: SlidersHorizontal, titulo: "Sin ajustes de stock" }}
        actions={puede && <Button size="sm" onClick={() => setCreando(true)}><Plus /> Nuevo ajuste</Button>}
      />
      <NuevoAjuste
        open={creando}
        productoInicial={productoInicial}
        onClose={(id) => {
          setCreando(false);
          router.replace(id ? `/stock/ajustes?id=${id}` : "/stock/ajustes", { scroll: false });
        }}
      />
      <DetalleAjuste id={abrirId} onClose={() => router.replace("/stock/ajustes", { scroll: false })} />
    </>
  );
}

function NuevoAjuste({ open, onClose, productoInicial }: { open: boolean; onClose: (id?: string) => void; productoInicial?: string | null }) {
  const db = useDb();
  const posiciones = usePosiciones();
  const crear = useStore((s) => s.crearAjuste);
  const [deposito, setDeposito] = React.useState("dep_central");
  const [items, setItems] = React.useState<Linea[]>([]);
  const [obs, setObs] = React.useState("");
  const motivos = db.config.motivosAjuste.filter((m) => m.activo);
  React.useEffect(() => {
    if (!open) return;
    setItems(productoInicial ? [{ id: newId("l"), productoId: productoInicial, cantidad: 1, signo: -1, motivo: "ROTURA" }] : []);
    setObs("");
  }, [open, productoInicial]);
  const valor = items.reduce((s, i) => s + i.cantidad * (db.productos.find((p) => p.id === i.productoId)?.costoPromedio ?? 0), 0);
  const requiereObs = valor > 500_000;

  const guardar = () => {
    const r = crear({ depositoId: deposito, items: items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, signo: i.signo, motivo: i.motivo })), observacion: obs || undefined });
    if (r.ok) {
      toast.success(`Ajuste ${r.data.numero} registrado`, { description: "El stock y el kardex ya están actualizados." });
      onClose(r.data.id);
    } else toast.error(r.error);
  };

  return (
    <EntitySheet
      open={open}
      onOpenChange={(v) => !v && onClose()}
      titulo="Nuevo ajuste de stock"
      subtitulo="Se valoriza al costo promedio vigente y queda en el kardex."
      width={760}
      footer={
        <>
          <Button variant="secondary" onClick={() => onClose()}>Cancelar</Button>
          <Button onClick={guardar} disabled={!items.length || (requiereObs && !obs.trim())}>Registrar ajuste</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Depósito" className="max-w-xs">
          <Select value={deposito} onValueChange={setDeposito} options={db.depositos.map((d) => ({ value: d.id, label: d.nombre }))} />
        </FormField>
        <ItemsGrid
          items={items}
          onChange={setItems}
          crearItem={(p): Linea => ({ id: newId("l"), productoId: p.id, cantidad: 1, signo: -1, motivo: "FALTANTE" })}
          depositoId={deposito}
          conPrecio={false}
          extras={[
            { header: "Signo", width: 120, cell: (i, up) => <Select size="sm" aria-label="Signo" value={String(i.signo)} onValueChange={(v) => up({ signo: Number(v) as 1 | -1 })} options={[{ value: "1", label: "+ Suma" }, { value: "-1", label: "− Resta" }]} /> },
            { header: "Motivo", width: 190, cell: (i, up) => <Select size="sm" aria-label="Motivo" value={i.motivo} onValueChange={(v) => up({ motivo: v })} options={motivos.map((m) => ({ value: m.codigo, label: m.nombre }))} /> },
          ]}
          avisoLinea={(i, p) => {
            const pos = posiciones.get(p.id)?.porDeposito[deposito];
            const fis = pos?.fisico ?? 0;
            if (i.signo === -1 && i.cantidad > fis) return { texto: `No se puede restar más que el físico (${formatQty(fis, p.unidad)})`, tono: "danger" };
            const disp = pos?.disponible ?? 0;
            if (i.signo === -1 && i.cantidad > disp) return { texto: `Atención: deja el disponible en ${formatQty(disp - i.cantidad, p.unidad)} (hay ${formatQty((pos?.pendiente ?? 0) + (pos?.reservado ?? 0), p.unidad)} pendientes de entrega)`, tono: "warning" };
            return undefined;
          }}
        />
        <div className="flex items-center justify-between rounded-control border border-border bg-subtle px-3 py-2 text-[13px]">
          <span className="text-muted">Valor del ajuste a costo promedio</span>
          <span className="font-semibold tnum">{formatMoney(valor)}</span>
        </div>
        <FormField label="Observación" required={requiereObs} error={requiereObs && !obs.trim() ? "Obligatoria: el ajuste supera $ 500.000." : undefined} htmlFor="aju-obs">
          <Textarea id="aju-obs" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ej. Conteo físico de fin de mes" />
        </FormField>
      </div>
    </EntitySheet>
  );
}

function DetalleAjuste({ id, onClose }: { id?: string | null; onClose: () => void }) {
  const db = useDb();
  const a = id ? db.ajustes.find((x) => x.id === id) : undefined;
  const [imprimir, setImprimir] = React.useState(false);
  if (!a) return null;
  const prod = (x: string) => db.productos.find((p) => p.id === x);
  const motivo = (c: string) => db.config.motivosAjuste.find((m) => m.codigo === c)?.nombre ?? c;
  const dep = db.depositos.find((d) => d.id === a.depositoId)?.nombre;
  return (
    <>
      <EntitySheet
        open
        onOpenChange={(v) => !v && onClose()}
        titulo={`Ajuste ${a.numero}`}
        subtitulo={`${dep} · ${formatDateTime(a.fecha)} · ${nombreUsuario(db, a.usuarioId)}`}
        acciones={<Button size="sm" variant="secondary" onClick={() => setImprimir(true)}><Printer /> Imprimir</Button>}
      >
        <table className="w-full text-table">
          <thead>
            <tr className="border-b border-border text-[12px] text-muted">
              <th className="py-2 text-left font-medium">Producto</th>
              <th className="py-2 text-left font-medium">Motivo</th>
              <th className="py-2 text-right font-medium">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {a.items.map((i, k) => (
              <tr key={k} className="border-b border-border">
                <td className="py-2">{prod(i.productoId)?.nombre}</td>
                <td className="py-2"><Badge>{motivo(i.motivo)}</Badge></td>
                <td className={cn("py-2 text-right font-medium tnum", i.signo > 0 ? "text-success" : "text-danger")}>{i.signo > 0 ? "+" : "−"}{formatQty(i.cantidad, prod(i.productoId)?.unidad ?? "UN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {a.observacion && <p className="mt-4 text-[13px]"><span className="text-muted">Observación:</span> {a.observacion}</p>}
      </EntitySheet>
      <PrintPreview open={imprimir} onOpenChange={setImprimir} titulo={`Ajuste ${a.numero}`}>
        <PrintLayout titulo="Ajuste de stock" numero={a.numero} fecha={formatDate(a.fecha)} subtitulo={<div><b>Depósito:</b> {dep} · <b>Responsable:</b> {nombreUsuario(db, a.usuarioId)}</div>} pie="Firma responsable ______________________">
          <PrintTable head={["Código", "Producto", "Motivo", "Cantidad"]} rows={a.items.map((i) => [prod(i.productoId)?.codigo, prod(i.productoId)?.nombre, motivo(i.motivo), `${i.signo > 0 ? "+" : "−"}${formatQty(i.cantidad, prod(i.productoId)?.unidad ?? "UN")}`])} />
          {a.observacion && <p className="mt-3"><b>Observación:</b> {a.observacion}</p>}
        </PrintLayout>
      </PrintPreview>
    </>
  );
}
