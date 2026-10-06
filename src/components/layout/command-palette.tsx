"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Boxes, FileText, Package, Plus, Search, ShoppingCart, Truck, User, Building2 } from "lucide-react";
import { useDb, useUsuario } from "@/store/selectors";
import { NAVEGACION } from "@/config/navegacion";
import { puede } from "@/domain/permisos";
import { formatMoney } from "@/lib/format";

const grupoCls =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted";
const itemCls = "flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-[13px] text-ink outline-none data-[selected=true]:bg-subtle [&_svg]:size-4 [&_svg]:text-muted";

/** Búsqueda global (⌘K): módulos, productos, clientes, pedidos, OC y acopios. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const db = useDb();
  const usuario = useUsuario();
  const ir = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const cliente = React.useMemo(() => new Map(db.clientes.map((c) => [c.id, c])), [db.clientes]);
  const proveedor = React.useMemo(() => new Map(db.proveedores.map((p) => [p.id, p])), [db.proveedores]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/30 animate-fade-in" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-32px)] max-w-[640px] -translate-x-1/2 overflow-hidden rounded-card border border-border bg-surface shadow-pop outline-none animate-fade-in">
          <DialogPrimitive.Title className="sr-only">Búsqueda global</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Buscá módulos, productos, clientes, pedidos, órdenes de compra y acopios</DialogPrimitive.Description>
          <Command loop>
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 text-disabled" />
              <Command.Input autoFocus placeholder="Buscar productos, clientes, pedidos, OC, acopios…" className="h-12 w-full bg-transparent text-[14px] outline-none placeholder:text-disabled" />
              <kbd className="hidden rounded border border-border px-1.5 text-[10px] text-muted sm:block">Esc</kbd>
            </div>
            <Command.List className="max-h-[min(460px,60vh)] overflow-y-auto p-1.5">
              <Command.Empty className="py-8 text-center text-[13px] text-muted">Sin resultados.</Command.Empty>
              <Command.Group heading="Ir a" className={grupoCls}>
                {NAVEGACION.flatMap((g) => g.items)
                  .filter((i) => puede(usuario, i.permiso))
                  .map((i) => (
                    <Command.Item key={i.href} value={`ir ${i.label}`} onSelect={() => ir(i.href)} className={itemCls}>
                      <i.icono />
                      {i.label}
                    </Command.Item>
                  ))}
              </Command.Group>
              <Command.Group heading="Acciones" className={grupoCls}>
                {puede(usuario, "ventas.editar") && (
                  <Command.Item value="nuevo pedido" onSelect={() => ir("/ventas/notas-pedido/nuevo")} className={itemCls}>
                    <Plus /> Nuevo pedido
                  </Command.Item>
                )}
                {puede(usuario, "ventas.editar") && (
                  <Command.Item value="nuevo presupuesto" onSelect={() => ir("/ventas/presupuestos/nuevo")} className={itemCls}>
                    <Plus /> Nuevo presupuesto
                  </Command.Item>
                )}
                {puede(usuario, "compras.editar") && (
                  <Command.Item value="nueva orden de compra" onSelect={() => ir("/compras/oc/nueva")} className={itemCls}>
                    <Plus /> Nueva orden de compra
                  </Command.Item>
                )}
                {puede(usuario, "acopios.editar") && (
                  <Command.Item value="nuevo acopio" onSelect={() => ir("/acopios/nuevo")} className={itemCls}>
                    <Plus /> Nuevo acopio
                  </Command.Item>
                )}
              </Command.Group>
              {puede(usuario, "productos.ver") && (
                <Command.Group heading="Productos" className={grupoCls}>
                  {db.productos.map((p) => (
                    <Command.Item key={p.id} value={`${p.codigo} ${p.nombre} ${p.marca ?? ""} ${p.codigoBarras ?? ""}`} onSelect={() => ir(`/productos?id=${p.id}`)} className={itemCls}>
                      <Package />
                      <span className="w-[72px] shrink-0 font-mono text-[11px] text-muted">{p.codigo}</span>
                      <span className="truncate">{p.nombre}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted">{p.marca}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {puede(usuario, "ventas.ver") && (
                <Command.Group heading="Clientes" className={grupoCls}>
                  {db.clientes.map((c) => (
                    <Command.Item key={c.id} value={`cliente ${c.razonSocial} ${c.nombreFantasia ?? ""} ${c.cuit}`} onSelect={() => ir(`/ventas?tab=clientes&cliente=${c.id}`)} className={itemCls}>
                      <User />
                      <span className="truncate">{c.nombreFantasia ?? c.razonSocial}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted">{c.cuit}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {puede(usuario, "ventas.ver") && (
                <Command.Group heading="Notas de pedido" className={grupoCls}>
                  {db.notasPedido.filter((p) => p.numero).map((p) => (
                    <Command.Item key={p.id} value={`${p.numero} pedido ${cliente.get(p.clienteId)?.razonSocial ?? ""}`} onSelect={() => ir(`/ventas/notas-pedido/${p.id}`)} className={itemCls}>
                      <FileText />
                      <span className="w-[86px] shrink-0 font-mono text-[12px]">{p.numero}</span>
                      <span className="truncate">{cliente.get(p.clienteId)?.razonSocial}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted tnum">{formatMoney(p.total, { compact: true })}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {puede(usuario, "compras.ver") && (
                <Command.Group heading="Órdenes de compra" className={grupoCls}>
                  {db.ordenesCompra.map((o) => (
                    <Command.Item key={o.id} value={`${o.numero} orden compra ${proveedor.get(o.proveedorId)?.razonSocial ?? ""}`} onSelect={() => ir(`/compras/oc/${o.id}`)} className={itemCls}>
                      <ShoppingCart />
                      <span className="w-[86px] shrink-0 font-mono text-[12px]">{o.numero}</span>
                      <span className="truncate">{proveedor.get(o.proveedorId)?.razonSocial}</span>
                    </Command.Item>
                  ))}
                  {db.proveedores.map((p) => (
                    <Command.Item key={p.id} value={`proveedor ${p.razonSocial} ${p.cuit}`} onSelect={() => ir(`/compras?tab=proveedores&proveedor=${p.id}`)} className={itemCls}>
                      <Building2 />
                      <span className="truncate">{p.razonSocial}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted">Proveedor</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {puede(usuario, "acopios.ver") && (
                <Command.Group heading="Acopios" className={grupoCls}>
                  {db.acopios.map((a) => (
                    <Command.Item key={a.id} value={`${a.numero} acopio ${cliente.get(a.clienteId)?.razonSocial ?? ""}`} onSelect={() => ir(`/acopios/${a.id}`)} className={itemCls}>
                      <Boxes />
                      <span className="w-[86px] shrink-0 font-mono text-[12px]">{a.numero}</span>
                      <span className="truncate">{cliente.get(a.clienteId)?.razonSocial}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {puede(usuario, "despachos.ver") && (
                <Command.Group heading="Remitos" className={grupoCls}>
                  {db.despachos.slice(-30).map((d) => (
                    <Command.Item key={d.id} value={`${d.numero} remito ${cliente.get(d.clienteId)?.razonSocial ?? ""}`} onSelect={() => ir(`/despachos?despacho=${d.id}`)} className={itemCls}>
                      <Truck />
                      <span className="w-[86px] shrink-0 font-mono text-[12px]">{d.numero}</span>
                      <span className="truncate">{cliente.get(d.clienteId)?.razonSocial}</span>
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
