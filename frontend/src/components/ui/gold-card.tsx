import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { AlertTriangle, Inbox, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

export type ApprovalStatus = "pending_approval" | "approved" | "rejected";

export type GoldCardFailure = {
  code: string;
  message: string;
};

export type GoldCardState =
  | { status: "loading" }
  | { status: "empty"; message: string }
  | { status: "error"; failure: GoldCardFailure; onRetry?: () => void }
  | { status: "success"; approval: ApprovalStatus };

type Tone = { rail: string; marker: string; label: string };

const APPROVAL_TONE: Record<ApprovalStatus, Tone> = {
  pending_approval: { rail: "border-l-brand-blue", marker: "bg-brand-blue", label: "Menunggu approval" },
  approved: { rail: "border-l-brand-green", marker: "bg-brand-green", label: "Disetujui" },
  rejected: { rail: "border-l-destructive", marker: "bg-destructive", label: "Ditolak" },
};

const STATE_RAIL: Record<Exclude<GoldCardState["status"], "success">, string> = {
  loading: "border-l-brand-sky",
  empty: "border-l-brand-navy/20",
  error: "border-l-destructive",
};

function railFor(state: GoldCardState): string {
  return state.status === "success" ? APPROVAL_TONE[state.approval].rail : STATE_RAIL[state.status];
}

function ApprovalMarker({ approval, testId }: { approval: ApprovalStatus; testId: string }) {
  const tone = APPROVAL_TONE[approval];
  return (
    <p
      data-testid={`${testId}-approval`}
      className="mt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/70"
    >
      <span aria-hidden="true" className={cn("h-2 w-2 rounded-[2px]", tone.marker)} />
      {tone.label}
    </p>
  );
}

function GoldCardSkeleton() {
  const bar = "block h-3 animate-pulse rounded-sm bg-brand-mist motion-reduce:animate-none";
  return (
    <>
      <p className="sr-only">Memuat antrean approval</p>
      <span aria-hidden="true" className="flex flex-col gap-2">
        <span className={cn(bar, "w-2/3")} />
        <span className={cn(bar, "w-1/2")} />
        <span className={cn(bar, "w-5/6")} />
      </span>
    </>
  );
}

function GoldCardEmpty({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-3 text-sm text-brand-navy/70">
      <Inbox aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-blue" />
      {message}
    </p>
  );
}

type GoldCardErrorProps = { failure: GoldCardFailure; onRetry?: () => void; testId: string };

function GoldCardError({ failure, onRetry, testId }: GoldCardErrorProps) {
  return (
    <div role="alert" data-testid={`${testId}-error`} className="flex flex-col items-start gap-3">
      <p className="flex items-start gap-3 text-sm text-destructive">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <code className="font-mono text-xs font-semibold">{failure.code}</code> {failure.message}
        </span>
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          data-testid={`${testId}-retry-button`}
          className="inline-flex items-center gap-2 rounded-md bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 active:scale-[0.97]"
        >
          <RotateCw aria-hidden="true" className="h-3.5 w-3.5" />
          Coba lagi
        </button>
      )}
    </div>
  );
}

function GoldCardBody({ state, children, testId }: { state: GoldCardState; children?: ReactNode; testId: string }): ReactElement {
  switch (state.status) {
    case "loading":
      return <GoldCardSkeleton />;
    case "empty":
      return <GoldCardEmpty message={state.message} />;
    case "error":
      return <GoldCardError failure={state.failure} onRetry={state.onRetry} testId={testId} />;
    case "success":
      return <>{children}</>;
  }
}

export interface GoldCardProps extends Omit<HTMLAttributes<HTMLElement>, "title" | "children"> {
  heading: string;
  reference?: string;
  state: GoldCardState;
  children?: ReactNode;
  actions?: ReactNode;
  testId?: string;
}

const ARTICLE_BASE =
  "rounded-lg border border-l-4 border-brand-navy/10 bg-white p-5 text-brand-navy shadow-brand-rest " +
  "transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-brand-lift " +
  "focus-within:ring-2 focus-within:ring-brand-blue/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0";

export function GoldCard({ heading, reference, state, children, actions, testId = "gold-card", className, ...rest }: GoldCardProps) {
  return (
    <article
      data-testid={testId}
      data-state={state.status}
      aria-busy={state.status === "loading"}
      className={cn(ARTICLE_BASE, railFor(state), className)}
      {...rest}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-semibold tracking-tight">{heading}</h3>
        {reference && <p className="font-mono text-xs tabular-nums text-brand-navy/60">{reference}</p>}
      </header>
      {state.status === "success" && <ApprovalMarker approval={state.approval} testId={testId} />}
      <section aria-live="polite" data-testid={`${testId}-body`} className="mt-4 text-sm">
        <GoldCardBody state={state} testId={testId}>{children}</GoldCardBody>
      </section>
      {state.status === "success" && actions && (
        <footer className="mt-5 flex flex-wrap gap-2 border-t border-brand-navy/10 pt-4">{actions}</footer>
      )}
    </article>
  );
}
