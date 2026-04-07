import { urlLooksLikeAudio } from "@/lib/dashboard/media";

/**
 * Bucket per path relativi salvati in `richieste.url_media` (es. `+39…/vocale_whatsapp_….ogg`).
 * Allineato a `main.py`: audio → vocali, resto → referti.
 */
export function patientMediaBucketForPath(relativePath: string): "referti" | "vocali" {
  const base =
    relativePath.split("/").pop()?.toLowerCase() ??
    relativePath.toLowerCase();
  if (base.startsWith("vocale_whatsapp")) return "vocali";
  if (base.startsWith("referto_whatsapp")) return "referti";
  if (urlLooksLikeAudio(relativePath)) return "vocali";
  return "referti";
}
