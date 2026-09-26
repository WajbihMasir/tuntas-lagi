import { Check, Loader2, X } from "lucide-react";
import { APPROVAL } from "@/constants/testIds";

const BASE =
  "inline-flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-[background-color,transform,opacity] duration-150 ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 active:scale-[0.97] motion-reduce:active:scale-100 disabled:cursor-wait disabled:opacity-60";

type DecisionActionsProps = { busy: boolean; onApprove: () => void; onReject: () => void };

export function DecisionActions({ busy, onApprove, onReject }: DecisionActionsProps) {
  return (
    <>
      <button type="button" data-testid={APPROVAL.approveButton} onClick={onApprove} disabled={busy} className={`${BASE} bg-brand-green text-white hover:bg-brand-navy`}>
        {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Check aria-hidden="true" className="h-4 w-4" />}
        {busy ? "AI menyusun balasan…" : "Approve"}
      </button>
      <button type="button" data-testid={APPROVAL.rejectButton} onClick={onReject} disabled={busy} className={`${BASE} border border-brand-navy/15 text-brand-navy hover:bg-brand-mist`}>
        <X aria-hidden="true" className="h-4 w-4" />
        Reject
      </button>
    </>
  );
}
