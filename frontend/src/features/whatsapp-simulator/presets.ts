import { PackageCheck, PackageX, type LucideIcon } from "lucide-react";

export type SimulatorPreset = {
  id: "valid-order" | "low-stock";
  label: string;
  hint: string;
  customerAlias: string;
  text: string;
  Icon: LucideIcon;
};

export const DEFAULT_ALIAS = "Pelanggan WA (sintetis)";

export const PRESETS: SimulatorPreset[] = [
  {
    id: "valid-order",
    label: "Kirim Order Valid",
    hint: "Stok cukup, siap di-Approve",
    customerAlias: "Maya A. (sintetis)",
    text: "Halo Kak, saya mau pesan Batik Keris 1 pcs kirim ke Jakarta.",
    Icon: PackageCheck,
  },
  {
    id: "low-stock",
    label: "Kirim Order Stok Kurang",
    hint: "Approve akan memicu INSUFFICIENT_STOCK",
    customerAlias: "Tono B. (sintetis)",
    text: "Saya mau pesan Kebaya Batik 10 pcs ya.",
    Icon: PackageX,
  },
];
