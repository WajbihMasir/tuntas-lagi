import type {
  ActionFailure,
  AiInsight,
  AuditEntry,
  ChatMessage,
  InboundMessage,
  Inventory,
  Order,
  OrderLine,
  Product,
  QueueState,
  Result,
} from "./types";

const BACKEND_URL: string = process.env.REACT_APP_BACKEND_URL ?? "";
const BASE = `${BACKEND_URL}/api/v1`;

type OrderDTO = {
  id: string;
  customerAlias: string;
  channel: string;
  lines: OrderLine[];
  status: string;
  rejectReason: string | null;
  totalPrice: number;
  receivedAt: string;
  messages: ChatMessage[];
  aiInsight: AiInsight | null;
};

type AuditDTO = {
  id: string;
  at: string;
  actor: "human" | "agent";
  action: string;
  orderId: string;
  before: string;
  after: string;
  note: string | null;
};

type StateResponse = {
  inventory: Product[];
  orders: OrderDTO[];
  audit: AuditDTO[];
};

type FailureBody = {
  code: string;
  message: string;
  context: { operation: string; order_id: string; sku?: string };
};

const ORDER_STATUSES = ["pending_approval", "approved", "rejected"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

function toOrder(dto: OrderDTO): Order {
  const status: OrderStatus = (ORDER_STATUSES as readonly string[]).includes(dto.status)
    ? (dto.status as OrderStatus)
    : "pending_approval";
  const order: Order = {
    id: dto.id,
    customerAlias: dto.customerAlias,
    channel: dto.channel as Order["channel"],
    lines: dto.lines,
    status,
    receivedAt: dto.receivedAt,
    messages: dto.messages,
  };
  if (dto.rejectReason) order.rejectReason = dto.rejectReason;
  if (dto.aiInsight) order.aiInsight = dto.aiInsight;
  return order;
}

function toAudit(dto: AuditDTO): AuditEntry {
  return {
    id: dto.id,
    at: dto.at,
    actor: dto.actor,
    action: dto.action as AuditEntry["action"],
    orderId: dto.orderId,
    before: dto.before,
    after: dto.after,
  };
}

function toInventoryRecord(products: Product[]): Inventory {
  const out: Inventory = {};
  for (const p of products) out[p.sku] = p;
  return out;
}

function toQueueState(res: StateResponse, prevSelectedId: string | null): QueueState {
  const orders = res.orders.map(toOrder);
  const selectedId =
    prevSelectedId && orders.some((o) => o.id === prevSelectedId)
      ? prevSelectedId
      : orders.find((o) => o.status === "pending_approval")?.id ?? orders[0]?.id ?? null;
  return {
    inventory: toInventoryRecord(res.inventory),
    orders,
    audit: res.audit.map(toAudit),
    selectedId,
    lastFailure: null,
  };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text) as unknown;
}

function isFailureBody(body: unknown): body is FailureBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.code === "string" && typeof b.message === "string" && typeof b.context === "object";
}

function toFailure(body: FailureBody): ActionFailure {
  const code = body.code as ActionFailure["code"];
  return { code, message: body.message, context: body.context };
}

export async function fetchQueueState(prevSelectedId: string | null): Promise<QueueState> {
  const response = await fetch(`${BASE}/state`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`STATE_FETCH_FAILED status=${response.status}`);
  const body = (await readJson(response)) as StateResponse;
  return toQueueState(body, prevSelectedId);
}

async function mutateOrder(
  path: string,
  init: RequestInit,
  prevSelectedId: string | null,
): Promise<Result<QueueState, ActionFailure>> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) },
  });
  const body = await readJson(response);
  if (response.status === 409 && isFailureBody(body)) {
    return { ok: false, error: toFailure(body) };
  }
  if (!response.ok) {
    throw new Error(`MUTATE_FAILED status=${response.status}`);
  }
  return { ok: true, value: toQueueState(body as StateResponse, prevSelectedId) };
}

export function approveOrderApi(id: string, prevSelectedId: string | null) {
  return mutateOrder(`/orders/${encodeURIComponent(id)}/approve`, { method: "POST" }, prevSelectedId);
}

export function rejectOrderApi(id: string, reason: string, prevSelectedId: string | null) {
  return mutateOrder(
    `/orders/${encodeURIComponent(id)}/reject`,
    { method: "POST", body: JSON.stringify({ reason }) },
    prevSelectedId,
  );
}

type WebhookResponse = { ok: boolean; order: OrderDTO | null };

export async function sendWhatsappMessageApi(msg: InboundMessage): Promise<Result<Order, ActionFailure>> {
  const response = await fetch(`${BASE}/webhook/whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...msg, channel: "WhatsApp" }),
  });
  const body = await readJson(response);
  if (response.status === 409 && isFailureBody(body)) return { ok: false, error: toFailure(body) };
  const created = (body as WebhookResponse | null)?.order;
  if (!response.ok || !created) throw new Error(`WEBHOOK_FAILED status=${response.status}`);
  return { ok: true, value: toOrder(created) };
}

export async function resetDemoApi(): Promise<QueueState> {
  const response = await fetch(`${BASE}/demo/reset`, { method: "POST", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`DEMO_RESET_FAILED status=${response.status}`);
  return toQueueState((await readJson(response)) as StateResponse, null);
}
