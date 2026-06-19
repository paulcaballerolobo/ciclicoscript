import type { Env } from "./types";
import { SCRIPTS, getScript } from "./scripts/registry";
import {
  BANNER_PREFIX,
  listBannerImages,
  getSchedule,
  saveSchedule,
} from "./scripts/banner-rotator";
import type { Schedule } from "./types";

/* ----------------------------- helpers ----------------------------- */

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** Auth simple por bearer token (o ?token= para previews de imagen). */
function isAuthed(req: Request, env: Env): boolean {
  if (!env.DASH_TOKEN) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${env.DASH_TOKEN}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("token") === env.DASH_TOKEN;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/* ------------------------------ router ----------------------------- */

async function handleApi(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (!isAuthed(req, env)) {
    return json({ ok: false, error: "No autorizado." }, 401);
  }

  // Lista de scripts disponibles.
  if (path === "/api/scripts" && req.method === "GET") {
    return json({
      ok: true,
      scripts: SCRIPTS.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        scheduled: s.scheduled,
      })),
    });
  }

  // Ejecutar un script manualmente: POST /api/scripts/:id/run
  const runMatch = path.match(/^\/api\/scripts\/([^/]+)\/run$/);
  if (runMatch && req.method === "POST") {
    const script = getScript(runMatch[1]);
    if (!script) return json({ ok: false, error: "Script no encontrado." }, 404);
    try {
      const result = await script.run(env, { trigger: "manual" });
      return json({ ok: true, result });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message }, 500);
    }
  }

  /* ---- gestión de imágenes del rotador ---- */

  // Leer el calendario de rotación.
  if (path === "/api/rotator/schedule" && req.method === "GET") {
    return json({ ok: true, schedule: await getSchedule(env) });
  }

  // Guardar el calendario de rotación.
  if (path === "/api/rotator/schedule" && req.method === "PUT") {
    const schedule = (await req.json()) as Schedule;
    if (!schedule || typeof schedule !== "object" || !schedule.days) {
      return json({ ok: false, error: "Calendario inválido." }, 400);
    }
    await saveSchedule(env, schedule);
    return json({ ok: true });
  }

  // Listar imágenes.
  if (path === "/api/rotator/images" && req.method === "GET") {
    const keys = await listBannerImages(env);
    return json({ ok: true, images: keys.map((k) => k.slice(BANNER_PREFIX.length)) });
  }

  // Subir una imagen (multipart, campo "file").
  if (path === "/api/rotator/images" && req.method === "POST") {
    const form = await req.formData();
    const entry = form.get("file");
    if (!entry || typeof entry === "string") {
      return json({ ok: false, error: "Falta el archivo (campo 'file')." }, 400);
    }
    const file = entry as File;
    const key = BANNER_PREFIX + sanitizeName(file.name);
    await env.BANNERS.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || "image/jpeg" },
    });
    return json({ ok: true, key: key.slice(BANNER_PREFIX.length) });
  }

  // Borrar una imagen: DELETE /api/rotator/images/:name
  const delMatch = path.match(/^\/api\/rotator\/images\/(.+)$/);
  if (delMatch && req.method === "DELETE") {
    const name = decodeURIComponent(delMatch[1]);
    await env.BANNERS.delete(BANNER_PREFIX + name);
    return json({ ok: true });
  }

  // Servir bytes de una imagen para preview: GET /api/rotator/image/:name
  const imgMatch = path.match(/^\/api\/rotator\/image\/(.+)$/);
  if (imgMatch && req.method === "GET") {
    const name = decodeURIComponent(imgMatch[1]);
    const obj = await env.BANNERS.get(BANNER_PREFIX + name);
    if (!obj) return new Response("Not found", { status: 404 });
    return new Response(obj.body, {
      headers: {
        "content-type": obj.httpMetadata?.contentType || "image/jpeg",
        "cache-control": "no-store",
      },
    });
  }

  return json({ ok: false, error: "Ruta no encontrada." }, 404);
}

/* ------------------------------ worker ----------------------------- */

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(req, env, ctx);
    }
    // Todo lo demás lo sirve el binding de assets (el dashboard estático).
    return env.ASSETS.fetch(req);
  },

  // Cron: ejecuta todos los scripts marcados como `scheduled`.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const script of SCRIPTS) {
      if (!script.scheduled) continue;
      ctx.waitUntil(
        script
          .run(env, { trigger: "cron" })
          .then((r) => console.log(`[cron] ${script.id}: ${r.message}`))
          .catch((e) => console.error(`[cron] ${script.id} error:`, e))
      );
    }
  },
};
