import { formatRupiah } from "@/lib/format";
import { orderTotal } from "./order-math";
import type { ActionFailure, AuditEntry, ChatMessage, Inventory, Order, QueueState, Result } from "./types";

type Transition = { next: QueueState; failure: ActionFailure | null };

function fail(state: QueueState, failure: ActionFailure): Transition {
  return { next: { ...state, lastFailure: failure }, failure };
}

function findPending(state: QueueState, id: string, operation: string): Result<Order, ActionFailure> {
  const order = state.orders.find((o) => o.id === id);
  if (order && order.status === "pending_approval") return { ok: true, value: order };
  return { ok: false, error: { code: "ORDER_NOT_PENDING", message: "Pesanan ini sudah diproses sebelumnya.", context: { operation, order_id: id } } };
}

export function deductStock(order: Order, inventory: Inventory): Result<Inventory, ActionFailure> {
  const next: Inventory = { ...inventory };
  for (const line of order.lines) {
    const product = next[line.sku];
    const context = { operation: "check_stock", order_id: order.id, sku: line.sku };
    if (!product) return { ok: false, error: { code: "PRODUCT_NOT_FOUND", message: `Produk ${line.sku} tidak ditemukan.`, context } };
    if (product.stock < line.quantity) {
      const message = `Stok ${product.name} tersisa ${product.stock}, pesanan butuh ${line.quantity}.`;
      return { ok: false, error: { code: "INSUFFICIENT_STOCK", message, context } };
    }
    next[line.sku] = { ...product, stock: product.stock - line.quantity };
  }
  return { ok: true, value: next };
}

function botMessage(order: Order, text: string, at: string): ChatMessage {
  return { id: `${order.id}-m${order.messages.length}`, sender: "bot", text, at };
}

function audit(order: Order, at: string, entry: Pick<AuditEntry, "actor" | "action" | "before" | "after">, seq: number): AuditEntry {
  return { id: `${order.id}-${entry.action}-${at}-${seq}`, at, orderId: order.id, ...entry };
}

function replaceOrder(orders: Order[], updated: Order): Order[] {
  return orders.map((o) => (o.id === updated.id ? updated : o));
}

export function approveOrder(state: QueueState, id: string, at: string): Transition {
  const found = findPending(state, id, "approve_order");
  if (!found.ok) return fail(state, found.error);
  const order = found.value;
  const deducted = deductStock(order, state.inventory);
  if (!deducted.ok) return fail(state, deducted.error);
  const total = formatRupiah(orderTotal(order, state.inventory));
  const notice = botMessage(order, `Pesanan ${order.id} sudah dikonfirmasi pemilik toko. Total ${total}, invoice segera kami kirim. Terima kasih, Kak!`, at);
  const updated: Order = { ...order, status: "approved", messages: [...order.messages, notice] };
  const entries = [
    audit(order, at, { actor: "agent", action: "NOTIFY_CUSTOMER", before: "draft", after: "sent" }, 2),
    audit(order, at, { actor: "agent", action: "DEDUCT_STOCK", before: "reserved", after: "deducted" }, 1),
    audit(order, at, { actor: "human", action: "APPROVE_ORDER", before: "pending_approval", after: "approved" }, 0),
  ];
  const next = { ...state, inventory: deducted.value, orders: replaceOrder(state.orders, updated), audit: [...entries, ...state.audit], lastFailure: null };
  return { next, failure: null };
}

export function rejectOrder(state: QueueState, id: string, reason: string, at: string): Transition {
  const found = findPending(state, id, "reject_order");
  if (!found.ok) return fail(state, found.error);
  const order = found.value;
  const notice = botMessage(order, `Mohon maaf, Kak. Pesanan ${order.id} dibatalkan: ${reason}.`, at);
  const updated: Order = { ...order, status: "rejected", rejectReason: reason, messages: [...order.messages, notice] };
  const entries = [
    audit(order, at, { actor: "agent", action: "NOTIFY_CUSTOMER", before: "draft", after: "sent" }, 1),
    audit(order, at, { actor: "human", action: "REJECT_ORDER", before: "pending_approval", after: "rejected" }, 0),
  ];
  const next = { ...state, orders: replaceOrder(state.orders, updated), audit: [...entries, ...state.audit], lastFailure: null };
  return { next, failure: null };
}
