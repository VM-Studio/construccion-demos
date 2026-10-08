"use client";
import * as React from "react";
import { toast } from "sonner";
import { FileText, UploadCloud } from "lucide-react";
import { useDb } from "@/store/selectors";
import { ACCEPT_ADJUNTOS, guardarAdjunto, validarArchivo } from "@/lib/adjuntos";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatearTamano } from "@/components/shared/adjuntos-panel";
import { cn } from "@/lib/utils";
import { Impacto, medir } from "@/capacitacion";

/**
 * "Subir remito firmado": zona de arrastre o click (foto o PDF), vista previa y subida a
 * Vercel Blob. "Hacer después" deja el remito hecho pero sin firmar.
 */
export function SubirFirmadoDialog({ remitoId, open, onOpenChange }: { remitoId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const db = useDb();
  const remito = db.remitos.find((r) => r.id === remitoId);
  const maxMB = db.config.tamanoMaxAdjuntoMB || 10;
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [arrastrando, setArrastrando] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setError(null);
    }
  }, [open]);
  React.useEffect(() => {
    if (!file || !file.type.startsWith("image/")) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const elegir = (f?: File) => {
    if (!f) return;
    const e = validarArchivo(f, maxMB);
    setError(e);
    setFile(e ? null : f);
  };
  const guardar = async () => {
    if (!file) return;
    setGuardando(true);
    const nombre = `Remito firmado ${remito?.numero.replace(/\s+/g, "_") ?? ""}${file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ""}`;
    const r = await medir("subirRemitoFirmado", { remitoId, clienteId: remito?.clienteId, notaPedidoId: remito?.notaPedidoId }, () => guardarAdjunto(file, { entidadTipo: "REMITO", entidadId: remitoId, categoria: "REMITO_FIRMADO", nombre }));
    setGuardando(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Remito firmado guardado", { description: "Queda en Adjuntos del remito." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="md"
        title="Subir remito firmado"
        description={`${remito?.numero ?? ""} · foto o PDF del remito firmado por el cliente (máx. ${maxMB} MB)`}
        footer={
          <>
            <Button variant="ghost" onClick={() => { onOpenChange(false); toast.info("Quedó pendiente de remito firmado", { description: "Lo ves en el KPI de remitos sin firmar." }); }}>Hacer después</Button>
            <Button onClick={() => void guardar()} disabled={!file} loading={guardando}>Guardar</Button>
          </>
        }
      >
        <input ref={input} type="file" accept={ACCEPT_ADJUNTOS} className="hidden" aria-label="Seleccionar remito firmado" onChange={(e) => elegir(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files?.[0]); }}
          className={cn("flex min-h-[220px] w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-4 text-center transition-colors", arrastrando ? "border-ink bg-subtle" : "border-border-strong hover:border-ink")}
        >
          {file ? (
            preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Vista previa" className="max-h-[260px] rounded-control object-contain" />
            ) : (
              <span className="flex items-center gap-2 text-[13px]"><FileText className="size-6 text-danger" /> PDF listo para guardar</span>
            )
          ) : (
            <>
              <UploadCloud className="size-8 text-disabled" />
              <span className="text-[13px] font-medium text-ink">Arrastrá la foto o el PDF acá, o hacé click para elegirlo</span>
              <span className="text-[12px] text-muted">Imágenes o PDF · hasta {maxMB} MB</span>
            </>
          )}
        </button>
        {file && <p className="mt-2 text-[12px] text-muted">{file.name} · {formatearTamano(file.size)}</p>}
        {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
        <Impacto accion="subirRemitoFirmado" className="mt-3" />
      </DialogContent>
    </Dialog>
  );
}
