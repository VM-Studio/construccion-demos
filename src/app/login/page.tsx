import { BRAND } from "@/config/brand";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-app p-4">
      <div className="w-full max-w-[420px] rounded-card border border-border bg-surface p-6 text-center">
        <h1 className="text-title font-semibold">{BRAND.empresa}</h1>
        <p className="text-muted">{BRAND.sistema}</p>
        <p className="mt-6 text-[13px] text-muted">Próximamente</p>
      </div>
    </main>
  );
}
