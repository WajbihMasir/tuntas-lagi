"""Real LLM engine (Bynara router, OpenAI-compatible) returning typed Results.

Callers must fall back to the rule-based parser / static template on LLMFailure.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Literal

import httpx
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger("tuntas.llm")

LLM_TIMEOUT_S = 30.0


@dataclass(frozen=True)
class LLMOk:
    value: Any
    model: str
    ok: Literal[True] = True


@dataclass(frozen=True)
class LLMFailure:
    code: str
    message: str
    context: dict[str, Any] = field(default_factory=dict)
    cause: str | None = None
    ok: Literal[False] = False


LLMResult = LLMOk | LLMFailure


@dataclass(frozen=True)
class LLMConfig:
    api_key: str
    base_url: str
    models: tuple[str, ...]


def load_llm_config() -> LLMConfig | None:
    api_key = os.environ.get("BYNARA_API_KEY", "").strip()
    if not api_key:
        return None
    return LLMConfig(
        api_key=api_key,
        base_url=os.environ["BYNARA_BASE_URL"].rstrip("/"),
        models=(os.environ["LLM_PRIMARY_MODEL"], os.environ["LLM_FALLBACK_MODEL"]),
    )


def llm_enabled() -> bool:
    return load_llm_config() is not None


# ----------------------------- Transport -----------------------------

def _failure(code: str, message: str, operation: str, model: str, cause: object = None) -> LLMFailure:
    return LLMFailure(
        code=code,
        message=message,
        context={"operation": operation, "tool": "bynara_chat_completions", "model": model},
        cause=repr(cause) if cause is not None else None,
    )


def _read_content(resp: httpx.Response, operation: str, model: str) -> LLMResult:
    if resp.status_code == 429:
        return _failure("LLM_RATE_LIMITED", "LLM provider membatasi request (429).", operation, model)
    if resp.status_code >= 400:
        return _failure("LLM_HTTP_ERROR", f"LLM provider status {resp.status_code}.", operation, model, resp.text[:200])
    try:
        content = resp.json()["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        return _failure("LLM_BAD_RESPONSE", "Respons LLM tidak sesuai format.", operation, model, exc)
    if not isinstance(content, str) or not content.strip():
        return _failure("LLM_EMPTY_RESPONSE", "LLM mengembalikan konten kosong.", operation, model)
    return LLMOk(value=content.strip(), model=model)


async def _call_model(
    client: httpx.AsyncClient, cfg: LLMConfig, model: str, body: dict[str, Any], operation: str
) -> LLMResult:
    try:
        resp = await client.post(
            f"{cfg.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {cfg.api_key}", "Content-Type": "application/json"},
            json={**body, "model": model},
        )
    except httpx.TimeoutException as exc:
        return _failure("LLM_TIMEOUT", f"LLM timeout setelah {LLM_TIMEOUT_S:.0f}s.", operation, model, exc)
    except httpx.HTTPError as exc:
        return _failure("LLM_TRANSPORT_ERROR", "Gagal menghubungi LLM provider.", operation, model, exc)
    return _read_content(resp, operation, model)


async def chat_completion(
    messages: list[dict[str, str]], *, operation: str, json_mode: bool, temperature: float
) -> LLMResult:
    cfg = load_llm_config()
    if cfg is None:
        return LLMFailure("LLM_DISABLED", "BYNARA_API_KEY kosong, memakai fallback.", {"operation": operation})
    body: dict[str, Any] = {"messages": messages, "temperature": temperature}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    last: LLMResult = LLMFailure("LLM_NO_MODEL", "Tidak ada model terkonfigurasi.", {"operation": operation})
    async with httpx.AsyncClient(timeout=LLM_TIMEOUT_S) as client:
        for model in cfg.models:
            last = await _call_model(client, cfg, model, body, operation)
            if last.ok:
                logger.info("llm_ok operation=%s model=%s", operation, model)
                return last
            logger.warning("llm_failure code=%s context=%s cause=%s", last.code, last.context, last.cause)
    return last


# ----------------------------- WhatsApp parsing -----------------------------

class ParsedItem(BaseModel):
    sku: str
    quantity: int = Field(gt=0, le=999)


class ParsedMessage(BaseModel):
    customer_name: str = "Anonim"
    intent: Literal["ORDER_CREATION", "GENERAL_QUERY"]
    extracted_product: str | None = None
    quantity: int = Field(default=1, ge=0, le=999)
    ai_confidence: float = Field(ge=0, le=1)
    ai_reasoning: str
    items: list[ParsedItem] = Field(default_factory=list)


def _catalog_block(catalog: list[dict[str, Any]]) -> str:
    return "\n".join(
        f"- SKU {p['sku']} | {p['name']} | Rp {int(p['price']):,} | stok {int(p['stock'])}".replace(",", ".")
        for p in catalog
    )


def build_parse_prompt(catalog: list[dict[str, Any]]) -> str:
    return (
        "Kamu adalah AI Agent order-intake untuk toko UMKM TuntasUMKM (batik & kain nusantara).\n"
        "Analisis pesan WhatsApp pelanggan dan petakan ke produk di KATALOG STOK TERKINI berikut:\n"
        f"{_catalog_block(catalog)}\n\n"
        "Aturan:\n"
        "- intent = ORDER_CREATION hanya jika pelanggan jelas ingin memesan/membeli produk dari katalog.\n"
        "- intent = GENERAL_QUERY untuk sapaan, tanya harga/stok/ongkir tanpa niat memesan, atau produk di luar katalog.\n"
        "- extracted_product WAJIB persis nama produk di katalog (produk utama), atau null.\n"
        "- items berisi SEMUA produk yang dipesan: [{\"sku\": SKU katalog, \"quantity\": angka}]. Kosong jika GENERAL_QUERY.\n"
        "- quantity = jumlah produk utama; default 1 bila tidak disebut.\n"
        "- customer_name dari pesan/alias WA; jika tidak ada gunakan \"Anonim\".\n"
        "- ai_confidence 0..1, ai_reasoning 1 kalimat Bahasa Indonesia.\n"
        "Balas HANYA JSON valid dengan kunci: customer_name, intent, extracted_product, quantity, "
        "ai_confidence, ai_reasoning, items."
    )


def _extract_json(content: str) -> dict[str, Any]:
    start, end = content.find("{"), content.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object in LLM content")
    data = json.loads(content[start : end + 1])
    if not isinstance(data, dict):
        raise TypeError("LLM JSON is not an object")
    return data


def _normalize_items(parsed: ParsedMessage, catalog: list[dict[str, Any]]) -> ParsedMessage:
    known = {str(p["sku"]): str(p["name"]) for p in catalog}
    items = [it for it in parsed.items if it.sku in known]
    if not items and parsed.intent == "ORDER_CREATION" and parsed.extracted_product:
        by_name = {name.lower(): sku for sku, name in known.items()}
        sku = by_name.get(parsed.extracted_product.strip().lower())
        if sku:
            items = [ParsedItem(sku=sku, quantity=max(parsed.quantity, 1))]
    return parsed.model_copy(update={"items": items})


async def parse_whatsapp_message(text: str, customer_alias: str, catalog: list[dict[str, Any]]) -> LLMResult:
    operation = "llm_parse_message"
    result = await chat_completion(
        [
            {"role": "system", "content": build_parse_prompt(catalog)},
            {"role": "user", "content": f"Alias WA: {customer_alias}\nPesan: {text}"},
        ],
        operation=operation,
        json_mode=True,
        temperature=0.1,
    )
    if not result.ok:
        return result
    try:
        parsed = ParsedMessage.model_validate(_extract_json(result.value))
    except (ValueError, TypeError, ValidationError) as exc:
        return _failure("LLM_SCHEMA_INVALID", "JSON LLM tidak lolos validasi skema.", operation, result.model, exc)
    return LLMOk(value=_normalize_items(parsed, catalog), model=result.model)


# ----------------------------- Reply drafting -----------------------------

REPLY_SYSTEM_PROMPT = (
    "Kamu adalah admin customer service toko UMKM TuntasUMKM. Tulis SATU draf balasan WhatsApp "
    "dalam Bahasa Indonesia yang sopan, ramah, dan profesional (sapa pelanggan dengan 'Kak'). "
    "Maksimal 3 kalimat, tanpa markdown, tanpa tanda kutip pembuka/penutup. "
    "Jika pesanan DISETUJUI: konfirmasi, sebut nomor pesanan dan total, info invoice segera dikirim. "
    "Jika DITOLAK: minta maaf dengan empati, jelaskan alasan penolakan secara halus, tawarkan alternatif/bantuan."
)


def _reply_context(decision: Literal["approved", "rejected"], ctx: dict[str, str]) -> str:
    status = "DISETUJUI pemilik toko" if decision == "approved" else "DITOLAK pemilik toko"
    lines = [f"Status: {status}"] + [f"{k}: {v}" for k, v in ctx.items() if v]
    return "\n".join(lines)


async def draft_customer_reply(decision: Literal["approved", "rejected"], ctx: dict[str, str]) -> LLMResult:
    result = await chat_completion(
        [
            {"role": "system", "content": REPLY_SYSTEM_PROMPT},
            {"role": "user", "content": _reply_context(decision, ctx)},
        ],
        operation=f"llm_draft_reply_{decision}",
        json_mode=False,
        temperature=0.5,
    )
    if not result.ok:
        return result
    return LLMOk(value=str(result.value).strip().strip('"'), model=result.model)
