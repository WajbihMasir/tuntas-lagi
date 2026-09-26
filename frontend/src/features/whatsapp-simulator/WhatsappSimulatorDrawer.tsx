import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { MessageCircleMore, X } from "lucide-react";
import { SIMULATOR } from "@/constants/testIds";
import type { InboundMessage, SimulationOutcome } from "@/features/approval-queue/types";
import { PresetList } from "./PresetList";
import { FreeChatForm } from "./FreeChatForm";
import { SimulatorLog, type LogEntry } from "./SimulatorLog";

type DrawerProps = { onSend: (msg: InboundMessage) => Promise<SimulationOutcome> };

function DrawerHeader() {
  return (
    <header className="flex items-start justify-between gap-4 bg-brand-navy px-5 py-5 text-white">
      <div>
        <Dialog.Title className="font-display text-lg font-bold">Simulasi Chat WhatsApp Customer</Dialog.Title>
        <Dialog.Description className="mt-1 text-xs text-white/70">Pura-pura jadi customer. Pesan dikirim ke webhook dan langsung masuk Antrean Persetujuan.</Dialog.Description>
      </div>
      <Dialog.Close data-testid={SIMULATOR.closeButton} aria-label="Tutup simulator" className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
        <X aria-hidden="true" className="h-5 w-5" />
      </Dialog.Close>
    </header>
  );
}

export function WhatsappSimulatorDrawer({ onSend }: DrawerProps) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [sending, setSending] = useState(false);

  const send = async (msg: InboundMessage): Promise<SimulationOutcome> => {
    setSending(true);
    const outcome = await onSend(msg);
    const at = new Date().toISOString();
    setLog((prev) => [...prev, { ...msg, id: `${at}-${prev.length}`, at, outcome }]);
    setSending(false);
    return outcome;
  };

  return (
    <Dialog.Root modal={false}>
      <Dialog.Trigger data-testid={SIMULATOR.openButton} className="inline-flex items-center gap-2 rounded-md bg-brand-green px-4 py-2.5 text-sm font-semibold text-white shadow-brand-rest transition-[background-color,transform] duration-150 ease-out hover:bg-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 active:scale-[0.97]">
        <MessageCircleMore aria-hidden="true" className="h-4 w-4" />
        Simulasi Chat WA
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          data-testid={SIMULATOR.panel}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-brand-lift duration-300 data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right sm:max-w-md"
        >
          <DrawerHeader />
          <div className="flex-1 overflow-y-auto">
            <PresetList disabled={sending} onPick={(p) => void send({ customerAlias: p.customerAlias, text: p.text })} />
            <SimulatorLog entries={log} />
          </div>
          <FreeChatForm disabled={sending} onSubmit={send} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
