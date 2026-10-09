"use client";
import * as React from "react";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import { Copy, KeyRound, LogOut, MoreHorizontal, Pencil, Plus, Power, Save } from "lucide-react";
import type { Rol, Usuario } from "@/domain/types";
import { ROL_LABEL } from "@/domain/permisos";
import { inicialesDe, validarCambioUsuario } from "@/domain/usuarios";
import { useStore } from "@/store";
import { useDb, useUsuario } from "@/store/selectors";
import { aplicarResultadoPropio } from "@/lib/datos/proveedor";
import { cambiarActivoUsuario, cerrarSesionesDe, crearUsuario, restablecerPassword } from "@/server/actions/sesion";
import { Impacto } from "@/capacitacion";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDateTime } from "@/lib/format";

const ROLES = (Object.keys(ROL_LABEL) as Rol[]).map((r) => ({ value: r, label: ROL_LABEL[r] }));
const conSucursal = (rol: Rol) => rol === "VENTAS" || rol === "DEPOSITO";
const refrescar = () => aplicarResultadoPropio(["Usuario"]);

type Acceso = { nombre: string; email: string; password: string; titulo: string };

/** Usuarios del sistema: alta con contraseña temporal, edición, restablecer, cerrar sesiones y baja. */
export function UsuariosTabla({ editable }: { editable: boolean }) {
  const db = useDb();
  const yo = useUsuario();
  const [edit, setEdit] = React.useState<Usuario | "nuevo" | null>(null);
  const [acceso, setAcceso] = React.useState<Acceso | null>(null);
  const [confirmar, setConfirmar] = React.useState<{ u: Usuario; accion: "restablecer" | "cerrar" | "activo" } | null>(null);

  const columnas: Column<Usuario>[] = [
    { key: "n", header: "Nombre", cell: (u) => <span className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-full bg-ink text-[10px] font-semibold text-white">{u.avatarIniciales}</span><span className="font-medium">{[u.nombre, u.apellido].filter(Boolean).join(" ")}</span>{u.id === yo?.id && <span className="text-[11px] text-muted">(vos)</span>}</span> },
    { key: "e", header: "Email", cell: (u) => <span className="text-muted">{u.email}</span> },
    { key: "r", header: "Rol", cell: (u) => <Badge variant={u.rol === "DUENO" ? "accent" : "neutral"}>{ROL_LABEL[u.rol]}</Badge> },
    { key: "s", header: "Sucursal", cell: (u) => <span className="text-muted">{u.sucursalId ? db.sucursales.find((s) => s.id === u.sucursalId)?.nombre : "Todas"}</span> },
    { key: "u", header: "Último acceso", cell: (u) => (u.ultimoAcceso ? <span className="text-muted" title={formatDateTime(u.ultimoAcceso)}>hace {formatDistanceToNowStrict(new Date(u.ultimoAcceso), { locale: es })}</span> : <span className="text-disabled">Nunca</span>) },
    { key: "a", header: "Estado", cell: (u) => (!u.activo ? <Badge>Inactivo</Badge> : u.debeCambiarPassword ? <Badge variant="warning">Contraseña temporal</Badge> : <Badge variant="success">Activo</Badge>) },
    ...(editable
      ? [{
          key: "acc",
          header: "",
          cell: (u: Usuario) => (
            <span onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" aria-label={`Acciones de ${u.nombre}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                <DropdownMenuContent className="w-52">
                  <DropdownMenuItem onSelect={() => setEdit(u)}><Pencil /> Editar</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setConfirmar({ u, accion: "restablecer" })}><KeyRound /> Restablecer contraseña</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setConfirmar({ u, accion: "cerrar" })}><LogOut /> Cerrar sesiones</DropdownMenuItem>
                  {u.id !== yo?.id && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setConfirmar({ u, accion: "activo" })}><Power /> {u.activo ? "Desactivar" : "Reactivar"}</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          ),
        } satisfies Column<Usuario>]
      : []),
  ];

  return (
    <>
      <DataTable
        rows={db.usuarios}
        columns={columnas}
        getRowId={(u) => u.id}
        onRowClick={editable ? setEdit : undefined}
        actions={editable ? <Button size="sm" onClick={() => setEdit("nuevo")}><Plus /> Nuevo usuario</Button> : <span className="text-[12px] text-muted">Sólo un dueño administra usuarios</span>}
      />
      {edit === "nuevo" && <NuevoUsuarioDialog onClose={() => setEdit(null)} onCreado={setAcceso} />}
      {edit && edit !== "nuevo" && <EditarUsuarioDialog usuario={edit} onClose={() => setEdit(null)} />}
      {confirmar && <ConfirmarDialog {...confirmar} onClose={() => setConfirmar(null)} onAcceso={setAcceso} />}
      {acceso && <AccesoDialog acceso={acceso} onClose={() => setAcceso(null)} />}
    </>
  );
}

function NuevoUsuarioDialog({ onClose, onCreado }: { onClose: () => void; onCreado: (a: Acceso) => void }) {
  const db = useDb();
  const [f, setF] = React.useState({ nombre: "", apellido: "", email: "", rol: "DUENO" as Rol, sucursalId: db.sucursales[0]?.id ?? "" });
  const [enviando, setEnviando] = React.useState(false);
  const guardar = async () => {
    setEnviando(true);
    const r = await crearUsuario({ nombre: f.nombre, apellido: f.apellido, email: f.email, rol: f.rol, sucursalId: conSucursal(f.rol) ? f.sucursalId || null : null });
    setEnviando(false);
    if (!r.ok) return toast.error(r.error);
    void refrescar();
    onClose();
    onCreado({ nombre: f.nombre.trim(), email: f.email.trim().toLowerCase(), password: r.data.passwordTemporal, titulo: "Usuario creado" });
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title="Nuevo usuario"
        description="Se genera una contraseña temporal que la persona cambia en su primer ingreso."
        footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={enviando} disabled={!f.nombre.trim() || !f.email.trim()} onClick={guardar}><Save /> Crear usuario</Button></>}
      >
        <div className="space-y-4">
          <Impacto accion="crearUsuario" />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nombre" required htmlFor="nu-n"><Input id="nu-n" autoFocus value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></FormField>
            <FormField label="Apellido" htmlFor="nu-a"><Input id="nu-a" value={f.apellido} onChange={(e) => setF({ ...f, apellido: e.target.value })} /></FormField>
            <FormField label="Email" required htmlFor="nu-e" className="sm:col-span-2"><Input id="nu-e" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></FormField>
            <FormField label="Rol" hint={f.rol === "DUENO" ? "Acceso completo, incluida la administración de usuarios." : undefined}><Select value={f.rol} onValueChange={(v) => setF({ ...f, rol: v as Rol })} options={ROLES} /></FormField>
            {conSucursal(f.rol) && <FormField label="Sucursal asignada"><Select value={f.sucursalId} onValueChange={(v) => setF({ ...f, sucursalId: v })} options={db.sucursales.map((s) => ({ value: s.id, label: s.nombre }))} /></FormField>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditarUsuarioDialog({ usuario, onClose }: { usuario: Usuario; onClose: () => void }) {
  const db = useDb();
  const yo = useUsuario();
  const [f, setF] = React.useState({ nombre: usuario.nombre, apellido: usuario.apellido ?? "", email: usuario.email, rol: usuario.rol, sucursalId: usuario.sucursalId ?? db.sucursales[0]?.id ?? "" });
  const [enviando, setEnviando] = React.useState(false);
  const propio = usuario.id === yo?.id;
  const bloqueo = yo ? validarCambioUsuario(db.usuarios, yo.id, usuario.id, { rol: f.rol, activo: usuario.activo }) : null;
  const guardar = async () => {
    setEnviando(true);
    const r = await useStore.getState().guardarUsuario({ nombre: f.nombre.trim(), apellido: f.apellido.trim() || undefined, email: f.email.trim(), rol: f.rol, sucursalId: conSucursal(f.rol) ? f.sucursalId : undefined, activo: usuario.activo, avatarIniciales: inicialesDe(f.nombre, f.apellido) }, usuario.id);
    setEnviando(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Usuario guardado");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={`Editar ${usuario.nombre}`} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={enviando} disabled={!f.nombre.trim() || !f.email.trim() || !!bloqueo} onClick={guardar}><Save /> Guardar</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nombre" required htmlFor="eu-n"><Input id="eu-n" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></FormField>
          <FormField label="Apellido" htmlFor="eu-a"><Input id="eu-a" value={f.apellido} onChange={(e) => setF({ ...f, apellido: e.target.value })} /></FormField>
          <FormField label="Email" required htmlFor="eu-e" className="sm:col-span-2"><Input id="eu-e" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></FormField>
          <FormField label="Rol" error={bloqueo ?? undefined} hint={propio ? "No podés cambiar tu propio rol." : undefined}><Select value={f.rol} disabled={propio} onValueChange={(v) => setF({ ...f, rol: v as Rol })} options={ROLES} /></FormField>
          {conSucursal(f.rol) && <FormField label="Sucursal asignada"><Select value={f.sucursalId} onValueChange={(v) => setF({ ...f, sucursalId: v })} options={db.sucursales.map((s) => ({ value: s.id, label: s.nombre }))} /></FormField>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const TEXTOS_CONFIRMAR = {
  restablecer: (u: Usuario) => ({ titulo: `Restablecer la contraseña de ${u.nombre}`, texto: "Se genera una contraseña temporal nueva y se cierran sus sesiones abiertas. La va a tener que cambiar al ingresar.", boton: "Restablecer" }),
  cerrar: (u: Usuario) => ({ titulo: `Cerrar las sesiones de ${u.nombre}`, texto: "Todos los navegadores donde haya ingresado vuelven al login en menos de un minuto.", boton: "Cerrar sesiones" }),
  activo: (u: Usuario) => (u.activo ? { titulo: `Desactivar a ${u.nombre}`, texto: "No va a poder ingresar y sus sesiones abiertas se cierran. Sus movimientos quedan en el historial.", boton: "Desactivar" } : { titulo: `Reactivar a ${u.nombre}`, texto: "Vuelve a poder ingresar con su contraseña.", boton: "Reactivar" }),
};

function ConfirmarDialog({ u, accion, onClose, onAcceso }: { u: Usuario; accion: "restablecer" | "cerrar" | "activo"; onClose: () => void; onAcceso: (a: Acceso) => void }) {
  const db = useDb();
  const yo = useUsuario();
  const [enviando, setEnviando] = React.useState(false);
  const t = TEXTOS_CONFIRMAR[accion](u);
  const bloqueo = accion === "activo" && yo ? validarCambioUsuario(db.usuarios, yo.id, u.id, { rol: u.rol, activo: !u.activo }) : null;
  const ejecutar = async () => {
    setEnviando(true);
    if (accion === "restablecer") {
      const r = await restablecerPassword(u.id);
      setEnviando(false);
      if (!r.ok) return toast.error(r.error);
      void refrescar();
      onClose();
      return onAcceso({ nombre: u.nombre, email: r.data.email, password: r.data.passwordTemporal, titulo: "Contraseña restablecida" });
    }
    const r = accion === "cerrar" ? await cerrarSesionesDe(u.id) : await cambiarActivoUsuario(u.id, !u.activo);
    setEnviando(false);
    if (!r.ok) return toast.error(r.error);
    void refrescar();
    toast.success(accion === "cerrar" ? "Sesiones cerradas" : u.activo ? "Usuario desactivado" : "Usuario reactivado");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={t.titulo} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant={accion === "activo" && u.activo ? "danger" : "primary"} loading={enviando} disabled={!!bloqueo} onClick={ejecutar}>{t.boton}</Button></>}>
        <p className="text-[13px] text-muted">{t.texto}</p>
        {bloqueo && <p className="mt-3 rounded-control bg-danger-soft px-3 py-2 text-[13px] text-danger">{bloqueo}</p>}
      </DialogContent>
    </Dialog>
  );
}

/** La contraseña temporal se muestra UNA sola vez: al cerrar este diálogo no se puede volver a ver. */
function AccesoDialog({ acceso, onClose }: { acceso: Acceso; onClose: () => void }) {
  const empresa = useDb().config.empresa.empresa;
  const url = typeof window !== "undefined" ? `${window.location.origin}/login` : "";
  const texto = `Hola ${acceso.nombre}, ya tenés usuario en el sistema de ${empresa}.\n\nIngresá en: ${url}\nEmail: ${acceso.email}\nContraseña temporal: ${acceso.password}\n\nAl entrar te va a pedir que elijas una contraseña propia.`;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Datos de acceso copiados");
    } catch {
      toast.error("No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={acceso.titulo} description="Mandale estos datos por WhatsApp. La contraseña temporal no se vuelve a mostrar." footer={<><Button variant="secondary" onClick={onClose}>Listo</Button><Button onClick={copiar}><Copy /> Copiar datos de acceso</Button></>}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-control border border-border bg-subtle px-4 py-3 text-[13px]">
          <dt className="text-muted">Ingreso</dt><dd className="truncate">{url}</dd>
          <dt className="text-muted">Email</dt><dd className="truncate">{acceso.email}</dd>
          <dt className="text-muted">Contraseña</dt><dd className="font-mono text-[15px] font-semibold tracking-wider">{acceso.password}</dd>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
