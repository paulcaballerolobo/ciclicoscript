import type { ScriptDef } from "../types";
import { runBannerRotator } from "./banner-rotator";

/**
 * Registro central de scripts. Para agregar un script nuevo al dashboard,
 * sumá una entrada acá. El dashboard los lista automáticamente.
 */
export const SCRIPTS: ScriptDef[] = [
  {
    id: "banner-rotator",
    name: "Rotador de banner YouTube",
    description:
      "Cambia el banner del canal de Cíclico a la siguiente imagen del set guardado en R2.",
    scheduled: true,
    run: runBannerRotator,
  },
];

export function getScript(id: string): ScriptDef | undefined {
  return SCRIPTS.find((s) => s.id === id);
}
