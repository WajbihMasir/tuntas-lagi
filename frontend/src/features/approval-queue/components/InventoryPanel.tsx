import { cn } from "@/lib/utils";
import { APPROVAL, stockId } from "@/constants/testIds";
import type { Inventory } from "../types";

const LOW_STOCK = 3;

export function InventoryPanel({ inventory }: { inventory: Inventory }) {
  return (
    <section data-testid={APPROVAL.inventory} aria-labelledby="inventory-heading" className="rounded-lg bg-brand-navy p-5 text-white">
      <h2 id="inventory-heading" className="font-display text-base font-bold">Stok Gudang</h2>
      <p className="mt-1 text-xs text-white/60">Sumber kebenaran check_stock()</p>
      <ul aria-live="polite" className="mt-4 flex flex-col gap-2.5">
        {Object.values(inventory).map((p) => (
          <li key={p.sku} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-white/85">{p.name}</span>
            <span data-testid={stockId(p.sku)} className={cn("font-mono font-semibold tabular-nums", p.stock <= LOW_STOCK ? "text-brand-peach" : "text-brand-mint")}>
              {p.stock}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
