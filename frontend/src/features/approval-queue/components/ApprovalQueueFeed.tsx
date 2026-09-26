import { APPROVAL } from "@/constants/testIds";
import { orderTitle, orderTotal } from "../order-math";
import { QueueItem } from "./QueueItem";
import type { Inventory, Order } from "../types";

type FeedProps = { orders: Order[]; inventory: Inventory; selectedId: string | null; onSelect: (id: string) => void };

const STATUS_ORDER = { pending_approval: 0, approved: 1, rejected: 2 } as const;

export function ApprovalQueueFeed({ orders, inventory, selectedId, onSelect }: FeedProps) {
  const sorted = [...orders].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.receivedAt.localeCompare(a.receivedAt));
  const pending = orders.filter((o) => o.status === "pending_approval").length;
  return (
    <section data-testid={APPROVAL.feed} aria-labelledby="queue-heading" className="flex flex-col overflow-hidden rounded-lg bg-white shadow-brand-rest">
      <header className="flex items-baseline justify-between px-4 pb-3 pt-5">
        <h2 id="queue-heading" className="font-display text-lg font-bold text-brand-navy">Antrean Approval</h2>
        <p data-testid={APPROVAL.feedCount} className="font-mono text-xs tabular-nums text-brand-blue">{pending} menunggu</p>
      </header>
      <ul aria-live="polite" className="flex flex-col divide-y divide-brand-navy/5 overflow-y-auto lg:max-h-[640px]">
        {sorted.map((order) => (
          <QueueItem
            key={order.id}
            order={order}
            total={orderTotal(order, inventory)}
            title={orderTitle(order, inventory)}
            active={order.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </section>
  );
}
