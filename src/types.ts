/// <reference types="@cloudflare/workers-types" />

export interface Env {
  // Bindings
  ASSETS: Fetcher;
  BANNERS: R2Bucket;

  // Variables públicas (wrangler.jsonc → vars)
  YOUTUBE_CHANNEL_ID: string;
  ROTATOR_ENABLED: string;

  // Secretos (wrangler secret put / .dev.vars)
  DASH_TOKEN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REFRESH_TOKEN: string;
}

/** Resultado estándar que devuelve la ejecución de cualquier script. */
export interface ScriptResult {
  ok: boolean;
  message: string;
  /** Datos arbitrarios para mostrar en el dashboard. */
  data?: Record<string, unknown>;
  startedAt: string;
  finishedAt: string;
}

/* ----------------------------- rotador ----------------------------- */

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type RotateMode = "fixed" | "sequential" | "random";
/** Grupo de imágenes: lista de substrings de nombre, o palabra clave. */
export type PoolSpec = string[] | "all" | "rest";

export interface ScheduleDay {
  mode: RotateMode;
  pool: PoolSpec;
}

export interface Schedule {
  timezone: string;
  avoidRepeat: boolean;
  days: Record<DayKey, ScheduleDay>;
}

/** Metadatos + handler de un script ejecutable desde el dashboard. */
export interface ScriptDef {
  id: string;
  name: string;
  description: string;
  /** Si el script corre también por cron. */
  scheduled: boolean;
  run: (env: Env, ctx: { trigger: "manual" | "cron" }) => Promise<ScriptResult>;
}
