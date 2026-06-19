import type { Env, ScriptResult } from "../types";
import { getAccessToken } from "../lib/google-auth";
import { setChannelBanner } from "../lib/youtube";

/** Prefijo bajo el que viven las imágenes del banner en R2. */
export const BANNER_PREFIX = "banners/";
/** Clave del objeto de estado (guarda qué imagen tocó por última vez). */
const STATE_KEY = "rotator-state.json";

interface RotatorState {
  lastKey: string | null;
  lastRunAt: string | null;
}

function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    default:
      return "image/jpeg";
  }
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

/** Lista las imágenes disponibles (ordenadas por clave). */
export async function listBannerImages(env: Env): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.BANNERS.list({ prefix: BANNER_PREFIX, cursor });
    for (const o of page.objects) {
      if (o.key !== STATE_KEY) out.push(o.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out.sort();
}

/**
 * Elige la siguiente imagen de forma circular respecto a la última usada
 * y la pone como banner del canal.
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

  // En cron respetamos el interruptor; en manual siempre corre.
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

  const state = await readState(env);
  const lastIdx = state.lastKey ? images.indexOf(state.lastKey) : -1;
  const nextKey = images[(lastIdx + 1) % images.length];

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

  return finish(true, `Banner actualizado a ${nextKey}.`, {
    image: nextKey,
    bannerUrl,
    totalImages: images.length,
    trigger: ctx.trigger,
  });
}
