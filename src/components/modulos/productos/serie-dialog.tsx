"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ClipboardPaste, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede } from "@/store/selectors";
import { detectarVariante, markupsEfectivos, markupsSospechosos, nombreConVariante, nombreRepetidoEnRubro, parsearPegado, preciosParaCosto, siguientesCodigos } from "@/domain/duplicar";
import { UNIDAD_LABEL } from "@/domain/estados";
import { Impacto, medir } from "@/capacitacion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, NumberInput, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Fila {
  clave: number;
  sufijo: string;
  nombre: string;
  /** El usuario editó el nombre a mano: ya no se arma desde base + sufijo. */
  nombreManual: boolean;
  pesoKg?: number;
  costo: number;
  precios: Record<string, number>;
  preciosManuales: Set<string>;
  stockMinimo: number;
  codigo: string;
}

let claves = 0;

/**
 * "Crear serie a partir de este artículo": varios artículos iguales al base que solo cambian
 * medida, peso, costo y precios. Se crean en una sola transacción (todos o ninguno).
 */
export function SerieDialog({ origenId, onClose }: { origenId: string; onClose: () => void }) {
  const db = useDb();
  const crear = useStore((s) => s.crearSerieProductos);
  const verCostos = usePuede("margenes.ver");
  const origen = db.productos.find((p) => p.id === origenId);
  const listas = db.listasPrecios;
  const detectada = React.useMemo(() => detectarVariante(origen?.nombre ?? ""), [origen?.nombre]);
  const [base, setBase] = React.useState(detectada.base);
  const markups = React.useMemo(() => (origen ? markupsEfectivos(origen, db.precios, listas) : {}), [origen, db.precios, listas]);
  const nuevaFila = (codigo: string, datos: Partial<Fila> = {}): Fila => {
    const costo = datos.costo ?? 0;
    return { clave: ++claves, sufijo: "", nombre: "", nombreManual: false, pesoKg: undefined, costo, precios: origen ? preciosParaCosto(origen, db.precios, listas, costo) : {}, preciosManuales: new Set(), stockMinimo: origen?.stockMinimo ?? 0, codigo, ...datos };
  };
  const [filas, setFilas] = React.useState<Fila[]>(() => (origen ? siguientesCodigos(origen.rubroId, db.productos, db.rubros, 3).map((c) => nuevaFila(c)) : []));
  const [pegando, setPegando] = React.useState(false);
  const [textoPegado, setTextoPegado] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);

  if (!origen) return null;
  const rubro = db.rubros.find((r) => r.id === origen.rubroId);
  const proveedor = db.proveedores.find((p) => p.id === origen.proveedorHabitualId);
  const nombreDe = (f: Fila) => (f.nombreManual ? f.nombre : nombreConVariante(base, f.sufijo));

  const actualizar = (clave: number, cambio: Partial<Fila>) =>
    setFilas((fs) =>
      fs.map((f) => {
        if (f.clave !== clave) return f;
        const n = { ...f, ...cambio };
        if (cambio.costo !== undefined) {
          const calc = preciosParaCosto(origen, db.precios, listas, cambio.costo);
          n.precios = { ...n.precios, ...Object.fromEntries(Object.entries(calc).filter(([k]) => !f.preciosManuales.has(k))) };
        }
        return n;
      }),
    );
  const codigosLibres = (n: number, excluir: Fila[] = filas) => siguientesCodigos(origen.rubroId, db.productos, db.rubros, n, excluir.map((f) => f.codigo));
  const agregar = () => setFilas((fs) => [...fs, nuevaFila(codigosLibres(1, fs)[0])]);
  const pegar = () => {
    const pegadas = parsearPegado(textoPegado);
    if (!pegadas.length) return toast.error("No se encontraron filas. Pegá columnas variante, peso y costo separadas por tabulación.");
    // Las filas vacías se reemplazan; las que ya tienen datos se conservan.
    const conDatos = filas.filter((f) => f.sufijo || f.costo || f.nombreManual);
    const codigos = siguientesCodigos(origen.rubroId, db.productos, db.rubros, pegadas.length, conDatos.map((f) => f.codigo));
    setFilas([...conDatos, ...pegadas.map((p, i) => nuevaFila(codigos[i], { sufijo: p.variante, pesoKg: p.peso, costo: p.costo ?? 0, precios: preciosParaCosto(origen, db.precios, listas, p.costo ?? 0) }))]);
    setPegando(false);
    setTextoPegado("");
  };

  // Validación por fila.
  const errores = filas.map((f, i) => {
    const e: string[] = [];
    const nombre = nombreDe(f).trim();
    const codigo = f.codigo.trim().toUpperCase();
    if (!codigo) e.push("Falta el código");
    else if (db.productos.some((p) => p.codigo.toUpperCase() === codigo)) e.push("El código ya existe");
    else if (filas.some((g, j) => j < i && g.codigo.trim().toUpperCase() === codigo)) e.push("Código repetido en la serie");
    if (!nombre) e.push("Falta el nombre");
    else if (nombreRepetidoEnRubro(nombre, origen.rubroId, db.productos)) e.push("Ya existe un artículo con ese nombre");
    else if (filas.some((g, j) => j < i && nombreDe(g).trim().toLowerCase() === nombre.toLowerCase())) e.push("Nombre repetido en la serie");
    if (!(f.costo > 0)) e.push("El costo tiene que ser mayor a 0");
    return e;
  });
  const validas = filas.length > 0 && errores.every((e) => !e.length);

  const enviar = async () => {
    setEnviando(true);
    const datos = filas.map((f) => ({ codigo: f.codigo.trim().toUpperCase(), nombre: nombreDe(f).trim(), pesoKg: f.pesoKg, costoUltimo: f.costo, stockMinimo: f.stockMinimo, precios: f.precios }));
    const r = await medir("crearSerieProductos", { productoIds: [origen.id] }, () => crear(origen.id, datos));
    setEnviando(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(
      <span>
        Se crearon {r.data.codigos.length} artículos: {r.data.codigos.join(", ")} ·{" "}
        <Link className="underline" href={`/productos?rubro=${origen.rubroId}`}>Ver en el listado</Link>
      </span>,
      { duration: 8000 },
    );
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        size="2xl"
        title="Crear serie a partir de este artículo"
        description="Artículos iguales al base que solo cambian medida, peso, costo y precio. Se crean todos juntos o ninguno."
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={enviar} disabled={!validas} loading={enviando}>Crear {filas.length} {filas.length === 1 ? "artículo" : "artículos"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-x-6 gap-y-1 rounded-control border border-border bg-subtle px-3 py-2 text-[12px] sm:grid-cols-3">
            <span><span className="text-muted">Base:</span> {origen.codigo} · {origen.nombre}</span>
            <span><span className="text-muted">Rubro:</span> {rubro?.nombre} · <span className="text-muted">Unidad:</span> {UNIDAD_LABEL[origen.unidad]}</span>
            <span><span className="text-muted">Marca:</span> {origen.marca ?? "—"} · <span className="text-muted">Proveedor:</span> {proveedor?.razonSocial ?? "—"}</span>
            {verCostos && <span className="sm:col-span-3"><span className="text-muted">Markups del base:</span> {listas.map((l) => `${l.nombre} ${formatPercent((markups[l.id] ?? 0) / 100)}`).join(" · ")} · <span className="text-muted">Costo base:</span> {formatMoney(origen.costoUltimo)}</span>}
          </div>
          {verCostos && markupsSospechosos(markups).length > 0 && (
            <p className="rounded-control bg-warning-soft px-3 py-2 text-[13px] text-warning">
              Los precios del artículo base parecen mal cargados: son más de 10 veces su costo ({listas.filter((l) => markupsSospechosos(markups).includes(l.id)).map((l) => `${l.nombre} ${formatPercent((markups[l.id] ?? 0) / 100)}`).join(", ")}). Si creás la serie, los artículos nuevos copian ese markup. Revisá los precios del base antes, o corregí los de cada fila.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <FormField label="Nombre base (sin la medida)" htmlFor="serie-base" hint={detectada.variante ? `Detectado: "${detectada.base}" + variante "${detectada.variante}"` : "No se detectó una medida al final del nombre: corregilo si hace falta."}>
              <Input id="serie-base" value={base} onChange={(e) => setBase(e.target.value)} />
            </FormField>
            <div className="flex items-end gap-2">
              <Button variant="secondary" onClick={() => setPegando(!pegando)}><ClipboardPaste /> Pegar desde Excel</Button>
              <Button variant="secondary" onClick={agregar}><Plus /> Agregar fila</Button>
            </div>
          </div>
          {pegando && (
            <div className="space-y-2 rounded-control border border-border p-3">
              <p className="text-[12px] text-muted">Copiá de Excel tres columnas: <b>variante</b>, <b>peso (kg)</b> y <b>costo</b>. Ejemplo: <code>8 mm  4,74  5.900</code></p>
              <Textarea value={textoPegado} onChange={(e) => setTextoPegado(e.target.value)} rows={4} placeholder={"8 mm\t4,74\t5.900\n10 mm\t7,4\t9.200"} />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setPegando(false)}>Cancelar</Button>
                <Button size="sm" onClick={pegar} disabled={!textoPegado.trim()}>Cargar filas</Button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] table-fixed text-table">
              <thead>
                <tr className="border-b border-border text-left text-[12px] text-muted">
                  <th className="w-[110px] px-1.5 py-1.5 font-medium">Sufijo / variante</th>
                  <th className="w-[260px] px-1.5 py-1.5 font-medium">Nombre resultante</th>
                  <th className="w-[90px] px-1.5 py-1.5 font-medium">Peso (kg)</th>
                  <th className="w-[120px] px-1.5 py-1.5 font-medium">Costo</th>
                  {listas.map((l) => <th key={l.id} className="w-[130px] px-1.5 py-1.5 font-medium">{l.nombre}</th>)}
                  <th className="w-[90px] px-1.5 py-1.5 font-medium">Stock mín.</th>
                  <th className="w-[100px] px-1.5 py-1.5 font-medium">Código</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <React.Fragment key={f.clave}>
                    <tr className={cn("align-top", errores[i].length ? "" : "border-b border-border")}>
                      <td className="px-1.5 py-1"><Input aria-label={`Variante fila ${i + 1}`} value={f.sufijo} placeholder="8 mm" onChange={(e) => actualizar(f.clave, { sufijo: e.target.value })} /></td>
                      <td className="px-1.5 py-1"><Input aria-label={`Nombre fila ${i + 1}`} value={nombreDe(f)} onChange={(e) => actualizar(f.clave, { nombre: e.target.value, nombreManual: true })} /></td>
                      <td className="px-1.5 py-1"><NumberInput aria-label={`Peso fila ${i + 1}`} value={f.pesoKg ?? 0} min={0} onValueChange={(v) => actualizar(f.clave, { pesoKg: v || undefined })} /></td>
                      <td className="px-1.5 py-1"><NumberInput aria-label={`Costo fila ${i + 1}`} value={f.costo} min={0} onValueChange={(v) => actualizar(f.clave, { costo: v })} /></td>
                      {listas.map((l) => (
                        <td key={l.id} className="px-1.5 py-1">
                          <NumberInput aria-label={`${l.nombre} fila ${i + 1}`} value={f.precios[l.id] ?? 0} min={0} onValueChange={(v) => actualizar(f.clave, { precios: { ...f.precios, [l.id]: v }, preciosManuales: new Set(f.preciosManuales).add(l.id) })} />
                        </td>
                      ))}
                      <td className="px-1.5 py-1"><NumberInput aria-label={`Stock mínimo fila ${i + 1}`} value={f.stockMinimo} min={0} onValueChange={(v) => actualizar(f.clave, { stockMinimo: v })} /></td>
                      <td className="px-1.5 py-1"><Input aria-label={`Código fila ${i + 1}`} value={f.codigo} onChange={(e) => actualizar(f.clave, { codigo: e.target.value.toUpperCase() })} /></td>
                      <td className="px-1 py-1">
                        <Button variant="ghost" size="icon-sm" aria-label={`Quitar fila ${i + 1}`} onClick={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))}><Trash2 /></Button>
                      </td>
                    </tr>
                    {errores[i].length > 0 && (
                      <tr className="border-b border-border">
                        <td colSpan={7 + listas.length} className="px-1.5 pb-1.5 text-[12px] text-danger">Fila {i + 1}: {errores[i].join(" · ")}</td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {!filas.length && <p className="py-6 text-center text-[13px] text-muted">Agregá filas o pegalas desde Excel.</p>}
          </div>
          <Impacto accion="crearSerieProductos" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
