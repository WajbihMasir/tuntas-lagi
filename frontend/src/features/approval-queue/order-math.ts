import type { Inventory, Order, QueueStats } from "./types";

export function orderTotal(order: Order, inventory: Inventory): number {
  return order.lines.reduce((sum, line) => sum + (inventory[line.sku]?.price ?? 0) * line.quantity, 0);
}

export function orderTitle(order: Order, inventory: Inventory): string {
  const first = order.lines[0];
  const name = first ? inventory[first.sku]?.name ?? first.sku : "Pesanan";
  const extra = order.lines.length > 1 ? ` +${order.lines.length - 1}` : "";
  return `Pemesanan ${name}${extra}`;
}

export function computeStats(orders: Order[], inventory: Inventory): QueueStats {
  const pending = orders.filter((o) => o.status === "pending_approval");
  const approved = orders.filter((o) => o.status === "approved");
  return {
    total: orders.length,
    pending: pending.length,
    pendingValue: pending.reduce((s, o) => s + orderTotal(o, inventory), 0),
    completed: approved.length,
    revenue: approved.reduce((s, o) => s + orderTotal(o, inventory), 0),
  };
}
