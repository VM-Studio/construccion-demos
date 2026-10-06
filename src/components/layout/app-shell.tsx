"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useStore, useHydrated } from "@/store";
import { useUsuario } from "@/store/selectors";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { PantallaCarga } from "./loader";
import { DemoBanner } from "./demo-banner";
import { Tour } from "./tour";

const LOADER_KEY = "cd-loader-visto";

/** Muestra el loader de marca sólo en la primera carga de la sesión (mín. 1,2 s). */
function useLoaderInicial() {
  const [visible, setVisible] = React.useState(true);
  React.useEffect(() => {
    let visto = false;
    try {
      visto = sessionStorage.getItem(LOADER_KEY) === "1";
      sessionStorage.setItem(LOADER_KEY, "1");
    } catch {}
    if (visto) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(false), 1200);
    return () => clearTimeout(t);
  }, []);
  return visible;
}

/** Layout autenticado: espera la hidratación, exige sesión y arma sidebar + header + contenido. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const hidratado = useHydrated();
  const usuario = useUsuario();
  const router = useRouter();
  const colapsado = useStore((s) => s.ui.sidebarColapsado);
  const loader = useLoaderInicial();

  React.useEffect(() => {
    if (hidratado && !usuario) router.replace("/login");
  }, [hidratado, usuario, router]);

  if (!hidratado || !usuario) return loader ? <PantallaCarga /> : <div className="min-h-dvh bg-app" />;

  return (
    <>
      {loader && <PantallaCarga />}
      <Sidebar />
      <div className={cn("flex min-h-dvh flex-col transition-[padding] duration-150", colapsado ? "lg:pl-16" : "lg:pl-60")}>
        <DemoBanner />
        <Header />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
      <Tour />
    </>
  );
}
