"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Boxes, Building2, Factory, Package, Plus, Receipt, Search, ShoppingCart, Truck, User } from "lucide-react";
import { useStore } from "@/store";
import { useDb, useUsuario } from "@/store/selectors";
import { MODULOS } from "@/config/modulos";
import { puede } from "@/domain/permisos";
import { formatMoney } from "@/lib/format";

const grupoCls =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted";
const itemCls = "flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-[13px] text-ink outline-none data-[selected=true]:bg-subtle [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted";
const numCls = "w-[150px] shrink-0 font-mono text-[12px]";

const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** Todas las palabras buscadas tienen que aparecer (por número o nombre); prioriza coincidencias al inicio. */
function filtrar(value: string, search: string) {
  const v = norm(value);
  const palabras = norm(search).split(/\s+/).filter(Boolean);
  if (!palabras.every((w) => v.includes(w))) return 0;
  return palabras.some((w) => v.includes(` ${w}`)) ? 1 : 0.6;
}

/** Explorar (⌘K): páginas de todos los módulos y documentos por número o nombre, agrupados por tipo. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const db = useDb();
  const usuario = useUsuario();
  const setModulo = useStore((s) => s.setModuloActivo);
  const veC2 = puede(usuario, "circuito2.ver");
  const ir = (href: string, modulo?: string) => {
    onOpenChange(false);
    if (modulo) setModulo(modulo);
    router.push(href);
  };
  const cliente = React.useMemo(() => new Map(db.clientes.map((c) => [c.id, c])), [db.clientes]);
  const proveedor = React.useMemo(() => new Map(db.proveedores.map((p) => [p.id, p])), [db.proveedores]);
  const nombreCli = (id?: string) => (id ? (cliente.get(id)?.nombreFantasia ?? cliente.get(id)?.razonSocial ?? "") : "");
  const c2 = <T extends { circuito: 1 | 2 }>(l: T[]) => (veC2 ? l : l.filter((x) => x.circuito !== 2));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/30 animate-fade-in" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-32px)] max-w-[680px] -translate-x-1/2 overflow-hidden rounded-card border border-border bg-surface shadow-pop outline-none animate-fade-in">
          <DialogPrimitive.Title className="sr-only">Explorar</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Buscá páginas, clientes, proveedores, artículos, acopios, notas de pedido, remitos, órdenes de compra y comprobantes</DialogPrimitive.Description>
          <Command loop filter={filtrar}>
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 text-disabled" />
              <Command.Input autoFocus placeholder="Explorar páginas, clientes, acopios, NP, remitos, OC, comprobantes…" className="h-12 w-full bg-transparent text-[14px] outline-none placeholder:text-disabled" />
              <kbd className="hidden rounded border border-border px-1.5 text-[10px] text-muted sm:block">Esc</kbd>
            </div>
            <Command.List className="max-h-[min(480px,62vh)] overflow-y-auto p-1.5">
              <Command.Empty className="py-8 text-center text-[13px] text-muted">Sin resultados.</Command.Empty>
              <Command.Group heading="Páginas" className={grupoCls}>
                {MODULOS.flatMap((m) =>
                  m.paginas
                    .filter((p) => puede(usuario, p.permiso))
                    .map((p) => (
                      <Command.Item key={m.id + p.id} value={`pagina ${p.nombre} ${m.nombre}`} onSelect={() => ir(p.href, m.id)} className={itemCls}>
                        <m.icono />
                        <span className="truncate">{p.nombre}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted">{m.nombre}</span>
                      </Command.Item>
                    )),
                )}
              </Command.Group>
              <Command.Group heading="Acciones" className={grupoCls}>
                {puede(usuario, "ventas.editar") && (
                  <Command.Item value="accion nueva nota de pedido venta" onSelect={() => ir("/ventas/notas-pedido/nueva", "ventas")} className={itemCls}>
                    <Plus /> Nueva nota de pedido
                  </Command.Item>
                )}
                {puede(usuario, "acopios.editar") && (
                  <Command.Item value="accion nuevo acopio" onSelect={() => ir("/acopios/nuevo", "clientes")} className={itemCls}>
                    <Plus /> Nuevo acopio
                  </Command.Item>
                )}
                {puede(usuario, "acopios.editar") && (
                  <Command.Item value="accion registrar retiro de acopio" onSelect={() => ir("/ventas/notas-pedido/nueva?origen=acopio", "ventas")} className={itemCls}>
                    <Plus /> Registrar retiro de acopio
                  </Command.Item>
                )}
                {puede(usuario, "compras.editar") && (
                  <Command.Item value="accion nueva orden de compra" onSelect={() => ir("/compras/oc/nueva", "compras")} className={itemCls}>
                    <Plus /> Nueva orden de compra
                  </Command.Item>
                )}
              </Command.Group>
              {puede(usuario, "clientes.ver") && (
                <Command.Group heading="Clientes" className={grupoCls}>
                  {db.clientes.map((c) => (
                    <Command.Item key={c.id} value={`cliente ${c.codigo} ${c.razonSocial} ${c.nombreFantasia ?? ""} ${c.cuit}`} onSelect={() => ir(`/clientes/${c.id}`, "clientes")} className={itemCls}>
                      <User />
                      <span className="w-[52px] shrink-0 font-mono text-[11px] text-muted">{c.codigo}</span>
                      <span className="truncate">{c.nombreFantasia ?? c.razonSocial}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted">{c.cuit}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {puede(usuario, "proveedores.ver") && (
                <Command.Group heading="Proveedores" className={grupoCls}>
                  {db.proveedores.map((p) => (
                    <Command.Item key={p.id} value={`proveedor ${p.codigo} ${p.razonSocial} ${p.cuit}`} onSelect={() => ir(`/proveedores/${p.id}`, "proveedores")} className={itemCls}>
                      <Factory />
                      <span className="w-[52px] shrink-0 font-mono text-[11px] text-muted">{p.codigo}</span>
                      <span className="truncate">{p.razonSocial}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {puede(usuario, "acopios.ver") && (
                <Command.Group heading="Acopios" className={grupoCls}>
                  {c2(db.acopios).map((a) => (
                    <Command.Item key={a.id} value={`acopio ${a.numero} ${a.numero.replace(/\D+0*/g, " ")} ${nombreCli(a.clienteId)} ${cliente.get(a.clienteId)?.razonSocial ?? ""}`} onSelect={() => ir(`/acopios/${a.id}`, "clientes")} className={itemCls}>
                      <Boxes />
                      <span className={numCls}>{a.numero}</span>
                      <span className="truncate">{nombreCli(a.clienteId)}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted tnum">{formatMoney(a.importe, { compact: true })}</span>
                    </Command.Item>
                  ))}
                  {c2(db.acopiosProveedor).map((a) => (
                    <Command.Item key={a.id} value={`acopio proveedor ${a.numero} ${proveedor.get(a.proveedorId)?.razonSocial ?? ""}`} onSelect={() => ir(`/proveedores/acopios/${a.id}`, "proveedores")} className={itemCls}>
                      <Factory />
                      <span className={numCls}>{a.numero}</span>
                      <span className="truncate">{proveedor.get(a.proveedorId)?.razonSocial}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {puede(usuario, "ventas.ver") && (
                <Command.Group heading="Notas de pedido" className={grupoCls}>
                  {c2(db.notasPedido.filter((n) => n.numero)).map((n) => (
                    <Command.Item key={n.id} value={`nota pedido ${n.numero} ${n.numero.replace(/\D+0*/g, " ")} ${nombreCli(n.clienteId)}`} onSelect={() => ir(`/ventas/notas-pedido/${n.id}`, "ventas")} className={itemCls}>
                      <ShoppingCart />
                      <span className={numCls}>{n.numero}</span>
                      <span className="truncate">{nombreCli(n.clienteId)}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted tnum">{formatMoney(n.total, { compact: true })}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {puede(usuario, "remitos.ver") && (
                <Command.Group heading="Remitos" className={grupoCls}>
                  {c2(db.remitos).map((r) => (
                    <Command.Item key={r.id} value={`remito ${r.numero} ${r.numero.replace(/\D+0*/g, " ")} ${nombreCli(r.clienteId)}`} onSelect={() => ir(`/remitos/${r.id}`, "remitos")} className={itemCls}>
                      <Truck />
                      <span className={numCls}>{r.numero}</span>
                      <span className="truncate">{nombreCli(r.clienteId)}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {puede(usuario, "compras.ver") && (
                <Command.Group heading="Órdenes de compra" className={grupoCls}>
                  {c2(db.ordenesCompra).map((o) => (
                    <Command.Item key={o.id} value={`orden compra ${o.numero} ${proveedor.get(o.proveedorId)?.razonSocial ?? ""}`} onSelect={() => ir(`/compras/oc/${o.id}`, "compras")} className={itemCls}>
                      <Building2 />
                      <span className={numCls}>{o.numero}</span>
                      <span className="truncate">{proveedor.get(o.proveedorId)?.razonSocial}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted tnum">{formatMoney(o.total, { compact: true })}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {puede(usuario, "ventas.ver") && (
                <Command.Group heading="Comprobantes" className={grupoCls}>
                  {c2(db.comprobantes.filter((c) => c.clienteId && c.tipo !== "SALDO_A_FAVOR")).map((c) => (
                    <Command.Item key={c.id} value={`comprobante factura ${c.numero} ${nombreCli(c.clienteId)}`} onSelect={() => ir(`/ventas/comprobantes?id=${c.id}`, "ventas")} className={itemCls}>
                      <Receipt />
                      <span className={numCls}>{c.numero}</span>
                      <span className="truncate">{nombreCli(c.clienteId)}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted tnum">{formatMoney(c.total, { compact: true })}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {puede(usuario, "productos.ver") && (
                <Command.Group heading="Artículos" className={grupoCls}>
                  {db.productos.map((p) => (
                    <Command.Item key={p.id} value={`articulo ${p.codigo} ${p.nombre} ${p.marca ?? ""}`} onSelect={() => ir(`/productos?id=${p.id}`, "stock")} className={itemCls}>
                      <Package />
                      <span className="w-[60px] shrink-0 font-mono text-[11px] text-muted">{p.codigo}</span>
                      <span className="truncate">{p.nombre}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted">{p.marca}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
