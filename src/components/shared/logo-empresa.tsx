/** Logo de Aceros RNF (marca + nombre) para documentos impresos y la interfaz. */
export function LogoEmpresa({ nombre = "ACEROS RNF", bajada = "Corralón · Ferretería", size = 44 }: { nombre?: string; bajada?: string; size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
        <rect width="48" height="48" rx="8" fill="#141413" />
        <rect x="0" y="40" width="48" height="8" fill="#B7791F" />
        <rect x="0" y="36" width="48" height="4" fill="#141413" />
        <text x="24" y="29" textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontSize="17" fontWeight="800" fill="#F7F7F5" letterSpacing="0.5">RNF</text>
      </svg>
      <div className="leading-tight">
        <div className="text-[19px] font-extrabold tracking-tight">{nombre.toUpperCase()}</div>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">{bajada}</div>
      </div>
    </div>
  );
}
