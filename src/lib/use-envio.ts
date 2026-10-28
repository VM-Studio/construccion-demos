"use client";
import * as React from "react";

/**
 * Envío de formulario sin duplicados: mientras `fn` está en curso, los envíos siguientes (doble
 * clic, Enter repetido) se ignoran. Devuelve la función envuelta y si está guardando.
 */
export function useEnvio<A extends unknown[]>(fn: (...args: A) => Promise<unknown>): [(...args: A) => Promise<void>, boolean] {
  const [enviando, setEnviando] = React.useState(false);
  const ocupado = React.useRef(false);
  const ultima = React.useRef(fn);
  ultima.current = fn;
  const envuelta = React.useCallback(async (...args: A) => {
    const ev = args[0] as { preventDefault?: () => void } | undefined;
    if (ocupado.current) {
      ev?.preventDefault?.();
      return;
    }
    ocupado.current = true;
    setEnviando(true);
    try {
      await ultima.current(...args);
    } finally {
      ocupado.current = false;
      setEnviando(false);
    }
  }, []);
  return [envuelta, enviando];
}
