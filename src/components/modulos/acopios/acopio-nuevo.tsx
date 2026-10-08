"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Boxes, Eye, Plus, Printer } from "lucide-react";
import { useStore } from "@/store";
import { useDb, useUsuario } from "@/store/selectors";
import type { Circuito, FormaPagoAcopio } from "@/domain/types";
import { PageHeader } from "@/components/shared/page-header";
import { SelectorCliente } from "@/components/shared/alta-rapida";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { faltantes } from "@/domain/prerequisitos";
import { NuevaObraDialog } from "@/components/shared/obra-select";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { PrintPreview } from "@/components/shared/print-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, NumberInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { formatDate, formatMoney } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { cn } from "@/lib/utils";
import { CobranzaDialog } from "@/components/modulos/cuentas/cobranza-dialog";
import { AvisoFaltantes } from "@/components/shared/aviso-faltantes";
import { Impacto, ImpactoCampo, medir } from "@/capacitacion";
import { ConstanciaAcopio } from "./acopio-detalle";
import { obtenerDb } from "@/lib/datos/almacen";

const aIso = (v: string, h = 10) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, h).toISOString();
};

export function AcopioNuevo() {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const usuario = useUsuario();
  const [clienteId, setClienteId] = React.useState(params.get("cliente") ?? "");
  const c = db.clientes.find((x) => x.id === clienteId);
  const [sucursalId, setSucursalId] = React.useState(c?.sucursalPreferidaId ?? usuario?.sucursalId ?? "suc_central");
  const [depositoId, setDepositoId] = React.useState(db.sucursales.find((s) => s.id === sucursalId)?.depositoId ?? "dep_central");
  const [vendedorId, setVendedorId] = React.useState(c?.vendedorId ?? "");
  const [fecha, setFecha] = React.useState(diaLocal(new Date()));
  const [vence, setVence] = React.useState(diaLocal(new Date(Date.now() + db.config.diasVencimientoAcopio * 86_400_000)));
  const [circuito, setCircuito] = React.useState<Circuito>(c?.circuitoHabitual ?? 2);
  const [obraIds, setObraIds] = React.useState<string[]>(db.obras.filter((o) => o.clienteId === clienteId && o.activa).map((o) => o.id));
  const [importe, setImporte] = React.useState(0);
  const [iibb, setIibb] = React.useState(db.config.alicuotaIIBBPct);
  const [forma, setForma] = React.useState<FormaPagoAcopio>("ANTICIPO");
  const [lista, setLista] = React.useState(c?.listaPreciosId ?? "lst_gen");
  const [un, setUn] = React.useState("un_cor");
  const [ajustes, setAjustes] = React.useState<Record<string, number>>({});
  const [obs, setObs] = React.useState("");
  const [verPrecios, setVerPrecios] = React.useState(false);
  const [nuevaObra, setNuevaObra] = React.useState(false);
  const [creado, setCreado] = React.useState<{ id: string; comprobanteId: string } | null>(null);
  const [cobrar, setCobrar] = React.useState(false);
  const [constancia, setConstancia] = React.useState(false);

  const elegirCliente = (id: string) => {
    setClienteId(id);
    // Del store en el momento: un cliente recién creado con el alta rápida todavía no está en `db`.
    const actual = obtenerDb();
    const x = actual.clientes.find((k) => k.id === id);
    if (!x) return;
    setCircuito(x.circuitoHabitual);
    setLista(x.listaPreciosId);
    if (x.vendedorId) setVendedorId(x.vendedorId);
    setSucursalId(x.sucursalPreferidaId);
    setDepositoId(db.sucursales.find((s) => s.id === x.sucursalPreferidaId)?.depositoId ?? depositoId);
    setObraIds(actual.obras.filter((o) => o.clienteId === id && o.activa).map((o) => o.id));
  };

  const productos = db.productos.filter((p) => p.activo && p.unidadNegocioId === un);
  const precioHoy = (pid: string) => db.precios.find((p) => p.productoId === pid && p.listaPreciosId === lista)?.precio ?? 0;
  const conIIBB = Math.round(importe * (1 + (iibb || 0) / 100) * 100) / 100;
  const conPrecio = productos.filter((p) => precioHoy(p.id) > 0).length;
  const sinListaConPrecios = faltantes(["listaConPrecios"], db).length > 0;
  const obrasCliente = db.obras.filter((o) => o.clienteId === clienteId && o.activa);
  const nombreUn = db.unidadesNegocio.find((u) => u.id === un)?.nombre ?? "";
  const nombreLista = db.listasPrecios.find((l) => l.id === lista)?.nombre ?? "";
  const otraUn = db.unidadesNegocio.find((u) => u.id !== un && db.productos.some((p) => p.activo && p.unidadNegocioId === u.id && precioHoy(p.id) > 0));

  const crear = async () => {
    const r = await medir("crearAcopio", { clienteId, depositoIds: [depositoId] }, () => useStore.getState().crearAcopio({
      clienteId,
      sucursalId,
      depositoId,
      vendedorId: vendedorId || undefined,
      fechaCreacion: aIso(fecha),
      fechaVencimiento: aIso(vence),
      circuito,
      obraIds,
      importe,
      alicuotaIIBBPct: iibb,
      formaPago: forma,
      listaPreciosBaseId: lista,
      unidadNegocioId: un,
      ajustesPrecio: ajustes,
      observaciones: obs || undefined,
    }));
    if (!r.ok) return toast.error(r.error);
    toast.success(`Acopio ${r.data.numero} creado`, { description: `${productos.length} precios congelados · ${forma === "ANTICIPO" ? "registrá el cobro del anticipo" : "queda en cuenta corriente"}` });
    setCreado({ id: r.data.id, comprobanteId: r.data.comprobanteId });
    if (forma === "ANTICIPO") setCobrar(true);
    else router.push(`/acopios/${r.data.id}`);
  };

  const acopioCreado = creado ? db.acopios.find((a) => a.id === creado.id) : undefined;
  const header = <PageHeader titulo="Nuevo acopio" descripcion="El cliente deposita o pacta un importe y se le congela toda la lista de precios de la unidad de negocio." favorito={false} />;
  // Sin precios cargados no hay nada que congelar: el formulario no llevaría a ningún lado.
  if (sinListaConPrecios && !creado)
    return (
      <div>
        {header}
        <Card><VacioGuiado pagina="acopios" icono={Boxes} /></Card>
      </div>
    );
  return (
    <div>
      {header}
      <div className="mb-4 space-y-3 empty:hidden">
        {clienteId && obrasCliente.length === 0 && (
          <AvisoFaltantes
            faltan={[]}
            titulo="El cliente no tiene obras"
            texto="El acopio se asocia a una o más obras del cliente. Creá la primera para poder continuar."
            acciones={<Button size="sm" variant="secondary" onClick={() => setNuevaObra(true)}><Plus /> Nueva obra</Button>}
          />
        )}
        {conPrecio === 0 && (
          <AvisoFaltantes
            faltan={[]}
            titulo={`La lista ${nombreLista} no tiene precios de ${nombreUn}`}
            texto={otraUn ? `No hay nada para congelar en esta unidad de negocio. Cambiá a ${otraUn.nombre} o cargá precios.` : "No hay nada para congelar. Cargá los precios de la lista antes de crear el acopio."}
            acciones={
              <>
                {otraUn && <Button size="sm" variant="secondary" onClick={() => { setUn(otraUn.id); setAjustes({}); }}>Usar {otraUn.nombre}</Button>}
                <Button size="sm" variant="secondary" onClick={() => router.push("/ventas/listas-precios")}>Cargar precios</Button>
              </>
            }
          />
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardContent className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Cliente" required className="sm:col-span-2">
              <SelectorCliente value={clienteId} onChange={elegirCliente} placeholder="Buscar cliente…" />
            </FormField>
            <FormField label="Circuito">
              <Segmented value={String(circuito) as "1" | "2"} onChange={(v) => setCircuito(Number(v) as Circuito)} options={[{ value: "1", label: "AC1 · Fiscal" }, { value: "2", label: "AC2 · Interno" }]} />
              <ImpactoCampo campo={`circuito.${circuito}`} />
            </FormField>
            <FormField label="Sucursal"><Select aria-label="Sucursal" value={sucursalId} onValueChange={(v) => { setSucursalId(v); setDepositoId(db.sucursales.find((s) => s.id === v)?.depositoId ?? depositoId); }} options={db.sucursales.map((s) => ({ value: s.id, label: s.nombre }))} /></FormField>
            <FormField label="Depósito de entrega"><Select aria-label="Depósito" value={depositoId} onValueChange={setDepositoId} options={db.depositos.map((d) => ({ value: d.id, label: d.nombre }))} /><ImpactoCampo campo="deposito" /></FormField>
            <FormField label="Vendedor"><Select aria-label="Vendedor" value={vendedorId} onValueChange={setVendedorId} options={[{ value: "", label: "Sin asignar" }, ...db.usuarios.filter((u) => u.rol === "VENTAS" || u.rol === "DUENO").map((u) => ({ value: u.id, label: u.nombre }))]} /></FormField>
            <FormField label="Fecha de creación" htmlFor="ac-f"><Input id="ac-f" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></FormField>
            <FormField label="Vencimiento" htmlFor="ac-v" hint={`Por defecto ${db.config.diasVencimientoAcopio} días`}><Input id="ac-v" type="date" value={vence} onChange={(e) => setVence(e.target.value)} /><ImpactoCampo campo="acopio.vencimiento" /></FormField>
            <FormField label="Unidad de negocio"><Select aria-label="Unidad de negocio" value={un} onValueChange={(v) => { setUn(v); setAjustes({}); }} options={db.unidadesNegocio.map((u) => ({ value: u.id, label: u.nombre }))} /></FormField>
            <FormField label="Obras" className="sm:col-span-2 lg:col-span-3">
              <div className="flex flex-wrap gap-2">
                {db.obras.filter((o) => o.clienteId === clienteId && o.activa).map((o) => (
                  <label key={o.id} className={cn("flex h-8 items-center gap-2 rounded-control border px-2.5 text-[12.5px]", obraIds.includes(o.id) ? "border-ink bg-subtle" : "border-border")}>
                    <Checkbox checked={obraIds.includes(o.id)} onCheckedChange={(v) => setObraIds(v ? [...obraIds, o.id] : obraIds.filter((x) => x !== o.id))} aria-label={o.nombre} /> {o.nombre}
                  </label>
                ))}
                {clienteId ? <Button size="sm" variant="ghost" onClick={() => setNuevaObra(true)}>+ Nueva obra</Button> : <span className="text-[12px] text-muted">Elegí el cliente</span>}
              </div>
            </FormField>
            <FormField label="Importe" required htmlFor="ac-i"><NumberInput id="ac-i" value={importe} min={0} onValueChange={setImporte} /></FormField>
            <FormField label="Alícuota IIBB %" htmlFor="ac-ii" hint="0 si no aplica"><NumberInput id="ac-ii" value={iibb} min={0} onValueChange={setIibb} /></FormField>
            <FormField label="Importe con IIBB"><div className="flex h-9 items-center font-semibold tnum">{formatMoney(conIIBB)}</div></FormField>
            <FormField label="Forma de pago" className="sm:col-span-2" hint={forma === "ANTICIPO" ? "Paga ahora: al crear se abre el recibo con el importe precargado" : "Lo paga después: la factura queda en su cuenta corriente"}>
              <Segmented value={forma} onChange={setForma} options={[{ value: "ANTICIPO", label: "Anticipo" }, { value: "CUENTA_CORRIENTE", label: "Cuenta corriente" }]} />
              <ImpactoCampo campo={`acopio.formaPago.${forma}`} />
            </FormField>
            <FormField label="Lista de precios a congelar"><Select aria-label="Lista de precios" value={lista} onValueChange={(v) => { setLista(v); setAjustes({}); }} options={db.listasPrecios.map((l) => ({ value: l.id, label: l.nombre }))} /></FormField>
            <FormField label="Observaciones" htmlFor="ac-o" className="sm:col-span-2 lg:col-span-3"><Input id="ac-o" value={obs} onChange={(e) => setObs(e.target.value)} /></FormField>
          </CardContent>
        </Card>
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader><CardTitle>Resumen</CardTitle><CircuitoBadge circuito={circuito} corto /></CardHeader>
            <CardContent className="space-y-3 text-[13px]">
              <dl className="grid grid-cols-[1fr_auto] gap-y-1.5">
                <dt className="text-muted">Cliente</dt><dd className="max-w-[170px] truncate text-right">{c?.nombreFantasia ?? c?.razonSocial ?? "—"}</dd>
                <dt className="text-muted">Obras</dt><dd className="text-right">{obraIds.length}</dd>
                <dt className="text-muted">Vence</dt><dd className="text-right">{formatDate(aIso(vence))}</dd>
                <dt className="text-muted">Precios a congelar</dt><dd className={cn("text-right tnum", conPrecio === 0 && "text-warning")}>{conPrecio}{conPrecio < productos.length ? ` de ${productos.length}` : ""}{Object.keys(ajustes).length ? ` · ${Object.keys(ajustes).length} ajustados` : ""}</dd>
                <dt className="border-t border-border pt-1.5 font-semibold">Importe con IIBB</dt><dd className="border-t border-border pt-1.5 text-right text-[16px] font-semibold tnum">{formatMoney(conIIBB)}</dd>
              </dl>
              <Button variant="secondary" className="w-full" onClick={() => setVerPrecios(true)}><Eye /> Ver precios que se van a congelar</Button>
              <Button className="w-full" onClick={crear} disabled={!clienteId || !(importe > 0) || !obraIds.length || conPrecio === 0}><Boxes /> Crear acopio</Button>
              <Impacto accion="crearAcopio" />
              {clienteId && importe > 0 && (!obraIds.length || conPrecio === 0) && <p className="text-[12px] text-muted">{!obraIds.length ? "Elegí al menos una obra." : "La lista elegida no tiene precios para congelar."}</p>}
              {acopioCreado && <Button variant="ghost" className="w-full" onClick={() => setConstancia(true)}><Printer /> Constancia de acopio</Button>}
            </CardContent>
          </Card>
        </aside>
      </div>

      <Sheet open={verPrecios} onOpenChange={setVerPrecios}>
        <SheetContent side="right" width={760} title={`Precios a congelar · ${db.unidadesNegocio.find((u) => u.id === un)?.nombre} · ${db.listasPrecios.find((l) => l.id === lista)?.nombre}`}>
          <div className="p-4">
            <p className="mb-3 text-[12px] text-muted">Podés ajustar manualmente algún precio antes de congelar (queda auditado).</p>
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-[#F0EFEB] text-[11.5px] text-muted">
                <tr><th className="h-8 px-2 text-left font-medium">Código</th><th className="h-8 px-2 text-left font-medium">Artículo</th><th className="h-8 px-2 text-right font-medium">Precio hoy</th><th className="h-8 w-[150px] px-2 text-right font-medium">A congelar</th></tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-2 py-1 font-mono text-[11px]">{p.codigo}</td>
                    <td className="px-2 py-1">{p.nombre}</td>
                    <td className="px-2 py-1 text-right text-muted tnum">{formatMoney(precioHoy(p.id))}</td>
                    <td className="px-2 py-1"><NumberInput aria-label={`Precio a congelar de ${p.nombre}`} value={ajustes[p.id] ?? precioHoy(p.id)} min={0} onValueChange={(v) => setAjustes((a) => (v === precioHoy(p.id) ? Object.fromEntries(Object.entries(a).filter(([k]) => k !== p.id)) : { ...a, [p.id]: v }))} className={cn("h-7", ajustes[p.id] !== undefined && "border-accent")} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SheetContent>
      </Sheet>
      {clienteId && <NuevaObraDialog clienteId={clienteId} open={nuevaObra} onOpenChange={setNuevaObra} onCreada={(id) => setObraIds((x) => [...x, id])} />}
      {creado && (
        <CobranzaDialog
          open={cobrar}
          onOpenChange={(v) => {
            setCobrar(v);
            if (!v) router.push(`/acopios/${creado.id}`);
          }}
          clienteId={clienteId}
          comprobanteId={creado.comprobanteId}
          importeSugerido={conIIBB}
        />
      )}
      {acopioCreado && (
        <PrintPreview open={constancia} onOpenChange={setConstancia} titulo={`Constancia ${acopioCreado.numero}`}>
          <ConstanciaAcopio acopio={acopioCreado} />
        </PrintPreview>
      )}
    </div>
  );
}
