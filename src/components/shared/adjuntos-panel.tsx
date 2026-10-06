"use client";
import * as React from "react";
import { toast } from "sonner";
import { Download, Eye, FileText, Image as ImageIcon, Link2, Paperclip, Trash2, Upload } from "lucide-react";
import type { Adjunto, CategoriaAdjunto, EntidadAdjunto } from "@/domain/types";
import { puede } from "@/domain/permisos";
import { useDb, useUsuario } from "@/store/selectors";
import { ACCEPT_ADJUNTOS, adjuntarEnlace, descargarAdjunto, eliminarAdjunto, guardarAdjunto, obtenerUrl } from "@/lib/adjuntos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { useConfirm } from "./confirm-dialog";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const CATEGORIA_LABEL: Record<CategoriaAdjunto, string> = { REMITO_FIRMADO: "Remito firmado", FACTURA_PROVEEDOR: "Factura proveedor", OTRO: "Otro" };

export function formatearTamano(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, 2)} KB`;
  return `${formatNumber(bytes / 1024 / 1024, 2)} MB`;
}

/** Adjuntos de una entidad (memo por array del store). */
export function useAdjuntos(entidadTipo: EntidadAdjunto, entidadId: string) {
  const adjuntos = useDb().adjuntos;
  return React.useMemo(() => adjuntos.filter((a) => a.entidadTipo === entidadTipo && a.entidadId === entidadId), [adjuntos, entidadTipo, entidadId]);
}

/** Clip con contador (verde si hay remito firmado), como el "📎 1" del sistema actual. */
export function ClipContador({ cantidad, firmado, onClick, className }: { cantidad: number; firmado?: boolean; onClick?: () => void; className?: string }) {
  const Comp = onClick ? "button" : "span";
  return (
    <Tooltip content={firmado ? "Con remito firmado" : cantidad ? `${cantidad} adjunto${cantidad === 1 ? "" : "s"}` : "Sin adjuntos"}>
      <Comp
        onClick={onClick}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-[4px] border px-1.5 text-[11px] font-medium tnum",
          firmado ? "border-success/30 bg-success-soft text-success" : cantidad ? "border-border bg-subtle text-ink" : "border-border text-disabled",
          onClick && "hover:border-border-strong",
          className,
        )}
      >
        <Paperclip className="size-3" />
        {cantidad}
      </Comp>
    </Tooltip>
  );
}

/** Visor de un adjunto (imagen o PDF) en un diálogo. */
export function VisorAdjunto({ adjunto, onOpenChange }: { adjunto: Adjunto | null; onOpenChange: (v: boolean) => void }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    if (!adjunto) return;
    let revoke: (() => void) | undefined;
    setUrl(null);
    setError(false);
    if (adjunto.url) {
      setUrl(adjunto.url);
      return;
    }
    obtenerUrl(adjunto.blobKey).then((r) => {
      if (!r) return setError(true);
      revoke = r.revoke;
      setUrl(r.url);
    });
    return () => revoke?.();
  }, [adjunto]);
  return (
    <Dialog open={!!adjunto} onOpenChange={onOpenChange}>
      {adjunto && (
        <DialogContent
          size="xl"
          title={adjunto.nombre}
          description={`${CATEGORIA_LABEL[adjunto.categoria]} · ${formatearTamano(adjunto.tamanoBytes)}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>Cerrar</Button>
              {!adjunto.url && (
                <Button onClick={() => descargarAdjunto(adjunto.blobKey, adjunto.nombre)}>
                  <Download /> Descargar
                </Button>
              )}
            </>
          }
        >
          <div className="flex min-h-[420px] items-center justify-center rounded-card bg-subtle">
            {error ? (
              <p className="text-[13px] text-muted">El archivo no está disponible en este navegador.</p>
            ) : !url ? (
              <p className="text-[13px] text-muted">Cargando…</p>
            ) : adjunto.url ? (
              <a href={url} target="_blank" rel="noreferrer" className="text-[13px] font-medium underline">Abrir enlace en otra pestaña</a>
            ) : adjunto.tipoMime.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={adjunto.nombre} className="max-h-[70vh] max-w-full object-contain" />
            ) : (
              <iframe src={url} title={adjunto.nombre} className="h-[70vh] w-full rounded-card border-0 bg-white" />
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

/**
 * Panel reutilizable de adjuntos: subir archivo (foto/PDF a IndexedDB), adjuntar enlace web,
 * listar con categoría, ver, descargar y eliminar.
 */
export function AdjuntosPanel({ entidadTipo, entidadId, categoriaDefecto = "OTRO", className }: { entidadTipo: EntidadAdjunto; entidadId: string; categoriaDefecto?: CategoriaAdjunto; className?: string }) {
  const db = useDb();
  const usuario = useUsuario();
  const adjuntos = useAdjuntos(entidadTipo, entidadId);
  const [categoria, setCategoria] = React.useState<CategoriaAdjunto>(categoriaDefecto);
  const [enlace, setEnlace] = React.useState<string | null>(null);
  const [ver, setVer] = React.useState<Adjunto | null>(null);
  const [subiendo, setSubiendo] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const { confirmar, dialog } = useConfirm();
  const ordenados = [...adjuntos].sort((a, b) => b.subidoEn.localeCompare(a.subidoEn));

  const subir = async (files: FileList | null) => {
    if (!files?.length) return;
    setSubiendo(true);
    for (const f of Array.from(files)) {
      const r = await guardarAdjunto(f, { entidadTipo, entidadId, categoria });
      if (r.ok) toast.success(`Adjuntado: ${f.name}`);
      else toast.error(r.error);
    }
    setSubiendo(false);
    if (input.current) input.current.value = "";
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept={ACCEPT_ADJUNTOS} multiple className="hidden" onChange={(e) => subir(e.target.files)} aria-label="Seleccionar archivo" />
        <Button size="sm" onClick={() => input.current?.click()} loading={subiendo}>
          <Upload /> Seleccionar archivo…
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setEnlace("")}>
          <Link2 /> Adjuntar enlace web
        </Button>
        <div className="w-[180px]">
          <Select size="sm" aria-label="Categoría" value={categoria} onValueChange={(v) => setCategoria(v as CategoriaAdjunto)} options={db.config.categoriasAdjunto.map((c) => ({ value: c.codigo, label: c.nombre }))} />
        </div>
        <span className="text-[11px] text-muted">Fotos o PDF · máx. {db.config.tamanoMaxAdjuntoMB} MB</span>
      </div>
      {enlace !== null && (
        <div className="flex gap-2">
          <Input autoFocus aria-label="Dirección web" placeholder="https://…" value={enlace} onChange={(e) => setEnlace(e.target.value)} className="h-8" />
          <Button
            size="sm"
            onClick={() => {
              const r = adjuntarEnlace(enlace, { entidadTipo, entidadId, categoria });
              if (!r.ok) return toast.error(r.error);
              toast.success("Enlace adjuntado");
              setEnlace(null);
            }}
          >
            Adjuntar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEnlace(null)}>Cancelar</Button>
        </div>
      )}
      {ordenados.length === 0 ? (
        <div className="rounded-card border border-dashed border-border-strong px-4 py-8 text-center text-[13px] text-muted">
          <Paperclip className="mx-auto mb-2 size-5 text-disabled" />
          Sin adjuntos. Subí una foto o un PDF.
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {ordenados.map((a) => {
            const esPdf = a.tipoMime === "application/pdf";
            const esImg = a.tipoMime.startsWith("image/");
            const autor = db.usuarios.find((u) => u.id === a.subidoPor);
            const puedeBorrar = a.subidoPor === usuario?.id || puede(usuario, "acopios.autorizar");
            return (
              <li key={a.id} className="flex items-start gap-3 rounded-card border border-border bg-surface p-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-control", esPdf ? "bg-danger-soft text-danger" : esImg ? "bg-subtle text-ink" : "bg-subtle text-muted")}>
                  {esPdf ? <FileText className="size-4" /> : esImg ? <ImageIcon className="size-4" /> : <Link2 className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <button onClick={() => setVer(a)} className="block max-w-full truncate text-left text-[13px] font-medium text-ink hover:underline">
                    {a.nombre}
                  </button>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {formatearTamano(a.tamanoBytes)} · Subido el {formatDate(a.subidoEn, "dd/MM/yyyy HH:mm:ss")} · Subido por {autor?.avatarIniciales ?? "—"}
                  </div>
                  <Badge variant={a.categoria === "REMITO_FIRMADO" ? "success" : "neutral"} className="mt-1.5">
                    {CATEGORIA_LABEL[a.categoria]}
                  </Badge>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Tooltip content="Ver">
                    <Button variant="ghost" size="icon-sm" aria-label={`Ver ${a.nombre}`} onClick={() => setVer(a)}><Eye /></Button>
                  </Tooltip>
                  {!a.url && (
                    <Tooltip content="Descargar">
                      <Button variant="ghost" size="icon-sm" aria-label={`Descargar ${a.nombre}`} onClick={async () => { if (!(await descargarAdjunto(a.blobKey, a.nombre))) toast.error("El archivo no está disponible en este navegador."); }}><Download /></Button>
                    </Tooltip>
                  )}
                  {puedeBorrar && (
                    <Tooltip content="Eliminar">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Eliminar ${a.nombre}`}
                        onClick={() =>
                          confirmar({
                            titulo: `Eliminar ${a.nombre}`,
                            descripcion: "El archivo se borra de forma permanente.",
                            confirmLabel: "Eliminar",
                            variant: "danger",
                            onConfirm: async () => {
                              const r = await eliminarAdjunto(a.id);
                              if (!r.ok) toast.error(r.error);
                              else toast.success("Adjunto eliminado");
                            },
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </Tooltip>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <VisorAdjunto adjunto={ver} onOpenChange={(v) => !v && setVer(null)} />
      {dialog}
    </div>
  );
}
