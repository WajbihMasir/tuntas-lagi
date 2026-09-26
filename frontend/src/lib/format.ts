const RUPIAH = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const CLOCK = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" });

export function formatRupiah(amount: number): string {
  return RUPIAH.format(amount);
}

export function formatClock(iso: string): string {
  return CLOCK.format(new Date(iso));
}
