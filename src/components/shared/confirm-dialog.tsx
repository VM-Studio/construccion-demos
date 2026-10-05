"use client";
import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  onOpenChange,
  titulo,
  descripcion,
  confirmLabel = "Confirmar",
  variant = "default",
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo: string;
  descripcion?: React.ReactNode;
  confirmLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void | boolean | Promise<void | boolean>;
  children?: React.ReactNode;
}) {
  const [loading, setLoading] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        title={titulo}
        description={descripcion}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              variant={variant === "danger" ? "danger" : "primary"}
              loading={loading}
              onClick={async () => {
                setLoading(true);
                const r = await onConfirm();
                setLoading(false);
                if (r !== false) onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        {children ?? <p className="text-[13px] text-muted">Esta acción queda registrada en la auditoría.</p>}
      </DialogContent>
    </Dialog>
  );
}

/** Hook para confirmar acciones de forma imperativa. */
export function useConfirm() {
  const [state, setState] = React.useState<{
    titulo: string;
    descripcion?: React.ReactNode;
    confirmLabel?: string;
    variant?: "default" | "danger";
    onConfirm: () => void | boolean | Promise<void | boolean>;
  } | null>(null);
  const confirmar = React.useCallback((s: NonNullable<typeof state>) => setState(s), []);
  const dialog = state ? (
    <ConfirmDialog open onOpenChange={(v) => !v && setState(null)} {...state} />
  ) : null;
  return { confirmar, dialog };
}
