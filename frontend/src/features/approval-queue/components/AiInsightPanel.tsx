import { Cpu, Sparkles } from "lucide-react";
import { APPROVAL } from "@/constants/testIds";
import type { AiInsight } from "../types";

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span aria-hidden="true" className="mt-2 block h-1 w-full overflow-hidden rounded-sm bg-brand-sky">
      <span className="block h-full bg-brand-blue transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
    </span>
  );
}

function LlmHeader({ insight }: { insight: AiInsight }) {
  const pct = insight.confidence === null ? null : Math.round(insight.confidence * 100);
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span data-testid={APPROVAL.aiBadge} className="inline-flex items-center gap-1.5 rounded-sm bg-brand-navy px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">
        <Sparkles aria-hidden="true" className="h-3 w-3 text-brand-peach" />
        AI Parsed
      </span>
      {pct !== null && (
        <span data-testid={APPROVAL.aiConfidence} className="font-mono text-xs font-semibold tabular-nums text-brand-blue">Confidence {pct}%</span>
      )}
      <code data-testid={APPROVAL.aiModel} className="ml-auto font-mono text-[11px] text-brand-navy/50">{insight.model}</code>
    </p>
  );
}

function RuleHeader() {
  return (
    <p data-testid={APPROVAL.aiBadge} className="inline-flex items-center gap-1.5 rounded-sm bg-brand-peach/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-navy">
      <Cpu aria-hidden="true" className="h-3 w-3" />
      Rule-based fallback
    </p>
  );
}

export function AiInsightPanel({ insight }: { insight: AiInsight }) {
  const isLlm = insight.engine === "llm";
  return (
    <aside data-testid={APPROVAL.aiInsight} data-engine={insight.engine} aria-label="Hasil analisis AI Agent" className="mb-4 rounded-md border border-brand-blue/20 bg-brand-sky/40 px-3 py-3 text-xs text-brand-navy animate-in fade-in duration-300 motion-reduce:animate-none">
      {isLlm ? <LlmHeader insight={insight} /> : <RuleHeader />}
      {isLlm && insight.confidence !== null && <ConfidenceMeter value={insight.confidence} />}
      {isLlm && insight.extractedProduct && (
        <p data-testid={APPROVAL.aiExtracted} className="mt-2 font-mono text-[11px] text-brand-navy/70">
          {insight.intent} · {insight.extractedProduct} × {insight.quantity ?? 1}
        </p>
      )}
      <p data-testid={APPROVAL.aiReasoning} className="mt-2 leading-relaxed">
        <span className="font-semibold">AI Reasoning: </span>{insight.reasoning}
      </p>
    </aside>
  );
}
