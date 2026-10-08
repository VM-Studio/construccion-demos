"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, DatabaseZap, Download, Eraser, ImagePlus, Plus, Save, ShieldCheck, Upload, XCircle } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede, useUsuario } from "@/store/selectors";
import type { ListaPrecios, Rol, Rubro, Sucursal, Usuario } from "@/domain/types";
import { MATRIZ_PERMISOS, ROL_LABEL, puede, PERMISOS_POR_ROL } from "@/domain/permisos";
import { verificarIntegridad, type ResultadoIntegridad } from "@/domain/integridad";
import { estaVacio } from "@/domain/prerequisitos";
import { Impacto, InterruptorCapacitacionConfig, medir } from "@/capacitacion";
import { filasNumeracion, formatearDoc } from "@/domain/numeracion";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import type { CodigoDoc } from "@/domain/types";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NumberInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FlotaTab } from "@/components/modulos/despachos/flota";
import { formatDateTime } from "@/lib/format";
import { cn, descargarArchivo } from "@/lib/utils";

const ok = (r: { ok: boolean; error?: string }, msg: string) => (r.ok ? toast.success(msg) : toast.error(r.error));

const RESUMEN_EJEMPLO = "150 artículos de Corralón y Ferretería con precios y stock, 28 clientes con 38 obras, 12 proveedores, 10 acopios (incluido el de referencia que cierra en $ 844,85), 4 acopios con proveedores, 103 notas de pedido, 106 remitos, compras, cobranzas, cheques y despachos de los últimos meses.";

const TITULOS: Record<string, [string, string]> = {
  empresa: ["Empresa", "Datos de la empresa que se usan en todas las impresiones."],
  sucursales: ["Sucursales y depósitos", "Puntos de venta, depósitos y posiciones de carga."],
  unidades: ["Unidades de negocio", "Ferretería y Corralón: rubros asociados y motivos de ajuste."],
  usuarios: ["Usuarios y roles", "Usuarios del sistema y matriz de permisos por rol."],
  parametros: ["Parámetros", "IVA, vencimiento de acopios, avisos y adjuntos."],
  numeracion: ["Numeración", "Último número usado por código de documento, circuito y punto de venta."],
  demo: ["Datos del demo", "Vaciar, cargar datos de ejemplo, respaldos y verificación de integridad."],
};

/** Configuración: cada página del módulo es una sección (`?tab=`), navegada desde la barra lateral. */
export function ConfigView() {
  const params = useSearchParams();
  const tab = params.get("tab") ?? "empresa";
  const verUsuarios = usePuede("config.usuarios");
  const [titulo, descripcion] = TITULOS[tab] ?? TITULOS.empresa;
  return (
    <>
      <PageHeader titulo={titulo} descripcion={descripcion} />
      {tab === "empresa" && <Empresa />}
      {tab === "sucursales" && <Sucursales />}
      {tab === "unidades" && <UnidadesNegocio />}
      {tab === "usuarios" && <Usuarios editable={verUsuarios} />}
      {tab === "parametros" && <Parametros />}
      {tab === "numeracion" && <Numeracion />}
      {tab === "demo" && <DatosDemo />}
    </>
  );
}

/** Listas de precios (página del módulo Ventas). */
export function ListasPreciosView() {
  return (
    <>
      <PageHeader titulo="Listas de precios" descripcion="Mayorista, Corralón y Público: markup por defecto sobre el costo de reposición." />
      <Listas />
    </>
  );
}

/** Vehículos y choferes (página del módulo Logística). */
export function VehiculosView() {
  const router = useRouter();
  return (
    <>
      <PageHeader titulo="Vehículos y choferes" descripcion="Flota propia, capacidad de carga y choferes asignados." />
      <FlotaTab onAbrirDespacho={(id) => router.push(`/despachos?despacho=${id}`)} />
    </>
  );
}

function Empresa() {
  const db = useDb();
  const [f, setF] = React.useState(db.config.empresa);
  const [logo, setLogo] = React.useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader><CardTitle>Datos de la empresa</CardTitle><span className="text-[12px] text-muted">Se usan en todas las impresiones</span></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nombre de fantasía" required htmlFor="em-nf"><Input id="em-nf" value={f.empresa} onChange={(e) => set("empresa", e.target.value)} /></FormField>
          <FormField label="Razón social" htmlFor="em-rs"><Input id="em-rs" value={f.razonSocial} onChange={(e) => set("razonSocial", e.target.value)} /></FormField>
          <FormField label="CUIT" htmlFor="em-cuit"><Input id="em-cuit" value={f.cuit} onChange={(e) => set("cuit", e.target.value)} /></FormField>
          <FormField label="Teléfono" htmlFor="em-tel"><Input id="em-tel" value={f.telefono} onChange={(e) => set("telefono", e.target.value)} /></FormField>
          <FormField label="Dirección" htmlFor="em-dir" className="sm:col-span-2"><Input id="em-dir" value={f.direccion} onChange={(e) => set("direccion", e.target.value)} /></FormField>
          <FormField label="Email" htmlFor="em-mail" className="sm:col-span-2"><Input id="em-mail" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></FormField>
          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={() => ok(useStore.getState().actualizarEmpresa(f), "Datos de la empresa actualizados")}><Save /> Guardar</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Logo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex h-32 items-center justify-center rounded-card border border-dashed border-border-strong bg-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (data URL) */}
            {logo ? <img src={logo} alt="Vista previa del logo" className="max-h-28 max-w-full object-contain" /> : <span className="text-[22px] font-bold tracking-tight">{f.empresa}</span>}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-control border border-border-strong px-3 py-2 text-[13px] font-medium hover:bg-subtle">
            <ImagePlus className="size-4" /> Subir logo
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const r = new FileReader();
                r.onload = () => setLogo(String(r.result));
                r.readAsDataURL(file);
              }}
            />
          </label>
          <p className="text-[12px] text-muted">Vista previa únicamente. En el demo el logo es el nombre en tipografía; en la versión final se guarda y se imprime en los comprobantes.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Sucursales() {
  const db = useDb();
  const [edit, setEdit] = React.useState<Sucursal | "nueva" | null>(null);
  const columnas: Column<Sucursal>[] = [
    { key: "n", header: "Sucursal", cell: (s) => <span className="font-medium">{s.nombre}</span> },
    { key: "d", header: "Dirección", cell: (s) => <span className="text-muted">{s.direccion}</span> },
    { key: "t", header: "Teléfono", cell: (s) => <span className="text-muted">{s.telefono}</span> },
    { key: "pv", header: "Punto de venta", cell: (s) => <span className="font-mono text-[12px]">{s.puntoVenta}</span> },
    { key: "dep", header: "Depósito", cell: (s) => db.depositos.find((d) => d.id === s.depositoId)?.nombre },
  ];
  return (
    <>
      <DataTable rows={db.sucursales} columns={columnas} getRowId={(s) => s.id} onRowClick={setEdit} actions={<Button size="sm" onClick={() => setEdit("nueva")}><Plus /> Nueva sucursal</Button>} />
      {edit && <SucursalDialog sucursal={edit === "nueva" ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function SucursalDialog({ sucursal, onClose }: { sucursal?: Sucursal; onClose: () => void }) {
  const db = useDb();
  const dep = db.depositos.find((d) => d.id === sucursal?.depositoId);
  const [f, setF] = React.useState({ nombre: sucursal?.nombre ?? "", direccion: sucursal?.direccion ?? "", telefono: sucursal?.telefono ?? "", puntoVenta: sucursal?.puntoVenta ?? String(db.sucursales.length + 1).padStart(4, "0"), puntoVentaRemito: sucursal?.puntoVentaRemito ?? String(db.sucursales.length + 20).padStart(5, "0"), depositoNombre: dep?.nombre ?? "", depositoDireccion: dep?.direccion ?? "", posiciones: dep?.posiciones ?? ["Playa", "Mostrador"] });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={sucursal ? `Editar ${sucursal.nombre}` : "Nueva sucursal"} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => { const r = useStore.getState().guardarSucursal(f, sucursal?.id); ok(r, "Sucursal guardada"); if (r.ok) onClose(); }}><Save /> Guardar</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nombre" required htmlFor="s-n"><Input id="s-n" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></FormField>
          <FormField label="Punto de venta fiscal" htmlFor="s-pv" hint="Numera facturas, notas de crédito y recibos"><Input id="s-pv" value={f.puntoVenta} onChange={(e) => setF({ ...f, puntoVenta: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></FormField>
          <FormField label="Punto de venta de remitos" htmlFor="s-pvr" hint="Numera los remitos (RM1 / RM2)"><Input id="s-pvr" value={f.puntoVentaRemito} onChange={(e) => setF({ ...f, puntoVentaRemito: e.target.value.replace(/\D/g, "").slice(0, 5) })} /></FormField>
          <FormField label="Posiciones de carga del depósito" htmlFor="s-pos" hint="Separadas por coma, ej. Playa 1, Galpón 2, Mostrador"><Input id="s-pos" value={f.posiciones.join(", ")} onChange={(e) => setF({ ...f, posiciones: e.target.value.split(",").map((x) => x.trimStart()) })} /></FormField>
          <FormField label="Dirección" htmlFor="s-d"><Input id="s-d" value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} /></FormField>
          <FormField label="Teléfono" htmlFor="s-t"><Input id="s-t" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></FormField>
          <FormField label="Depósito asociado" htmlFor="s-dn"><Input id="s-dn" value={f.depositoNombre} onChange={(e) => setF({ ...f, depositoNombre: e.target.value })} placeholder="Depósito …" /></FormField>
          <FormField label="Dirección del depósito" htmlFor="s-dd"><Input id="s-dd" value={f.depositoDireccion} onChange={(e) => setF({ ...f, depositoDireccion: e.target.value })} /></FormField>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Usuarios({ editable }: { editable: boolean }) {
  const db = useDb();
  const [edit, setEdit] = React.useState<Usuario | "nuevo" | null>(null);
  const columnas: Column<Usuario>[] = [
    { key: "n", header: "Usuario", cell: (u) => <span className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-full bg-ink text-[10px] font-semibold text-white">{u.avatarIniciales}</span><span className="font-medium">{u.nombre}</span></span> },
    { key: "e", header: "Email", cell: (u) => <span className="text-muted">{u.email}</span> },
    { key: "r", header: "Rol", cell: (u) => <Badge variant={u.rol === "DUENO" ? "accent" : "neutral"}>{ROL_LABEL[u.rol]}</Badge> },
    { key: "s", header: "Sucursal", cell: (u) => <span className="text-muted">{u.sucursalId ? db.sucursales.find((s) => s.id === u.sucursalId)?.nombre : "Todas"}</span> },
    { key: "a", header: "Estado", cell: (u) => (u.activo ? <Badge variant="success">Activo</Badge> : <Badge>Inactivo</Badge>) },
  ];
  const acciones = ["ver", "crear", "editar", "confirmar", "anular", "margenes"] as const;
  const etiqueta = { ver: "Ver", crear: "Crear", editar: "Editar", confirmar: "Confirmar", anular: "Anular", margenes: "Ver márgenes" };
  const roles: Rol[] = ["DUENO", "ADMINISTRACION", "VENTAS", "DEPOSITO"];
  return (
    <div className="space-y-4">
      <DataTable rows={db.usuarios} columns={columnas} getRowId={(u) => u.id} onRowClick={editable ? setEdit : undefined} actions={editable ? <Button size="sm" onClick={() => setEdit("nuevo")}><Plus /> Nuevo usuario</Button> : <span className="text-[12px] text-muted">Sólo el Dueño administra usuarios</span>} />
      <Card>
        <CardHeader><CardTitle>Matriz de permisos por rol</CardTitle><span className="text-[12px] text-muted">Informativa · se aplica en toda la app</span></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-table">
            <thead className="bg-[#FAFAF8]">
              <tr className="text-[12px] text-muted">
                <th className="h-9 px-3 text-left font-medium">Módulo</th>
                {roles.map((r) => <th key={r} colSpan={acciones.length} className="h-9 border-l border-border px-2 text-center font-medium">{ROL_LABEL[r]}</th>)}
              </tr>
              <tr className="text-[10px] text-muted">
                <th />
                {roles.map((r) => acciones.map((a, i) => <th key={r + a} className={cn("h-7 px-1 text-center font-normal", i === 0 && "border-l border-border")}>{etiqueta[a]}</th>))}
              </tr>
            </thead>
            <tbody>
              {MATRIZ_PERMISOS.map((m) => (
                <tr key={m.modulo} className="h-9 border-t border-border">
                  <td className="whitespace-nowrap px-3">{m.modulo}</td>
                  {roles.map((r) =>
                    acciones.map((a, i) => {
                      const p = m.acciones[a];
                      const si = p ? PERMISOS_POR_ROL[r].includes(p) : null;
                      return (
                        <td key={r + a} className={cn("px-1 text-center", i === 0 && "border-l border-border")}>
                          {si === null ? <span className="text-disabled">·</span> : si ? <CheckCircle2 className="mx-auto size-4 text-success" aria-label="Sí" /> : <XCircle className="mx-auto size-4 text-disabled" aria-label="No" />}
                        </td>
                      );
                    }),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {edit && <UsuarioDialog usuario={edit === "nuevo" ? undefined : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function UsuarioDialog({ usuario, onClose }: { usuario?: Usuario; onClose: () => void }) {
  const db = useDb();
  const [f, setF] = React.useState({ nombre: usuario?.nombre ?? "", email: usuario?.email ?? "", rol: usuario?.rol ?? ("VENTAS" as Rol), sucursalId: usuario?.sucursalId ?? "suc_central", activo: usuario?.activo ?? true });
  const iniciales = f.nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title={usuario ? `Editar ${usuario.nombre}` : "Nuevo usuario"}
        footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => { const r = useStore.getState().guardarUsuario({ nombre: f.nombre, email: f.email, rol: f.rol, sucursalId: f.rol === "DUENO" || f.rol === "ADMINISTRACION" ? undefined : f.sucursalId, activo: f.activo, avatarIniciales: iniciales || "US" }, usuario?.id); ok(r, "Usuario guardado"); if (r.ok) onClose(); }}><Save /> Guardar</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nombre" required htmlFor="u-n"><Input id="u-n" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></FormField>
          <FormField label="Email" required htmlFor="u-e"><Input id="u-e" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></FormField>
          <FormField label="Rol"><Select value={f.rol} onValueChange={(v) => setF({ ...f, rol: v as Rol })} options={(Object.keys(ROL_LABEL) as Rol[]).map((r) => ({ value: r, label: ROL_LABEL[r] }))} /></FormField>
          {(f.rol === "VENTAS" || f.rol === "DEPOSITO") && <FormField label="Sucursal asignada"><Select value={f.sucursalId} onValueChange={(v) => setF({ ...f, sucursalId: v })} options={db.sucursales.map((s) => ({ value: s.id, label: s.nombre }))} /></FormField>}
          <label className="flex items-center gap-3 text-[13px] sm:col-span-2"><Switch checked={f.activo} onCheckedChange={(v) => setF({ ...f, activo: v })} /> Usuario activo</label>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Listas() {
  const db = useDb();
  const [edit, setEdit] = React.useState<ListaPrecios | "nueva" | null>(null);
  const [f, setF] = React.useState({ nombre: "", descripcion: "", markupPorDefecto: 30, activa: true });
  React.useEffect(() => {
    if (edit) setF(edit === "nueva" ? { nombre: "", descripcion: "", markupPorDefecto: 30, activa: true } : { nombre: edit.nombre, descripcion: edit.descripcion, markupPorDefecto: edit.markupPorDefecto, activa: edit.activa });
  }, [edit]);
  const columnas: Column<ListaPrecios>[] = [
    { key: "n", header: "Lista", cell: (l) => <span className="font-medium">{l.nombre}</span> },
    { key: "d", header: "Descripción", cell: (l) => <span className="text-muted">{l.descripcion}</span> },
    { key: "m", header: "Markup por defecto", align: "right", cell: (l) => <span className="tnum">{l.markupPorDefecto} %</span> },
    { key: "c", header: "Clientes", align: "right", cell: (l) => <span className="tnum">{db.clientes.filter((c) => c.listaPreciosId === l.id).length}</span> },
    { key: "a", header: "Estado", cell: (l) => (l.activa ? <Badge variant="success">Activa</Badge> : <Badge>Inactiva</Badge>) },
  ];
  return (
    <>
      <DataTable rows={db.listasPrecios} columns={columnas} getRowId={(l) => l.id} onRowClick={setEdit} actions={<Button size="sm" onClick={() => setEdit("nueva")}><Plus /> Nueva lista</Button>} />
      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent title={edit === "nueva" ? "Nueva lista de precios" : "Editar lista"} description={edit === "nueva" ? "Se generan los precios de todos los productos con costo promedio + markup." : undefined} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={() => { const r = useStore.getState().guardarLista(f, edit === "nueva" ? undefined : (edit as ListaPrecios).id); ok(r, "Lista guardada"); if (r.ok) setEdit(null); }}><Save /> Guardar</Button></>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nombre" required htmlFor="l-n"><Input id="l-n" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></FormField>
            <FormField label="Markup por defecto (%)" htmlFor="l-m"><NumberInput id="l-m" value={f.markupPorDefecto} min={0} onValueChange={(v) => setF({ ...f, markupPorDefecto: v })} /></FormField>
            <FormField label="Descripción" htmlFor="l-d" className="sm:col-span-2"><Input id="l-d" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></FormField>
            <label className="flex items-center gap-3 text-[13px]"><Switch checked={f.activa} onCheckedChange={(v) => setF({ ...f, activa: v })} /> Activa</label>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Parametros() {
  const db = useDb();
  const c = db.config;
  const [f, setF] = React.useState({ ivaPct: c.ivaPct, validezPresupuestoDias: c.validezPresupuestoDias, diasVencimientoAcopio: c.diasVencimientoAcopio, alicuotaIIBBPct: c.alicuotaIIBBPct, alertaStockMinimo: c.alertaStockMinimo, umbralSubaCostoPct: c.umbralSubaCostoPct, tipoCambioUSD: c.tipoCambioUSD ?? 0, tamanoMaxAdjuntoMB: c.tamanoMaxAdjuntoMB });
  const [cats, setCats] = React.useState(c.categoriasAdjunto);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Parámetros generales</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="IVA (%)" htmlFor="p-iva"><NumberInput id="p-iva" value={f.ivaPct} min={0} onValueChange={(v) => setF({ ...f, ivaPct: v })} /></FormField>
          <FormField label="Alícuota IIBB por defecto para acopios (%)" htmlFor="p-iibb"><NumberInput id="p-iibb" value={f.alicuotaIIBBPct} min={0} onValueChange={(v) => setF({ ...f, alicuotaIIBBPct: v })} /></FormField>
          <FormField label="Vencimiento de acopios (días)" htmlFor="p-aco"><NumberInput id="p-aco" value={f.diasVencimientoAcopio} min={1} onValueChange={(v) => setF({ ...f, diasVencimientoAcopio: Math.round(v) })} /></FormField>
          <FormField label="Validez de cotizaciones (días)" htmlFor="p-val"><NumberInput id="p-val" value={f.validezPresupuestoDias} min={1} onValueChange={(v) => setF({ ...f, validezPresupuestoDias: Math.round(v) })} /></FormField>
          <FormField label="Aviso de suba de costo (%)" htmlFor="p-suba" hint="Al recibir mercadería más cara que el último costo"><NumberInput id="p-suba" value={f.umbralSubaCostoPct} min={0} onValueChange={(v) => setF({ ...f, umbralSubaCostoPct: v })} /></FormField>
          <FormField label="Tamaño máximo de adjunto (MB)" htmlFor="p-adj"><NumberInput id="p-adj" value={f.tamanoMaxAdjuntoMB} min={1} onValueChange={(v) => setF({ ...f, tamanoMaxAdjuntoMB: Math.max(1, Math.round(v)) })} /></FormField>
          <FormField label="Tipo de cambio USD de referencia" htmlFor="p-usd"><NumberInput id="p-usd" value={f.tipoCambioUSD} min={0} onValueChange={(v) => setF({ ...f, tipoCambioUSD: v })} /></FormField>
          <label className="flex items-center gap-3 self-end pb-2 text-[13px]"><Switch checked={f.alertaStockMinimo} onCheckedChange={(v) => setF({ ...f, alertaStockMinimo: v })} /> Alertar stock bajo mínimo</label>
          <div className="flex justify-end sm:col-span-2 lg:col-span-3"><Button onClick={() => ok(useStore.getState().actualizarConfig(f), "Parámetros guardados")}><Save /> Guardar</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Categorías de adjuntos</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {cats.map((cat, k) => (
            <div key={cat.codigo} className="flex items-center gap-3">
              <Input aria-label={`Categoría ${cat.codigo}`} className="h-8" value={cat.nombre} onChange={(e) => setCats(cats.map((x, i2) => (i2 === k ? { ...x, nombre: e.target.value } : x)))} />
              <span className="w-36 font-mono text-[11px] text-muted">{cat.codigo}</span>
            </div>
          ))}
          <div className="flex justify-end"><Button size="sm" onClick={() => ok(useStore.getState().actualizarConfig({ categoriasAdjunto: cats }), "Categorías guardadas")}><Save /> Guardar categorías</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Posiciones de carga por depósito</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-[13px]">
          {db.depositos.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2">
              <span className="w-44 text-muted">{d.nombre}</span>
              {d.posiciones.map((p) => <span key={p} className="rounded-control bg-subtle px-2 py-0.5">{p}</span>)}
            </div>
          ))}
          <p className="text-[12px] text-muted">Se editan desde Sucursales y depósitos.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function UnidadesNegocio() {
  const db = useDb();
  const [edit, setEdit] = React.useState<{ id?: string; nombre: string; codigo: "FER" | "COR"; rubroIds: string[] } | null>(null);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {db.unidadesNegocio.map((u) => {
          const rubros = db.rubros.filter((r) => r.unidadNegocioId === u.id);
          return (
            <Card key={u.id}>
              <CardHeader>
                <CardTitle>{u.nombre} <span className="ml-1 font-mono text-[12px] text-muted">{u.codigo}</span></CardTitle>
                <Button size="sm" variant="secondary" onClick={() => setEdit({ id: u.id, nombre: u.nombre, codigo: u.codigo, rubroIds: rubros.map((r) => r.id) })}><Save /> Editar</Button>
              </CardHeader>
              <CardContent className="text-[13px]">
                <p className="mb-2 text-muted">{rubros.length} rubros · {db.productos.filter((p) => p.unidadNegocioId === u.id).length} artículos</p>
                <div className="flex flex-wrap gap-1.5">{rubros.map((r) => <span key={r.id} className="rounded-control bg-subtle px-2 py-0.5 text-[12px]">{r.nombre}</span>)}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Tablas />
      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        {edit && (
          <DialogContent size="md" title={edit.id ? `Editar ${edit.nombre}` : "Nueva unidad de negocio"} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={() => { const r = useStore.getState().guardarUnidadNegocio({ nombre: edit.nombre, codigo: edit.codigo, rubroIds: edit.rubroIds }, edit.id); ok(r, "Unidad de negocio guardada"); if (r.ok) setEdit(null); }}><Save /> Guardar</Button></>}>
            <div className="space-y-3">
              <FormField label="Nombre" htmlFor="un-n"><Input id="un-n" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></FormField>
              <FormField label="Rubros asociados">
                <div className="grid grid-cols-2 gap-1.5">
                  {db.rubros.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-[13px]">
                      <Switch checked={edit.rubroIds.includes(r.id)} onCheckedChange={(v) => setEdit({ ...edit, rubroIds: v ? [...edit.rubroIds, r.id] : edit.rubroIds.filter((x) => x !== r.id) })} aria-label={r.nombre} /> {r.nombre}
                    </label>
                  ))}
                </div>
              </FormField>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function Tablas() {
  const db = useDb();
  const [rubro, setRubro] = React.useState<Rubro | "nuevo" | null>(null);
  const [fr, setFr] = React.useState({ nombre: "", prefijo: "", orden: 9, unidadNegocioId: "un_cor" });
  const [motivos, setMotivos] = React.useState(db.config.motivosAjuste);
  const [nuevoMotivo, setNuevoMotivo] = React.useState("");
  React.useEffect(() => {
    if (rubro) setFr(rubro === "nuevo" ? { nombre: "", prefijo: "", orden: db.rubros.length + 1, unidadNegocioId: "un_cor" } : { nombre: rubro.nombre, prefijo: rubro.prefijo, orden: rubro.orden, unidadNegocioId: rubro.unidadNegocioId });
  }, [rubro, db.rubros.length]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-[14px] font-semibold">Rubros</h3>
        <DataTable
          rows={[...db.rubros].sort((a, b) => a.orden - b.orden)}
          columns={[
            { key: "o", header: "#", cell: (r) => <span className="tnum text-muted">{r.orden}</span> },
            { key: "n", header: "Rubro", cell: (r) => r.nombre },
            { key: "p", header: "Prefijo", cell: (r) => <span className="font-mono text-[12px]">{r.prefijo}</span> },
            { key: "c", header: "Productos", align: "right", cell: (r) => <span className="tnum">{db.productos.filter((p) => p.rubroId === r.id).length}</span> },
          ]}
          getRowId={(r) => r.id}
          onRowClick={setRubro}
          actions={<Button size="sm" onClick={() => setRubro("nuevo")}><Plus /> Nuevo rubro</Button>}
        />
      </div>
      <Card>
        <CardHeader><CardTitle>Motivos de ajuste</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {motivos.map((m, i) => (
            <div key={m.codigo} className="flex items-center gap-3">
              <Input aria-label={`Motivo ${m.codigo}`} value={m.nombre} onChange={(e) => setMotivos(motivos.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} className="h-8" />
              <span className="w-24 font-mono text-[11px] text-muted">{m.codigo}</span>
              <Switch aria-label="Activo" checked={m.activo} onCheckedChange={(v) => setMotivos(motivos.map((x, j) => (j === i ? { ...x, activo: v } : x)))} />
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Input aria-label="Nuevo motivo" className="h-8" value={nuevoMotivo} onChange={(e) => setNuevoMotivo(e.target.value)} placeholder="Nuevo motivo, ej. Robo" />
            <Button size="sm" variant="secondary" disabled={!nuevoMotivo.trim()} onClick={() => { setMotivos([...motivos, { codigo: nuevoMotivo.trim().toUpperCase().replace(/\W+/g, "_"), nombre: nuevoMotivo.trim(), activo: true }]); setNuevoMotivo(""); }}><Plus /> Agregar</Button>
          </div>
          <div className="flex justify-end"><Button size="sm" onClick={() => ok(useStore.getState().guardarMotivosAjuste(motivos), "Motivos guardados")}><Save /> Guardar motivos</Button></div>
        </CardContent>
      </Card>
      <Dialog open={!!rubro} onOpenChange={(v) => !v && setRubro(null)}>
        <DialogContent size="sm" title={rubro === "nuevo" ? "Nuevo rubro" : "Editar rubro"} footer={<><Button variant="secondary" onClick={() => setRubro(null)}>Cancelar</Button><Button onClick={() => { const r = useStore.getState().guardarRubro(fr, rubro === "nuevo" ? undefined : (rubro as Rubro).id); ok(r, "Rubro guardado"); if (r.ok) setRubro(null); }}><Save /> Guardar</Button></>}>
          <div className="space-y-3">
            <FormField label="Nombre" htmlFor="r-n"><Input id="r-n" value={fr.nombre} onChange={(e) => setFr({ ...fr, nombre: e.target.value })} /></FormField>
            <FormField label="Prefijo de código (2 o 3 dígitos)" htmlFor="r-p"><Input id="r-p" value={fr.prefijo} maxLength={3} onChange={(e) => setFr({ ...fr, prefijo: e.target.value.replace(/\D/g, "") })} /></FormField>
            <FormField label="Unidad de negocio">
              <Select aria-label="Unidad de negocio" value={fr.unidadNegocioId} onValueChange={(v) => setFr({ ...fr, unidadNegocioId: v })} options={db.unidadesNegocio.map((u) => ({ value: u.id, label: u.nombre }))} />
            </FormField>
            <FormField label="Orden" htmlFor="r-o"><NumberInput id="r-o" value={fr.orden} min={1} onValueChange={(v) => setFr({ ...fr, orden: Math.round(v) })} /></FormField>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Numeracion() {
  const db = useDb();
  const usuario = useUsuario();
  const esDueno = puede(usuario, "config.usuarios");
  const [edit, setEdit] = React.useState<{ k: string; ultimo: number; proximo: number; codigo: CodigoDoc; circ: 1 | 2 | null; pv: string; label: string } | null>(null);
  const [codigo, setCodigo] = React.useState("");
  const [soloUsados, setSoloUsados] = React.useState(false);
  const filas = filasNumeracion(db.numeradores, db.sucursales).filter((x) => (!codigo || x.codigo === codigo) && (!soloUsados || x.ultimo > 0));
  const columnas: Column<(typeof filas)[number]>[] = [
    { key: "c", header: "Documento", cell: (x) => <span><span className="font-mono text-[12px]">{x.codigo}{x.circuito ?? ""}</span> <span className="text-muted">· {x.nombre}</span></span> },
    { key: "ci", header: "Circuito", cell: (x) => (x.circuito ? <CircuitoBadge circuito={x.circuito} /> : <span className="text-disabled">—</span>) },
    { key: "pv", header: "Punto de venta", cell: (x) => <span className="font-mono text-[12px]">{x.puntoVenta}</span> },
    { key: "u", header: "Último usado", align: "right", cell: (x) => <span className={cn("tnum", !x.ultimo && "text-disabled")}>{x.ultimo || "—"}</span> },
    { key: "p", header: "Próximo número", cell: (x) => <span className="font-mono text-[12px]">{formatearDoc(x.codigo, x.circuito, x.puntoVenta, x.ultimo + 1)}</span> },
    {
      key: "a",
      header: "",
      align: "right",
      cell: (x) =>
        esDueno ? (
          <Button size="sm" variant="ghost" onClick={() => setEdit({ k: x.clave, ultimo: x.ultimo, proximo: x.ultimo + 1, codigo: x.codigo, circ: x.circuito, pv: x.puntoVenta, label: `${x.codigo}${x.circuito ?? ""} · PV ${x.puntoVenta}` })}>
            Establecer número inicial
          </Button>
        ) : null,
    },
  ];
  const codigos = [...new Set(filasNumeracion(db.numeradores, db.sucursales).map((x) => x.codigo))];
  const invalido = !!edit && (!Number.isInteger(edit.proximo) || edit.proximo - 1 < edit.ultimo);
  return (
    <>
      <p className="mb-3 max-w-3xl text-[13px] text-muted">
        Para continuar la numeración del sistema actual, establecé el próximo número de cada documento (por ejemplo, que la próxima NP2 de Casa Central sea 0001-00067300). No se puede volver atrás de un número ya usado.
        {!esDueno && " Solo el Dueño puede cambiarla."}
      </p>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(x) => x.clave}
        pageSize={50}
        filters={
          <>
            <div className="w-[220px]"><Select size="sm" aria-label="Documento" value={codigo} onValueChange={setCodigo} options={[{ value: "", label: "Todos los documentos" }, ...codigos.map((c) => ({ value: c, label: c }))]} /></div>
            <label className="flex items-center gap-2 text-[13px] text-muted"><Switch checked={soloUsados} onCheckedChange={setSoloUsados} aria-label="Solo los ya usados" /> Solo los ya usados</label>
          </>
        }
      />
      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        {edit && (
          <DialogContent
            size="sm"
            title={`Número inicial · ${edit.label}`}
            description="Ingresá el número con el que tiene que salir el próximo documento."
            footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button disabled={invalido} onClick={async () => { const r = await medir("establecerNumeroInicial", {}, () => useStore.getState().establecerNumeroInicial(edit.k, edit.proximo - 1)); ok(r, "Numeración actualizada"); if (r.ok) setEdit(null); }}>Guardar</Button></>}
          >
            <div className="space-y-3">
              <FormField label="Próximo número" htmlFor="num-u" error={invalido ? `Tiene que ser mayor a ${edit.ultimo} (último usado).` : undefined}>
                <NumberInput id="num-u" value={edit.proximo} min={edit.ultimo + 1} onValueChange={(v) => setEdit({ ...edit, proximo: Math.round(v) })} />
              </FormField>
              <Impacto accion="establecerNumeroInicial" />
              <p className="rounded-control bg-subtle px-3 py-2 text-[13px]">
                El próximo documento sale como <span className="font-mono font-medium">{formatearDoc(edit.codigo, edit.circ, edit.pv, Math.max(1, edit.proximo))}</span>
              </p>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function DatosDemo() {
  const db = useDb();
  const usuario = useUsuario();
  const { confirmar, dialog } = useConfirm();
  const [res, setRes] = React.useState<ResultadoIntegridad | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const esDueno = puede(usuario, "config.usuarios");
  const vacio = estaVacio(db);
  const guiaOculta = useStore((s) => !!s.ui.guiaOculta[s.ui.usuarioId ?? ""]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Datos del demo</CardTitle>
          <Badge variant={vacio ? "neutral" : "accent"}>{vacio ? "Solo estructura" : `${db.productos.length} artículos · ${db.clientes.length} clientes · ${db.proveedores.length} proveedores`}</Badge>
        </CardHeader>
        <CardContent className="space-y-4 text-[13px]">
          <p className="text-muted">Los datos viven en este navegador. El sistema arranca vacío (solo la estructura de la empresa) para cargar todo en vivo; los datos de ejemplo se cargan a pedido.</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-2 rounded-card border border-border p-3">
              <span className="font-medium text-ink">Vaciar todo</span>
              <span className="flex-1 text-[12px] text-muted">Deja solo la estructura: empresa, sucursales y depósitos, unidades de negocio y rubros, listas de precios sin precios, usuarios y parámetros. Numeración en 0.</span>
              <Button
                variant="danger"
                size="sm"
                disabled={!esDueno}
                onClick={() =>
                  confirmar({
                    titulo: "Vaciar todo (dejar solo estructura)",
                    descripcion: "Se borran artículos, clientes, proveedores, stock, ventas, acopios, compras, remitos, comprobantes, adjuntos y auditoría. Quedan la empresa, las sucursales, los rubros, las listas de precios y los usuarios.",
                    confirmLabel: "Vaciar todo",
                    variant: "danger",
                    onConfirm: async () => {
                      await medir("vaciarDatos", {}, () => useStore.getState().resetearDemo());
                      toast.success("Datos vaciados: quedó solo la estructura");
                      setRes(null);
                    },
                  })
                }
              >
                <Eraser /> Vaciar todo (dejar solo estructura)
              </Button>
              <Impacto accion="vaciarDatos" />
            </div>
            <div className="flex flex-col gap-2 rounded-card border border-border p-3">
              <span className="font-medium text-ink">Cargar datos de ejemplo</span>
              <span className="flex-1 text-[12px] text-muted">{RESUMEN_EJEMPLO}</span>
              <Button
                variant="secondary"
                size="sm"
                disabled={!esDueno}
                onClick={() =>
                  confirmar({
                    titulo: vacio ? "Cargar datos de ejemplo" : "Reemplazar por los datos de ejemplo",
                    descripcion: (
                      <>
                        <span className="block">Se cargan {RESUMEN_EJEMPLO.charAt(0).toLowerCase() + RESUMEN_EJEMPLO.slice(1)}</span>
                        {!vacio && <span className="mt-2 block font-medium text-danger">Ya hay datos cargados: se van a reemplazar. Se conservan los datos de la empresa y los parámetros.</span>}
                      </>
                    ),
                    confirmLabel: vacio ? "Cargar datos de ejemplo" : "Reemplazar",
                    variant: vacio ? "default" : "danger",
                    onConfirm: async () => {
                      const r = await medir("cargarDatosEjemplo", {}, () => useStore.getState().cargarDatosEjemplo({ reemplazar: !vacio }));
                      ok(r, "Datos de ejemplo cargados");
                      setRes(null);
                    },
                  })
                }
              >
                <DatabaseZap /> Cargar datos de ejemplo
              </Button>
              <Impacto accion="cargarDatosEjemplo" />
            </div>
            <div className="flex flex-col gap-2 rounded-card border border-border p-3">
              <span className="font-medium text-ink">Verificar integridad</span>
              <span className="flex-1 text-[12px] text-muted">Kardex contra stock físico, entregados y pendientes contra remitos, saldos de acopios y comprobantes, y numeración sin repetidos.</span>
              <Button variant="secondary" size="sm" onClick={() => setRes(verificarIntegridad(useStore.getState().db))}><ShieldCheck /> Verificar integridad</Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <label className="flex items-center gap-3"><Switch checked={!guiaOculta} onCheckedChange={(v) => useStore.getState().setGuiaOculta(!v)} /> Mostrar la guía de carga inicial en Inicio y en el Tablero</label>
            <InterruptorCapacitacionConfig />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Respaldos</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          <p className="text-muted">Guardá un respaldo antes de una reunión y restauralo después.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => { descargarArchivo(`respaldo-aceros-rnf-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db), "application/json"); toast.success("Respaldo descargado", { description: `Incluye la metadata de ${db.adjuntos.length} adjuntos.` }); }}><Download /> Exportar respaldo (JSON)</Button>
            <Button
              variant="secondary"
              onClick={async () => {
                const t = toast.loading("Armando ZIP de adjuntos…");
                try {
                  const [{ default: JSZip }, { obtenerBlob, asegurarAdjuntosDemo }, { saveAs }] = await Promise.all([import("jszip"), import("@/lib/adjuntos"), import("file-saver")]);
                  await asegurarAdjuntosDemo();
                  const zip = new JSZip();
                  let n = 0;
                  for (const a of db.adjuntos) {
                    if (!a.blobKey) continue;
                    const b = await obtenerBlob(a.blobKey);
                    if (b) {
                      zip.file(`${a.entidadTipo.toLowerCase()}/${a.id}-${a.nombre}`, b);
                      n++;
                    }
                  }
                  saveAs(await zip.generateAsync({ type: "blob" }), `adjuntos-aceros-rnf-${new Date().toISOString().slice(0, 10)}.zip`);
                  toast.success(`ZIP con ${n} archivos descargado`, { id: t });
                } catch {
                  toast.error("No se pudo armar el ZIP", { id: t });
                }
              }}
            >
              <Download /> Exportar adjuntos (ZIP)
            </Button>
            <Button variant="secondary" disabled={!esDueno} onClick={() => inputRef.current?.click()}><Upload /> Importar respaldo</Button>
            <input
              ref={inputRef}
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const texto = (await file.text()).replace(/^﻿/, "");
                  const r = useStore.getState().importarRespaldo(JSON.parse(texto));
                  ok(r, "Respaldo importado");
                } catch {
                  toast.error("No se pudo leer el archivo.");
                }
                e.target.value = "";
              }}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Verificación de integridad</CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setRes(verificarIntegridad(useStore.getState().db))}><ShieldCheck /> Verificar ahora</Button>
        </CardHeader>
        <CardContent className="text-[13px]">
          {!res ? (
            <p className="text-muted">Comprueba que el kardex cierre con el stock físico, que entregados y pendientes coincidan con los remitos, que el saldo de cada acopio sea importe − NP + DP + ACD, que los saldos de comprobantes cierren y que la numeración no se repita.</p>
          ) : (
            <ul className="space-y-2">
              <li className={cn("font-medium", res.ok ? "text-success" : "text-danger")}>{res.ok ? "Todo consistente" : "Se encontraron inconsistencias"} · {formatDateTime(new Date())}</li>
              {res.chequeos.map((c) => (
                <li key={c.nombre} className="flex gap-2">
                  {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
                  <span>
                    <span className="block">{c.nombre}</span>
                    <span className="block text-[12px] text-muted">{c.detalle}</span>
                    {c.errores.slice(0, 5).map((e) => <span key={e} className="block text-[12px] text-danger">{e}</span>)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {dialog}
    </div>
  );
}
