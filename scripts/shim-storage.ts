/** localStorage en memoria para correr el store fuera del navegador. */
const datos = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => datos.get(k) ?? null,
  setItem: (k: string, v: string) => void datos.set(k, v),
  removeItem: (k: string) => void datos.delete(k),
  clear: () => datos.clear(),
  key: (i: number) => [...datos.keys()][i] ?? null,
  get length() {
    return datos.size;
  },
};
export {};
