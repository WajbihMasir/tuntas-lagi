"""FastAPI backend for TuntasUMKM HITL Approval Queue.

Persistence: SQLite (aiosqlite) — schema:
  - inventory(sku, name, price, stock)
  - orders(id, customer_alias, channel, lines_json, status, reject_reason,
           total_price, received_at, messages_json)
  - audit_logs(id, order_id, actor, action, before_state, after_state, note, at)

Typed failures are returned as HTTP 409 with body {code, message, context}
so the frontend GoldCard error state can render them without translation.
"""

from __future__ import annotations  # noqa: I001 (llm_engine is first-party from backend/, third-party from repo root)

import json
import logging
import os
import re
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

import aiosqlite
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

from llm_engine import (
    ParsedMessage,
    draft_customer_reply,
    llm_enabled,
    load_llm_config,
    parse_whatsapp_message,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

DB_PATH = str(ROOT_DIR / "tuntas.db")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("tuntas.hitl")

OrderStatus = Literal["pending_approval", "approved", "rejected"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ----------------------------- Pydantic Models -----------------------------

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    sku: str
    name: str
    price: int
    stock: int


class OrderLine(BaseModel):
    sku: str
    quantity: int = Field(gt=0)


class ChatMessage(BaseModel):
    id: str
    sender: Literal["customer", "bot"]
    text: str
    at: str


class OrderModel(BaseModel):
    id: str
    customer_alias: str = Field(alias="customerAlias")
    channel: str
    lines: list[OrderLine]
    status: OrderStatus
    reject_reason: str | None = Field(default=None, alias="rejectReason")
    total_price: int = Field(alias="totalPrice")
    received_at: str = Field(alias="receivedAt")
    messages: list[ChatMessage]

    model_config = ConfigDict(populate_by_name=True)


class AuditEntry(BaseModel):
    id: str
    at: str
    actor: Literal["human", "agent"]
    action: str
    order_id: str = Field(alias="orderId")
    before: str
    after: str
    note: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class WebhookPayload(BaseModel):
    customer_alias: str = Field(default="Pelanggan WA (sintetis)", alias="customerAlias", max_length=60)
    channel: str = "WhatsApp"
    lines: list[OrderLine] = Field(default_factory=list)
    text: str | None = Field(default=None, max_length=500)

    model_config = ConfigDict(populate_by_name=True)


class RejectPayload(BaseModel):
    reason: str = Field(min_length=5, max_length=160)


# ----------------------------- Seed data -----------------------------

SEED_INVENTORY: list[tuple[str, str, int, int]] = [
    ("BTK-KRS-01", "Batik Keris Tulis Sogan", 450000, 12),
    ("BTK-PKL-02", "Batik Pekalongan Cap", 275000, 8),
    ("KBY-ENC-03", "Kebaya Encim Bordir", 385000, 2),
    ("SRG-TNN-04", "Sarung Tenun Samarinda", 520000, 5),
    ("SLD-SUT-05", "Selendang Sutra Garut", 180000, 20),
]


def _msg(order_id: str, idx: int, sender: str, text: str, at: str) -> dict[str, str]:
    return {"id": f"{order_id}-m{idx}", "sender": sender, "text": text, "at": at}


SEED_ORDERS: list[dict[str, Any]] = [
    {
        "id": "ORD-2406-001",
        "customer_alias": "Rina S. (sintetis)",
        "channel": "WhatsApp",
        "lines": [{"sku": "BTK-KRS-01", "quantity": 1}],
        "status": "pending_approval",
        "reject_reason": None,
        "received_at": "2026-06-12T02:41:00Z",
        "messages": [
            _msg("ORD-2406-001", 0, "customer", "Halo kak, Batik Keris Tulis Sogan ukuran L masih ada?", "2026-06-12T02:38:00Z"),
            _msg("ORD-2406-001", 1, "bot", "Masih ada, Kak. Harganya Rp 450.000. Mau dipesan 1 potong?", "2026-06-12T02:38:20Z"),
            _msg("ORD-2406-001", 2, "customer", "Iya kak, 1 ya. Kirim ke Solo, transfer BCA.", "2026-06-12T02:40:10Z"),
            _msg("ORD-2406-001", 3, "bot", "Draft pesanan sudah dibuat dan menunggu konfirmasi pemilik toko.", "2026-06-12T02:41:00Z"),
        ],
    },
    {
        "id": "ORD-2406-002",
        "customer_alias": "Dimas P. (sintetis)",
        "channel": "Instagram DM",
        "lines": [
            {"sku": "BTK-PKL-02", "quantity": 2},
            {"sku": "SLD-SUT-05", "quantity": 1},
        ],
        "status": "pending_approval",
        "reject_reason": None,
        "received_at": "2026-06-12T03:05:00Z",
        "messages": [
            _msg("ORD-2406-002", 0, "customer", "Kak, mau 2 batik pekalongan cap + 1 selendang sutra buat seserahan.", "2026-06-12T03:02:00Z"),
            _msg("ORD-2406-002", 1, "bot", "Siap, Kak. Totalnya Rp 730.000. Draft sedang dicek pemilik toko ya.", "2026-06-12T03:05:00Z"),
        ],
    },
    {
        "id": "ORD-2406-003",
        "customer_alias": "Sari W. (sintetis)",
        "channel": "WhatsApp",
        "lines": [{"sku": "KBY-ENC-03", "quantity": 3}],
        "status": "pending_approval",
        "reject_reason": None,
        "received_at": "2026-06-12T03:22:00Z",
        "messages": [
            _msg("ORD-2406-003", 0, "customer", "Kebaya encim bordir yang hijau 3 pcs bisa kak? Buat acara keluarga.", "2026-06-12T03:20:00Z"),
            _msg("ORD-2406-003", 1, "bot", "Terima kasih, Kak. Pesanan 3 pcs sedang dicek ketersediaannya oleh pemilik toko.", "2026-06-12T03:22:00Z"),
        ],
    },
    {
        "id": "ORD-2406-004",
        "customer_alias": "Budi H. (sintetis)",
        "channel": "Tokopedia Chat",
        "lines": [{"sku": "SRG-TNN-04", "quantity": 1}],
        "status": "pending_approval",
        "reject_reason": None,
        "received_at": "2026-06-12T03:47:00Z",
        "messages": [
            _msg("ORD-2406-004", 0, "customer", "Sarung tenun samarinda motif hitam ready? Bisa COD?", "2026-06-12T03:45:00Z"),
            _msg("ORD-2406-004", 1, "bot", "Ready, Kak. Untuk COD perlu konfirmasi pemilik toko dulu ya.", "2026-06-12T03:47:00Z"),
        ],
    },
    {
        "id": "ORD-2406-005",
        "customer_alias": "Lala K. (sintetis)",
        "channel": "WhatsApp",
        "lines": [{"sku": "SLD-SUT-05", "quantity": 2}],
        "status": "approved",
        "reject_reason": None,
        "received_at": "2026-06-12T01:10:00Z",
        "messages": [
            _msg("ORD-2406-005", 0, "customer", "Selendang sutra 2 ya kak, warna marun.", "2026-06-12T01:08:00Z"),
            _msg("ORD-2406-005", 1, "bot", "Pesanan dikonfirmasi. Invoice Rp 360.000 sudah dikirim, Kak.", "2026-06-12T01:15:00Z"),
        ],
    },
    {
        "id": "ORD-2406-006",
        "customer_alias": "Andi R. (sintetis)",
        "channel": "Instagram DM",
        "lines": [{"sku": "BTK-KRS-01", "quantity": 1}],
        "status": "rejected",
        "reject_reason": "Alamat di luar jangkauan kurir",
        "received_at": "2026-06-12T00:52:00Z",
        "messages": [
            _msg("ORD-2406-006", 0, "customer", "Batik keris 1, kirim ke pulau terpencil bisa?", "2026-06-12T00:50:00Z"),
            _msg("ORD-2406-006", 1, "bot", "Mohon maaf, Kak. Pesanan dibatalkan: Alamat di luar jangkauan kurir.", "2026-06-12T00:58:00Z"),
        ],
    },
]


# ----------------------------- DB layer -----------------------------

SCHEMA = [
    """CREATE TABLE IF NOT EXISTS inventory (
        sku TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        stock INTEGER NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        customer_alias TEXT NOT NULL,
        channel TEXT NOT NULL,
        lines_json TEXT NOT NULL,
        status TEXT NOT NULL,
        reject_reason TEXT,
        total_price INTEGER NOT NULL DEFAULT 0,
        received_at TEXT NOT NULL,
        messages_json TEXT NOT NULL,
        ai_json TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        before_state TEXT NOT NULL,
        after_state TEXT NOT NULL,
        note TEXT,
        at TEXT NOT NULL
    )""",
    """CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)""",
    """CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_logs(at)""",
]


async def get_db() -> aiosqlite.Connection:
    conn = await aiosqlite.connect(DB_PATH, timeout=15)
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys = ON")
    await conn.execute("PRAGMA journal_mode = WAL")
    return conn


async def _order_total(db: aiosqlite.Connection, lines: list[dict[str, Any]]) -> int:
    total = 0
    for line in lines:
        cur = await db.execute("SELECT price FROM inventory WHERE sku = ?", (line["sku"],))
        row = await cur.fetchone()
        await cur.close()
        price = int(row["price"]) if row else 0
        total += price * int(line["quantity"])
    return total


async def _seed_inventory(db: aiosqlite.Connection) -> None:
    await db.executemany(
        "INSERT INTO inventory(sku, name, price, stock) VALUES (?, ?, ?, ?)",
        SEED_INVENTORY,
    )
    logger.info("seeded inventory rows=%d", len(SEED_INVENTORY))


async def _seed_orders(db: aiosqlite.Connection) -> None:
    for order in SEED_ORDERS:
        total = await _order_total(db, order["lines"])
        await db.execute(
            """INSERT INTO orders(id, customer_alias, channel, lines_json,
               status, reject_reason, total_price, received_at, messages_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                order["id"],
                order["customer_alias"],
                order["channel"],
                json.dumps(order["lines"]),
                order["status"],
                order["reject_reason"],
                total,
                order["received_at"],
                json.dumps(order["messages"]),
            ),
        )
    logger.info("seeded orders rows=%d", len(SEED_ORDERS))


async def _table_empty(db: aiosqlite.Connection, table: Literal["inventory", "orders"]) -> bool:
    cur = await db.execute(f"SELECT COUNT(*) AS c FROM {table}")
    row = await cur.fetchone()
    await cur.close()
    return bool(row) and int(row["c"]) == 0


async def _migrate_ai_column(db: aiosqlite.Connection) -> None:
    cur = await db.execute("PRAGMA table_info(orders)")
    columns = {row["name"] for row in await cur.fetchall()}
    await cur.close()
    if "ai_json" not in columns:
        await db.execute("ALTER TABLE orders ADD COLUMN ai_json TEXT")
        logger.info("migrated orders.ai_json")


async def initialize_db() -> None:
    db = await get_db()
    try:
        for stmt in SCHEMA:
            await db.execute(stmt)
        await _migrate_ai_column(db)
        if await _table_empty(db, "inventory"):
            await _seed_inventory(db)
        if await _table_empty(db, "orders"):
            await _seed_orders(db)
        await db.commit()
    finally:
        await db.close()


# ----------------------------- Row → API DTO -----------------------------

def order_row_to_dto(row: aiosqlite.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "customerAlias": row["customer_alias"],
        "channel": row["channel"],
        "lines": json.loads(row["lines_json"]),
        "status": row["status"],
        "rejectReason": row["reject_reason"],
        "totalPrice": int(row["total_price"]),
        "receivedAt": row["received_at"],
        "messages": json.loads(row["messages_json"]),
        "aiInsight": json.loads(row["ai_json"]) if row["ai_json"] else None,
    }


def audit_row_to_dto(row: aiosqlite.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "at": row["at"],
        "actor": row["actor"],
        "action": row["action"],
        "orderId": row["order_id"],
        "before": row["before_state"],
        "after": row["after_state"],
        "note": row["note"],
    }


def inventory_row_to_dto(row: aiosqlite.Row) -> dict[str, Any]:
    return {
        "sku": row["sku"],
        "name": row["name"],
        "price": int(row["price"]),
        "stock": int(row["stock"]),
    }


# ----------------------------- Failure helpers -----------------------------

def typed_failure(
    code: str, message: str, operation: str, order_id: str, sku: str | None = None
) -> JSONResponse:
    context: dict[str, Any] = {"operation": operation, "order_id": order_id}
    if sku is not None:
        context["sku"] = sku
    body = {"code": code, "message": message, "context": context}
    logger.warning("typed_failure %s", body)
    return JSONResponse(status_code=409, content=body)


# ----------------------------- Lifespan -----------------------------

@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await initialize_db()
    yield


app = FastAPI(title="TuntasUMKM HITL API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")
v1 = APIRouter(prefix="/api/v1")


# ----------------------------- Health -----------------------------

@api.get("/")
async def root() -> dict[str, str]:
    return {"service": "TuntasUMKM HITL API", "version": "1.0.0"}


@api.get("/health")
async def health() -> dict[str, Any]:
    db = await get_db()
    try:
        cur = await db.execute("SELECT COUNT(*) AS c FROM orders")
        row = await cur.fetchone()
        await cur.close()
        cfg = load_llm_config()
        return {
            "status": "ok",
            "orders": int(row["c"]) if row else 0,
            "llm": {"enabled": cfg is not None, "models": list(cfg.models) if cfg else []},
            "at": now_iso(),
        }
    finally:
        await db.close()


# ----------------------------- Aggregate state -----------------------------

@v1.get("/state")
async def get_state() -> dict[str, Any]:
    db = await get_db()
    try:
        cur = await db.execute("SELECT * FROM inventory ORDER BY sku")
        inv_rows = await cur.fetchall()
        await cur.close()

        cur = await db.execute("SELECT * FROM orders ORDER BY received_at DESC")
        order_rows = await cur.fetchall()
        await cur.close()

        cur = await db.execute("SELECT * FROM audit_logs ORDER BY at DESC LIMIT 100")
        audit_rows = await cur.fetchall()
        await cur.close()

        return {
            "inventory": [inventory_row_to_dto(r) for r in inv_rows],
            "orders": [order_row_to_dto(r) for r in order_rows],
            "audit": [audit_row_to_dto(r) for r in audit_rows],
        }
    finally:
        await db.close()


# ----------------------------- Inventory / Orders / Audit -----------------------------

@v1.get("/inventory")
async def list_inventory() -> list[dict[str, Any]]:
    db = await get_db()
    try:
        cur = await db.execute("SELECT * FROM inventory ORDER BY sku")
        rows = await cur.fetchall()
        await cur.close()
        return [inventory_row_to_dto(r) for r in rows]
    finally:
        await db.close()


@v1.get("/orders")
async def list_orders(status: str | None = None) -> list[dict[str, Any]]:
    db = await get_db()
    try:
        if status:
            cur = await db.execute(
                "SELECT * FROM orders WHERE status = ? ORDER BY received_at DESC",
                (status,),
            )
        else:
            cur = await db.execute("SELECT * FROM orders ORDER BY received_at DESC")
        rows = await cur.fetchall()
        await cur.close()
        return [order_row_to_dto(r) for r in rows]
    finally:
        await db.close()


@v1.get("/orders/{order_id}")
async def get_order(order_id: str) -> dict[str, Any]:
    db = await get_db()
    try:
        cur = await db.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        row = await cur.fetchone()
        await cur.close()
        if not row:
            raise HTTPException(status_code=404, detail="order_not_found")
        return order_row_to_dto(row)
    finally:
        await db.close()


@v1.get("/audit-logs")
async def list_audit(limit: int = 100) -> list[dict[str, Any]]:
    db = await get_db()
    try:
        cur = await db.execute(
            "SELECT * FROM audit_logs ORDER BY at DESC LIMIT ?", (int(limit),)
        )
        rows = await cur.fetchall()
        await cur.close()
        return [audit_row_to_dto(r) for r in rows]
    finally:
        await db.close()


# ----------------------------- Approve / Reject -----------------------------

async def _insert_audit(
    db: aiosqlite.Connection,
    order_id: str,
    actor: str,
    action: str,
    before_state: str,
    after_state: str,
    at: str,
    note: str | None = None,
) -> None:
    await db.execute(
        """INSERT INTO audit_logs(id, order_id, actor, action, before_state,
           after_state, note, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            f"{order_id}-{action}-{at}-{uuid.uuid4().hex[:6]}",
            order_id,
            actor,
            action,
            before_state,
            after_state,
            note,
            at,
        ),
    )


def _bot_notify(order_row: aiosqlite.Row, text: str, at: str, drafted_by: str) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = json.loads(order_row["messages_json"])
    messages.append(
        {
            "id": f"{order_row['id']}-m{len(messages)}",
            "sender": "bot",
            "text": text,
            "at": at,
            "draftedBy": drafted_by,
        }
    )
    return messages


async def _line_summary(db: aiosqlite.Connection, lines: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    for line in lines:
        cur = await db.execute("SELECT name FROM inventory WHERE sku = ?", (line["sku"],))
        row = await cur.fetchone()
        await cur.close()
        parts.append(f"{line['quantity']}x {row['name'] if row else line['sku']}")
    return ", ".join(parts)


async def _draft_reply(
    db: aiosqlite.Connection,
    order: aiosqlite.Row,
    decision: Literal["approved", "rejected"],
    fallback_text: str,
    reason: str | None = None,
) -> tuple[str, str]:
    """LLM-drafted customer reply; returns (text, drafted_by). Falls back to template on failure."""
    customer_msgs = [m["text"] for m in json.loads(order["messages_json"]) if m["sender"] == "customer"]
    ctx = {
        "Nomor pesanan": order["id"],
        "Nama pelanggan": order["customer_alias"],
        "Produk": await _line_summary(db, json.loads(order["lines_json"])),
        "Total": _format_rupiah(int(order["total_price"])),
        "Alasan penolakan": reason or "",
        "Pesan terakhir pelanggan": customer_msgs[-1] if customer_msgs else "",
    }
    result = await draft_customer_reply(decision, ctx)
    if result.ok:
        return str(result.value), f"llm:{result.model}"
    logger.warning(
        "draft_reply_fallback code=%s order_id=%s context=%s", result.code, order["id"], result.context
    )
    return fallback_text, "template"


async def _claim_pending(
    db: aiosqlite.Connection, order_id: str, status: str, reason: str | None, messages: list[dict[str, Any]]
) -> bool:
    """Atomic pending -> decided transition; False if another request already decided it."""
    cur = await db.execute(
        "UPDATE orders SET status = ?, reject_reason = ?, messages_json = ? WHERE id = ? AND status = 'pending_approval'",
        (status, reason, json.dumps(messages), order_id),
    )
    return cur.rowcount == 1


async def _send_bot_reply(order_id: str, channel: str, text: str) -> None:
    """MOCK: outbound WhatsApp/chat reply. Real integration goes here later."""
    logger.info("bot_reply channel=%s order_id=%s text=%s", channel, order_id, text)


def _format_rupiah(amount: int) -> str:
    return "Rp " + f"{amount:,}".replace(",", ".")


@v1.post("/orders/{order_id}/approve")
async def approve_order(order_id: str) -> Any:
    at = now_iso()
    db = await get_db()
    try:
        cur = await db.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        order = await cur.fetchone()
        await cur.close()
        if not order:
            return typed_failure(
                "ORDER_NOT_FOUND",
                f"Pesanan {order_id} tidak ditemukan.",
                "approve_order",
                order_id,
            )
        if order["status"] != "pending_approval":
            return typed_failure(
                "ORDER_NOT_PENDING",
                "Pesanan ini sudah diproses sebelumnya.",
                "approve_order",
                order_id,
            )

        lines: list[dict[str, Any]] = json.loads(order["lines_json"])

        # Stock validation (typed failure returned)
        stock_snapshot: dict[str, aiosqlite.Row] = {}
        for line in lines:
            cur = await db.execute(
                "SELECT * FROM inventory WHERE sku = ?", (line["sku"],)
            )
            prod = await cur.fetchone()
            await cur.close()
            if not prod:
                return typed_failure(
                    "PRODUCT_NOT_FOUND",
                    f"Produk {line['sku']} tidak ditemukan.",
                    "check_stock",
                    order_id,
                    sku=line["sku"],
                )
            if int(prod["stock"]) < int(line["quantity"]):
                return typed_failure(
                    "INSUFFICIENT_STOCK",
                    f"Stok {prod['name']} tersisa {prod['stock']}, pesanan butuh {line['quantity']}.",
                    "check_stock",
                    order_id,
                    sku=line["sku"],
                )
            stock_snapshot[line["sku"]] = prod

        # LLM draft runs BEFORE any write so no write-lock is held during the slow call
        template_text = (
            f"Pesanan {order_id} sudah dikonfirmasi pemilik toko. "
            f"Total {_format_rupiah(int(order['total_price']))}, invoice segera kami kirim. Terima kasih, Kak!"
        )
        notify_text, drafted_by = await _draft_reply(db, order, "approved", template_text)
        new_messages = _bot_notify(order, notify_text, at, drafted_by)

        claimed = await _claim_pending(db, order_id, "approved", None, new_messages)
        if not claimed:
            return typed_failure("ORDER_NOT_PENDING", "Pesanan ini sudah diproses sebelumnya.", "approve_order", order_id)

        # Deduct stock atomically (stock may have changed while the LLM was drafting)
        for line in lines:
            cur = await db.execute(
                "UPDATE inventory SET stock = stock - ? WHERE sku = ? AND stock >= ?",
                (int(line["quantity"]), line["sku"], int(line["quantity"])),
            )
            if cur.rowcount == 0:
                await db.rollback()
                return typed_failure(
                    "INSUFFICIENT_STOCK",
                    f"Stok {stock_snapshot[line['sku']]['name']} tidak cukup lagi untuk pesanan ini.",
                    "check_stock",
                    order_id,
                    sku=line["sku"],
                )

        # Audit log (3 entries: human approve, agent stock deduct, agent notify)
        await _insert_audit(db, order_id, "human", "APPROVE_ORDER", "pending_approval", "approved", at)
        await _insert_audit(db, order_id, "agent", "DEDUCT_STOCK", "reserved", "deducted", at)
        await _insert_audit(db, order_id, "agent", "NOTIFY_CUSTOMER", drafted_by, "sent", at, note=notify_text)

        await db.commit()
        # Mocked outbound reply (fire-and-log)
        await _send_bot_reply(order_id, order["channel"], notify_text)
    finally:
        await db.close()

    return await get_state()


@v1.post("/orders/{order_id}/reject")
async def reject_order(order_id: str, payload: RejectPayload) -> Any:
    at = now_iso()
    db = await get_db()
    try:
        cur = await db.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        order = await cur.fetchone()
        await cur.close()
        if not order:
            return typed_failure(
                "ORDER_NOT_FOUND",
                f"Pesanan {order_id} tidak ditemukan.",
                "reject_order",
                order_id,
            )
        if order["status"] != "pending_approval":
            return typed_failure(
                "ORDER_NOT_PENDING",
                "Pesanan ini sudah diproses sebelumnya.",
                "reject_order",
                order_id,
            )

        template_text = f"Mohon maaf, Kak. Pesanan {order_id} dibatalkan: {payload.reason}."
        notify_text, drafted_by = await _draft_reply(db, order, "rejected", template_text, payload.reason)
        new_messages = _bot_notify(order, notify_text, at, drafted_by)

        claimed = await _claim_pending(db, order_id, "rejected", payload.reason, new_messages)
        if not claimed:
            return typed_failure("ORDER_NOT_PENDING", "Pesanan ini sudah diproses sebelumnya.", "reject_order", order_id)

        await _insert_audit(db, order_id, "human", "REJECT_ORDER", "pending_approval", "rejected", at, note=payload.reason)
        await _insert_audit(db, order_id, "agent", "NOTIFY_CUSTOMER", drafted_by, "sent", at, note=notify_text)

        await db.commit()
        await _send_bot_reply(order_id, order["channel"], notify_text)
    finally:
        await db.close()

    return await get_state()


# ----------------------------- Webhook -----------------------------

PRODUCT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "BTK-KRS-01": ("batik keris", "keris", "sogan"),
    "BTK-PKL-02": ("pekalongan",),
    "KBY-ENC-03": ("kebaya", "encim"),
    "SRG-TNN-04": ("sarung", "tenun", "samarinda"),
    "SLD-SUT-05": ("selendang", "sutra", "garut"),
}
SEGMENT_SPLIT = re.compile(r"[,+;\n]|\bdan\b")
QTY_PATTERN = re.compile(r"\b(\d{1,3})\b")


def _quantity_near(segment: str, start: int, end: int) -> int:
    after = QTY_PATTERN.search(segment, end)
    if after:
        return max(int(after.group(1)), 1)
    before = QTY_PATTERN.findall(segment[:start])
    return max(int(before[-1]), 1) if before else 1


def _match_segment(segment: str) -> dict[str, int]:
    found: dict[str, int] = {}
    for sku, keywords in PRODUCT_KEYWORDS.items():
        for kw in keywords:
            pos = segment.find(kw)
            if pos >= 0:
                found[sku] = _quantity_near(segment, pos, pos + len(kw))
                break
    return found


def parse_order_text(text: str) -> list[dict[str, Any]]:
    """Rule-based parser: free-text chat → order lines (sku, quantity)."""
    totals: dict[str, int] = {}
    for segment in SEGMENT_SPLIT.split(text.lower()):
        for sku, qty in _match_segment(segment).items():
            totals[sku] = totals.get(sku, 0) + qty
    return [{"sku": sku, "quantity": qty} for sku, qty in totals.items()]


async def _missing_sku(db: aiosqlite.Connection, lines: list[dict[str, Any]]) -> str | None:
    for line in lines:
        cur = await db.execute("SELECT sku FROM inventory WHERE sku = ?", (line["sku"],))
        row = await cur.fetchone()
        await cur.close()
        if not row:
            return str(line["sku"])
    return None


async def _stock_warnings(db: aiosqlite.Connection, lines: list[dict[str, Any]]) -> list[str]:
    notes: list[str] = []
    for line in lines:
        cur = await db.execute("SELECT name, stock FROM inventory WHERE sku = ?", (line["sku"],))
        row = await cur.fetchone()
        await cur.close()
        if row and int(row["stock"]) < int(line["quantity"]):
            notes.append(f"stok {row['name']} tersisa {row['stock']}, diminta {line['quantity']}")
    return notes


async def _next_order_id(db: aiosqlite.Connection) -> str:
    cur = await db.execute("SELECT COUNT(*) AS c FROM orders")
    row = await cur.fetchone()
    await cur.close()
    seq = (int(row["c"]) if row else 0) + 1
    stamp = datetime.now(timezone.utc).strftime("%y%m")
    while True:
        order_id = f"ORD-{stamp}-{seq:03d}"
        cur = await db.execute("SELECT 1 FROM orders WHERE id = ?", (order_id,))
        exists = await cur.fetchone()
        await cur.close()
        if not exists:
            return order_id
        seq += 1


def _intake_messages(
    order_id: str, text: str | None, lines: list[dict[str, Any]], total: int, warnings: list[str], at: str
) -> list[dict[str, str]]:
    summary = ", ".join(f"{ln['quantity']}x {ln['sku']}" for ln in lines)
    customer_text = text or f"Halo kak, mau pesan {summary}."
    bot_text = (
        f"Terima kasih, Kak. Draft pesanan {order_id} total {_format_rupiah(total)} "
        "sedang menunggu konfirmasi pemilik toko."
    )
    if warnings:
        bot_text += " Catatan: " + "; ".join(warnings) + "."
    return [
        {"id": f"{order_id}-m0", "sender": "customer", "text": customer_text, "at": at},
        {"id": f"{order_id}-m1", "sender": "bot", "text": bot_text, "at": at},
    ]


DEFAULT_CUSTOMER_ALIAS = "Pelanggan WA (sintetis)"
NOT_PARSED_MESSAGE = "Pesan belum menyebut produk dari katalog toko (mis. Batik Keris, Kebaya, Sarung)."


async def _catalog(db: aiosqlite.Connection) -> list[dict[str, Any]]:
    cur = await db.execute("SELECT * FROM inventory ORDER BY sku")
    rows = await cur.fetchall()
    await cur.close()
    return [inventory_row_to_dto(r) for r in rows]


def _llm_insight(parsed: ParsedMessage, model: str) -> dict[str, Any]:
    return {
        "engine": "llm",
        "model": model,
        "intent": parsed.intent,
        "customerName": parsed.customer_name,
        "extractedProduct": parsed.extracted_product,
        "quantity": parsed.quantity,
        "confidence": round(parsed.ai_confidence, 2),
        "reasoning": parsed.ai_reasoning,
    }


def _rule_insight(code: str, message: str) -> dict[str, Any]:
    return {
        "engine": "rule_based",
        "model": None,
        "intent": "ORDER_CREATION",
        "customerName": None,
        "extractedProduct": None,
        "quantity": None,
        "confidence": None,
        "reasoning": f"Fallback rule-based parser ({code}): {message}",
    }


async def _analyze_text(
    db: aiosqlite.Connection, payload: WebhookPayload
) -> tuple[list[dict[str, Any]], dict[str, Any]] | JSONResponse:
    text = (payload.text or "").strip()
    if not text:
        return typed_failure("ORDER_NOT_PARSED", NOT_PARSED_MESSAGE, "parse_order_text", "-")
    result = await parse_whatsapp_message(text, payload.customer_alias, await _catalog(db))
    if not result.ok:
        logger.warning("llm_parse_fallback code=%s context=%s cause=%s", result.code, result.context, result.cause)
        lines = parse_order_text(text)
        if not lines:
            return typed_failure("ORDER_NOT_PARSED", NOT_PARSED_MESSAGE, "parse_order_text", "-")
        return lines, _rule_insight(result.code, result.message)
    parsed: ParsedMessage = result.value
    if parsed.intent != "ORDER_CREATION" or not parsed.items:
        return typed_failure(
            "ORDER_NOT_PARSED",
            f"AI Agent ({result.model}) mendeteksi {parsed.intent}: {parsed.ai_reasoning}",
            "llm_parse_message",
            "-",
        )
    return [it.model_dump() for it in parsed.items], _llm_insight(parsed, result.model)


def _resolve_alias(payload: WebhookPayload, insight: dict[str, Any] | None) -> str:
    name = str((insight or {}).get("customerName") or "").strip()
    if payload.customer_alias == DEFAULT_CUSTOMER_ALIAS and name and name.lower() != "anonim":
        return f"{name} (WA)"
    return payload.customer_alias


async def _insert_intake_order(
    db: aiosqlite.Connection,
    payload: WebhookPayload,
    lines_json: list[dict[str, Any]],
    insight: dict[str, Any] | None,
    at: str,
) -> str:
    order_id = await _next_order_id(db)
    total = await _order_total(db, lines_json)
    warnings = await _stock_warnings(db, lines_json)
    messages = _intake_messages(order_id, payload.text, lines_json, total, warnings, at)
    await db.execute(
        """INSERT INTO orders(id, customer_alias, channel, lines_json, status,
           reject_reason, total_price, received_at, messages_json, ai_json)
           VALUES (?, ?, ?, ?, 'pending_approval', NULL, ?, ?, ?, ?)""",
        (
            order_id,
            _resolve_alias(payload, insight),
            payload.channel,
            json.dumps(lines_json),
            total,
            at,
            json.dumps(messages),
            json.dumps(insight) if insight else None,
        ),
    )
    return order_id


async def _audit_intake(
    db: aiosqlite.Connection, order_id: str, channel: str, insight: dict[str, Any] | None, at: str
) -> None:
    await _insert_audit(
        db, order_id, "agent", "INBOUND_MESSAGE", "external", "pending_approval", at, note=f"channel={channel}"
    )
    if insight:
        engine = f"llm:{insight['model']}" if insight["engine"] == "llm" else "rule_based"
        await _insert_audit(
            db, order_id, "agent", "AI_PARSE_MESSAGE", "raw_text", engine, at, note=str(insight["reasoning"])
        )


@v1.post("/webhook/whatsapp")
async def webhook_whatsapp(payload: WebhookPayload) -> Any:
    at = now_iso()
    db = await get_db()
    try:
        insight: dict[str, Any] | None = None
        lines_json = [ln.model_dump() for ln in payload.lines]
        if not lines_json:
            analyzed = await _analyze_text(db, payload)
            if isinstance(analyzed, JSONResponse):
                return analyzed
            lines_json, insight = analyzed
        missing = await _missing_sku(db, lines_json)
        if missing:
            return typed_failure(
                "PRODUCT_NOT_FOUND", f"Produk {missing} tidak ditemukan.", "webhook_whatsapp", "-", sku=missing
            )
        order_id = await _insert_intake_order(db, payload, lines_json, insight, at)
        await _audit_intake(db, order_id, payload.channel, insight, at)
        await db.commit()
        logger.info("webhook_ingested order_id=%s channel=%s engine=%s", order_id, payload.channel,
                    insight["engine"] if insight else "structured")

        cur = await db.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        created = await cur.fetchone()
        await cur.close()
        return {"ok": True, "order": order_row_to_dto(created) if created else None, "llmEnabled": llm_enabled()}
    finally:
        await db.close()


# ----------------------------- Demo reset -----------------------------

@v1.post("/demo/reset")
async def demo_reset() -> Any:
    db = await get_db()
    try:
        await db.execute("DELETE FROM audit_logs")
        await db.execute("DELETE FROM orders")
        await db.execute("DELETE FROM inventory")
        await _seed_inventory(db)
        await _seed_orders(db)
        await db.commit()
        logger.info("demo_reset_complete")
    finally:
        await db.close()
    return await get_state()


# ----------------------------- Wire routers -----------------------------

app.include_router(api)
app.include_router(v1)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    logger.info("shutdown_complete")
