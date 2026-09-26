import { formatClock } from "@/lib/format";
import { APPROVAL } from "@/constants/testIds";
import type { AuditEntry } from "../types";

function AuditRow({ entry }: { entry: AuditEntry }) {
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 py-2 text-xs">
      <time dateTime={entry.at} className="font-mono tabular-nums text-brand-navy/50">{formatClock(entry.at)}</time>
      <span className="text-brand-navy">
        <code className="font-mono font-semibold text-brand-blue">{entry.action}</code> · {entry.orderId}
        <span className="block text-brand-navy/50">{entry.before} → {entry.after}</span>
      </span>
      <span className="font-semibold uppercase tracking-[0.1em] text-brand-navy/60">{entry.actor}</span>
    </li>
  );
}

export function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  return (
    <section data-testid={APPROVAL.audit} aria-labelledby="audit-heading" className="rounded-lg bg-white p-5 shadow-brand-rest">
      <h2 id="audit-heading" className="font-display text-base font-bold text-brand-navy">Audit Log</h2>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-brand-navy/60">Belum ada keputusan di sesi ini. Setiap Approve/Reject tercatat di sini.</p>
      ) : (
        <ol aria-live="polite" className="mt-2 divide-y divide-brand-navy/5 lg:max-h-[220px] lg:overflow-y-auto">
          {entries.slice(0, 12).map((e) => <AuditRow key={e.id} entry={e} />)}
        </ol>
      )}
    </section>
  );
}
