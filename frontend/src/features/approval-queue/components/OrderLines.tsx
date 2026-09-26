import { formatRupiah } from "@/lib/format";
import { APPROVAL } from "@/constants/testIds";
import type { Inventory, Order } from "../types";

export function OrderLines({ order, inventory, total }: { order: Order; inventory: Inventory; total: number }) {
  return (
    <>
      <ul className="flex flex-col gap-2">
        {order.lines.map((line) => {
          const product = inventory[line.sku];
          return (
            <li key={line.sku} className="flex items-start justify-between gap-3">
              <span>
                <span className="block font-medium">{product?.name ?? line.sku}</span>
                <span className="font-mono text-xs text-brand-navy/60">{line.quantity} × {formatRupiah(product?.price ?? 0)} · stok {product?.stock ?? 0}</span>
              </span>
              <span className="font-mono text-sm tabular-nums">{formatRupiah((product?.price ?? 0) * line.quantity)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 flex items-baseline justify-between border-t border-dashed border-brand-navy/15 pt-3">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/60">Total via {order.channel}</span>
        <span data-testid={APPROVAL.orderTotal} className="font-display text-xl font-extrabold tabular-nums text-brand-navy">{formatRupiah(total)}</span>
      </p>
    </>
  );
}
