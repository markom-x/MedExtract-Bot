import { MEDICO_FILE_SENT, MEDICO_MSG_PREFIX } from "./constants";

export function cleanPhone(phone: string | null | undefined): string {
  let value = (phone ?? "").trim();
  if (value.toLowerCase().startsWith("whatsapp:")) {
    value = value.split(":", 2)[1]?.trim() ?? "";
  }
  return value || "Numero sconosciuto";
}

export function patientDisplayName(
  nome: string | null | undefined,
  _phoneClean: string
): string {
  if (nome?.trim()) return nome.trim();
  return "Sconosciuto (clicca per modificare)";
}

export function formatCreatedAt(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return value;
  }
}

export function isMedicoMessage(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  return t.startsWith(MEDICO_MSG_PREFIX) || t === MEDICO_FILE_SENT;
}

export function needsAttention(requests: { stato?: string | null; urgenza?: string | null }[]): boolean {
  for (const req of requests) {
    const stato = (req.stato ?? "").trim().toLowerCase();
    const urgenza = (req.urgenza ?? "").trim().toLowerCase();
    if (stato === "da gestire" || urgenza === "alta") return true;
  }
  return false;
}
