import Image from "next/image";

/** Logo sin fondo de Aceros RNF para documentos impresos (remitos, OC, recibos…) y pantallas claras. */
export function LogoEmpresa({ nombre = "Aceros RNF", alto = 64, className }: { nombre?: string; alto?: number; className?: string }) {
  return <Image src="/logo-sinfondo.png" alt={nombre} width={1536} height={1024} priority className={className} style={{ height: alto, width: "auto" }} />;
}
