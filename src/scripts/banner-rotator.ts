import type { Env, ScriptResult, Schedule, ScheduleDay, DayKey, PoolSpec } from "../types";
import { getAccessToken } from "../lib/google-auth";
import { setChannelBanner } from "../lib/youtube";

/** Prefijo bajo el que viven las imágenes del banner en R2. */
export const BANNER_PREFIX = "banners/";
/** Estado del rotador (qué imagen tocó por última vez). */
const STATE_KEY = "rotator-state.json";
/** Calendario de reglas editable desde el dashboard. */
const SCHEDULE_KEY = "rotator-schedule.json";

const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

interface RotatorState {
  lastKey: string | null;
  lastRunAt: string | null;
}

/** Por defecto: random entre todas, todos los días (funciona sin configurar). */
export const DEFAULT_SCHEDULE: Schedule = {
  timezone: "America/Argentina/Buenos_Aires",
  avoidRepeat: true,
  days: DAY_ORDER.reduce((acc, d) => {
    acc[d] = { mode: "random", pool: "all" };
    return acc;
  }, {} as Record<DayKey, ScheduleDay>),
};

/* ------------------------------ helpers ---------------------------- */

function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "bmp") return "image/bmp";
  return "image/jpeg";
}

function nameOf(key: string): string {
  return key.slice(BANNER_PREFIX.length).toLowerCase();
}

async function readState(env: Env): Promise<RotatorState> {
  const obj = await env.BANNERS.get(STATE_KEY);
  if (!obj) return { lastKey: null, lastRunAt: null };
  try {
    return (await obj.json()) as RotatorState;
  } catch {
    return { lastKey: null, lastRunAt: null };
  }
}

async function writeState(env: Env, state: RotatorState): Promise<void> {
  await env.BANNERS.put(STATE_KEY, JSON.stringify(state), {
    httpMetadata: { contentType: "application/json" },
  });
}

export async function getSchedule(env: Env): Promise<Schedule> {
  const obj = await env.BANNERS.get(SCHEDULE_KEY);
  if (!obj) return DEFAULT_SCHEDULE;
  try {
    const parsed = (await obj.json()) as Partial<Schedule>;
    return {
      timezone: parsed.timezone || DEFAULT_SCHEDULE.timezone,
      avoidRepeat: parsed.avoidRepeat ?? true,
      days: { ...DEFAULT_SCHEDULE.days, ...(parsed.days ?? {}) },
    };
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

export async function saveSchedule(env: Env, schedule: Schedule): Promise<void> {
  await env.BANNERS.put(SCHEDULE_KEY, JSON.stringify(schedule), {
    httpMetadata: { contentType: "application/json" },
  });
}

/** Lista las imágenes disponibles (claves completas, ordenadas). */
export async function listBannerImages(env: Env): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.BANNERS.list({ prefix: BANNER_PREFIX, cursor });
    for (const o of page.objects) {
      if (o.key !== STATE_KEY && o.key !== SCHEDULE_KEY) out.push(o.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out.sort();
}

/** Día de la semana (mon..sun) en la zona horaria dada. */
function weekdayInTz(tz: string): DayKey {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" })
    .format(new Date())
    .toLowerCase()
    .slice(0, 3);
  return (DAY_ORDER.find((d) => d === wd) ?? "mon") as DayKey;
}

/** Substrings asignados explícitamente en cualquier día (para calcular "resto"). */
function assignedSubstrings(schedule: Schedule): string[] {
  const subs: string[] = [];
  for (const d of DAY_ORDER) {
    const p = schedule.days[d]?.pool;
    if (Array.isArray(p)) subs.push(...p.map((s) => s.toLowerCase()));
  }
  return subs;
}

/** Resuelve un PoolSpec a claves concretas de imágenes. */
function resolvePool(images: string[], spec: PoolSpec, assigned: string[]): string[] {
  if (spec === "all") return images;
  if (spec === "rest") {
    return images.filter((img) => !assigned.some((sub) => nameOf(img).includes(sub)));
  }
  const subs = spec.map((s) => s.toLowerCase());
  return images.filter((img) => subs.some((sub) => nameOf(img).includes(sub)));
}

/** Elige una imagen del pool según el modo. */
function pickFromPool(
  pool: string[],
  mode: ScheduleDay["mode"],
  lastKey: string | null,
  avoidRepeat: boolean
): string | null {
  if (pool.length === 0) return null;
  if (mode === "fixed") return pool[0];
  if (mode === "sequential") {
    const idx = lastKey ? pool.indexOf(lastKey) : -1;
    return pool[(idx + 1) % pool.length];
  }
  // random
  let candidates = pool;
  if (avoidRepeat && pool.length > 1 && lastKey) {
    const filtered = pool.filter((k) => k !== lastKey);
    if (filtered.length > 0) candidates = filtered;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Elige la imagen del día según el calendario y la pone como banner del canal.
 */
export async function runBannerRotator(
  env: Env,
  ctx: { trigger: "manual" | "cron" }
): Promise<ScriptResult> {
  const startedAt = new Date().toISOString();
  const finish = (ok: boolean, message: string, data?: Record<string, unknown>): ScriptResult => ({
    ok,
    message,
    data,
    startedAt,
    finishedAt: new Date().toISOString(),
  });

  if (ctx.trigger === "cron" && env.ROTATOR_ENABLED !== "true") {
    return finish(false, "Rotador deshabilitado (ROTATOR_ENABLED != 'true'). Saltado.");
  }
  if (!env.YOUTUBE_CHANNEL_ID) {
    return finish(false, "Falta YOUTUBE_CHANNEL_ID.");
  }

  const images = await listBannerImages(env);
  if (images.length === 0) {
    return finish(false, "No hay imágenes en R2 bajo el prefijo 'banners/'.");
  }

  const schedule = await getSchedule(env);
  const day = weekdayInTz(schedule.timezone);
  const rule = schedule.days[day] ?? { mode: "random", pool: "all" };
  const state = await readState(env);

  // Resolver el pool del día; si queda vacío, caer a todas las imágenes.
  let pool = resolvePool(images, rule.pool, assignedSubstrings(schedule));
  let poolNote = "";
  if (pool.length === 0) {
    pool = images;
    poolNote = " (pool vacío → todas)";
  }

  const nextKey = pickFromPool(pool, rule.mode, state.lastKey, schedule.avoidRepeat);
  if (!nextKey) {
    return finish(false, `No se pudo elegir imagen para ${day} (modo ${rule.mode}).`);
  }

  const obj = await env.BANNERS.get(nextKey);
  if (!obj) {
    return finish(false, `No se pudo leer la imagen ${nextKey} de R2.`);
  }
  const bytes = await obj.arrayBuffer();

  const accessToken = await getAccessToken(env);
  const bannerUrl = await setChannelBanner(
    accessToken,
    env.YOUTUBE_CHANNEL_ID,
    bytes,
    obj.httpMetadata?.contentType || contentTypeFor(nextKey)
  );

  await writeState(env, { lastKey: nextKey, lastRunAt: startedAt });

  const imageName = nextKey.slice(BANNER_PREFIX.length);
  return finish(true, `[${day} · ${rule.mode}${poolNote}] banner → ${imageName}`, {
    image: imageName,
    day,
    mode: rule.mode,
    poolSize: pool.length,
    bannerUrl,
    trigger: ctx.trigger,
  });
}
