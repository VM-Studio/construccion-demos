"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const cargando = () => <Skeleton className="h-[260px] w-full" />;

// Recharts se carga bajo demanda para mantener el JS inicial de cada página liviano.
export const VentasMargenChart = dynamic(() => import("./charts").then((m) => m.VentasMargenChart), { ssr: false, loading: cargando });
export const BarrasAgrupadasChart = dynamic(() => import("./charts").then((m) => m.BarrasAgrupadasChart), { ssr: false, loading: cargando });
export const BarrasHorizontalesChart = dynamic(() => import("./charts").then((m) => m.BarrasHorizontalesChart), { ssr: false, loading: cargando });
export const LineaChart = dynamic(() => import("./charts").then((m) => m.LineaChart), { ssr: false, loading: cargando });
export const ParetoChart = dynamic(() => import("./charts").then((m) => m.ParetoChart), { ssr: false, loading: cargando });
export const DispersionChart = dynamic(() => import("./charts").then((m) => m.DispersionChart), { ssr: false, loading: cargando });
export { COLORES } from "./colores";
