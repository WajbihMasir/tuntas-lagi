import { useState, type FormEvent, type KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { SIMULATOR } from "@/constants/testIds";
import type { InboundMessage, SimulationOutcome } from "@/features/approval-queue/types";
import { DEFAULT_ALIAS } from "./presets";

type FreeChatFormProps = { disabled: boolean; onSubmit: (msg: InboundMessage) => Promise<SimulationOutcome> };

const FIELD = "w-full rounded-md border border-brand-navy/15 bg-white px-3 py-2 text-sm text-brand-navy placeholder:text-brand-navy/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export function FreeChatForm({ disabled, onSubmit }: FreeChatFormProps) {
  const [alias, setAlias] = useState(DEFAULT_ALIAS);
  const [text, setText] = useState("");
  const trimmed = text.trim();

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!trimmed) return;
    const outcome = await onSubmit({ customerAlias: alias.trim() || DEFAULT_ALIAS, text: trimmed });
    if (outcome.ok) setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
  };

  return (
    <form onSubmit={(e) => void submit(e)} aria-label="Chat bebas" className="flex flex-col gap-2 border-t border-brand-navy/10 bg-brand-mist px-5 py-4">
      <label htmlFor="wa-alias" className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-navy/60">Chat bebas sebagai</label>
      <input id="wa-alias" data-testid={SIMULATOR.aliasInput} value={alias} maxLength={60} onChange={(e) => setAlias(e.target.value)} className={FIELD} />
      <textarea
        aria-label="Isi pesan WhatsApp"
        data-testid={SIMULATOR.textInput}
        value={text}
        rows={3}
        maxLength={500}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Contoh: Kak, pesan 2 selendang sutra + 1 sarung tenun ya"
        className={`${FIELD} resize-none`}
      />
      <button
        type="submit"
        disabled={disabled || !trimmed}
        data-testid={SIMULATOR.sendButton}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <SendHorizontal aria-hidden="true" className="h-4 w-4" />
        {disabled ? "AI Agent menganalisis pesan…" : "Kirim ke Webhook"}
      </button>
      <p className="text-[11px] text-brand-navy/50">Ctrl/⌘ + Enter untuk kirim · POST /api/v1/webhook/whatsapp</p>
    </form>
  );
}
