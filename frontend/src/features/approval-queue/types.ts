import type { ApprovalStatus } from "@/components/ui/gold-card";

export type Channel = "WhatsApp" | "Instagram DM" | "Tokopedia Chat";

export type Product = { sku: string; name: string; price: number; stock: number };

export type ChatMessage = { id: string; sender: "customer" | "bot"; text: string; at: string; draftedBy?: string };

export type OrderLine = { sku: string; quantity: number };

export type AiInsight = {
  engine: "llm" | "rule_based";
  model: string | null;
  intent: "ORDER_CREATION" | "GENERAL_QUERY";
  customerName: string | null;
  extractedProduct: string | null;
  quantity: number | null;
  confidence: number | null;
  reasoning: string;
};

export type Order = {
  id: string;
  customerAlias: string;
  channel: Channel;
  lines: OrderLine[];
  status: ApprovalStatus;
  rejectReason?: string;
  receivedAt: string;
  messages: ChatMessage[];
  aiInsight?: AiInsight;
};

export type AuditEntry = {
  id: string;
  at: string;
  actor: "human" | "agent";
  action: "APPROVE_ORDER" | "REJECT_ORDER" | "DEDUCT_STOCK" | "NOTIFY_CUSTOMER" | "INBOUND_MESSAGE" | "AI_PARSE_MESSAGE";
  orderId: string;
  before: string;
  after: string;
};

export type ActionFailure = {
  code: "INSUFFICIENT_STOCK" | "PRODUCT_NOT_FOUND" | "ORDER_NOT_PENDING" | "ORDER_NOT_PARSED";
  message: string;
  context: { operation: string; order_id: string; sku?: string };
};

export type InboundMessage = { customerAlias: string; text: string };

export type SimulationOutcome =
  | { ok: true; orderId: string; aiInsight?: AiInsight }
  | { ok: false; code: string; message: string };

export type Result<T, E extends { code: string }> = { ok: true; value: T } | { ok: false; error: E };

export type Inventory = Record<string, Product>;

export type QueueState = {
  inventory: Inventory;
  orders: Order[];
  audit: AuditEntry[];
  selectedId: string | null;
  lastFailure: ActionFailure | null;
};

export type QueueStats = {
  total: number;
  pending: number;
  pendingValue: number;
  completed: number;
  revenue: number;
};
