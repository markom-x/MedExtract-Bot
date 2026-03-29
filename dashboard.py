import mimetypes
import os
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import streamlit as st
from dotenv import load_dotenv
from supabase import create_client
from twilio.rest import Client

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")

twilio_client: Client | None = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

MEDICO_MSG_PREFIX = "👨‍⚕️ Tu:"
MEDICO_FILE_SENT = "📄 File inviato dal medico"


def url_looks_like_pdf(url: str | None) -> bool:
    if not url:
        return False
    base = url.split("?")[0].split("#")[0].lower()
    return base.endswith(".pdf")


_AUDIO_EXTENSIONS = (
    ".ogg",
    ".oga",
    ".opus",
    ".mp3",
    ".mpeg",
    ".wav",
    ".m4a",
    ".aac",
    ".flac",
)


def url_looks_like_audio(url: str | None) -> bool:
    if not url:
        return False
    base = url.split("?")[0].split("#")[0].lower()
    return any(base.endswith(ext) for ext in _AUDIO_EXTENSIONS)


def streamlit_audio_format(url: str) -> str:
    """MIME type per st.audio in base all'estensione nell'URL."""
    base = url.split("?")[0].split("#")[0].lower()
    if base.endswith(".wav"):
        return "audio/wav"
    if base.endswith(".mp3") or base.endswith(".mpeg"):
        return "audio/mpeg"
    if base.endswith(".m4a"):
        return "audio/mp4"
    if base.endswith(".aac"):
        return "audio/aac"
    return "audio/ogg"

st.set_page_config(page_title="WhatsApp Superpowered", layout="wide")
st.title("CRM Medico · WhatsApp Superpowered")
st.caption("Fascicolo paziente, priorità clinica e conversazione in un'unica vista.")

if not SUPABASE_URL or not SUPABASE_KEY:
    st.error("Config mancante: imposta SUPABASE_URL e SUPABASE_KEY nel file .env")
    st.stop()

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def supabase_execute_with_retry(operation, max_attempts: int = 10):
    """Esegue una chiamata Supabase (.execute) con retry su errori di connessione."""
    last_error: Exception | None = None
    attempt = 0
    while attempt < max_attempts:
        try:
            return operation()
        except Exception as e:
            last_error = e
            attempt += 1
            st.warning("Connessione al database persa. Riprovo in 2 secondi...")
            time.sleep(2)
    st.error(f"Impossibile connettersi al database dopo {max_attempts} tentativi: {last_error}")
    st.stop()


def urgency_badge(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized == "alta":
        return "🔴 Alta"
    if normalized == "media":
        return "🟡 Media"
    if normalized == "bassa":
        return "🟢 Bassa"
    return "⚪ Non definita"


def clean_phone(phone: str | None) -> str:
    value = (phone or "").strip()
    if value.lower().startswith("whatsapp:"):
        value = value.split(":", 1)[1].strip()
    return value or "Numero sconosciuto"


def patient_display_name(nome: str | None, phone_clean: str) -> str:
    if nome and nome.strip():
        return nome.strip()
    return f"Sconosciuto {phone_clean}"


def format_created_at(value: str | None) -> str:
    if not value:
        return "-"
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.strftime("%d/%m/%Y %H:%M")
    except ValueError:
        return value


def parse_created_at_utc(value: str | None) -> datetime | None:
    """Converte created_at Supabase in datetime timezone-aware (UTC)."""
    if not value:
        return None
    try:
        s = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt
    except ValueError:
        return None


def last_patient_inbound_at_utc(requests: list[dict]) -> datetime | None:
    """Data/ora dell'ultimo messaggio dal paziente (esclude messaggi medico)."""
    inbound = [
        r
        for r in requests
        if not ((r.get("messaggio_originale") or "").strip().startswith(MEDICO_MSG_PREFIX))
        and (r.get("messaggio_originale") or "").strip() != MEDICO_FILE_SENT
    ]
    if not inbound:
        return None
    inbound.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return parse_created_at_utc(inbound[0].get("created_at"))


def needs_attention(requests: list[dict]) -> bool:
    for req in requests:
        stato = (req.get("stato") or "").strip().lower()
        urgenza = (req.get("urgenza") or "").strip().lower()
        if stato == "da gestire" or urgenza == "alta":
            return True
    return False


def _fetch_richieste():
    return (
        supabase.table("richieste")
        .select(
            "id, created_at, stato, urgenza, riassunto_clinico, messaggio_originale, url_media, "
            "pazienti:paziente_id (id, nome, telefono)"
        )
        .order("created_at", desc=True)
        .limit(500)
        .execute()
    )


def whatsapp_to_address(telefono_clean: str) -> str:
    """Twilio WhatsApp richiede il prefisso whatsapp: sull'indirizzo."""
    t = (telefono_clean or "").strip()
    if t.lower().startswith("whatsapp:"):
        return t
    return f"whatsapp:{t}"


result = supabase_execute_with_retry(_fetch_richieste)

rows = result.data or []
if not rows:
    st.info("Nessuna richiesta presente.")
    st.stop()

patients_map: dict[int, dict] = {}
patient_requests: dict[int, list[dict]] = defaultdict(list)

for row in rows:
    paziente = row.get("pazienti") or {}
    paziente_id = paziente.get("id")
    if paziente_id is None:
        continue

    raw_name = paziente.get("nome")
    phone_clean = clean_phone(paziente.get("telefono"))
    display_name = patient_display_name(raw_name, phone_clean)

    patients_map[paziente_id] = {
        "id": paziente_id,
        "nome_raw": raw_name,
        "nome_display": display_name,
        "telefono": phone_clean,
    }
    patient_requests[paziente_id].append(row)

if not patients_map:
    st.warning("Nessun paziente valido trovato nelle richieste.")
    st.stop()

ordered_patient_ids = sorted(
    patients_map.keys(),
    key=lambda pid: (
        0 if needs_attention(patient_requests[pid]) else 1,
        -(len(patient_requests[pid])),
        patients_map[pid]["nome_display"].lower(),
    ),
)

if "selected_patient_id" not in st.session_state:
    st.session_state.selected_patient_id = ordered_patient_ids[0]

st.sidebar.title("Pazienti")
st.sidebar.caption("Priorità in cima: stato 'Da gestire' o urgenza 'Alta'.")

for pid in ordered_patient_ids:
    p = patients_map[pid]
    requests_for_patient = patient_requests[pid]
    pending = sum(
        1 for r in requests_for_patient if (r.get("stato") or "").strip().lower() == "da gestire"
    )
    high = sum(
        1 for r in requests_for_patient if (r.get("urgenza") or "").strip().lower() == "alta"
    )
    prefix = "🚨 " if needs_attention(requests_for_patient) else ""
    label = f"{prefix}{p['nome_display']} ({pending} da gestire, {high} alte)"

    if st.sidebar.button(label, key=f"patient_button_{pid}", use_container_width=True):
        st.session_state.selected_patient_id = pid

selected_id = st.session_state.selected_patient_id
selected_patient = patients_map.get(selected_id)
selected_requests = patient_requests.get(selected_id, [])

if not selected_patient or not selected_requests:
    st.info("Seleziona un paziente dalla sidebar.")
    st.stop()

selected_requests_desc = sorted(
    selected_requests,
    key=lambda r: r.get("created_at") or "",
    reverse=True,
)
selected_requests_asc = list(reversed(selected_requests_desc))

# --- Toolbar sopra le colonne ---
tool_a, tool_b, tool_c = st.columns([3, 2, 1])
with tool_a:
    current_name = selected_patient.get("nome_raw") or ""
    nuovo_nome = st.text_input(
        "Rinomina paziente",
        value=current_name,
        key=f"rename_input_{selected_id}",
        placeholder="Nome e cognome",
        label_visibility="collapsed",
    )
with tool_b:
    if st.button("Salva nome", key=f"save_name_{selected_id}", use_container_width=True):
        nome_to_save = nuovo_nome.strip()
        update_payload = {"nome": nome_to_save if nome_to_save else None}

        def _update_nome():
            return (
                supabase.table("pazienti")
                .update(update_payload)
                .eq("id", selected_id)
                .execute()
            )

        supabase_execute_with_retry(_update_nome)
        st.success("Nome aggiornato.")
        st.rerun()
with tool_c:
    if st.button("Segna tutto gestito", key=f"all_done_{selected_id}", use_container_width=True):

        def _update_all():
            return (
                supabase.table("richieste")
                .update({"stato": "Gestito"})
                .eq("paziente_id", selected_id)
                .execute()
            )

        supabase_execute_with_retry(_update_all)
        st.success("Tutte le richieste sono state segnate come gestite.")
        st.rerun()

st.divider()

col_sinistra, col_destra = st.columns([6, 4])

with col_sinistra:
    st.markdown(f"### {selected_patient['nome_display']}")
    st.markdown(f"**Telefono:** `{selected_patient['telefono']}`")

    m1, m2, m3 = st.columns(3)
    m1.metric("Richieste totali", len(selected_requests))
    m2.metric(
        "Da gestire",
        sum(1 for r in selected_requests if (r.get("stato") or "").strip().lower() == "da gestire"),
    )
    m3.metric(
        "Urgenza alta",
        sum(1 for r in selected_requests if (r.get("urgenza") or "").strip().lower() == "alta"),
    )

    st.markdown("#### To-Do · Necessità cliniche")
    pending_reqs = [
        r
        for r in selected_requests
        if (r.get("stato") or "").strip().lower() == "da gestire"
    ]
    if not pending_reqs:
        st.success("Nessuna azione in sospeso per questo paziente.")
    else:
        pending_reqs.sort(
            key=lambda r: (
                {"alta": 0, "media": 1, "bassa": 2}.get((r.get("urgenza") or "").strip().lower(), 3),
                r.get("created_at") or "",
            )
        )
        for req in pending_reqs:
            rid = req.get("id")
            summary = req.get("riassunto_clinico") or "Nessun riassunto IA."
            urg = (req.get("urgenza") or "").strip().lower()
            badge = urgency_badge(req.get("urgenza"))
            when = format_created_at(req.get("created_at"))
            btn_col, txt_col = st.columns([1, 5])
            with btn_col:
                if st.button(
                    "Segna come completato",
                    key=f"complete_req_{selected_id}_{rid}",
                    use_container_width=True,
                ):

                    def _one_done():
                        return (
                            supabase.table("richieste")
                            .update({"stato": "Gestito"})
                            .eq("id", rid)
                            .execute()
                        )

                    supabase_execute_with_retry(_one_done)
                    st.rerun()
            with txt_col:
                body = f"**{badge}** · {when}\n\n{summary}"
                if urg == "alta":
                    st.error(body)
                elif urg == "media":
                    st.warning(body)
                else:
                    st.info(body)

    st.markdown("#### Smart Files · Referti")
    media_items = [
        (r.get("url_media"), r.get("created_at"), r.get("messaggio_originale") or "")
        for r in selected_requests_desc
        if r.get("url_media")
    ]
    if not media_items:
        st.caption("Nessun referto o allegato per questo paziente.")
    else:
        idx = 0
        while idx < len(media_items):
            gal_cols = st.columns(3)
            for gc in gal_cols:
                if idx >= len(media_items):
                    break
                url, ts, msg_txt = media_items[idx]
                idx += 1
                with gc:
                    st.caption(format_created_at(ts))
                    if url_looks_like_audio(url):
                        st.audio(url, format=streamlit_audio_format(url))
                        if msg_txt.strip():
                            st.markdown(msg_txt)
                    elif url_looks_like_pdf(url):
                        st.markdown(f"[📄 Scarica/Apri PDF]({url})")
                    else:
                        st.image(url, use_container_width=True)
                    st.caption(url[:48] + "…" if len(url) > 48 else url)

with col_destra:
    last_inbound_utc = last_patient_inbound_at_utc(selected_requests)
    now_utc = datetime.now(timezone.utc)
    if last_inbound_utc is None:
        window_24h_expired = True
    else:
        window_24h_expired = (now_utc - last_inbound_utc) > timedelta(hours=24)

    if window_24h_expired:
        st.warning(
            "⚠️ Finestra di 24h scaduta. Apri WhatsApp sul telefono per ricontattare questo paziente."
        )

    st.markdown("#### Conversazione WhatsApp")
    chat_container = st.container(height=500)
    with chat_container:
        chat_rows = sorted(
            selected_requests,
            key=lambda r: r.get("created_at") or "",
        )
        for r in chat_rows:
            ts_raw = r.get("created_at") or ""
            ts = format_created_at(ts_raw)
            raw_msg = (r.get("messaggio_originale") or "").strip() or "[Messaggio vuoto]"
            is_medico = raw_msg.startswith(MEDICO_MSG_PREFIX) or raw_msg == MEDICO_FILE_SENT
            role = "assistant" if is_medico else "user"
            with st.chat_message(role):
                st.caption(ts)
                u = r.get("url_media")
                if u and url_looks_like_audio(u):
                    st.audio(u, format=streamlit_audio_format(u))
                    st.markdown(raw_msg)
                elif u and url_looks_like_pdf(u):
                    st.markdown(raw_msg)
                    st.markdown(f"[📄 Scarica/Apri PDF]({u})")
                elif u:
                    st.markdown(raw_msg)
                    st.image(u)
                else:
                    st.markdown(raw_msg)

    if not TWILIO_PHONE_NUMBER:
        st.caption("Configura `TWILIO_PHONE_NUMBER` nel file `.env` per inviare messaggi.")

    messaggio_medico = st.chat_input(
        "Rispondi al paziente su WhatsApp...",
        key=f"chat_input_{selected_id}",
        disabled=window_24h_expired,
    )

    up_col, btn_col = st.columns([4, 1])
    with up_col:
        file_medico = st.file_uploader(
            "Allega ricetta o referto",
            type=["pdf", "png", "jpg", "jpeg"],
            key=f"file_upload_{selected_id}",
            disabled=window_24h_expired,
        )
    with btn_col:
        invia_file = st.button(
            "Invia File",
            key=f"invia_file_{selected_id}",
            disabled=window_24h_expired,
            use_container_width=True,
        )

    if invia_file and not window_24h_expired:
        if file_medico is None:
            st.warning("Carica un file prima di inviare.")
        elif not twilio_client or not TWILIO_PHONE_NUMBER:
            st.error(
                "Twilio non configurato: servono TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_PHONE_NUMBER."
            )
        else:
            try:
                raw_bytes = file_medico.getvalue()
                basename = Path(file_medico.name).name or "file"
                safe_name = basename.replace(" ", "_")
                storage_name = f"{int(time.time())}_{safe_name}"
                content_type = file_medico.type or (
                    mimetypes.guess_type(file_medico.name)[0] or "application/octet-stream"
                )
                supabase.storage.from_("referti").upload(
                    storage_name,
                    raw_bytes,
                    file_options={"content-type": content_type},
                )
                url_pubblico = supabase.storage.from_("referti").get_public_url(storage_name)

                twilio_client.messages.create(
                    from_=TWILIO_PHONE_NUMBER,
                    to=whatsapp_to_address(selected_patient["telefono"]),
                    media_url=[url_pubblico],
                )
                supabase.table("richieste").insert(
                    {
                        "paziente_id": selected_id,
                        "messaggio_originale": MEDICO_FILE_SENT,
                        "riassunto_clinico": "File inviato dal medico",
                        "urgenza": "Bassa",
                        "stato": "Gestito",
                        "url_media": url_pubblico,
                    }
                ).execute()
                st.rerun()
            except Exception as e:
                st.error(f"Errore durante l'invio: {e}")
    if messaggio_medico and not window_24h_expired:
        testo = messaggio_medico.strip()
        if not testo:
            st.warning("Inserisci un messaggio prima di inviare.")

        elif not twilio_client or not TWILIO_PHONE_NUMBER:
            st.error(
                "Twilio non configurato: servono TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_PHONE_NUMBER."
            )
        else:
            try:
                twilio_client.messages.create(
                    from_=TWILIO_PHONE_NUMBER,
                    body=testo,
                    to=whatsapp_to_address(selected_patient["telefono"]),
                )
                supabase.table("richieste").insert(
                    {
                        "paziente_id": selected_id,
                        "messaggio_originale": f"{MEDICO_MSG_PREFIX} {testo}",
                        "riassunto_clinico": "Risposta del medico",
                        "urgenza": "Bassa",
                        "stato": "Gestito",
                    }
                ).execute()
                st.rerun()
            except Exception as e:
                st.error(f"Errore durante l'invio: {e}")
