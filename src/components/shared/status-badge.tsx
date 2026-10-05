import { Badge } from "@/components/ui/badge";
import { estadoInfo, type TipoEstado } from "@/domain/estados";

/** Badge de estado con el label y color del diccionario único de estados. */
export function StatusBadge({ tipo, estado, className }: { tipo: TipoEstado; estado: string; className?: string }) {
  const info = estadoInfo(tipo, estado);
  return (
    <Badge variant={info.variant} className={className}>
      {info.label}
    </Badge>
  );
}
