import type { Configuracion, DatosEmpresa, EstadoInicial, Sucursal, UnidadNegocio, Usuario } from "@/domain/types";
import { newId } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir } from "../helpers";
import type { GetFn, SetFn } from "../types";

/** Configuración, usuarios, sucursales y datos del demo. */
export function crearSliceConfig(set: SetFn, get: GetFn) {
  return {
    actualizarConfig: (patch: Partial<Omit<Configuracion, "empresa" | "tipoCambioVigente">>) =>
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

    guardarSucursal: (data: { nombre: string; direccion: string; telefono: string; puntoVenta: string; puntoVentaRemito: string; depositoNombre: string; depositoDireccion: string; posiciones: string[] }, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "config.ver");
        if (!data.nombre.trim()) throw new ErrorNegocio("El nombre es obligatorio.");
        if (!/^\d{1,4}$/.test(data.puntoVenta)) throw new ErrorNegocio("El punto de venta debe ser numérico (hasta 4 dígitos).");
        const pv = data.puntoVenta.padStart(4, "0");
        if (!/^\d{1,5}$/.test(data.puntoVentaRemito)) throw new ErrorNegocio("El punto de venta de remitos debe ser numérico (hasta 5 dígitos).");
        const pvr = data.puntoVentaRemito.padStart(5, "0");
        const posiciones = data.posiciones.map((p) => p.trim()).filter(Boolean);
        const dup = tx.get("sucursales").find((s) => s.puntoVenta === pv && s.id !== id);
        if (dup) throw new ErrorNegocio(`El punto de venta ${pv} ya lo usa ${dup.nombre}.`);
        if (id) {
          const s = tx.must("sucursales", id);
          tx.patch("sucursales", id, { nombre: data.nombre, direccion: data.direccion, telefono: data.telefono, puntoVenta: pv, puntoVentaRemito: pvr });
          tx.patch("depositos", s.depositoId, { nombre: data.depositoNombre, direccion: data.depositoDireccion, posiciones });
          tx.auditar("Editó sucursal", "Sucursal", id, data.nombre);
          return id;
        }
        const sid = newId("suc");
        const did = newId("dep");
        const suc: Sucursal = { id: sid, nombre: data.nombre, direccion: data.direccion, telefono: data.telefono, depositoId: did, puntoVenta: pv, puntoVentaRemito: pvr, ...tx.meta() };
        tx.insert("sucursales", suc);
        tx.insert("depositos", { id: did, nombre: data.depositoNombre || `Depósito ${data.nombre}`, sucursalId: sid, direccion: data.depositoDireccion, posiciones: posiciones.length ? posiciones : ["Playa", "Mostrador"], ...tx.meta() });
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

    guardarUnidadNegocio: (data: { nombre: string; codigo: UnidadNegocio["codigo"]; rubroIds: string[] }, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "config.ver");
        if (!data.nombre.trim()) throw new ErrorNegocio("El nombre es obligatorio.");
        let unId = id;
        if (id) tx.patch("unidadesNegocio", id, { nombre: data.nombre.trim(), codigo: data.codigo });
        else {
          if (tx.get("unidadesNegocio").some((u) => u.codigo === data.codigo)) throw new ErrorNegocio(`Ya existe una unidad con código ${data.codigo}.`);
          const u: UnidadNegocio = { id: newId("un"), nombre: data.nombre.trim(), codigo: data.codigo, orden: tx.get("unidadesNegocio").length + 1, ...tx.meta() };
          tx.insert("unidadesNegocio", u);
          unId = u.id;
        }
        for (const r of tx.get("rubros"))
          if (data.rubroIds.includes(r.id) && r.unidadNegocioId !== unId) {
            tx.patch("rubros", r.id, { unidadNegocioId: unId! });
            for (const p of tx.get("productos")) if (p.rubroId === r.id) tx.patch("productos", p.id, { unidadNegocioId: unId! });
          }
        tx.auditar(id ? "Editó unidad de negocio" : "Creó unidad de negocio", "UnidadNegocio", unId!, data.nombre);
        return unId!;
      }),

    /** Fija el último número usado de un numerador (solo dueño): el próximo documento sale con n + 1. */
    establecerNumeroInicial: (clave: string, ultimo: number) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "config.usuarios");
        if (!Number.isInteger(ultimo) || ultimo < 0) throw new ErrorNegocio("Ingresá un número entero positivo.");
        const actual = tx.numeradores[clave] ?? 0;
        if (ultimo < actual) throw new ErrorNegocio(`No se puede retroceder la numeración (último usado: ${actual}).`);
        tx.setNumerador(clave, ultimo);
        tx.auditar("Estableció número inicial", "Numerador", clave, `${actual} → ${ultimo}`);
      }),

    guardarMotivosAjuste: (motivos: Configuracion["motivosAjuste"]) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "config.ver");
        tx.setConfig({ motivosAjuste: motivos });
        tx.auditar("Actualizó motivos de ajuste", "Configuracion", "motivos", `${motivos.length} motivos`);
      }),

  };
}
