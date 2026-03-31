const SAFE = /[^a-zA-Z0-9._-]/g;

/** Nome file sicuro per storage (bucket referti). */
export function safeStorageFileName(originalName: string): string {
  const base =
    originalName
      .split(/[/\\]/)
      .pop()
      ?.replace(SAFE, "_")
      .replace(/_+/g, "_")
      .slice(0, 96) || "file";
  return `${Date.now()}_${base}`;
}
