import { ShieldCheck } from "lucide-react";
import { BRAND } from "@/constants/brand";
import { APPROVAL } from "@/constants/testIds";
import { useApprovalQueue } from "@/features/approval-queue/use-approval-queue";
import type { InboundMessage, SimulationOutcome } from "@/features/approval-queue/types";
import { StatSummaryBar } from "@/features/approval-queue/components/StatSummaryBar";
import { ApprovalQueueFeed } from "@/features/approval-queue/components/ApprovalQueueFeed";
import { LiveChatPreview } from "@/features/approval-queue/components/LiveChatPreview";
import { OrderDecisionCard } from "@/features/approval-queue/components/OrderDecisionCard";
import { InventoryPanel } from "@/features/approval-queue/components/InventoryPanel";
import { AuditTrail } from "@/features/approval-queue/components/AuditTrail";
import { WhatsappSimulatorDrawer } from "@/features/whatsapp-simulator/WhatsappSimulatorDrawer";
import { DemoResetButton } from "@/features/whatsapp-simulator/DemoResetButton";

type HeaderProps = {
  onSimulate: (msg: InboundMessage) => Promise<SimulationOutcome>;
  onReset: () => Promise<boolean>;
};

function PageHeader({ onSimulate, onReset }: HeaderProps) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="font-display text-sm font-bold text-brand-blue">{BRAND.name}</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-brand-navy sm:text-5xl">Antrean Persetujuan</h1>
        <p className="mt-2 max-w-xl text-sm text-brand-navy/70 md:text-base">{BRAND.tagline} Agent menyiapkan draft, Anda yang memutuskan.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <DemoResetButton onReset={onReset} />
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-navy/70">
          <ShieldCheck aria-hidden="true" className="h-4 w-4 text-brand-green" />
          Mode HITL aktif
        </p>
        <WhatsappSimulatorDrawer onSend={onSimulate} />
      </div>
    </header>
  );
}

export default function ApprovalQueuePage() {
  const { state, selected, stats, loading, error, select, approve, reject, refresh, simulateInbound, resetDemo } = useApprovalQueue();
  return (
    <main data-testid={APPROVAL.page} className="min-h-screen bg-brand-mist px-4 py-8 font-sans sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
        <PageHeader onSimulate={simulateInbound} onReset={resetDemo} />
        {loading && state.orders.length === 0 && (
          <p data-testid="approval-loading" className="rounded-md bg-white px-4 py-3 text-sm text-brand-navy/70 shadow-brand-rest">Memuat antrean dari API…</p>
        )}
        {error && (
          <p role="alert" data-testid="approval-error" className="flex items-center justify-between gap-3 rounded-md bg-brand-peach/30 px-4 py-3 text-sm text-brand-navy">
            <span><code className="font-mono font-semibold">API_ERROR</code> {error}</span>
            <button type="button" onClick={() => void refresh()} data-testid="approval-retry" className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-blue">Coba lagi</button>
          </p>
        )}
        <StatSummaryBar stats={stats} />
        <section aria-label="Ruang kerja approval" className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-4 lg:row-span-2">
            <ApprovalQueueFeed orders={state.orders} inventory={state.inventory} selectedId={state.selectedId} onSelect={select} />
          </div>
          {selected && (
            <section aria-label="Live chat & quick action" className="grid grid-cols-1 gap-5 lg:col-span-8 xl:grid-cols-12">
              <div className="xl:col-span-7"><LiveChatPreview order={selected} /></div>
              <div className="xl:col-span-5">
                <OrderDecisionCard key={selected.id} order={selected} inventory={state.inventory} failure={state.lastFailure} onApprove={approve} onReject={reject} />
              </div>
            </section>
          )}
          <div className="lg:col-span-3"><InventoryPanel inventory={state.inventory} /></div>
          <div className="lg:col-span-5"><AuditTrail entries={state.audit} /></div>
        </section>
      </div>
    </main>
  );
}
