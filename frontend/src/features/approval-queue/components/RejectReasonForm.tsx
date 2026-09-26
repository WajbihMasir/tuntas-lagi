import { useState, type FormEvent } from "react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { APPROVAL, presetReasonId } from "@/constants/testIds";

const PRESET_REASONS = ["Stok habis", "Alamat di luar jangkauan kurir", "Pembayaran belum valid", "Permintaan customer"];

const ReasonSchema = z.string().trim().min(5, "Alasan minimal 5 karakter.").max(160, "Alasan maksimal 160 karakter.");

type RejectReasonFormProps = { onConfirm: (reason: string) => void; onCancel: () => void };

const CHIP = "rounded-md border px-2.5 py-1 text-xs font-medium transition-[background-color,color,border-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export function RejectReasonForm({ onConfirm, onCancel }: RejectReasonFormProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = ReasonSchema.safeParse(reason);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Alasan tidak valid.");
    onConfirm(parsed.data);
  }

  return (
    <form data-testid={APPROVAL.rejectForm} onSubmit={submit} className="flex w-full flex-col gap-3">
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/60">Alasan pembatalan</legend>
        {PRESET_REASONS.map((preset, i) => (
          <button key={preset} type="button" data-testid={presetReasonId(i)} onClick={() => { setReason(preset); setError(null); }}
            className={cn(CHIP, reason === preset ? "border-brand-navy bg-brand-navy text-white" : "border-brand-navy/15 text-brand-navy hover:bg-brand-mist")}>
            {preset}
          </button>
        ))}
      </fieldset>
      <label className="sr-only" htmlFor="reject-reason">Tulis alasan pembatalan</label>
      <textarea id="reject-reason" data-testid={APPROVAL.rejectReasonInput} rows={2} value={reason} placeholder="Tulis alasan yang akan dikirim bot ke customer…"
        onChange={(e) => { setReason(e.target.value); setError(null); }}
        className="w-full resize-none rounded-md border border-brand-navy/15 px-3 py-2 text-sm text-brand-navy placeholder:text-brand-navy/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue" />
      {error && <p role="alert" data-testid={APPROVAL.rejectReasonError} className="text-xs text-destructive">{error}</p>}
      <span className="flex gap-2">
        <button type="submit" data-testid={APPROVAL.rejectConfirmButton} className="rounded-md bg-destructive px-3 py-2 text-xs font-semibold text-white transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.97]">Konfirmasi Reject</button>
        <button type="button" data-testid={APPROVAL.rejectCancelButton} onClick={onCancel} className="rounded-md px-3 py-2 text-xs font-semibold text-brand-navy transition-[background-color] duration-150 ease-out hover:bg-brand-mist">Batal</button>
      </span>
    </form>
  );
}
