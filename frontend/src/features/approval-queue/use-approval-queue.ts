import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { approveOrderApi, fetchQueueState, rejectOrderApi, resetDemoApi, sendWhatsappMessageApi } from "./api-client";
import { computeStats } from "./order-math";
import type { InboundMessage, QueueState, QueueStats, SimulationOutcome } from "./types";

const EMPTY_STATE: QueueState = {
  inventory: {},
  orders: [],
  audit: [],
  selectedId: null,
  lastFailure: null,
};

const POLL_INTERVAL_MS = 3000;

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function useApprovalQueue() {
  const [state, setState] = useState<QueueState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = state.selectedId;

  const load = useCallback(async () => {
    try {
      const next = await fetchQueueState(selectedIdRef.current);
      setState(next);
      setError(null);
    } catch (err) {
      setError(errorText(err, "STATE_FETCH_FAILED"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const selected = state.orders.find((o) => o.id === state.selectedId) ?? null;
  const stats: QueueStats = useMemo(
    () => computeStats(state.orders, state.inventory),
    [state.orders, state.inventory],
  );

  const select = useCallback((id: string) => {
    setState((s) => ({ ...s, selectedId: id, lastFailure: null }));
  }, []);

  const runDecision = useCallback(
    async (id: string, call: () => ReturnType<typeof approveOrderApi>, successText: string): Promise<boolean> => {
      try {
        const result = await call();
        if (result.ok) {
          setState(result.value);
          toast.success(successText);
          return true;
        }
        setState((s) => ({ ...s, lastFailure: result.error }));
        toast.error(`${result.error.code}: ${result.error.message}`);
        return false;
      } catch (err) {
        toast.error(`NETWORK_ERROR: ${errorText(err, "DECISION_FAILED")} (${id})`);
        return false;
      }
    },
    [],
  );

  const approve = useCallback(
    (id: string) =>
      runDecision(id, () => approveOrderApi(id, selectedIdRef.current), `${id} disetujui. Stok dipotong & notifikasi terkirim.`),
    [runDecision],
  );

  const reject = useCallback(
    (id: string, reason: string) =>
      runDecision(id, () => rejectOrderApi(id, reason, selectedIdRef.current), `${id} dibatalkan. Customer sudah diberi tahu.`),
    [runDecision],
  );

  const simulateInbound = useCallback(
    async (msg: InboundMessage): Promise<SimulationOutcome> => {
      try {
        const result = await sendWhatsappMessageApi(msg);
        if (!result.ok) {
          toast.error(`${result.error.code}: ${result.error.message}`);
          return { ok: false, code: result.error.code, message: result.error.message };
        }
        selectedIdRef.current = result.value.id;
        await load();
        toast.success(`Pesan WhatsApp masuk. ${result.value.id} menunggu approval.`);
        return { ok: true, orderId: result.value.id, aiInsight: result.value.aiInsight };
      } catch (err) {
        const message = errorText(err, "WEBHOOK_FAILED");
        toast.error(`NETWORK_ERROR: ${message}`);
        return { ok: false, code: "NETWORK_ERROR", message };
      }
    },
    [load],
  );

  const resetDemo = useCallback(async (): Promise<boolean> => {
    try {
      setState(await resetDemoApi());
      toast.success("Data demo dikembalikan ke kondisi awal (seed).");
      return true;
    } catch (err) {
      toast.error(`DEMO_RESET_FAILED: ${errorText(err, "unknown")}`);
      return false;
    }
  }, []);

  return { state, selected, stats, loading, error, select, approve, reject, refresh: load, simulateInbound, resetDemo };
}
