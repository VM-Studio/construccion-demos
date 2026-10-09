"use client";
import * as React from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { formatearCUIT, validarCUIT, buscarPorCuit } from "@/domain/cuit";
import type { DatosPadron } from "@/domain/padron";
import { consultarPadronAction } from "@/server/actions/padron";
import { useDb } from "@/store/selectors";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { ImpactoCampo } from "@/capacitacion";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Estado = { tipo: "inicial" } | { tipo: "consultando" } | { tipo: "ok"; datos: DatosPadron } | { tipo: "sin-datos" };

/**
 * Campo CUIT/CUIL con consulta al padrón de ARCA: al completar 11 dígitos válidos consulta (debounce
 * 400 ms, por server action) y avisa con `onDatos`; el formulario decide qué completar.
 * Si el CUIT ya existe como cliente o proveedor, avisa con link a la ficha y marca `duplicado`.
 */
export function CuitPadron({
  entidad,
  value,
  onChange,
  onDatos,
  onDuplicado,
  excluirId,
  disabled,
  required,
  error,
  autoFocus,
}: {
  entidad: "cliente" | "proveedor";
  value: string;
  onChange: (v: string) => void;
  onDatos: (d: DatosPadron, reemplazar: boolean) => void;
  onDuplicado?: (dup: boolean) => void;
  excluirId?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  autoFocus?: boolean;
}) {
  const db = useDb();
  const [estado, setEstado] = React.useState<Estado>({ tipo: "inicial" });
  const ultimo = React.useRef<string>("");
  const digitos = value.replace(/\D/g, "");
  const valido = digitos.length === 11 && !validarCUIT(digitos);
  const dupCliente = valido ? buscarPorCuit(db.clientes, digitos, entidad === "cliente" ? excluirId : undefined) : undefined;
  const dupProveedor = valido ? buscarPorCuit(db.proveedores, digitos, entidad === "proveedor" ? excluirId : undefined) : undefined;
  const dup = entidad === "cliente" ? dupCliente : dupProveedor;
  const otro = entidad === "cliente" ? dupProveedor : dupCliente;

  React.useEffect(() => onDuplicado?.(!!dup), [dup, onDuplicado]);

  const consultar = React.useCallback(
    async (cuit: string, forzar = false, reemplazar = false) => {
      setEstado({ tipo: "consultando" });
      const r = await consultarPadronAction(cuit, { forzar });
      if (ultimo.current !== cuit) return;
      if (r.ok && r.data) {
        setEstado({ tipo: "ok", datos: r.data });
        onDatos(r.data, reemplazar);
      } else setEstado({ tipo: "sin-datos" });
    },
    [onDatos],
  );

  React.useEffect(() => {
    if (!valido || disabled || dup) {
      if (!valido) setEstado({ tipo: "inicial" });
      ultimo.current = valido ? digitos : "";
      return;
    }
    if (ultimo.current === digitos) return;
    ultimo.current = digitos;
    const t = setTimeout(() => void consultar(digitos), 400);
    return () => clearTimeout(t);
  }, [digitos, valido, disabled, dup, consultar]);

  const fuente = estado.tipo === "ok" ? (estado.datos.fuente === "ARCA" ? "ARCA" : "fuente pública") : "";
  const errVisible = error ?? (digitos.length === 11 && !valido ? validarCUIT(digitos) ?? undefined : undefined);

  return (
    <FormField label="CUIT / CUIL" required={required} error={errVisible} htmlFor={`${entidad}-cuit`} className="sm:col-span-2">
      <div className="relative">
        <Input
          id={`${entidad}-cuit`}
          disabled={disabled}
          autoFocus={autoFocus}
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            const d = v.replace(/\D/g, "");
            onChange(d.length === 11 ? formatearCUIT(d) : v);
          }}
          onBlur={() => value && onChange(formatearCUIT(value))}
          placeholder="20-12345678-9"
          aria-invalid={!!errVisible || !!dup}
          className="pr-40"
        />
        {estado.tipo === "consultando" && (
          <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-[12px] text-muted">
            <Loader2 className="size-3.5 animate-spin" /> Consultando padrón…
          </span>
        )}
      </div>
      {dup && (
        <p className="text-[12px] text-danger">
          Ya existe {entidad === "cliente" ? "el cliente" : "el proveedor"}{" "}
          <Link className="font-medium underline" href={entidad === "cliente" ? `/clientes/${dup.id}` : `/proveedores/${dup.id}`}>
            {dup.razonSocial}
          </Link>{" "}
          con este CUIT: no se puede duplicar.
        </p>
      )}
      {!dup && otro && (
        <p className="text-[12px] text-muted">
          Este CUIT ya está cargado como {entidad === "cliente" ? "proveedor" : "cliente"}: {otro.razonSocial}.
        </p>
      )}
      {estado.tipo === "ok" && (
        <div className="space-y-1">
          <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]", estado.datos.estado === "ACTIVO" ? "text-success" : "text-warning")}>
            <span>
              Datos obtenidos de {fuente} el {formatDate(estado.datos.obtenidoEn)} · Estado: {estado.datos.estado === "ACTIVO" ? "activo" : "inactivo"}
            </span>
            <button type="button" className="inline-flex items-center gap-1 text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => void consultar(digitos, true)}>
              <RefreshCw className="size-3" /> Volver a consultar
            </button>
            <button type="button" className="text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => onDatos(estado.datos, true)}>
              Reemplazar con los datos del padrón
            </button>
          </p>
          {estado.datos.estado === "INACTIVO" && <p className="rounded-control bg-warning-soft px-2 py-1 text-[12px] text-warning">Este CUIT figura inactivo en ARCA.</p>}
          {!estado.datos.condicionIVA && <p className="text-[12px] text-muted">El padrón no informó la condición de IVA: elegila a mano.</p>}
        </div>
      )}
      {estado.tipo === "sin-datos" && <p className="text-[12px] text-muted">No se pudo consultar el padrón; completá los datos a mano.</p>}
      <ImpactoCampo campo="padron.cuit" />
    </FormField>
  );
}
