"use client";

import { useDb } from "@/store/selectors";
import type { Despacho, HojaRuta } from "@/domain/types";
import { PrintLayout, PrintTable } from "@/components/shared/print-layout";
import { formatDate, formatNumber, formatQty } from "@/lib/format";

export function pesoDespacho(d: Pick<Despacho, "items">, productos: { id: string; pesoKg?: number }[]) {
  return d.items.reduce((a, i) => a + i.cantidad * (productos.find((p) => p.id === i.productoId)?.pesoKg ?? 0), 0);
}

export function origenLabel(db: ReturnType<typeof useDb>, d: Despacho) {
  if (d.origenTipo === "PEDIDO") return { label: db.pedidos.find((p) => p.id === d.origenId)?.numero ?? "Pedido", href: `/ventas/pedidos/${d.origenId}` };
  const a = db.acopios.find((x) => x.id === d.acopioId);
  return { label: a?.numero ?? "Acopio", href: `/acopios/${d.acopioId}` };
}

/** Remito con numeración por sucursal y "Recibí conforme". */
export function RemitoDocumento({ despacho: d }: { despacho: Despacho }) {
  const db = useDb();
  const c = db.clientes.find((x) => x.id === d.clienteId);
  const pv = db.sucursales.find((s) => s.id === d.sucursalId)?.puntoVenta ?? "0001";
  const veh = db.vehiculos.find((v) => v.id === d.vehiculoId);
  const cho = db.choferes.find((x) => x.id === d.choferId);
  const origen = origenLabel(db, d);
  return (
    <PrintLayout
      titulo="Remito"
      numero={`R ${pv}-${d.numero.replace("REM-", "000")}`}
      fecha={formatDate(d.fechaSalida ?? d.fechaProgramada)}
      leyenda="Documento no válido como factura"
      subtitulo={
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-[10px] font-semibold uppercase text-muted">Destinatario</div>
            <div className="font-semibold">{c?.razonSocial}</div>
            <div>CUIT {c?.cuit}</div>
            <div>Entregar en: {d.direccionEntrega}{d.localidad && d.direccionEntrega !== "Retira en mostrador" ? ` (${d.localidad})` : ""}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-muted">Transporte</div>
            <div>{veh ? `${veh.descripcion} · ${veh.patente}` : "Retira el cliente"}</div>
            <div>{cho ? `Chofer: ${cho.nombre}` : ""}</div>
            <div>Origen: {origen.label} · Depósito {db.depositos.find((x) => x.id === d.depositoId)?.nombre.replace("Depósito ", "")}</div>
          </div>
        </div>
      }
      pie={
        <div className="space-y-6 text-[11px] text-ink">
          <div>Recibí conforme la mercadería detallada en buen estado.</div>
          <div className="flex gap-16">
            <span>Firma ______________________</span>
            <span>Aclaración ______________________</span>
            <span>DNI ______________</span>
          </div>
        </div>
      }
    >
      <PrintTable
        head={["Código", "Producto", "Cantidad", "Peso aprox."]}
        rows={d.items.map((i) => {
          const p = db.productos.find((x) => x.id === i.productoId);
          return [p?.codigo, p?.nombre, formatQty(i.cantidad, p?.unidad ?? "UN"), `${formatNumber(i.cantidad * (p?.pesoKg ?? 0), 0)} kg`];
        })}
        foot={["", "Total", "", `${formatNumber(pesoDespacho(d, db.productos), 0)} kg`]}
      />
      {d.observaciones && <p className="mt-3"><b>Observaciones:</b> {d.observaciones}</p>}
    </PrintLayout>
  );
}

/** Orden de preparación para el depósito, con casilleros para tildar. */
export function OrdenPreparacionDocumento({ despacho: d }: { despacho: Despacho }) {
  const db = useDb();
  const c = db.clientes.find((x) => x.id === d.clienteId);
  return (
    <PrintLayout titulo="Orden de preparación" numero={d.numero} fecha={formatDate(d.fechaProgramada)} subtitulo={<div><b>Cliente:</b> {c?.razonSocial} · <b>Entrega:</b> {d.direccionEntrega} · <b>Depósito:</b> {db.depositos.find((x) => x.id === d.depositoId)?.nombre}</div>} pie="Preparó ______________________   Controló ______________________">
      <PrintTable
        head={["✓", "Código", "Producto", "Cantidad", "Ubicación / obs."]}
        rows={d.items.map((i) => {
          const p = db.productos.find((x) => x.id === i.productoId);
          return ["☐", p?.codigo, p?.nombre, formatQty(i.cantidad, p?.unidad ?? "UN"), "________________"];
        })}
      />
    </PrintLayout>
  );
}

/** Hoja de ruta: paradas en orden con casillero de hora y firma. */
export function HojaRutaDocumento({ hoja }: { hoja: HojaRuta }) {
  const db = useDb();
  const veh = db.vehiculos.find((v) => v.id === hoja.vehiculoId);
  const cho = db.choferes.find((c) => c.id === hoja.choferId);
  const ds = hoja.despachoIds.map((id) => db.despachos.find((d) => d.id === id)).filter((d): d is Despacho => !!d);
  return (
    <PrintLayout
      titulo="Hoja de ruta"
      fecha={formatDate(hoja.fecha)}
      numero={veh?.patente}
      subtitulo={<div><b>Vehículo:</b> {veh?.descripcion} ({veh?.patente}) · <b>Chofer:</b> {cho?.nombre} {cho?.telefono} · <b>Carga:</b> {formatNumber(ds.reduce((a, d) => a + pesoDespacho(d, db.productos), 0), 0)} kg de {formatNumber(veh?.capacidadKg ?? 0, 0)} kg</div>}
      pie="Salida ____:____ hs   Regreso ____:____ hs   Km inicial ________ Km final ________"
    >
      <PrintTable
        head={["#", "Remito", "Cliente / dirección", "Ítems", "Hora", "Firma"]}
        rows={ds.map((d, i) => {
          const c = db.clientes.find((x) => x.id === d.clienteId);
          return [
            String(i + 1),
            d.numero,
            <span key="c"><b>{c?.razonSocial}</b><br />{d.direccionEntrega} {d.localidad ? `· ${d.localidad}` : ""}<br />{c?.telefono}</span>,
            d.items.map((it) => { const p = db.productos.find((x) => x.id === it.productoId); return `${formatQty(it.cantidad, p?.unidad ?? "UN")} ${p?.nombre}`; }).join("; "),
            "____:____",
            "______________",
          ];
        })}
      />
    </PrintLayout>
  );
}
