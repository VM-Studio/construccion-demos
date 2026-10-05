"use client";
import * as React from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface EntityTab {
  value: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Panel lateral estándar para ver/editar una entidad: título + estado + acciones,
 * tabs opcionales y footer con botones.
 */
export function EntitySheet({
  open,
  onOpenChange,
  titulo,
  subtitulo,
  estado,
  acciones,
  tabs,
  tab,
  onTabChange,
  footer,
  width = 640,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo: string;
  subtitulo?: React.ReactNode;
  estado?: React.ReactNode;
  acciones?: React.ReactNode;
  tabs?: EntityTab[];
  tab?: string;
  onTabChange?: (v: string) => void;
  footer?: React.ReactNode;
  width?: 480 | 640 | 760;
  children?: React.ReactNode;
}) {
  const [tabInterno, setTabInterno] = React.useState(tabs?.[0]?.value ?? "");
  const actual = tab ?? tabInterno;
  React.useEffect(() => {
    if (open && tabs?.length && !tabs.some((t) => t.value === actual)) setTabInterno(tabs[0].value);
  }, [open, tabs, actual]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={titulo} width={width}>
        <div className="border-b border-border px-5 pb-3 pt-4 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-semibold text-ink">{titulo}</h2>
            {estado}
          </div>
          {subtitulo && <div className="mt-0.5 text-[13px] text-muted">{subtitulo}</div>}
          {acciones && <div className="mt-3 flex flex-wrap gap-2">{acciones}</div>}
        </div>
        {tabs?.length ? (
          <Tabs
            value={actual}
            onValueChange={(v) => (onTabChange ? onTabChange(v) : setTabInterno(v))}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="px-3">
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tabs.map((t) => (
                <TabsContent key={t.value} value={t.value} className="p-5">
                  {t.content}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        ) : (
          <div className={cn("min-h-0 flex-1 overflow-y-auto p-5")}>{children}</div>
        )}
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}
