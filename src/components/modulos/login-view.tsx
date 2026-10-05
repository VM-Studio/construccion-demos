"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useStore, useHydrated } from "@/store";
import { useEmpresa } from "@/store/selectors";
import { ROL_LABEL } from "@/domain/permisos";
import { BRAND } from "@/config/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/shared/confirm-dialog";

export function LoginView() {
  const router = useRouter();
  const hidratado = useHydrated();
  const usuarios = useStore((s) => s.db.usuarios);
  const sucursales = useStore((s) => s.db.sucursales);
  const usuarioId = useStore((s) => s.ui.usuarioId);
  const login = useStore((s) => s.login);
  const resetear = useStore((s) => s.resetearDemo);
  const empresa = useEmpresa();
  const { confirmar, dialog } = useConfirm();

  React.useEffect(() => {
    if (hidratado && usuarioId) router.replace("/tablero");
  }, [hidratado, usuarioId, router]);

  const rolLegible = (u: (typeof usuarios)[number]) => {
    const suc = sucursales.find((s) => s.id === u.sucursalId)?.nombre;
    return suc ? `${ROL_LABEL[u.rol]} · ${suc}` : ROL_LABEL[u.rol];
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-app px-4 py-10">
      <div className="w-full max-w-[420px] rounded-card border border-border bg-surface">
        <div className="border-b border-border px-6 py-5 text-center">
          <h1 className="text-title font-semibold tracking-tight">{empresa.empresa}</h1>
          <p className="text-[13px] text-muted">{BRAND.sistema}</p>
        </div>
        <div className="px-3 py-4">
          <p className="mb-2 px-3 text-[13px] text-muted">Elegí con qué usuario entrar al demo</p>
          <ul className="flex flex-col">
            {!hidratado
              ? Array.from({ length: 6 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </li>
                ))
              : usuarios
                  .filter((u) => u.activo)
                  .map((u) => (
                    <li key={u.id}>
                      <button
                        onClick={() => {
                          login(u.id);
                          router.push("/tablero");
                        }}
                        className="group flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors hover:bg-subtle focus-visible:bg-subtle"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-white">{u.avatarIniciales}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium text-ink">{u.nombre}</span>
                          <span className="block truncate text-[12px] text-muted">{rolLegible(u)}</span>
                        </span>
                        <ChevronRight className="size-4 text-disabled transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                      </button>
                    </li>
                  ))}
          </ul>
        </div>
        <div className="border-t border-border px-6 py-3 text-center">
          <button
            className="inline-flex items-center gap-1.5 text-[12px] text-muted underline-offset-4 hover:text-ink hover:underline"
            onClick={() =>
              confirmar({
                titulo: "Restablecer datos del demo",
                descripcion: "Se borran todos los cambios hechos y se vuelve a cargar el set de datos de demostración.",
                confirmLabel: "Restablecer",
                variant: "danger",
                onConfirm: () => {
                  resetear();
                  toast.success("Datos del demo restablecidos");
                },
              })
            }
          >
            <RotateCcw className="size-3.5" />
            Restablecer datos del demo
          </button>
        </div>
      </div>
      <p className="mt-6 text-[12px] text-muted">Demo desarrollado por {BRAND.agencia}</p>
      {dialog}
    </main>
  );
}
