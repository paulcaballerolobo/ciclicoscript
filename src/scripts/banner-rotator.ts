import type { Env, ScriptResult, Schedule, ScheduleSegment, DayKey, PoolSpec, RotateMode } from "../types";
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

/** Por defecto: una sola franja (desde 00:00) random entre todas, todos los días. */
export const DEFAULT_SCHEDULE: Schedule = {
  timezone: "America/Argentina/Buenos_Aires",
  avoidRepeat: true,
  days: DAY_ORDER.reduce((acc, d) => {
    acc[d] = [{ start: 0, mode: "random", pool: "all" }];
    return acc;
  }, {} as Record<DayKey, ScheduleSegment[]>),
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

/** Normaliza un día a lista de franjas (migra el formato viejo {mode,pool}). */
function normalizeDay(value: unknown): ScheduleSegment[] {
  if (Array.isArray(value) && value.length > 0) {
    return (value as ScheduleSegment[])
      .map((s) => ({ start: Number(s.start) || 0, mode: s.mode, pool: s.pool }))
      .sort((a, b) => a.start - b.start);
  }
  // Formato viejo: un solo objeto {mode, pool} → una franja desde 00:00.
  if (value && typeof value === "object" && "mode" in value) {
    const v = value as { mode: RotateMode; pool: PoolSpec };
    return [{ start: 0, mode: v.mode, pool: v.pool }];
  }
  return [{ start: 0, mode: "random", pool: "all" }];
}

export async function getSchedule(env: Env): Promise<Schedule> {
  const obj = await env.BANNERS.get(SCHEDULE_KEY);
  if (!obj) return DEFAULT_SCHEDULE;
  try {
    const parsed = (await obj.json()) as Partial<Schedule> & { days?: Record<string, unknown> };
    const days = {} as Record<DayKey, ScheduleSegment[]>;
    for (const d of DAY_ORDER) {
      days[d] = normalizeDay(parsed.days?.[d] ?? DEFAULT_SCHEDULE.days[d]);
    }
    return {
      timezone: parsed.timezone || DEFAULT_SCHEDULE.timezone,
      avoidRepeat: parsed.avoidRepeat ?? true,
      days,
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

/** Día (mon..sun) y hora (0-23) actuales en la zona horaria dada. */
function nowInTz(tz: string): { day: DayKey; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const wd = (parts.find((p) => p.type === "weekday")?.value ?? "Mon").toLowerCase().slice(0, 3);
  let hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  if (hour === 24) hour = 0; // algunos entornos devuelven '24' a medianoche
  const day = (DAY_ORDER.find((d) => d === wd) ?? "mon") as DayKey;
  return { day, hour };
}

/** Franja activa según la hora: la última cuyo `start` <= hora; si ninguna,
 *  la última del día (la franja nocturna se extiende hasta la madrugada). */
function activeSegment(segments: ScheduleSegment[], hour: number): ScheduleSegment {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  let active = sorted[sorted.length - 1];
  for (const s of sorted) {
    if (s.start <= hour) active = s;
  }
  return active;
}

/** Substrings asignados explícitamente en cualquier franja (para "resto"). */
function assignedSubstrings(schedule: Schedule): string[] {
  const subs: string[] = [];
  for (const d of DAY_ORDER) {
    for (const seg of schedule.days[d] ?? []) {
      if (Array.isArray(seg.pool)) subs.push(...seg.pool.map((s) => s.toLowerCase()));
    }
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
  mode: RotateMode,
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
  const { day, hour } = nowInTz(schedule.timezone);
  const segments = schedule.days[day] ?? DEFAULT_SCHEDULE.days[day];
  const rule = activeSegment(segments, hour);
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
  const hh = String(rule.start).padStart(2, "0");
  return finish(true, `[${day} ${hour}h · franja ${hh}:00 · ${rule.mode}${poolNote}] banner → ${imageName}`, {
    image: imageName,
    day,
    hour,
    segmentStart: rule.start,
    mode: rule.mode,
    poolSize: pool.length,
    bannerUrl,
    trigger: ctx.trigger,
  });
}
