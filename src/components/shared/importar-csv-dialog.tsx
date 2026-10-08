"use client";
import * as React from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn, descargarArchivo } from "@/lib/utils";
import { useStore } from "@/store";
import { Impacto, medir } from "@/capacitacion";
import { useDb } from "@/store/selectors";
import {
  COLUMNAS,
  NOMBRE_PLANTILLA,
  generarPlantillaCSV,
  mapearColumnas,
  validarArchivo,
  type DatosImportacion,
  type Mapeo,
  type TipoImportacion,
} from "@/domain/importacion";

const SIN_ASIGNAR = "__sin_asignar";
const FILAS_VISTA_PREVIA = 20;

const EJEMPLOS_ARTICULOS = [
  { label: "Usar ejemplo de Corralón (40)", url: "/plantillas/articulos-ejemplo-corralon.csv", nombre: "articulos-ejemplo-corralon.csv" },
  { label: "Usar ejemplo de Ferretería (30)", url: "/plantillas/articulos-ejemplo-ferreteria.csv", nombre: "articulos-ejemplo-ferreteria.csv" },
];

interface ArchivoCargado {
  nombre: string;
  cabeceras: string[];
  filas: Record<string, unknown>[];
}

/** Lee el archivo como UTF-8 y, si trae caracteres inválidos, reintenta como Windows-1252 (Excel). */
async function leerTexto(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(buf) : utf8;
}

function parsearCSV(texto: string, nombre: string): ArchivoCargado {
  const r = Papa.parse<Record<string, unknown>>(texto.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    delimiter: "",
    delimitersToGuess: [",", ";", "\t"],
    transformHeader: (h) => h.replace(/^﻿/, "").trim(),
  });
  const cabeceras = (r.meta.fields ?? []).filter(Boolean);
  return { nombre, cabeceras, filas: r.data };
}

/** Importación de artículos, clientes o proveedores desde un CSV, con mapeo de columnas y vista previa validada. */
const ACCION = { articulos: "importarArticulos", clientes: "importarClientes", proveedores: "importarProveedores" } as const;

export function ImportarCsvDialog({
  tipo,
  open,
  onOpenChange,
  onImportado,
}: {
  tipo: TipoImportacion;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportado?: (ids: string[]) => void;
}) {
  const db = useDb();
  const nombres = NOMBRE_PLANTILLA[tipo];
  const columnas = COLUMNAS[tipo];
  const [archivo, setArchivo] = React.useState<ArchivoCargado | null>(null);
  const [mapeo, setMapeo] = React.useState<Mapeo>({});
  const [arrastrando, setArrastrando] = React.useState(false);
  const [cargando, setCargando] = React.useState(false);
  const [importando, setImportando] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setArchivo(null);
      setMapeo({});
      setArrastrando(false);
    }
  }, [open]);

  const cargar = React.useCallback(
    (a: ArchivoCargado) => {
      if (!a.cabeceras.length) {
        toast.error("El archivo no tiene cabeceras reconocibles.");
        return;
      }
      setArchivo(a);
      setMapeo(mapearColumnas(tipo, a.cabeceras));
    },
    [tipo],
  );

  const elegirArchivo = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      toast.error("Elegí un archivo .csv o .txt.");
      return;
    }
    setCargando(true);
    try {
      cargar(parsearCSV(await leerTexto(file), file.name));
    } catch {
      toast.error("No se pudo leer el archivo.");
    } finally {
      setCargando(false);
    }
  };

  const usarEjemplo = async (url: string, nombre: string) => {
    setCargando(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      cargar(parsearCSV(await res.text(), nombre));
    } catch {
      toast.error("No se pudo cargar el ejemplo.");
    } finally {
      setCargando(false);
    }
  };

  const descargarPlantilla = () => descargarArchivo(nombres.archivo, generarPlantillaCSV(tipo));

  const validadas = React.useMemo(
    () => (archivo ? validarArchivo(tipo, archivo.filas, mapeo, db) : []),
    [archivo, mapeo, db, tipo],
  );
  const validas = validadas.filter((v) => v.ok && v.datos);
  const conErrores = validadas.length - validas.length;
  const columnasVisibles = columnas.filter((c) => mapeo[c.clave]);
  const erroresOcultos = validadas.slice(FILAS_VISTA_PREVIA).filter((v) => !v.ok);

  const importar = async () => {
    if (!validas.length) return;
    const acciones = useStore.getState();
    setImportando(true);
    const r = await medir(ACCION[tipo], { n: validas.length }, () =>
      tipo === "articulos"
        ? acciones.importarArticulos(validas.map((v) => v.datos as DatosImportacion["articulos"]))
        : tipo === "clientes"
          ? acciones.importarClientes(validas.map((v) => v.datos as DatosImportacion["clientes"]))
          : acciones.importarProveedores(validas.map((v) => v.datos as DatosImportacion["proveedores"])),
    );
    setImportando(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    const n = r.data.creados;
    toast.success(n === 1 ? `Se importó 1 ${nombres.singular}` : `Se importaron ${n} ${nombres.plural}`);
    onImportado?.(r.data.ids);
    onOpenChange(false);
  };

  const opcionesArchivo = [
    { value: SIN_ASIGNAR, label: "— sin asignar —" },
    ...(archivo?.cabeceras ?? []).map((c) => ({ value: c, label: c })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        title={`Importar ${nombres.plural} desde CSV`}
        description="Subí un archivo CSV (separado por coma o punto y coma). Revisá el mapeo de columnas y la vista previa antes de importar."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={importar} disabled={validas.length === 0} loading={importando}>
              Importar {validas.length} {validas.length === 1 ? "fila válida" : "filas válidas"}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-[13px]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button variant="secondary" size="sm" onClick={descargarPlantilla}>
              <Download /> Descargar plantilla
            </Button>
            {tipo === "articulos" &&
              EJEMPLOS_ARTICULOS.map((e) => (
                <Button key={e.url} variant="link" size="sm" className="text-[13px] text-muted hover:text-ink" disabled={cargando} onClick={() => usarEjemplo(e.url, e.nombre)}>
                  {e.label}
                </Button>
              ))}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              void elegirArchivo(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {archivo ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border bg-subtle px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <FileSpreadsheet className="size-4 shrink-0 text-muted" />
                <span className="truncate font-medium text-ink">{archivo.nombre}</span>
                <span className="shrink-0 text-muted">
                  · {archivo.filas.length} {archivo.filas.length === 1 ? "fila" : "filas"} · {archivo.cabeceras.length} columnas
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
                Cambiar archivo
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                void elegirArchivo(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-1.5 rounded-card border border-dashed px-4 py-8 text-center transition-colors",
                arrastrando ? "border-accent bg-accent-soft" : "border-border-strong bg-subtle hover:bg-app",
              )}
            >
              <Upload className="size-5 text-muted" />
              <span className="font-medium text-ink">{cargando ? "Leyendo archivo…" : "Arrastrá el archivo acá o hacé clic para elegirlo"}</span>
              <span className="text-[12px] text-muted">Formatos .csv o .txt · la primera fila debe tener las cabeceras</span>
            </button>
          )}

          {archivo && (
            <>
              <section>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Columnas</h3>
                <div className="grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {columnas.map((c) => (
                    <div key={c.clave} className="flex min-w-0 items-center gap-2">
                      <label htmlFor={`map-${c.clave}`} className="w-[44%] min-w-0 shrink-0 truncate text-[12px] text-ink" title={c.clave}>
                        {c.etiqueta}
                        {c.requerida && <span className="text-danger"> *</span>}
                      </label>
                      <span className="text-[12px] text-muted" aria-hidden>
                        ←
                      </span>
                      <Select
                        id={`map-${c.clave}`}
                        size="sm"
                        aria-label={`Columna del archivo para ${c.etiqueta}`}
                        className={cn("h-7 min-w-0 flex-1 text-[12px]", !mapeo[c.clave] && "text-muted")}
                        value={mapeo[c.clave] || SIN_ASIGNAR}
                        onValueChange={(v) => setMapeo((m) => ({ ...m, [c.clave]: v === SIN_ASIGNAR ? "" : v }))}
                        options={opcionesArchivo}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="min-w-0">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted">Vista previa</h3>
                  <p className="text-[12px] text-muted">
                    <span className="font-medium text-ink">{validas.length} válidas</span> ·{" "}
                    <span className={cn(conErrores ? "font-medium text-danger" : "")}>{conErrores} con errores</span> sobre {validadas.length}
                    {validadas.length > FILAS_VISTA_PREVIA && ` · se muestran las primeras ${FILAS_VISTA_PREVIA}`}
                  </p>
                </div>
                {validadas.length === 0 ? (
                  <p className="rounded-control border border-border px-3 py-6 text-center text-muted">El archivo no tiene filas con datos.</p>
                ) : (
                  <div className="max-h-[340px] overflow-auto rounded-control border border-border">
                    <table className="w-full border-collapse text-[12px]">
                      <thead className="sticky top-0 z-[1] bg-subtle">
                        <tr>
                          <th className="h-8 whitespace-nowrap border-b border-border px-2 text-left font-medium text-muted">Fila</th>
                          {columnasVisibles.map((c) => (
                            <th key={c.clave} className="h-8 whitespace-nowrap border-b border-border px-2 text-left font-medium text-muted">
                              {c.etiqueta}
                            </th>
                          ))}
                          <th className="h-8 min-w-[220px] whitespace-nowrap border-b border-border px-2 text-left font-medium text-muted">Validación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validadas.slice(0, FILAS_VISTA_PREVIA).map((v) => (
                          <tr key={v.fila} className={cn("border-b border-border last:border-b-0", !v.ok && "bg-danger-soft")}>
                            <td className="px-2 py-1 align-top tabular-nums text-muted">{v.fila}</td>
                            {columnasVisibles.map((c) => (
                              <td key={c.clave} className="max-w-[240px] truncate whitespace-nowrap px-2 py-1 align-top text-ink" title={v.valores[c.clave]}>
                                {v.valores[c.clave]}
                              </td>
                            ))}
                            <td className="px-2 py-1 align-top">
                              {v.ok ? (
                                <span className="inline-flex items-center gap-1 text-success">
                                  <CheckCircle2 className="size-3.5" /> OK
                                </span>
                              ) : (
                                <span className="flex items-start gap-1 text-danger">
                                  <AlertCircle className="mt-px size-3.5 shrink-0" />
                                  <span>{v.errores.join(" ")}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {erroresOcultos.length > 0 && (
                  <div className="mt-2 rounded-control border border-border bg-danger-soft px-3 py-2 text-[12px] text-danger">
                    <p className="mb-1 font-medium">Otras filas con errores</p>
                    <ul className="space-y-0.5">
                      {erroresOcultos.slice(0, 15).map((v) => (
                        <li key={v.fila}>
                          Fila {v.fila}: {v.errores.join(" ")}
                        </li>
                      ))}
                      {erroresOcultos.length > 15 && <li>y {erroresOcultos.length - 15} filas más.</li>}
                    </ul>
                  </div>
                )}
              </section>
            </>
          )}
          <Impacto accion={ACCION[tipo]} n={validas.length} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
