import { Bot, Sparkles, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/format";
import { APPROVAL, chatDraftBadgeId, chatMessageId } from "@/constants/testIds";
import type { ChatMessage, Order } from "../types";

function DraftBadge({ message }: { message: ChatMessage & { draftedBy: string } }) {
  const isLlm = message.draftedBy.startsWith("llm:");
  return (
    <span data-testid={chatDraftBadgeId(message.id)} className={cn("mb-1 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]", isLlm ? "bg-brand-peach text-brand-navy" : "bg-white/15 text-white/80")}>
      {isLlm ? <Sparkles aria-hidden="true" className="h-2.5 w-2.5" /> : null}
      {isLlm ? `AI Draft · ${message.draftedBy.slice(4)}` : "Template"}
    </span>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isBot = message.sender === "bot";
  const Icon = isBot ? Bot : UserRound;
  return (
    <li data-testid={chatMessageId(message.id)} data-sender={message.sender} className={cn("flex max-w-[85%] gap-2", isBot ? "self-end flex-row-reverse" : "self-start")}>
      <Icon aria-hidden="true" className={cn("mt-1 h-4 w-4 shrink-0", isBot ? "text-brand-blue" : "text-brand-navy/50")} />
      <p className={cn("rounded-lg px-3 py-2 text-sm leading-relaxed", isBot ? "rounded-tr-sm bg-brand-navy text-white" : "rounded-tl-sm bg-brand-mist text-brand-navy")}>
        {message.draftedBy && <DraftBadge message={{ ...message, draftedBy: message.draftedBy }} />}
        <span className="block">{message.text}</span>
        <time dateTime={message.at} className="mt-1 block text-[10px] font-mono tabular-nums opacity-60">{formatClock(message.at)}</time>
      </p>
    </li>
  );
}

export function LiveChatPreview({ order }: { order: Order }) {
  return (
    <section data-testid={APPROVAL.chatPreview} aria-labelledby="chat-heading" className="flex flex-col rounded-lg bg-white shadow-brand-rest">
      <header className="flex items-center justify-between border-b border-brand-navy/10 px-5 py-4">
        <h2 id="chat-heading" className="font-display text-base font-bold text-brand-navy">{order.customerAlias}</h2>
        <p className="flex items-center gap-2 text-xs font-medium text-brand-navy/60">
          <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-[2px] bg-brand-green motion-reduce:animate-none" />
          Live via {order.channel}
        </p>
      </header>
      <ol data-testid={APPROVAL.chatLog} aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-5 lg:max-h-[440px]">
        {order.messages.map((m) => <ChatBubble key={m.id} message={m} />)}
      </ol>
      <footer className="border-t border-brand-navy/10 px-5 py-3 text-xs text-brand-navy/50">
        Bot hanya membalas otomatis setelah pemilik toko memberi keputusan (HITL).
      </footer>
    </section>
  );
}
