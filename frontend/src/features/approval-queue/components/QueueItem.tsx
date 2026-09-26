import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock, formatRupiah } from "@/lib/format";
import { approvalItemId } from "@/constants/testIds";
import { STATUS_TONE } from "./status-tone";
import type { Order } from "../types";

type QueueItemProps = { order: Order; total: number; title: string; active: boolean; onSelect: (id: string) => void };

export function QueueItem({ order, total, title, active, onSelect }: QueueItemProps) {
  const tone = STATUS_TONE[order.status];
  const last = order.messages[order.messages.length - 1];
  return (
    <li>
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        data-testid={approvalItemId(order.id)}
        data-status={order.status}
        onClick={() => onSelect(order.id)}
        className={cn(
          "group w-full border-l-4 px-4 py-3 text-left transition-[background-color,border-color] duration-150 ease-out motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-blue",
          active ? "border-l-brand-blue bg-brand-sky/60" : "border-l-transparent hover:bg-brand-mist",
        )}
      >
        <span className="flex items-center justify-between gap-3 text-xs text-brand-navy/60">
          <span className="flex items-center gap-1.5 font-medium">
            <MessageCircle aria-hidden="true" className="h-3.5 w-3.5 text-brand-blue" />
            {order.channel} · {order.customerAlias}
          </span>
          <time dateTime={order.receivedAt} className="font-mono tabular-nums">{formatClock(order.receivedAt)}</time>
        </span>
        <span className="mt-1 block truncate text-sm font-semibold text-brand-navy">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-brand-navy/60">{last?.text}</span>
        <span className="mt-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-semibold uppercase tracking-[0.1em] text-brand-navy/70">
            <span aria-hidden="true" className={cn("h-2 w-2 rounded-[2px]", tone.marker)} />
            {tone.label}
          </span>
          <span className="font-mono font-semibold tabular-nums text-brand-navy">{formatRupiah(total)}</span>
        </span>
      </button>
    </li>
  );
}
