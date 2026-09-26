import type { ApprovalStatus } from "@/components/ui/gold-card";

export const STATUS_TONE: Record<ApprovalStatus, { label: string; marker: string }> = {
  pending_approval: { label: "Menunggu", marker: "bg-brand-blue" },
  approved: { label: "Approved", marker: "bg-brand-green" },
  rejected: { label: "Rejected", marker: "bg-destructive" },
};
