import re
import requests
from django.conf import settings
from messaging.models import MetaConfiguration
from messaging.meta_config import cipher


def format_patient_first_name(full_name: str, first_name_only: bool = True) -> str:
    cleaned = (full_name or "").strip()
    if not cleaned:
        return "Cliente"
    parts = cleaned.split()
    if first_name_only:
        first = parts[0]
        # Title case, e.g. "VALERIA" -> "Valeria"
        return first.capitalize()
    # Title case for all words except prepositions
    preps = {"de", "da", "do", "das", "dos", "e"}
    return " ".join(
        w.lower() if w.lower() in preps else w.capitalize()
        for w in parts
    )


def normalize_recipient_phone(raw_phone: str) -> str:
    digits = re.sub(r"\D", "", raw_phone or "")
    if not digits:
        return ""
    # Se já tiver código de país 55 e tamanho razoável (12 ou 13 dígitos: 55 + DDD + 8 ou 9)
    if digits.startswith("55") and len(digits) in (12, 13):
        return digits
    # Se tiver 10 ou 11 dígitos (DDD + número), adiciona o 55
    if len(digits) in (10, 11):
        return f"55{digits}"
    # Se tiver 8 ou 9 dígitos (sem DDD), não sabemos o DDD com segurança, mas adiciona 5517 se for região SCV
    if len(digits) in (8, 9):
        return f"5517{digits}"
    return digits


def build_survey_url(base_url: str, attendance_id: str) -> str:
    url = (base_url or "").strip()
    if not url:
        url = "https://pesqfy.santacasavotuporanga.com.br"
    separator = "&" if "?" in url else "?"
    if "atendimento=" in url:
        return url
    return f"{url}{separator}atendimento={attendance_id}"


def send_meta_survey_template(
    unit,
    recipient_phone: str,
    patient_name: str,
    attendance_id: str,
    template_name: str = "pesquisa_nps",
    template_language: str = "pt_BR",
    first_name_only: bool = True,
    button_parameter: str | None = None,
) -> dict:
    meta_config = MetaConfiguration.objects.filter(unit=unit).first()
    if not meta_config or not meta_config.phone_number_id:
        return {
            "success": False,
            "error": "Meta WhatsApp não configurado para esta unidade.",
        }

    phone = normalize_recipient_phone(recipient_phone)
    if not phone or len(phone) < 10:
        return {
            "success": False,
            "error": f"Número de telefone inválido para envio: {recipient_phone}",
        }

    display_name = format_patient_first_name(patient_name, first_name_only=first_name_only)
    button_val = str(button_parameter or attendance_id or "").strip()

    # Detecta requisitos reais do template a partir de meta_config
    tpl_meta = None
    if meta_config and meta_config.templates:
        for t in meta_config.templates:
            if t.get("name") == template_name:
                tpl_meta = t
                break

    body_var_count = 1
    has_dynamic_url_button = True
    button_index = 0

    if tpl_meta:
        for comp in tpl_meta.get("components", []):
            c_type = (comp.get("type") or "").upper()
            if c_type == "BODY":
                body_text = comp.get("text", "")
                body_var_count = len(re.findall(r"\{\{(\d+)\}\}", body_text))
            elif c_type == "BUTTONS":
                has_dynamic_url_button = False
                for idx, b in enumerate(comp.get("buttons", [])):
                    if (b.get("type") or "").upper() == "URL" and "{{1}}" in b.get("url", ""):
                        has_dynamic_url_button = True
                        button_index = idx
                        break

    # Monta os componentes com base na definição do template
    components = []
    if body_var_count == 1:
        components.append(
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": display_name}
                ],
            }
        )
    elif body_var_count > 1:
        params = [{"type": "text", "text": display_name}]
        for _ in range(2, body_var_count + 1):
            params.append({"type": "text", "text": "-"})
        components.append({"type": "body", "parameters": params})

    # Adiciona parâmetro do botão se o template possuir botão de URL dinâmica
    if has_dynamic_url_button and button_val:
        components.append(
            {
                "type": "button",
                "sub_type": "url",
                "index": str(button_index),
                "parameters": [
                    {"type": "text", "text": button_val}
                ],
            }
        )

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": template_language},
            "components": components,
        },
    }

    # Descriptografar token de acesso
    try:
        token = cipher().decrypt(meta_config.token_ciphertext.encode()).decode()
    except Exception as e:
        return {
            "success": False,
            "error": f"Falha ao descriptografar token Meta: {e}",
            "payload": payload,
        }

    api_url = f"https://graph.facebook.com/{meta_config.api_version}/{meta_config.phone_number_id}/messages"

    try:
        resp = requests.post(
            api_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15,
        )
        data = resp.json() if resp.content else {}
    except Exception as exc:
        return {
            "success": False,
            "error": f"Erro de conexão com Meta Graph API: {exc}",
            "payload": payload,
        }

    if resp.status_code >= 400 or "error" in data:
        err_msg = data.get("error", {}).get("message") or str(data)
        return {
            "success": False,
            "error": f"Meta API erro ({resp.status_code}): {err_msg}",
            "payload": payload,
            "response": data,
        }

    messages = data.get("messages", [])
    msg_id = messages[0].get("id") if messages else "ok"
    return {
        "success": True,
        "message_id": msg_id,
        "payload": payload,
        "response": data,
    }
