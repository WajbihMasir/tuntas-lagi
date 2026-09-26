import type { ReactNode } from "react";
import { CheckCircle2, Hourglass, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import { APPROVAL } from "@/constants/testIds";
import type { QueueStats } from "../types";

type StatTileProps = { label: string; value: number; note: string; icon: ReactNode; testId: string; className: string };

function StatTile({ label, value, note, icon, testId, className }: StatTileProps) {
  return (
    <article data-testid={testId} className={cn("flex flex-col justify-between gap-6 rounded-lg p-5", className)}>
      <header className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] opacity-80">
        <h2>{label}</h2>
        {icon}
      </header>
      <p className="flex items-end justify-between gap-4">
        <span data-testid={`${testId}-value`} className="font-display text-5xl font-extrabold tabular-nums leading-none">{value}</span>
        <span className="text-right text-xs font-medium opacity-80">{note}</span>
      </p>
    </article>
  );
}

export function StatSummaryBar({ stats }: { stats: QueueStats }) {
  const icon = "h-4 w-4";
  return (
    <section aria-label="Ringkasan pesanan" className="grid grid-cols-1 gap-4 md:grid-cols-12">
      <StatTile
        testId={APPROVAL.statPending} label="Perlu Persetujuan" value={stats.pending}
        note={`Nilai tertahan ${formatRupiah(stats.pendingValue)}`} icon={<Hourglass aria-hidden="true" className={icon} />}
        className="bg-brand-navy text-white shadow-brand-lift md:col-span-5 md:min-h-[168px]"
      />
      <StatTile
        testId={APPROVAL.statTotal} label="Total Pesanan" value={stats.total} note="Hari ini, semua kanal"
        icon={<ShoppingBag aria-hidden="true" className={icon} />} className="bg-white text-brand-navy shadow-brand-rest md:col-span-3"
      />
      <StatTile
        testId={APPROVAL.statCompleted} label="Penjualan Selesai" value={stats.completed}
        note={formatRupiah(stats.revenue)} icon={<CheckCircle2 aria-hidden="true" className={icon} />}
        className="bg-brand-mint text-brand-navy md:col-span-4"
      />
    </section>
  );
}
