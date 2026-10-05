"use client";
import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  Legend,
} from "recharts";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { COLORES } from "./colores";


const eje = { fontSize: 11, fill: COLORES.texto };

type Fila = Record<string, string | number>;
type Formato = "money" | "number" | "percent";

function fmt(v: number, f: Formato = "money") {
  if (f === "percent") return formatPercent(v);
  if (f === "number") return formatNumber(v);
  return formatMoney(v);
}

function TooltipCaja({
  active,
  payload,
  label,
  formatos,
  etiquetaX,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: string;
  formatos?: Record<string, Formato>;
  etiquetaX?: (v: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-control border border-border bg-surface px-3 py-2 text-[12px] shadow-pop">
      <div className="mb-1 font-medium text-ink">{etiquetaX ? etiquetaX(String(label)) : label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium text-ink tnum">{fmt(Number(p.value ?? 0), formatos?.[String(p.dataKey)])}</span>
        </div>
      ))}
    </div>
  );
}

/** Barras de ventas (gris) + línea de margen (ámbar). */
export function VentasMargenChart({ data, etiquetaX, alto = 280 }: { data: Fila[]; etiquetaX: (v: string) => string; alto?: number }) {
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={COLORES.grilla} />
        <XAxis dataKey="clave" tickFormatter={etiquetaX} tick={eje} axisLine={false} tickLine={false} minTickGap={16} />
        <YAxis tickFormatter={(v) => formatMoney(v, { compact: true })} tick={eje} axisLine={false} tickLine={false} width={64} />
        <Tooltip content={<TooltipCaja etiquetaX={etiquetaX} />} cursor={{ fill: "rgba(20,20,19,0.04)" }} />
        <Bar dataKey="ventas" name="Ventas" fill={COLORES.barra} radius={[3, 3, 0, 0]} maxBarSize={36} />
        <Line dataKey="margen" name="Margen bruto" stroke={COLORES.acento} strokeWidth={2} dot={false} type="monotone" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Barras agrupadas por serie. */
export function BarrasAgrupadasChart({
  data,
  series,
  etiquetaX,
  alto = 280,
  formato = "money",
}: {
  data: Fila[];
  series: { key: string; nombre: string; color: string }[];
  etiquetaX?: (v: string) => string;
  alto?: number;
  formato?: Formato;
}) {
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={COLORES.grilla} />
        <XAxis dataKey="clave" tickFormatter={etiquetaX} tick={eje} axisLine={false} tickLine={false} minTickGap={16} />
        <YAxis tickFormatter={(v) => (formato === "money" ? formatMoney(v, { compact: true }) : formatNumber(v, 0))} tick={eje} axisLine={false} tickLine={false} width={64} />
        <Tooltip content={<TooltipCaja etiquetaX={etiquetaX} formatos={Object.fromEntries(series.map((s) => [s.key, formato]))} />} cursor={{ fill: "rgba(20,20,19,0.04)" }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: COLORES.texto }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.nombre} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Barras horizontales (antigüedad de deuda): una barra resaltada. */
export function BarrasHorizontalesChart({ data, alto = 200, resaltar }: { data: { clave: string; valor: number }[]; alto?: number; resaltar?: string }) {
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid horizontal={false} stroke={COLORES.grilla} />
        <XAxis type="number" tickFormatter={(v) => formatMoney(v, { compact: true })} tick={eje} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="clave" tick={eje} axisLine={false} tickLine={false} width={64} />
        <Tooltip content={<TooltipCaja />} cursor={{ fill: "rgba(20,20,19,0.04)" }} />
        <Bar dataKey="valor" name="Saldo" radius={[0, 3, 3, 0]} maxBarSize={26}>
          {data.map((d) => (
            <Cell key={d.clave} fill={d.clave === resaltar ? COLORES.peligro : COLORES.barra} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Línea simple (historial de costos). */
export function LineaChart({ data, alto = 220, nombre = "Costo", formato = "money", etiquetaX }: { data: Fila[]; alto?: number; nombre?: string; formato?: Formato; etiquetaX?: (v: string) => string }) {
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={COLORES.grilla} />
        <XAxis dataKey="clave" tickFormatter={etiquetaX} tick={eje} axisLine={false} tickLine={false} minTickGap={16} />
        <YAxis tickFormatter={(v) => (formato === "money" ? formatMoney(v, { compact: true }) : formatNumber(v))} tick={eje} axisLine={false} tickLine={false} width={64} domain={["auto", "auto"]} />
        <Tooltip content={<TooltipCaja etiquetaX={etiquetaX} formatos={{ valor: formato }} />} />
        <Line dataKey="valor" name={nombre} stroke={COLORES.acento} strokeWidth={2} dot={{ r: 3, fill: COLORES.acento }} type="stepAfter" />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Pareto: barras + línea acumulada en %. */
export function ParetoChart({ data, alto = 300 }: { data: { clave: string; valor: number; acumulado: number }[]; alto?: number }) {
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={COLORES.grilla} />
        <XAxis dataKey="clave" tick={false} axisLine={false} tickLine={false} />
        <YAxis yAxisId="v" tickFormatter={(v) => formatMoney(v, { compact: true })} tick={eje} axisLine={false} tickLine={false} width={64} />
        <YAxis yAxisId="p" orientation="right" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)} %`} tick={eje} axisLine={false} tickLine={false} width={44} />
        <Tooltip content={<TooltipCaja formatos={{ valor: "money", acumulado: "percent" }} />} cursor={{ fill: "rgba(20,20,19,0.04)" }} />
        <Bar yAxisId="v" dataKey="valor" name="Facturado" fill={COLORES.barra} radius={[3, 3, 0, 0]} />
        <Line yAxisId="p" dataKey="acumulado" name="% acumulado" stroke={COLORES.acento} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Dispersión margen % vs unidades. */
export function DispersionChart({ data, alto = 300 }: { data: { nombre: string; x: number; y: number; z: number }[]; alto?: number }) {
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={COLORES.grilla} />
        <XAxis type="number" dataKey="x" name="Unidades" tick={eje} axisLine={false} tickLine={false} scale="log" domain={["auto", "auto"]} tickFormatter={(v) => formatNumber(v, 0)} />
        <YAxis type="number" dataKey="y" name="Margen %" tick={eje} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v * 100)} %`} width={48} />
        <ZAxis type="number" dataKey="z" range={[30, 300]} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="rounded-control border border-border bg-surface px-3 py-2 text-[12px] shadow-pop">
                <div className="font-medium">{(payload[0].payload as { nombre: string }).nombre}</div>
                <div className="text-muted">Unidades: {formatNumber((payload[0].payload as { x: number }).x)}</div>
                <div className="text-muted">Margen: {formatPercent((payload[0].payload as { y: number }).y)}</div>
                <div className="text-muted">Margen $: {formatMoney((payload[0].payload as { z: number }).z)}</div>
              </div>
            ) : null
          }
        />
        <Scatter data={data} fill={COLORES.acento} fillOpacity={0.6} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
