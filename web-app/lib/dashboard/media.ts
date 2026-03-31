const AUDIO_EXTENSIONS = [
  ".ogg",
  ".oga",
  ".opus",
  ".mp3",
  ".mpeg",
  ".wav",
  ".m4a",
  ".aac",
  ".flac",
] as const;

export function urlLooksLikePdf(url: string | null | undefined): boolean {
  if (!url) return false;
  const base = url.split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";
  return base.endsWith(".pdf");
}

export function urlLooksLikeAudio(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  /** Bucket Supabase per i vocali Twilio: l'URL contiene il segmento `vocali`. */
  if (lower.includes("vocali")) return true;
  const base = url.split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";
  return AUDIO_EXTENSIONS.some((ext) => base.endsWith(ext));
}
