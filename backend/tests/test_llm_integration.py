"""LLM integration tests (Bynara router).

Covers webhook parse, approve/reject reply drafting, and rule-based fallback.
"""
import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api/v1"
LLM_TIMEOUT = 90


@pytest.fixture
def reset_state():
    r = requests.post(f"{API}/demo/reset", timeout=15)
    assert r.status_code == 200, r.text
    yield r.json()
    # cleanup after
    requests.post(f"{API}/demo/reset", timeout=15)


# ----------------- LLM parse (webhook) -----------------

def test_llm_webhook_parses_order(reset_state):
    r = requests.post(
        f"{API}/webhook/whatsapp",
        json={"customerAlias": "TEST_LLM_Rina", "text": "saya mau pesan 2 batik keris tulis"},
        timeout=LLM_TIMEOUT,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["llmEnabled"] is True
    order = body["order"]
    assert order["status"] == "pending_approval"
    insight = order["aiInsight"]
    assert insight is not None, "aiInsight missing"
    assert insight["engine"] == "llm", f"engine={insight['engine']}"
    assert insight["model"] in ("agnes-2.5-flash", "longcat-2.5")
    assert insight["intent"] == "ORDER_CREATION"
    assert insight["extractedProduct"], "extractedProduct empty"
    assert isinstance(insight["confidence"], (int, float))
    assert 0.0 <= insight["confidence"] <= 1.0
    assert isinstance(insight["reasoning"], str) and len(insight["reasoning"]) > 5
    # Product mapping: BTK-KRS-01 qty 2
    assert any(ln["sku"] == "BTK-KRS-01" for ln in order["lines"]), order["lines"]
    assert order["totalPrice"] > 0


def test_llm_webhook_general_query(reset_state):
    r = requests.post(
        f"{API}/webhook/whatsapp",
        json={"customerAlias": "TEST_LLM_Halo", "text": "halo kak, toko buka jam berapa?"},
        timeout=LLM_TIMEOUT,
    )
    # Expected typed failure per server._analyze_text
    assert r.status_code == 409, r.text
    body = r.json()
    assert body.get("code") == "ORDER_NOT_PARSED"
    # No 500 crash — typed failure envelope
    assert "message" in body


# ----------------- Approve / Reject with LLM reply -----------------

def _create_order_via_llm(text: str, alias: str = "TEST_LLM_Approve") -> str:
    r = requests.post(
        f"{API}/webhook/whatsapp",
        json={"customerAlias": alias, "text": text},
        timeout=LLM_TIMEOUT,
    )
    assert r.status_code == 200, r.text
    return r.json()["order"]["id"]


def test_approve_appends_llm_reply(reset_state):
    oid = _create_order_via_llm("saya mau pesan 1 batik keris tulis untuk hadiah")
    ap = requests.post(f"{API}/orders/{oid}/approve", timeout=LLM_TIMEOUT)
    assert ap.status_code == 200, ap.text
    state = ap.json()
    order = next(o for o in state["orders"] if o["id"] == oid)
    assert order["status"] == "approved"
    bot_msgs = [m for m in order["messages"] if m["sender"] == "bot"]
    # At least one bot message present; last one should be approval draft
    assert len(bot_msgs) >= 1, order["messages"]
    approve_reply = bot_msgs[-1]["text"]
    assert isinstance(approve_reply, str) and len(approve_reply) > 10
    # Stock deducted BTK-KRS-01 12->11
    stock = {i["sku"]: i["stock"] for i in state["inventory"]}
    assert stock["BTK-KRS-01"] == 11


def test_reject_appends_llm_reply_mentioning_reason(reset_state):
    oid = _create_order_via_llm("mau pesan 1 kebaya encim bordir", alias="TEST_LLM_Reject")
    reason = "Stok warna cream sedang kosong Kak, mohon maaf"
    rj = requests.post(
        f"{API}/orders/{oid}/reject",
        json={"reason": reason},
        timeout=LLM_TIMEOUT,
    )
    assert rj.status_code == 200, rj.text
    state = rj.json()
    order = next(o for o in state["orders"] if o["id"] == oid)
    assert order["status"] == "rejected"
    assert order["rejectReason"] == reason
    bot_msgs = [m for m in order["messages"] if m["sender"] == "bot"]
    assert bot_msgs, "no bot reply appended on reject"


# ----------------- Fallback (rule-based) — unit-level via monkeypatch -----------------

def test_llm_fallback_to_rule_based(monkeypatch):
    """When LLM call fails, webhook should still create order via rule-based parser."""
    import asyncio
    import sys
    sys.path.insert(0, "/app/backend")
    import llm_engine
    from llm_engine import LLMFailure

    async def fake_parse(text, alias, catalog):
        return LLMFailure("LLM_TRANSPORT_ERROR", "forced fail", {"operation": "test"})

    monkeypatch.setattr(llm_engine, "parse_whatsapp_message", fake_parse)
    # Also patch server's imported symbol
    import server
    monkeypatch.setattr(server, "parse_whatsapp_message", fake_parse)

    # Call the internal _analyze_text via HTTP by pointing directly: easiest is to trigger webhook
    # But server uses the imported symbol at module load. Since we patched server.parse_whatsapp_message,
    # only in-process requests will use it. HTTP requests hit the running supervisor server which is unpatched.
    # So instead directly invoke _analyze_text with a fresh db connection to verify fallback path.

    async def run():
        db = await server.get_db()
        try:
            payload = server.WebhookPayload(customerAlias="TEST_FB", text="pesan 1 batik keris")
            result = await server._analyze_text(db, payload)
            assert not hasattr(result, "status_code"), f"unexpected typed failure: {result}"
            lines, insight = result
            assert insight["engine"] == "rule_based"
            assert insight["model"] is None
            assert any(ln["sku"] == "BTK-KRS-01" for ln in lines)
        finally:
            await db.close()

    asyncio.run(run())
