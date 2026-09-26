import { Send } from "lucide-react";
import { simulatorPresetId } from "@/constants/testIds";
import { PRESETS, type SimulatorPreset } from "./presets";

type PresetListProps = { disabled: boolean; onPick: (preset: SimulatorPreset) => void };

export function PresetList({ disabled, onPick }: PresetListProps) {
  return (
    <section aria-labelledby="wa-preset-heading" className="px-5 pb-2 pt-5">
      <h3 id="wa-preset-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-navy/60">Preset cepat</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {PRESETS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={disabled}
              data-testid={simulatorPresetId(p.id)}
              onClick={() => onPick(p)}
              className="group flex w-full items-start gap-3 rounded-md border border-brand-navy/10 bg-white px-3 py-3 text-left transition-[background-color,border-color,transform] duration-150 ease-out hover:border-brand-blue hover:bg-brand-sky/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <p.Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-brand-navy">{p.label}</span>
                <span className="mt-0.5 block text-xs text-brand-navy/60">&ldquo;{p.text}&rdquo;</span>
                <span className="mt-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-brand-navy/40">{p.hint}</span>
              </span>
              <Send aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-navy/30 transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-brand-blue" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
