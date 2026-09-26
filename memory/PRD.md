# PRD — TuntasUMKM HITL Governance & Approval Queue

## Original Problem Statement
Clone repo https://github.com/WajbihMasir/tuntas-lagi and wire the existing HITL Approval Queue dashboard to a real Backend, Database & Webhook layer (`Real Backend Integration & Persistence Layer`).

## User Choices (Iteration 3)
- Database: SQLite (aiosqlite) — embedded, no external service
- Bot reply: mocked/simulated (logged + persisted, no third-party sender)
- Repo stack: keep as-is (TypeScript strict frontend + FastAPI backend)
- Seed demo data: yes (5 inventory items, 6 orders incl. pending / approved / rejected samples)

## Stack
- Frontend: React 19 + Tailwind 3 + shadcn/ui (TS strict), yarn
- Backend: FastAPI + aiosqlite (SQLite file `backend/tuntas.db`), routes prefixed `/api` and `/api/v1`

## Iteration 3 — Backend & Persistence (2026-02)
- SQLite schema: `inventory(sku,name,price,stock)`, `orders(id,customer_alias,channel,lines_json,status,reject_reason,total_price,received_at,messages_json)`, `audit_logs(id,order_id,actor,action,before_state,after_state,note,at)`
- Endpoints under `/api/v1`:
  - `GET /state`, `GET /inventory`, `GET /orders`, `GET /orders/{id}`, `GET /audit-logs`
  - `POST /orders/{id}/approve` — stock validation, deduction, bot notify (mock), audit log × 3
  - `POST /orders/{id}/reject` — reason ≥ 5 chars, audit log × 2, bot notify
  - `POST /webhook/whatsapp` — ingest inbound WhatsApp/Chat order → creates pending order + audit
- Typed failures (HTTP 409): `INSUFFICIENT_STOCK`, `PRODUCT_NOT_FOUND`, `ORDER_NOT_PENDING`, `ORDER_NOT_FOUND` with `{code,message,context}`
- Bot reply is MOCKED (logged via `logger.info` and appended as `messages_json[bot]`); no external delivery
- Frontend: `api-client.ts` + rewritten `use-approval-queue.ts` (SWR-free, native fetch + 6s polling). Loading/error states surfaced in `ApprovalQueuePage`. All actions call backend; failure body drives GoldCard failure alert.
- `bash scripts/antislop-check.sh` → all green (grep guards + tsc --noEmit + ruff)

## Iteration 4 — WhatsApp Webhook Simulator & Demo Reset (2026-06)
- User choices: side drawer from Dashboard; rule-based parser (no AI in repo); hidden reset button + confirm
- `POST /api/v1/webhook/whatsapp` now accepts free text (`lines` optional) → `parse_order_text` (keyword → SKU + qty) → PENDING order; bot note when stock short; `ORDER_NOT_PARSED` typed failure (409)
- `POST /api/v1/demo/reset` → wipes audit/orders/inventory and reseeds
- Frontend: `features/whatsapp-simulator/` (non-modal Radix drawer, presets Valid/Stok Kurang, free chat, session log), `DemoResetButton` (hidden icon + AlertDialog). New order auto-selected in queue immediately; polling 3s
- Removed template `frontend/jsconfig.json` (conflicted with repo tsconfig)
- Testing iteration_4: backend 9/9, frontend flows 100%; antislop-check exit 0

## Iteration 5 — Real LLM Engine (2026-06)
- Deployed repo commit 6484ffb (llm_engine.py) into sandbox; configured `BYNARA_API_KEY`, `BYNARA_BASE_URL`, `LLM_PRIMARY_MODEL=agnes-2.5-flash`, `LLM_FALLBACK_MODEL=longcat-2.5` in backend/.env
- Webhook parse via LLM structured JSON (catalog in system prompt) → `aiInsight`; approve/reject → LLM-drafted Indonesian reply; fallback to rule-based / static template on any LLMFailure
- GoldCard AiInsightPanel: "AI Parsed · Confidence %", model, reasoning
- Testing iteration_5: backend 14/14, frontend 100%; antislop-check exit 0

## Backlog
- P1: Realtime push via SSE/websocket instead of 6s polling
- P1: Edit action on draft order (qty/price) before approve
- P1: Multi-tenant scoping + auth (per-toko session)
- P2: Real WhatsApp Business API adapter behind `_send_bot_reply`
- P2: Metrics dashboard (approval SLA, rejection reasons histogram)
