import { AlertTriangle, CheckCheck } from "lucide-react";
import { formatClock } from "@/lib/format";
import { SIMULATOR, simulatorLogEntryId } from "@/constants/testIds";
import type { AiInsight, InboundMessage, SimulationOutcome } from "@/features/approval-queue/types";

export type LogEntry = InboundMessage & { id: string; at: string; outcome: SimulationOutcome };

function AiOutcomeTag({ insight }: { insight: AiInsight }) {
  const label = insight.engine === "llm" && insight.confidence !== null
    ? `AI ${Math.round(insight.confidence * 100)}%`
    : "Rule-based";
  return <span className="ml-1 rounded-sm bg-brand-sky px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-blue">{label}</span>;
}

function OutcomeLine({ outcome }: { outcome: SimulationOutcome }) {
  if (outcome.ok) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-brand-navy/70">
        <CheckCheck aria-hidden="true" className="h-3.5 w-3.5 text-brand-blue" />
        Masuk antrean sebagai <code className="font-mono font-semibold text-brand-navy">{outcome.orderId}</code> · PENDING
        {outcome.aiInsight && <AiOutcomeTag insight={outcome.aiInsight} />}
      </p>
    );
  }
  return (
    <p role="alert" className="flex max-w-[90%] items-start gap-1.5 text-right text-xs text-brand-navy">
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-peach" />
      <span><code className="font-mono font-semibold">{outcome.code}</code> {outcome.message}</span>
    </p>
  );
}

function LogBubble({ entry, index }: { entry: LogEntry; index: number }) {
  return (
    <li data-testid={simulatorLogEntryId(index)} data-ok={entry.outcome.ok ? "true" : "false"} className="flex flex-col items-end gap-1 animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
      <span className="text-[11px] font-medium text-brand-navy/50">{entry.customerAlias}</span>
      <p className="max-w-[90%] rounded-lg rounded-tr-sm bg-brand-mint px-3 py-2 text-sm leading-relaxed text-brand-navy">
        {entry.text}
        <time dateTime={entry.at} className="mt-1 block text-right font-mono text-[10px] tabular-nums opacity-60">{formatClock(entry.at)}</time>
      </p>
      <OutcomeLine outcome={entry.outcome} />
    </li>
  );
}

export function SimulatorLog({ entries }: { entries: LogEntry[] }) {
  return (
    <section aria-labelledby="wa-log-heading" className="px-5 py-4">
      <h3 id="wa-log-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-navy/60">Riwayat simulasi</h3>
      {entries.length === 0 ? (
        <p data-testid={SIMULATOR.logEmpty} className="mt-3 text-sm text-brand-navy/50">Belum ada pesan terkirim. Klik preset atau ketik pesan bebas di bawah.</p>
      ) : (
        <ol data-testid={SIMULATOR.log} aria-live="polite" className="mt-3 flex flex-col gap-4">
          {entries.map((e, i) => <LogBubble key={e.id} entry={e} index={i} />)}
        </ol>
      )}
    </section>
  );
}
