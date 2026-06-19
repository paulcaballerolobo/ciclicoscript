# Cíclico · Panel de scripts

Dashboard para correr automatizaciones de Cíclico sobre **Cloudflare Workers**, desplegado vía GitHub.
Primer script: **rotador del banner del canal de YouTube**.

## Arquitectura

```
┌─────────────────────────────────────────────────────┐
│  Cloudflare Worker (ciclicoscript)                    │
│                                                       │
│  /            → dashboard estático (public/, ASSETS)  │
│  /api/*       → router (scripts, imágenes)            │
│  cron 0 9 * * → ejecuta scripts programados           │
│                                                       │
│  Bindings:  ASSETS (estático) · BANNERS (R2)          │
└─────────────────────────────────────────────────────┘
        │                         │
        ▼                         ▼
   R2: ciclico-banners      YouTube Data API v3
   (imágenes + estado)      (channelBanners + channels)
```

- **Dashboard**: HTML/CSS/JS vanilla con el sistema de diseño de Cíclico (`public/index.html`).
- **Backend**: un único Worker en TypeScript (`src/`).
- **Scripts**: registrados en `src/scripts/registry.ts`. Agregar uno nuevo = una entrada ahí.
- **Storage**: bucket R2 `ciclico-banners` (imágenes bajo `banners/`, estado en `rotator-state.json`).
- **Auth**: token bearer (`DASH_TOKEN`) para entrar al panel y llamar la API.

## Setup local

```bash
npm install
cp .dev.vars.example .dev.vars   # completá los valores
npm run dev                      # http://localhost:8787
```

Para probar el cron localmente: `npm run cron:test` y luego visitá
`http://localhost:8787/__scheduled`.

## Secretos / variables

Públicas (en `wrangler.jsonc → vars`):

| Variable             | Descripción                                              |
|----------------------|----------------------------------------------------------|
| `YOUTUBE_CHANNEL_ID` | ID del canal de Cíclico (empieza con `UC…`).             |
| `ROTATOR_ENABLED`    | `"true"` para que el cron rote; cualquier otra cosa lo salta. |

Secretas (con `wrangler secret put NOMBRE`, o en `.dev.vars` para local):

| Secreto                 | Descripción                                  |
|-------------------------|----------------------------------------------|
| `DASH_TOKEN`            | Token para entrar al dashboard.              |
| `GOOGLE_CLIENT_ID`      | OAuth client del proyecto en Google Cloud.   |
| `GOOGLE_CLIENT_SECRET`  | OAuth client secret.                          |
| `GOOGLE_REFRESH_TOKEN`  | Refresh token con scope de YouTube.          |

## Obtener el refresh token de YouTube (una sola vez)

1. En [Google Cloud Console](https://console.cloud.google.com): creá un proyecto y habilitá **YouTube Data API v3**.
2. Pantalla de consentimiento OAuth → agregá tu cuenta como *test user*.
3. Credenciales → **OAuth client ID** tipo *Desktop* (o Web con redirect a OAuth Playground).
4. En [OAuth Playground](https://developers.google.com/oauthplayground):
   - Engranaje ⚙ → *Use your own OAuth credentials* → pegá client id/secret.
   - Scope: `https://www.googleapis.com/auth/youtube`.
   - Autorizá con la cuenta dueña del canal → *Exchange authorization code for tokens*.
   - Copiá el **refresh token**.
5. Cargalo como secreto: `wrangler secret put GOOGLE_REFRESH_TOKEN`.

> El refresh token debe pertenecer a la cuenta que administra el canal de Cíclico.

## Crear el bucket R2

```bash
wrangler r2 bucket create ciclico-banners
```

## Deploy

### Manual

```bash
wrangler deploy
wrangler secret put DASH_TOKEN
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GOOGLE_REFRESH_TOKEN
```

### Vía GitHub (Workers Builds)

1. Subí este repo a GitHub.
2. Cloudflare Dashboard → **Workers & Pages → Create → Workers → Connect to Git**.
3. Elegí el repo. Build command: `npm install`. Deploy command: `npx wrangler deploy`.
4. Cargá los secretos en **Settings → Variables and Secrets** (o por CLI).
5. Cada push a la rama principal redeploya solo.

## Uso

1. Entrá a la URL del Worker → ingresá el `DASH_TOKEN`.
2. Clic en **Rotador de banner** → subí las imágenes del set.
3. **Rotar ahora** para probar, o dejá que el cron lo haga (con `ROTATOR_ENABLED=true`).

## Agregar un script nuevo

1. Creá `src/scripts/mi-script.ts` exportando una función `(env, ctx) => Promise<ScriptResult>`.
2. Registralo en `src/scripts/registry.ts`.
3. Aparece solo en el dashboard. Si tiene UI propia, agregá su panel en `public/index.html`.
