"use client";

import * as React from "react";
import { toast } from "sonner";
import { Mail, Paperclip } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";

/**
 * Envío por email (sólo UI en el demo): destinatario, asunto, mensaje y
 * vista previa del PDF adjunto.
 */
export function EmailDialog({
  open,
  onOpenChange,
  para,
  asunto,
  mensaje,
  adjunto,
  documento,
  onEnviado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  para: string;
  asunto: string;
  mensaje: string;
  adjunto: string;
  documento: React.ReactNode;
  onEnviado?: () => void;
}) {
  const [a, setA] = React.useState(para);
  const [s, setS] = React.useState(asunto);
  const [m, setM] = React.useState(mensaje);
  React.useEffect(() => {
    if (open) {
      setA(para);
      setS(asunto);
      setM(mensaje);
    }
  }, [open, para, asunto, mensaje]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        title="Enviar por email"
        description="En el demo el envío es simulado: no sale ningún correo."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                onEnviado?.();
                toast.success(`Enviado a ${a}`, { description: "Envío simulado (demo)." });
                onOpenChange(false);
              }}
            >
              <Mail /> Enviar
            </Button>
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3">
            <FormField label="Para" htmlFor="em-para">
              <Input id="em-para" value={a} onChange={(e) => setA(e.target.value)} />
            </FormField>
            <FormField label="Asunto" htmlFor="em-asunto">
              <Input id="em-asunto" value={s} onChange={(e) => setS(e.target.value)} />
            </FormField>
            <FormField label="Mensaje" htmlFor="em-msg">
              <Textarea id="em-msg" value={m} onChange={(e) => setM(e.target.value)} rows={7} />
            </FormField>
            <div className="flex items-center gap-2 rounded-control border border-border bg-subtle px-3 py-2 text-[13px]">
              <Paperclip className="size-4 text-muted" /> {adjunto}
            </div>
          </div>
          <div className="max-h-[460px] overflow-auto rounded-card border border-border bg-subtle p-3">
            <div className="origin-top-left scale-[0.62] [width:161%]">
              <div className="border border-border bg-white">{documento}</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
