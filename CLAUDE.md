# CLAUDE.md — TuntasUMKM Agent Operating Rules

TuntasUMKM · IDWEBHOST AI HACKFEST 2026 · "Dari Percakapan, Jadi Penjualan."
AI Agent operasional UMKM: chat → draft order → invoice, dengan pemilik tetap pegang kendali (HITL).

Aturan lengkap: `.cursor/rules/core-antislop.mdc` (selalu aktif) dan `.cursor/rules/frontend-antislop.mdc` (UI).
Gold standard UI: `frontend/src/components/ui/gold-card.tsx`.

## Stack
- Frontend: React 19 + Tailwind 3 + shadcn/ui, TypeScript (strict) untuk file baru (`.ts/.tsx`), yarn (bukan npm).
- Backend: FastAPI + MongoDB (`MONGO_URL`, `DB_NAME` dari env). Semua route berprefix `/api`.

## 1. Verifikasi setelah SETIAP modifikasi file
```bash
bash scripts/antislop-check.sh     # grep anti-slop + tsc --noEmit + ruff
cd frontend && yarn typecheck      # hanya type check frontend
```
Jangan lanjut ke file berikutnya selama check masih merah.

## 2. Error Context Enrichment
- Tidak ada silent swallow. Gunakan Result/Typed Failure.
- Setiap failure membawa: `code` (SCREAMING_SNAKE), `message`, `context` (`operation`, `message_id`, `order_id`, `idempotency_key`, `tool`), `cause`.
- Saat re-throw, bungkus dengan context baru; jangan buang error asli.
- Log terstruktur (key-value), tanpa PII — data pelanggan wajib sintetis.

## 3. Skema Warna Terkunci
| Token Tailwind | Hex |
|---|---|
| `brand-navy` (Primary) | #0F2D6B |
| `brand-blue` (Accent) | #2563EB |
| `brand-green` (Success) | #10B981 |

Pendukung: `brand-mist` #F1F5F9 · `brand-sky` #DBEAFE · `brand-mint` #D1FAE5 · `brand-peach` #FDBA8C.
Hanya via token (`bg-brand-navy`), dilarang hex literal di className. Konstanta: `@/constants/brand`.

## 4. Larangan UI Generik (AI Slop)
- Tanpa gradient purple→indigo, tanpa pill badge kapsul di atas Hero, tanpa 3-card grid simetris, tanpa `<Card border-gray-200>` di mana-mana.
- HTML5 semantik (`main/section/article/button`), tanpa div-soup, tanpa `useEffect` untuk derived state.

## 5. Search Before Create
Sebelum menulis helper/komponen baru, pindai dulu: `frontend/src/lib/`, `frontend/src/hooks/`, `frontend/src/constants/`, `frontend/src/components/ui/`, `@src/utils/`, `@src/common/`, dan modul backend. Reuse > duplikasi.

## 6. Guardrail Agent
- Tool (`check_stock`, `calc_total`, `create_draft_order`, `generate_invoice_draft`, `get_store_policy`): schema-validated, error eksplisit, idempotency key, timeout 30s, retry ≤ 2x.
- Aksi transaksional wajib lewat approval gate HITL; audit log di setiap state transition.
- Dilarang: `as any`, `@ts-ignore`, fungsi > 50 baris, komentar naratif redundant.
