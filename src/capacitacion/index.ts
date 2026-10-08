/**
 * Modo capacitación — API pública. Fuera de esta carpeta solo se usan estos componentes
 * (todos devuelven null con el modo apagado) y `medir()` (con el modo apagado solo ejecuta la acción).
 */
export { Impacto } from "./Impacto";
export { ImpactoCampo } from "./ImpactoCampo";
export { BannerPagina } from "./BannerPagina";
export { InterruptorCapacitacion, InterruptorCapacitacionConfig } from "./Interruptor";
export { medir, type Contexto } from "./medir";
export { useModoCapacitacion } from "./flag";
