"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Download, FileUp, Package, Plus, TrendingUp } from "lucide-react";
import { useDb, usePosiciones, usePuede, useDepositoActivo, useUnidadNegocio } from "@/store/selectors";
import { obtenerPrecio } from "@/domain/precios";
import { UNIDAD_LABEL } from "@/domain/estados";
import type { Producto } from "@/domain/types";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { ImportarCsvDialog } from "@/components/shared/importar-csv-dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatQty, unidadCorta } from "@/lib/format";
import { aCSV, descargarArchivo, cn } from "@/lib/utils";
import { posicionEn } from "@/store/selectors";
import { ProductoSheet } from "./producto-sheet";
import { ActualizacionMasivaDialog, type Alcance } from "./actualizacion-masiva";

export function ProductosView() {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const posiciones = usePosiciones();
  const depositoActivo = useDepositoActivo();
  const verCostos = usePuede("margenes.ver");
  const puedeEditar = usePuede("productos.editar");
  const puedePrecios = usePuede("precios.editar");
  const [lista, setLista] = React.useState(() => db.listasPrecios.find((l) => l.id === "lst_gen")?.id ?? db.listasPrecios[0]?.id ?? "");
  const [rubro, setRubro] = React.useState("");
  const [proveedor, setProveedor] = React.useState("");
  const [estado, setEstado] = React.useState(params.get("filtro") === "bajo-minimo" ? "BAJO" : "ACTIVOS");
  const [seleccion, setSeleccion] = React.useState<Set<string>>(new Set());
  const nuevoParam = params.get("nuevo") === "1";
  const masivaParam = params.get("masiva") === "markup";
  const [masiva, setMasiva] = React.useState(masivaParam);
  const [importar, setImportar] = React.useState(false);
  const [nuevo, setNuevo] = React.useState(nuevoParam);
  React.useEffect(() => {
    if (nuevoParam) setNuevo(true);
  }, [nuevoParam]);
  React.useEffect(() => {
    if (masivaParam) setMasiva(true);
  }, [masivaParam]);
  /** `?masiva=markup`: actualización de precios por markup sobre todo el catálogo (p. ej. después de importar). */
  const inicialMasiva = React.useMemo(() => (masivaParam ? { alcance: "TODO" as Alcance, modo: "MARKUP" as const } : undefined), [masivaParam]);
  const cerrarMasiva = (v: boolean) => {
    setMasiva(v);
    if (!v && masivaParam) router.replace("/productos", { scroll: false });
  };
  const productoId = params.get("id");
  const un = useUnidadNegocio();

  const rubroNombre = React.useMemo(() => new Map(db.rubros.map((r) => [r.id, r.nombre])), [db.rubros]);
  const provNombre = React.useMemo(() => new Map(db.proveedores.map((p) => [p.id, p.razonSocial])), [db.proveedores]);

  const filas = React.useMemo(
    () =>
      db.productos.filter((p) => {
        if (un && p.unidadNegocioId !== un) return false;
        if (rubro && p.rubroId !== rubro) return false;
        if (proveedor && p.proveedorHabitualId !== proveedor) return false;
        if (estado === "ACTIVOS" && !p.activo) return false;
        if (estado === "INACTIVOS" && p.activo) return false;
        if (estado === "BAJO" && posiciones.get(p.id)?.estado === "OK") return false;
        return true;
      }),
    [db.productos, rubro, proveedor, estado, posiciones, un],
  );

  const abrir = (id: string) => router.replace(`/productos?id=${id}`, { scroll: false });
  const cerrar = () => {
    setNuevo(false);
    router.replace("/productos", { scroll: false });
  };

  const columnas: Column<Producto>[] = [
    { key: "codigo", header: "Código", width: 92, sortable: true, sortValue: (p) => p.codigo, cell: (p) => <span className="whitespace-nowrap font-mono text-[12px]">{p.codigo}</span> },
    {
      key: "nombre",
      header: "Producto",
      sortable: true,
      sortValue: (p) => p.nombre,
      cell: (p) => (
        <div className="min-w-[220px]">
          <span className={cn(!p.activo && "text-muted line-through")}>{p.nombre}</span>
          {p.marca && <span className="ml-1.5 text-muted">{p.marca}</span>}
        </div>
      ),
    },
    { key: "rubro", header: "Rubro", hideOnMobile: true, sortable: true, sortValue: (p) => rubroNombre.get(p.rubroId) ?? "", cell: (p) => <span className="whitespace-nowrap text-muted">{rubroNombre.get(p.rubroId)}</span> },
    { key: "unidad", header: "Unidad", hideOnMobile: true, cell: (p) => <span className="text-muted">{UNIDAD_LABEL[p.unidad]}</span> },
    ...(verCostos
      ? [{ key: "costo", header: "Costo prom.", align: "right" as const, sortable: true, sortValue: (p: Producto) => p.costoPromedio, cell: (p: Producto) => <span className="tnum">{formatMoney(p.costoPromedio)}</span> }]
      : []),
    {
      key: "precio",
      header: `Precio ${db.listasPrecios.find((l) => l.id === lista)?.nombre ?? ""}`,
      align: "right",
      sortable: true,
      sortValue: (p) => obtenerPrecio(p.id, lista, db.precios),
      cell: (p) => <span className="font-medium tnum">{formatMoney(obtenerPrecio(p.id, lista, db.precios))}</span>,
    },
    {
      key: "stock",
      header: "Stock disp. / físico",
      align: "right",
      sortable: true,
      sortValue: (p) => posicionEn(posiciones.get(p.id), depositoActivo).disponible,
      cell: (p) => {
        const pos = posiciones.get(p.id);
        const x = posicionEn(pos, depositoActivo);
        return (
          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
            {pos && pos.estado !== "OK" && <Badge variant="danger">{pos.estado === "SIN_STOCK" ? "Sin stock" : "Bajo mínimo"}</Badge>}
            <span className="tnum">
              <span className={cn("font-medium", x.disponible < 0 && "text-danger")}>{formatQty(x.disponible, p.unidad).split(" ")[0]}</span>
              <span className="text-muted"> / {formatQty(x.fisico, p.unidad).split(" ")[0]} {unidadCorta(p.unidad)}</span>
            </span>
          </div>
        );
      },
    },
    { key: "proveedor", header: "Proveedor habitual", hideOnMobile: true, cell: (p) => <span className="block max-w-[180px] truncate text-muted">{p.proveedorHabitualId ? provNombre.get(p.proveedorHabitualId) : "—"}</span> },
    { key: "activo", header: "Estado", hideOnMobile: true, cell: (p) => (p.activo ? <Badge variant="success">Activo</Badge> : <Badge>Inactivo</Badge>) },
  ];

  const exportar = () => {
    const head = ["Código", "Producto", "Marca", "Rubro", "Unidad", ...(verCostos ? ["Costo promedio", "Costo último"] : []), ...db.listasPrecios.map((l) => `Precio ${l.nombre}`), "Físico", "Comprometido", "Disponible", "Mínimo", "Proveedor"];
    const rows = filas.map((p) => {
      const pos = posiciones.get(p.id);
      return [
        p.codigo,
        p.nombre,
        p.marca ?? "",
        rubroNombre.get(p.rubroId) ?? "",
        UNIDAD_LABEL[p.unidad],
        ...(verCostos ? [p.costoPromedio, p.costoUltimo] : []),
        ...db.listasPrecios.map((l) => obtenerPrecio(p.id, l.id, db.precios)),
        pos?.fisico ?? 0,
        pos?.comprometido ?? 0,
        pos?.disponible ?? 0,
        p.stockMinimo,
        p.proveedorHabitualId ? provNombre.get(p.proveedorHabitualId) ?? "" : "",
      ];
    });
    descargarArchivo(`productos-${new Date().toISOString().slice(0, 10)}.csv`, aCSV(head, rows));
    toast.success(`Exportados ${rows.length} productos`);
  };

  return (
    <>
      <PageHeader
        titulo="Productos"
        descripcion={`${db.productos.filter((p) => p.activo).length} artículos activos en ${db.rubros.length} rubros · ${db.listasPrecios.length} listas de precios`}
        acciones={
          <>
            {puedePrecios && (
              <Button variant="secondary" onClick={() => setMasiva(true)}>
                <TrendingUp />
                Actualizar precios
              </Button>
            )}
            {puedeEditar && (
              <Button onClick={() => setNuevo(true)}>
                <Plus />
                Nuevo artículo
              </Button>
            )}
          </>
        }
      />
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(p) => p.id}
        searchText={(p) => `${p.codigo} ${p.nombre} ${p.marca ?? ""} ${p.codigoBarras ?? ""}`}
        searchPlaceholder="Código, nombre, marca o código de barras"
        onRowClick={(p) => abrir(p.id)}
        selectable={puedePrecios}
        selected={seleccion}
        onSelectionChange={setSeleccion}
        initialSort={{ key: "codigo", dir: "asc" }}
        empty={
          db.productos.length ? (
            { icono: Package, titulo: "No hay artículos para el filtro" }
          ) : (
            <VacioGuiado
              pagina="productos"
              icono={Package}
              puedeAccion={puedeEditar}
              onAccion={() => setNuevo(true)}
              extra={puedeEditar ? <Button size="sm" variant="secondary" onClick={() => setImportar(true)}><FileUp /> Importar desde CSV</Button> : undefined}
            />
          )
        }
        filters={
          <>
            <Select size="sm" className="w-[170px]" aria-label="Rubro" value={rubro} onValueChange={setRubro} options={[{ value: "", label: "Todos los rubros" }, ...db.rubros.map((r) => ({ value: r.id, label: r.nombre }))]} />
            <Select size="sm" className="w-[190px]" aria-label="Proveedor" value={proveedor} onValueChange={setProveedor} options={[{ value: "", label: "Todos los proveedores" }, ...db.proveedores.map((p) => ({ value: p.id, label: p.razonSocial }))]} />
            <Select
              size="sm"
              className="w-[140px]"
              aria-label="Estado"
              value={estado}
              onValueChange={setEstado}
              options={[
                { value: "ACTIVOS", label: "Activos" },
                { value: "INACTIVOS", label: "Inactivos" },
                { value: "BAJO", label: "Bajo mínimo" },
                { value: "TODOS", label: "Todos" },
              ]}
            />
          </>
        }
        actions={
          <>
            <Select size="sm" className="w-[150px]" aria-label="Lista de precios" value={lista} onValueChange={setLista} options={db.listasPrecios.map((l) => ({ value: l.id, label: `Lista ${l.nombre}` }))} />
            {seleccion.size > 0 && puedePrecios && (
              <Button size="sm" variant="secondary" onClick={() => setMasiva(true)}>
                Actualizar {seleccion.size} seleccionados
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={exportar}>
              <Download />
              Exportar CSV
            </Button>
            {puedeEditar && (
              <Button size="sm" variant="ghost" onClick={() => setImportar(true)}>
                <FileUp />
                Importar desde CSV
              </Button>
            )}
          </>
        }
      />
      <ProductoSheet productoId={productoId} nuevo={nuevo} onClose={cerrar} />
      <ActualizacionMasivaDialog open={masiva} onOpenChange={cerrarMasiva} seleccionados={seleccion} inicial={inicialMasiva} />
      <ImportarCsvDialog tipo="articulos" open={importar} onOpenChange={setImportar} />
    </>
  );
}
