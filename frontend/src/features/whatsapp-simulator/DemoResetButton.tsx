import { useState, type MouseEvent } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { RotateCcw } from "lucide-react";
import { SIMULATOR } from "@/constants/testIds";

const ACTION = "rounded-md px-4 py-2 text-sm font-semibold transition-[background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue disabled:opacity-50";

export function DemoResetButton({ onReset }: { onReset: () => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onReset();
    setBusy(false);
    if (ok) setOpen(false);
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger data-testid={SIMULATOR.resetTrigger} aria-label="Reset data demo" title="Reset data demo" className="rounded-md p-1.5 text-brand-navy/25 transition-colors hover:bg-white hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue">
        <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-brand-navy/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AlertDialog.Content data-testid={SIMULATOR.resetDialog} className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-brand-lift data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <AlertDialog.Title className="font-display text-lg font-bold text-brand-navy">Reset data demo?</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-brand-navy/70">
            Stok gudang, seluruh pesanan, dan audit log akan dikembalikan ke seed data awal. Pesanan hasil simulasi akan dihapus.
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel data-testid={SIMULATOR.resetCancel} className={`${ACTION} text-brand-navy hover:bg-brand-mist`}>Batal</AlertDialog.Cancel>
            <AlertDialog.Action data-testid={SIMULATOR.resetConfirm} disabled={busy} onClick={(e) => void confirm(e)} className={`${ACTION} bg-brand-navy text-white hover:bg-brand-blue`}>
              {busy ? "Mereset…" : "Ya, reset sekarang"}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
