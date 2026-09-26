export const BRAND = {
  name: "TuntasUMKM",
  tagline: "Dari Percakapan, Jadi Penjualan.",
  colors: {
    navy: "#0F2D6B",
    blue: "#2563EB",
    green: "#10B981",
  },
  supportColors: {
    mist: "#F1F5F9",
    sky: "#DBEAFE",
    mint: "#D1FAE5",
    peach: "#FDBA8C",
  },
  uxValues: [
    "Human-In-The-Loop (HITL) approval",
    "Efisiensi operasional",
    "Keandalan real-time",
  ],
} as const;

export type BrandColor = keyof typeof BRAND.colors;
