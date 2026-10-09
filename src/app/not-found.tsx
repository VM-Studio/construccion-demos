import Link from "next/link";

export default function NoEncontrada() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-app px-4 text-center">
      <p className="text-[13px] font-medium text-muted">404</p>
      <h1 className="mt-1 text-title font-semibold tracking-tight">No encontramos esta página</h1>
      <p className="mt-1 max-w-sm text-[13px] text-muted">La dirección no existe o ya no está disponible.</p>
      <Link href="/inicio" className="mt-5 inline-flex h-9 items-center rounded-control bg-ink px-4 text-[13px] font-medium text-white hover:bg-ink-hover">Ir a Inicio</Link>
    </main>
  );
}
