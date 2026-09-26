import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { GoldCard } from "@/components/ui/gold-card";
import { APPROVAL } from "@/constants/testIds";
import { orderTitle, orderTotal } from "../order-math";
import { AiInsightPanel } from "./AiInsightPanel";
import { DecisionActions } from "./DecisionActions";
import { OrderLines } from "./OrderLines";
import { RejectReasonForm } from "./RejectReasonForm";
import type { ActionFailure, Inventory, Order } from "../types";

type OrderDecisionCardProps = {
  order: Order;
  inventory: Inventory;
  failure: ActionFailure | null;
  onApprove: (id: string) => Promise<boolean>;
  onReject: (id: string, reason: string) => Promise<boolean>;
};

function FailureNotice({ failure }: { failure: ActionFailure }) {
  return (
    <p role="alert" data-testid={APPROVAL.failureAlert} className="mt-4 flex items-start gap-2 rounded-md bg-brand-peach/30 px-3 py-2 text-xs text-brand-navy">
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
      <span><code className="font-mono font-semibold">{failure.code}</code> {failure.message}</span>
    </p>
  );
}

export function OrderDecisionCard({ order, inventory, failure, onApprove, onReject }: OrderDecisionCardProps) {
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = order.status === "pending_approval";
  async function decide(run: () => Promise<boolean>) {
    setBusy(true);
    const ok = await run();
    setBusy(false);
    if (ok) setRejecting(false);
  }
  const actions = rejecting
    ? <RejectReasonForm busy={busy} onCancel={() => setRejecting(false)} onConfirm={(reason) => void decide(() => onReject(order.id, reason))} />
    : <DecisionActions busy={busy} onApprove={() => void decide(() => onApprove(order.id))} onReject={() => setRejecting(true)} />;
  return (
    <GoldCard
      testId={APPROVAL.decisionCard}
      heading={orderTitle(order, inventory)}
      reference={order.id}
      state={{ status: "success", approval: order.status }}
      actions={pending ? actions : undefined}
    >
      {order.aiInsight && <AiInsightPanel insight={order.aiInsight} />}
      <OrderLines order={order} inventory={inventory} total={orderTotal(order, inventory)} />
      {order.rejectReason && (
        <p data-testid={APPROVAL.rejectReasonText} className="mt-4 text-xs text-brand-navy/70">
          Alasan: <span className="font-semibold text-destructive">{order.rejectReason}</span>
        </p>
      )}
      {failure && failure.context.order_id === order.id && <FailureNotice failure={failure} />}
    </GoldCard>
  );
}
