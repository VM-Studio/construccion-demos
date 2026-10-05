import type { Configuracion, DatosEmpresa, EstadoInicial, Sucursal, Usuario } from "@/domain/types";
import { crearSeed } from "@/data/seed";
import { newId } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir } from "../helpers";
import type { GetFn, SetFn } from "../types";

/** Configuración, usuarios, sucursales y datos del demo. */
export function crearSliceConfig(set: SetFn, get: GetFn) {
  return {
    actualizarConfig: (patch: Partial<Omit<Configuracion, "empresa">>) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "config.ver");
        tx.setConfig(patch);
        tx.auditar("Actualizó parámetros", "Configuracion", "config", Object.keys(patch).join(", "));
      }),

    actualizarEmpresa: (empresa: DatosEmpresa) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "config.ver");
        if (!empresa.empresa.trim()) throw new ErrorNegocio("El nombre de fantasía es obligatorio.");
        tx.setConfig({ empresa });
        tx.auditar("Actualizó datos de la empresa", "Configuracion", "empresa", empresa.empresa);
      }),

    guardarSucursal: (data: { nombre: string; direccion: string; telefono: string; puntoVenta: string; depositoNombre: string; depositoDireccion: string }, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "config.ver");
        if (!data.nombre.trim()) throw new ErrorNegocio("El nombre es obligatorio.");
        if (!/^\d{1,4}$/.test(data.puntoVenta)) throw new ErrorNegocio("El punto de venta debe ser numérico (hasta 4 dígitos).");
        const pv = data.puntoVenta.padStart(4, "0");
        const dup = tx.get("sucursales").find((s) => s.puntoVenta === pv && s.id !== id);
        if (dup) throw new ErrorNegocio(`El punto de venta ${pv} ya lo usa ${dup.nombre}.`);
        if (id) {
          const s = tx.must("sucursales", id);
          tx.patch("sucursales", id, { nombre: data.nombre, direccion: data.direccion, telefono: data.telefono, puntoVenta: pv });
          tx.patch("depositos", s.depositoId, { nombre: data.depositoNombre, direccion: data.depositoDireccion });
          tx.auditar("Editó sucursal", "Sucursal", id, data.nombre);
          return id;
        }
        const sid = newId("suc");
        const did = newId("dep");
        const suc: Sucursal = { id: sid, nombre: data.nombre, direccion: data.direccion, telefono: data.telefono, depositoId: did, puntoVenta: pv, ...tx.meta() };
        tx.insert("sucursales", suc);
        tx.insert("depositos", { id: did, nombre: data.depositoNombre || `Depósito ${data.nombre}`, sucursalId: sid, direccion: data.depositoDireccion, ...tx.meta() });
        for (const p of tx.get("productos")) tx.insert("stock", { id: newId("stk"), productoId: p.id, depositoId: did, cantidadFisica: 0, ...tx.meta() });
        tx.auditar("Creó sucursal", "Sucursal", sid, `${data.nombre} · PV ${pv}`);
        return sid;
      }),

    guardarUsuario: (data: Omit<Usuario, "id" | "creadoEn" | "actualizadoEn">, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "config.usuarios");
        if (!data.nombre.trim() || !data.email.trim()) throw new ErrorNegocio("Nombre y email son obligatorios.");
        if (!/^\S+@\S+\.\S+$/.test(data.email)) throw new ErrorNegocio("El email no es válido.");
        if ((data.rol === "VENTAS" || data.rol === "DEPOSITO") && !data.sucursalId) throw new ErrorNegocio("Ventas y Depósito necesitan una sucursal asignada.");
        if (id === tx.usuarioId && !data.activo) throw new ErrorNegocio("No podés desactivar tu propio usuario.");
        if (id) {
          tx.patch("usuarios", id, data);
          tx.auditar("Editó usuario", "Usuario", id, `${data.nombre} · ${data.rol}`);
          return id;
        }
        const u: Usuario = { ...data, id: newId("usr"), ...tx.meta() };
        tx.insert("usuarios", u);
        tx.auditar("Creó usuario", "Usuario", u.id, `${data.nombre} · ${data.rol}`);
        return u.id;
      }),

    guardarMotivosAjuste: (motivos: Configuracion["motivosAjuste"]) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "config.ver");
        tx.setConfig({ motivosAjuste: motivos });
        tx.auditar("Actualizó motivos de ajuste", "Configuracion", "motivos", `${motivos.length} motivos`);
      }),

    /** Vuelve todos los datos al estado semilla (conserva la sesión). */
    resetearDemo: () => {
      const seed = crearSeed(new Date());
      const usuarioId = get().ui.usuarioId;
      set((s) => ({
        db: seed,
        ui: { ...s.ui, usuarioId: usuarioId && seed.usuarios.some((u) => u.id === usuarioId) ? usuarioId : null, sucursalActivaId: null },
      }));
    },

    importarRespaldo: (db: EstadoInicial) => {
      const claves: (keyof EstadoInicial)[] = ["productos", "clientes", "pedidos", "stock", "movimientos", "config", "numeradores"];
      if (!db || typeof db !== "object" || claves.some((k) => !(k in db))) return { ok: false as const, error: "El archivo no es un respaldo válido de este sistema." };
      set({ db });
      return { ok: true as const, data: undefined };
    },
  };
}
