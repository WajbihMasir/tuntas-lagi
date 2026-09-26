"""Tests for WhatsApp webhook simulator + demo reset (iteration 4)."""
import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api/v1"


@pytest.fixture
def reset_state():
    r = requests.post(f"{API}/demo/reset", timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- demo/reset -----------------

def test_demo_reset_returns_seed(reset_state):
    state = reset_state
    assert "inventory" in state and "orders" in state and "audit" in state
    assert len(state["orders"]) == 6
    assert state["audit"] == []
    stocks = {i["sku"]: i["stock"] for i in state["inventory"]}
    assert stocks == {
        "BTK-KRS-01": 12, "BTK-PKL-02": 8, "KBY-ENC-03": 2,
        "SRG-TNN-04": 5, "SLD-SUT-05": 20,
    }


# --------------- webhook parsing -----------------

def test_webhook_parses_valid_order(reset_state):
    r = requests.post(f"{API}/webhook/whatsapp", json={
        "customerAlias": "TEST_Rina",
        "text": "Halo Kak, saya mau pesan Batik Keris 1 pcs kirim ke Jakarta."
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    order = body["order"]
    assert order["status"] == "pending_approval"
    assert order["lines"] == [{"sku": "BTK-KRS-01", "quantity": 1}]
    assert order["totalPrice"] == 450000
    # GET verify
    g = requests.get(f"{API}/orders/{order['id']}")
    assert g.status_code == 200
    assert g.json()["lines"][0]["sku"] == "BTK-KRS-01"


def test_webhook_low_stock_note(reset_state):
    r = requests.post(f"{API}/webhook/whatsapp", json={
        "customerAlias": "TEST_LowStock",
        "text": "Saya mau pesan Kebaya Batik 10 pcs ya."
    })
    assert r.status_code == 200, r.text
    order = r.json()["order"]
    assert order["lines"] == [{"sku": "KBY-ENC-03", "quantity": 10}]
    bot_msg = next(m for m in order["messages"] if m["sender"] == "bot")
    assert "tersisa 2" in bot_msg["text"].lower() or "2" in bot_msg["text"]


def test_webhook_multi_item(reset_state):
    r = requests.post(f"{API}/webhook/whatsapp", json={
        "customerAlias": "TEST_Multi",
        "text": "pesan 2 selendang sutra + 1 sarung tenun"
    })
    assert r.status_code == 200, r.text
    lines = r.json()["order"]["lines"]
    skus = {ln["sku"]: ln["quantity"] for ln in lines}
    assert skus == {"SLD-SUT-05": 2, "SRG-TNN-04": 1}


def test_webhook_unparseable(reset_state):
    r = requests.post(f"{API}/webhook/whatsapp", json={
        "customerAlias": "TEST_Noise", "text": "halo apa kabar"
    })
    assert r.status_code == 409
    assert r.json()["code"] == "ORDER_NOT_PARSED"


def test_webhook_legacy_lines(reset_state):
    r = requests.post(f"{API}/webhook/whatsapp", json={
        "customerAlias": "TEST_Legacy",
        "lines": [{"sku": "BTK-KRS-01", "quantity": 2}],
    })
    assert r.status_code == 200
    assert r.json()["order"]["lines"] == [{"sku": "BTK-KRS-01", "quantity": 2}]


def test_webhook_unknown_sku(reset_state):
    r = requests.post(f"{API}/webhook/whatsapp", json={
        "customerAlias": "TEST_Bad",
        "lines": [{"sku": "XXX-NOPE", "quantity": 1}],
    })
    assert r.status_code == 409
    assert r.json()["code"] == "PRODUCT_NOT_FOUND"


# ---------------- approve flow ----------------

def test_approve_low_stock_fails(reset_state):
    r = requests.post(f"{API}/webhook/whatsapp", json={
        "customerAlias": "TEST_A", "text": "Kebaya Batik 10 pcs"
    })
    oid = r.json()["order"]["id"]
    ap = requests.post(f"{API}/orders/{oid}/approve")
    assert ap.status_code == 409
    assert ap.json()["code"] == "INSUFFICIENT_STOCK"


def test_approve_deducts_and_reset_restores(reset_state):
    r = requests.post(f"{API}/webhook/whatsapp", json={
        "customerAlias": "TEST_B",
        "text": "Batik Keris 1 pcs kirim Jakarta"
    })
    oid = r.json()["order"]["id"]
    ap = requests.post(f"{API}/orders/{oid}/approve")
    assert ap.status_code == 200
    state = ap.json()
    stock = {i["sku"]: i["stock"] for i in state["inventory"]}
    assert stock["BTK-KRS-01"] == 11
    # Reset restores
    rs = requests.post(f"{API}/demo/reset").json()
    stock2 = {i["sku"]: i["stock"] for i in rs["inventory"]}
    assert stock2["BTK-KRS-01"] == 12
    assert all(o["id"] != oid for o in rs["orders"])
