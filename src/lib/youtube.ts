/**
 * Wrapper mínimo de YouTube Data API v3 para cambiar el banner del canal.
 *
 * Flujo de dos pasos:
 *   1. channelBanners.insert  → sube los bytes de la imagen y devuelve una URL/token.
 *   2. channels.update        → asigna ese token al brandingSettings del canal.
 *
 * Requisitos del banner (Google): 2048x1152 px recomendado, máx 6 MB,
 * formato JPG/PNG/GIF/BMP.
 */

const UPLOAD_URL =
  "https://www.googleapis.com/upload/youtube/v3/channelBanners/insert?uploadType=media";

/** Paso 1: sube la imagen y devuelve la bannerExternalUrl. */
export async function uploadBanner(
  accessToken: string,
  imageBytes: ArrayBuffer,
  contentType: string
): Promise<string> {
  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
    },
    body: imageBytes,
  });

  if (!res.ok) {
    throw new Error(`channelBanners.insert falló (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) {
    throw new Error("channelBanners.insert no devolvió una url.");
  }
  return data.url;
}

/** Paso 2: aplica la bannerExternalUrl al canal. */
export async function applyBanner(
  accessToken: string,
  channelId: string,
  bannerExternalUrl: string
): Promise<void> {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=brandingSettings",
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: channelId,
        brandingSettings: {
          image: { bannerExternalUrl },
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`channels.update falló (${res.status}): ${await res.text()}`);
  }
}

/** Conveniencia: sube + aplica en una sola llamada. */
export async function setChannelBanner(
  accessToken: string,
  channelId: string,
  imageBytes: ArrayBuffer,
  contentType: string
): Promise<string> {
  const bannerUrl = await uploadBanner(accessToken, imageBytes, contentType);
  await applyBanner(accessToken, channelId, bannerUrl);
  return bannerUrl;
}
