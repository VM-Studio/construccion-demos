"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { useDb, usePuede, useSaldosClientes, useSucursalActiva } from "@/store/selectors";
import type { Cliente } from "@/domain/types";
import { CONDICION_PAGO_LABEL, TIPO_CLIENTE_LABEL, opciones } from "@/domain/estados";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatMoney } from "@/lib/format";
import { nombreUsuario } from "@/lib/referencias";
import { cn } from "@/lib/utils";
import { ClienteSheet } from "./cliente-form";

export function ClientesTab({ abrirId }: { abrirId?: string | null }) {
  const db = useDb();
  const router = useRouter();
  const saldos = useSaldosClientes();
  const sucursalId = useSucursalActiva();
  const puede = usePuede("clientes.editar");
  const [tipo, setTipo] = React.useState("");
  const [nuevo, setNuevo] = React.useState(false);
  const filas = db.clientes.filter((c) => (!sucursalId || c.sucursalPreferidaId === sucursalId) && (!tipo || c.tipo === tipo));

  const columnas: Column<Cliente>[] = [
    {
      key: "razon",
      header: "Cliente",
      sortable: true,
      sortValue: (c) => c.nombreFantasia ?? c.razonSocial,
      cell: (c) => (
        <div className={cn("min-w-[200px]", !c.activo && "text-muted line-through")}>
          <div className="font-medium">{c.nombreFantasia ?? c.razonSocial}</div>
          {c.nombreFantasia && <div className="text-[11px] text-muted">{c.razonSocial}</div>}
        </div>
      ),
    },
    { key: "tipo", header: "Tipo", sortable: true, sortValue: (c) => c.tipo, cell: (c) => <Badge variant={c.tipo === "CONSTRUCTORA" ? "accent" : "neutral"}>{TIPO_CLIENTE_LABEL[c.tipo]}</Badge> },
    { key: "cuit", header: "CUIT", hideOnMobile: true, cell: (c) => <span className="whitespace-nowrap tnum text-muted">{c.cuit || "—"}</span> },
    { key: "iva", header: "IVA", hideOnMobile: true, cell: (c) => <span className="text-muted">{c.condicionIVA}</span> },
    { key: "loc", header: "Localidad", hideOnMobile: true, sortable: true, sortValue: (c) => c.localidad, cell: (c) => <span className="whitespace-nowrap text-muted">{c.localidad}</span> },
    { key: "lista", header: "Lista", hideOnMobile: true, cell: (c) => <span className="text-muted">{db.listasPrecios.find((l) => l.id === c.listaPreciosId)?.nombre}</span> },
    { key: "cond", header: "Condición", hideOnMobile: true, cell: (c) => <span className="whitespace-nowrap text-muted">{CONDICION_PAGO_LABEL[c.condicionPago]}</span> },
    {
      key: "saldo",
      header: "Saldo cta. cte.",
      align: "right",
      sortable: true,
      sortValue: (c) => saldos.get(c.id)?.saldo ?? 0,
      cell: (c) => {
        const s = saldos.get(c.id);
        return <span className={cn("tnum", (s?.vencido ?? 0) > 0 && "font-medium text-danger")}>{formatMoney(s?.saldo ?? 0, { decimals: false })}</span>;
      },
    },
    {
      key: "limite",
      header: "Límite / uso",
      width: 160,
      sortable: true,
      sortValue: (c) => (c.limiteCredito ? (saldos.get(c.id)?.saldo ?? 0) / c.limiteCredito : 0),
      cell: (c) => {
        if (!c.limiteCredito) return <span className="text-disabled">Contado</span>;
        const uso = (saldos.get(c.id)?.saldo ?? 0) / c.limiteCredito;
        return (
          <div className="min-w-[120px]">
            <div className="flex justify-between text-[11px] text-muted"><span className="tnum">{formatMoney(c.limiteCredito, { compact: true })}</span><span className={cn("tnum", uso > 1 && "font-medium text-danger")}>{Math.round(uso * 100)} %</span></div>
            <Progress value={uso} tone={uso > 1 ? "danger" : uso > 0.8 ? "accent" : "ink"} className="mt-1" />
          </div>
        );
      },
    },
    { key: "vend", header: "Vendedor", hideOnMobile: true, cell: (c) => <span className="whitespace-nowrap text-muted">{c.vendedorId ? nombreUsuario(db, c.vendedorId) : "—"}</span> },
    { key: "suc", header: "Sucursal", hideOnMobile: true, cell: (c) => <span className="whitespace-nowrap text-muted">{db.sucursales.find((s) => s.id === c.sucursalPreferidaId)?.nombre.replace("Sucursal ", "")}</span> },
  ];

  return (
    <>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(c) => c.id}
        searchText={(c) => `${c.razonSocial} ${c.nombreFantasia ?? ""} ${c.cuit} ${c.localidad}`}
        searchPlaceholder="Nombre, CUIT o localidad"
        onRowClick={(c) => router.replace(`/ventas?tab=clientes&cliente=${c.id}`, { scroll: false })}
        initialSort={{ key: "razon", dir: "asc" }}
        empty={{ icono: Users, titulo: "Sin clientes" }}
        filters={<Select size="sm" className="w-[150px]" aria-label="Tipo de cliente" value={tipo} onValueChange={setTipo} options={[{ value: "", label: "Todos los tipos" }, ...opciones(TIPO_CLIENTE_LABEL)]} />}
        actions={puede && <Button size="sm" onClick={() => setNuevo(true)}><Plus /> Nuevo cliente</Button>}
      />
      <ClienteSheet
        id={abrirId}
        nuevo={nuevo}
        onClose={() => {
          setNuevo(false);
          router.replace("/ventas?tab=clientes", { scroll: false });
        }}
      />
    </>
  );
}
