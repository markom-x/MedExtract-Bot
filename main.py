import json
import mimetypes
import os
import re
import secrets
import tempfile
import time
from pathlib import Path
from urllib.parse import unquote

import requests
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, Form
from fastapi.responses import Response
from openai import OpenAI
from supabase import Client, create_client

app = FastAPI(
    title="WhatsApp Twilio Webhook",
    description="MVP webhook per messaggi Twilio (Sandbox WhatsApp).",
)

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

openai_api_key = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=openai_api_key) if openai_api_key else None

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase: Client | None = (
    create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None
)


def extract_fields_with_openai(message: str, from_number: str) -> dict:
    """
    Chiama GPT per estrarre:
      - Paziente (nome se presente, altrimenti usa from_number)
      - Richiesta (es. "Ricetta <farmaco>")
      - Urgenza (Bassa/Media/Alta)

    Ritorna SEMPRE un oggetto con chiavi:
      - Paziente, Richiesta, Urgenza
    """
    is_placeholder_key = bool(openai_api_key) and (
        "INSERISCI" in openai_api_key.upper() or "HERE" in openai_api_key.upper()
    )

    if not openai_client or is_placeholder_key:
        print("ERRORE: OPENAI_API_KEY mancante. Nessuna estrazione eseguita.")
        return {"Paziente": None, "Richiesta": None, "Urgenza": None}

    if not message or not message.strip():
        return {"Paziente": None, "Richiesta": None, "Urgenza": None}

    system_prompt = (
        "Sei un estrattore di informazioni da messaggi WhatsApp. "
        "Estrai e restituisci SOLO un oggetto JSON VALIDO con chiavi esattamente: "
        "\"Paziente\", \"Richiesta\", \"Urgenza\". "
        "Paziente: stringa con il nome del paziente se presente nel messaggio; "
        "se non presente, usa ESATTAMENTE il valore del campo 'From' passato dal backend. "
        "Richiesta: stringa breve per la richiesta medica (es. \"Ricetta Eutirox\") "
        "utilizzando il nome farmaco e, se utile, il sintomo. "
        "Urgenza: una delle seguenti stringhe esattamente: \"Bassa\", \"Media\", \"Alta\". "
        "Se non puoi determinare l'urgenza, usa \"Media\". "
        "Non includere alcun testo fuori dal JSON."
    )

    try:
        resp = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            response_format={"type": "json_object"},
            timeout=15,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"From: {from_number}\nMessaggio: {message}",
                },
            ],
        )
    except Exception as e:
        raise

    content = resp.choices[0].message.content or "{}"
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        parsed = {"Paziente": from_number, "Richiesta": None, "Urgenza": None}

    paziente = parsed.get("Paziente") or from_number
    richiesta = parsed.get("Richiesta")
    urgenza = parsed.get("Urgenza")

    if isinstance(urgenza, str):
        urgenza = urgenza.strip().capitalize()
    if urgenza not in {"Bassa", "Media", "Alta"}:
        urgenza = "Media"

    return {"Paziente": paziente, "Richiesta": richiesta, "Urgenza": urgenza}


def super_riassunto_vocale(transcript: str, from_number: str) -> str:
    """
    Genera un Super Riassunto strutturato (markdown) dalla trascrizione Whisper.
    """
    is_placeholder_key = bool(openai_api_key) and (
        "INSERISCI" in openai_api_key.upper() or "HERE" in openai_api_key.upper()
    )
    if not openai_client or is_placeholder_key:
        return f"🎤 **Trascrizione grezza**\n\n{transcript}"

    system_prompt = (
        "Sei un assistente per medici di medicina generale. "
        "Ricevi la trascrizione di un messaggio vocale WhatsApp del paziente. "
        "Produci un Super Riassunto in italiano, in markdown, con esattamente due sezioni con titoli di livello 2:\n"
        "## Cosa ha detto\n"
        "- elenco puntato sintetico di cosa comunica il paziente\n\n"
        "## Azione richiesta\n"
        "- elenco puntato di cosa chiede o di cosa serve al medico (es. ricetta, consiglio, urgenza)\n\n"
        "Sii conciso e clinico. Se mancano informazioni, indicalo nei bullet."
    )
    try:
        resp = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            timeout=30,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"From: {from_number}\n\nTrascrizione del vocale:\n{transcript}",
                },
            ],
        )
        out = (resp.choices[0].message.content or "").strip()
        return out if out else transcript
    except Exception as e:
        print(f"ERRORE Super Riassunto vocale: {e}")
        return f"🎤 **Trascrizione**\n\n{transcript}"


def get_or_create_paziente(from_number: str) -> int | None:
    if not supabase:
        print("ERRORE: Supabase non configurato (SUPABASE_URL/SUPABASE_KEY).")
        return None

    existing = (
        supabase.table("pazienti")
        .select("id")
        .eq("telefono", from_number)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]["id"]

    created = (
        supabase.table("pazienti")
        .insert({"telefono": from_number})
        .execute()
    )
    if not created.data:
        return None
    return created.data[0]["id"]


def insert_richiesta(
    paziente_id: int,
    messaggio_originale: str,
    riassunto_clinico: str | None,
    urgenza: str | None,
    url_media: str | None,
) -> None:
    if not supabase:
        print("ERRORE: Supabase non configurato (SUPABASE_URL/SUPABASE_KEY).")
        return

    payload = {
        "paziente_id": paziente_id,
        "messaggio_originale": messaggio_originale,
        "riassunto_clinico": riassunto_clinico,
        "urgenza": urgenza,
        "url_media": url_media,
    }
    supabase.table("richieste").insert(payload).execute()
    print("SALVATAGGIO SUPABASE OK: nuova richiesta inserita.")


def _extension_from_content_type(content_type: str) -> str:
    guessed = mimetypes.guess_extension((content_type or "").split(";")[0].strip())
    if guessed:
        if guessed == ".jpe":
            return ".jpg"
        return guessed
    return ".bin"


def _filename_from_content_disposition(content_disposition: str | None) -> str | None:
    """Estrae filename dall'header Content-Disposition se presente."""
    if not content_disposition:
        return None
    cd = content_disposition.strip()
    m = re.search(r"filename\*=(?:UTF-8''|utf-8'')([^;]+)", cd, re.IGNORECASE)
    if m:
        return unquote(m.group(1).strip().strip('"'))
    m = re.search(r'filename="([^"]+)"', cd)
    if m:
        return m.group(1)
    m = re.search(r"filename=([^;\s]+)", cd)
    if m:
        return m.group(1).strip('"')
    return None


def _sanitize_storage_basename(name: str) -> str:
    base = Path(name).name
    for ch in '\\/:*?"<>|':
        base = base.replace(ch, "_")
    return base.replace(" ", "_")


def _temp_suffix_for_audio(content_type: str) -> str:
    ct = (content_type or "").split(";")[0].strip().lower()
    if "ogg" in ct or ct == "audio/opus":
        return ".ogg"
    if "oga" in ct:
        return ".oga"
    if "mpeg" in ct or "mp3" in ct:
        return ".mp3"
    if "wav" in ct:
        return ".wav"
    if "m4a" in ct or "mp4" in ct:
        return ".m4a"
    return ".ogg"


def transcribe_audio_bytes_whisper(file_bytes: bytes, content_type: str) -> str | None:
    """
    Trascrive bytes audio con Whisper usando un file temporaneo.
    """
    is_placeholder_key = bool(openai_api_key) and (
        "INSERISCI" in openai_api_key.upper() or "HERE" in openai_api_key.upper()
    )
    if not openai_client or is_placeholder_key:
        print("ERRORE: OpenAI client non disponibile o API key non valida per Whisper.")
        return None

    suffix = _temp_suffix_for_audio(content_type)
    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        with open(tmp_path, "rb") as audio_file:
            transcript = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
            )
        text = getattr(transcript, "text", None)
        if text is not None:
            text = text.strip()
        return text if text else None
    except Exception as e:
        print(f"ERRORE trascrizione Whisper: {e}")
        return None
    finally:
        if tmp_path and os.path.isfile(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError as e:
                print(f"ERRORE rimozione file temporaneo audio: {e}")


def download_twilio_media_requests(
    media_url: str,
) -> tuple[bytes | None, str | None, str | None]:
    """
    Scarica i bytes del media da Twilio (MediaUrlN) con Basic Auth.
    Ritorna (content, Content-Type, Content-Disposition) o (None, None, None) in errore.
    """
    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
    if not twilio_sid or not twilio_token:
        print("ERRORE: TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN mancanti nel .env.")
        return None, None, None
    if not media_url or not str(media_url).strip():
        return None, None, None
    try:
        r = requests.get(
            str(media_url).strip(),
            auth=(twilio_sid, twilio_token),
            timeout=45,
            allow_redirects=True,
        )
        r.raise_for_status()
        ct = r.headers.get("Content-Type") or r.headers.get("content-type")
        cd = r.headers.get("Content-Disposition") or r.headers.get("content-disposition")
        return r.content, ct, cd
    except requests.RequestException as e:
        print(f"ERRORE download media Twilio (requests): {e}")
        return None, None, None


def _normalize_content_type(downloaded_ct: str | None, twilio_hint: str) -> str:
    """Preferisce il Content-Type della risposta; altrimenti il hint Twilio (MediaContentType0)."""
    ct = (downloaded_ct or "").split(";")[0].strip()
    if ct and ct.lower() != "application/octet-stream":
        return ct
    hint = (twilio_hint or "").split(";")[0].strip()
    return hint or "application/octet-stream"


def _unique_storage_object_name(
    bucket: str,
    content_type: str,
    content_disposition: str | None,
    message_sid: str,
) -> str:
    """Nome oggetto univoco: prefix + timestamp ms + parte MessageSid + estensione da tipo o filename."""
    extension = _extension_from_content_type(content_type)
    original = _filename_from_content_disposition(content_disposition)
    if original and Path(original).suffix:
        extension = Path(original).suffix.lower() or extension
    ts = int(time.time() * 1000)
    sid_raw = (message_sid or "").strip() or secrets.token_hex(4)
    sid_part = _sanitize_storage_basename(sid_raw)
    if len(sid_part) > 40:
        sid_part = sid_part[:40]
    prefix = "vocale_whatsapp" if bucket == "vocali" else "referto_whatsapp"
    return f"{prefix}_{ts}_{sid_part}{extension}"


def _storage_bucket_for_content_type(content_type: str) -> str:
    """audio/* -> bucket vocali; immagini, PDF e altri allegati -> referti."""
    ct = (content_type or "").strip().lower()
    if ct.startswith("audio/"):
        return "vocali"
    return "referti"


def upload_bytes_to_supabase_bucket(
    bucket: str,
    object_path: str,
    file_bytes: bytes,
    content_type: str,
) -> str | None:
    """Carica su un bucket Storage e restituisce l'URL pubblico (get_public_url)."""
    if not supabase:
        print("ERRORE: Supabase non configurato (SUPABASE_URL/SUPABASE_KEY).")
        return None
    if bucket not in {"referti", "vocali"}:
        print(f"ERRORE: bucket non consentito: {bucket}")
        return None
    try:
        supabase.storage.from_(bucket).upload(
            object_path,
            file_bytes,
            file_options={"content-type": content_type or "application/octet-stream"},
        )
        return supabase.storage.from_(bucket).get_public_url(object_path)
    except Exception as e:
        print(f"ERRORE upload Supabase Storage (bucket={bucket}, path={object_path}): {e}")
        return None


def upload_file_bytes_to_storage(
    file_bytes: bytes,
    content_type: str,
    content_disposition: str | None,
    message_sid: str = "",
) -> str | None:
    """
    Sceglie vocali vs referti dal Content-Type, genera un path univoco,
    carica e restituisce l'URL pubblico da salvare in richieste.url_media.
    """
    bucket = _storage_bucket_for_content_type(content_type)
    object_path = _unique_storage_object_name(
        bucket, content_type, content_disposition, message_sid
    )
    return upload_bytes_to_supabase_bucket(
        bucket, object_path, file_bytes, content_type
    )


def process_message(
    from_number: str,
    body: str,
    num_media: int = 0,
    media_url_0: str = "",
    media_content_type_0: str = "",
    message_sid: str = "",
) -> None:
    message_text = body.strip() if body else ""
    uploaded_media_url = None
    media_url_clean = (media_url_0 or "").strip()

    if num_media > 0 and not media_url_clean:
        print(
            "ERRORE: NumMedia > 0 ma MediaUrl0 assente o vuoto: "
            "impossibile scaricare l'allegato da Twilio."
        )

    # Un solo download (requests) da MediaUrl0; bucket vocali vs referti dal tipo effettivo
    if num_media > 0 and media_url_clean:
        file_bytes, dl_ct, dl_cd = download_twilio_media_requests(media_url_clean)
        if file_bytes is None:
            message_text = message_text or "[Allegato - download da Twilio non riuscito]"
        else:
            ct_resolved = _normalize_content_type(dl_ct, media_content_type_0)
            is_audio = ct_resolved.strip().lower().startswith("audio/")

            if is_audio:
                uploaded_media_url = upload_file_bytes_to_storage(
                    file_bytes, ct_resolved, dl_cd, message_sid
                )
                if uploaded_media_url:
                    print(f"AUDIO CARICATO SU SUPABASE (bucket vocali): {uploaded_media_url}")

                transcript_text = transcribe_audio_bytes_whisper(
                    file_bytes, media_content_type_0
                )
                if transcript_text:
                    message_text = super_riassunto_vocale(transcript_text, from_number)
                else:
                    message_text = message_text or "[Vocale - trascrizione non disponibile]"
            else:
                if not message_text:
                    message_text = "[Allegato Multimediale]"
                object_path = _unique_storage_object_name(
                    "referti", ct_resolved, dl_cd, message_sid
                )
                try:
                    uploaded_media_url = upload_bytes_to_supabase_bucket(
                        "referti", object_path, file_bytes, ct_resolved
                    )
                    if uploaded_media_url:
                        print(
                            f"REFERTO CARICATO SU SUPABASE (bucket referti): {uploaded_media_url}"
                        )
                    else:
                        print(
                            "ERRORE: upload su bucket referti non riuscito (vedi log Storage)."
                        )
                except Exception as e:
                    print(f"ERRORE upload media referti: {e}")

    try:
        extracted = extract_fields_with_openai(message_text, from_number)
    except Exception as e:
        print(f"ERRORE estrazione OpenAI: {e}")
        return

    print("ESTRAZIONE GPT-4O-MINI (JSON)")
    print(json.dumps(extracted, indent=2))

    try:
        paziente_id = get_or_create_paziente(from_number)
        if paziente_id is None:
            print("ERRORE: impossibile trovare/creare il paziente su Supabase.")
            return

        insert_richiesta(
            paziente_id=paziente_id,
            messaggio_originale=message_text,
            riassunto_clinico=extracted.get("Richiesta"),
            urgenza=extracted.get("Urgenza"),
            url_media=uploaded_media_url,
        )
    except Exception as e:
        print(f"ERRORE Supabase: {e}")


@app.post("/webhook")
def twilio_webhook(
    background_tasks: BackgroundTasks,
    From: str = Form(...),
    Body: str = Form(default=""),
    NumMedia: int = Form(default=0),
    MediaUrl0: str = Form(default=""),
    MediaContentType0: str = Form(default=""),
    MessageSid: str = Form(default=""),
) -> Response:
    print("🚨 RICEVUTO MESSAGGIO DA TWILIO! 🚨", flush=True)
    # Riceve il POST da Twilio (application/x-www-form-urlencoded).
    # Rispondiamo subito con TwiML vuoto e processiamo OpenAI + Supabase in BackgroundTasks
    # (endpoint sync per non bloccare l'event loop con SDK bloccanti).
    separator = "=" * 72
    print(f"\n{separator}")
    print("TWILIO WEBHOOK — NUOVO MESSAGGIO")
    print(separator)
    print(f"  Mittente (From): {From}")
    print(f"  Messaggio (Body): {Body}")
    print(f"  NumMedia: {NumMedia}")
    if NumMedia > 0:
        print(f"  MediaUrl0: {MediaUrl0}")
        print(f"  MediaContentType0: {MediaContentType0}")
    if MessageSid:
        print(f"  MessageSid: {MessageSid}")
    print(f"{separator}\n")

    background_tasks.add_task(
        process_message,
        From,
        Body,
        NumMedia,
        MediaUrl0,
        MediaContentType0,
        MessageSid,
    )

    twiml = "<Response></Response>"
    return Response(content=twiml, media_type="application/xml")
