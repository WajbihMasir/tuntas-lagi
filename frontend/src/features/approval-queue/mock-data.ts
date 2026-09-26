import type { ChatMessage, Inventory, Order, QueueState } from "./types";

const PRODUCTS = [
  { sku: "BTK-KRS-01", name: "Batik Keris Tulis Sogan", price: 450000, stock: 12 },
  { sku: "BTK-PKL-02", name: "Batik Pekalongan Cap", price: 275000, stock: 8 },
  { sku: "KBY-ENC-03", name: "Kebaya Encim Bordir", price: 385000, stock: 2 },
  { sku: "SRG-TNN-04", name: "Sarung Tenun Samarinda", price: 520000, stock: 5 },
  { sku: "SLD-SUT-05", name: "Selendang Sutra Garut", price: 180000, stock: 20 },
];

const INVENTORY: Inventory = Object.fromEntries(PRODUCTS.map((p) => [p.sku, p]));

function chat(orderId: string, script: Array<[ChatMessage["sender"], string, string]>): ChatMessage[] {
  return script.map(([sender, text, at], i) => ({ id: `${orderId}-m${i}`, sender, text, at }));
}

const ORDERS: Order[] = [
  {
    id: "ORD-2406-001", customerAlias: "Rina S. (sintetis)", channel: "WhatsApp", status: "pending_approval",
    lines: [{ sku: "BTK-KRS-01", quantity: 1 }], receivedAt: "2026-06-12T02:41:00Z",
    messages: chat("ORD-2406-001", [
      ["customer", "Halo kak, Batik Keris Tulis Sogan ukuran L masih ada?", "2026-06-12T02:38:00Z"],
      ["bot", "Masih ada, Kak. Harganya Rp 450.000. Mau dipesan 1 potong?", "2026-06-12T02:38:20Z"],
      ["customer", "Iya kak, 1 ya. Kirim ke Solo, transfer BCA.", "2026-06-12T02:40:10Z"],
      ["bot", "Draft pesanan sudah dibuat dan menunggu konfirmasi pemilik toko.", "2026-06-12T02:41:00Z"],
    ]),
  },
  {
    id: "ORD-2406-002", customerAlias: "Dimas P. (sintetis)", channel: "Instagram DM", status: "pending_approval",
    lines: [{ sku: "BTK-PKL-02", quantity: 2 }, { sku: "SLD-SUT-05", quantity: 1 }], receivedAt: "2026-06-12T03:05:00Z",
    messages: chat("ORD-2406-002", [
      ["customer", "Kak, mau 2 batik pekalongan cap + 1 selendang sutra buat seserahan.", "2026-06-12T03:02:00Z"],
      ["bot", "Siap, Kak. Totalnya Rp 730.000. Draft sedang dicek pemilik toko ya.", "2026-06-12T03:05:00Z"],
    ]),
  },
  {
    id: "ORD-2406-003", customerAlias: "Sari W. (sintetis)", channel: "WhatsApp", status: "pending_approval",
    lines: [{ sku: "KBY-ENC-03", quantity: 3 }], receivedAt: "2026-06-12T03:22:00Z",
    messages: chat("ORD-2406-003", [
      ["customer", "Kebaya encim bordir yang hijau 3 pcs bisa kak? Buat acara keluarga.", "2026-06-12T03:20:00Z"],
      ["bot", "Terima kasih, Kak. Pesanan 3 pcs sedang dicek ketersediaannya oleh pemilik toko.", "2026-06-12T03:22:00Z"],
    ]),
  },
  {
    id: "ORD-2406-004", customerAlias: "Budi H. (sintetis)", channel: "Tokopedia Chat", status: "pending_approval",
    lines: [{ sku: "SRG-TNN-04", quantity: 1 }], receivedAt: "2026-06-12T03:47:00Z",
    messages: chat("ORD-2406-004", [
      ["customer", "Sarung tenun samarinda motif hitam ready? Bisa COD?", "2026-06-12T03:45:00Z"],
      ["bot", "Ready, Kak. Untuk COD perlu konfirmasi pemilik toko dulu ya.", "2026-06-12T03:47:00Z"],
    ]),
  },
  {
    id: "ORD-2406-005", customerAlias: "Lala K. (sintetis)", channel: "WhatsApp", status: "approved",
    lines: [{ sku: "SLD-SUT-05", quantity: 2 }], receivedAt: "2026-06-12T01:10:00Z",
    messages: chat("ORD-2406-005", [
      ["customer", "Selendang sutra 2 ya kak, warna marun.", "2026-06-12T01:08:00Z"],
      ["bot", "Pesanan dikonfirmasi. Invoice Rp 360.000 sudah dikirim, Kak.", "2026-06-12T01:15:00Z"],
    ]),
  },
  {
    id: "ORD-2406-006", customerAlias: "Andi R. (sintetis)", channel: "Instagram DM", status: "rejected",
    rejectReason: "Alamat di luar jangkauan kurir", lines: [{ sku: "BTK-KRS-01", quantity: 1 }], receivedAt: "2026-06-12T00:52:00Z",
    messages: chat("ORD-2406-006", [
      ["customer", "Batik keris 1, kirim ke pulau terpencil bisa?", "2026-06-12T00:50:00Z"],
      ["bot", "Mohon maaf, Kak. Pesanan dibatalkan: Alamat di luar jangkauan kurir.", "2026-06-12T00:58:00Z"],
    ]),
  },
];

export const INITIAL_QUEUE: QueueState = {
  inventory: INVENTORY,
  orders: ORDERS,
  audit: [],
  selectedId: "ORD-2406-001",
  lastFailure: null,
};
