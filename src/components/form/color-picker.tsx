import { cn } from "@/lib/utils";

type ColorOption = {
  name: string;
  class: string;
  badgeClass: string;
};

export const AVAILABLE_COLORS: ColorOption[] = [
  {
    name: "orange",
    class:
      "bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400",
    badgeClass: "bg-orange-500",
  },
  {
    name: "purple",
    class:
      "bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400",
    badgeClass: "bg-purple-500",
  },
  {
    name: "indigo",
    class:
      "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400",
    badgeClass: "bg-indigo-500",
  },
  {
    name: "emerald",
    class:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
    badgeClass: "bg-emerald-500",
  },
  {
    name: "teal",
    class: "bg-teal-100 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400",
    badgeClass: "bg-teal-500",
  },
  {
    name: "sky",
    class: "bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400",
    badgeClass: "bg-sky-500",
  },
  {
    name: "blue",
    class: "bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400",
    badgeClass: "bg-blue-500",
  },
  {
    name: "rose",
    class: "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
    badgeClass: "bg-rose-500",
  },
  {
    name: "red",
    class: "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400",
    badgeClass: "bg-red-500",
  },
  {
    name: "amber",
    class:
      "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
    badgeClass: "bg-amber-500",
  },
  {
    name: "yellow",
    class:
      "bg-yellow-100 text-yellow-600 dark:bg-yellow-950/60 dark:text-yellow-400",
    badgeClass: "bg-yellow-500",
  },
  {
    name: "lime",
    class: "bg-lime-100 text-lime-600 dark:bg-lime-950/60 dark:text-lime-400",
    badgeClass: "bg-lime-500",
  },
  {
    name: "green",
    class:
      "bg-green-100 text-green-600 dark:bg-green-950/60 dark:text-green-400",
    badgeClass: "bg-green-500",
  },
  {
    name: "cyan",
    class: "bg-cyan-100 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400",
    badgeClass: "bg-cyan-500",
  },
  {
    name: "violet",
    class:
      "bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400",
    badgeClass: "bg-violet-500",
  },
  {
    name: "fuchsia",
    class:
      "bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-950/60 dark:text-fuchsia-400",
    badgeClass: "bg-fuchsia-500",
  },
  // Inverted (dark bg/light text) rather than the light-100-tint pattern
  // every other entry uses — there's no sensible "light black" tint, and
  // a black card/category tile is naturally meant to read as solid dark
  // in both themes, not lighten in light mode like the others.
  {
    name: "black",
    class: "bg-neutral-900 text-neutral-100 dark:bg-neutral-950 dark:text-neutral-300",
    badgeClass: "bg-neutral-900",
  },
  {
    name: "pink",
    class: "bg-pink-100 text-pink-600 dark:bg-pink-950/60 dark:text-pink-400",
    badgeClass: "bg-pink-500",
  },
  {
    name: "slate",
    class:
      "bg-slate-100 text-slate-600 dark:bg-slate-950/60 dark:text-slate-400",
    badgeClass: "bg-slate-500",
  },
  {
    name: "gray",
    class: "bg-gray-100 text-gray-600 dark:bg-gray-950/60 dark:text-gray-400",
    badgeClass: "bg-gray-500",
  },
  {
    name: "zinc",
    class: "bg-zinc-100 text-zinc-600 dark:bg-zinc-950/60 dark:text-zinc-400",
    badgeClass: "bg-zinc-500",
  },
  {
    name: "neutral",
    class:
      "bg-neutral-100 text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-400",
    badgeClass: "bg-neutral-500",
  },
  {
    name: "stone",
    class:
      "bg-stone-100 text-stone-600 dark:bg-stone-950/60 dark:text-stone-400",
    badgeClass: "bg-stone-500",
  },
  // Inverted like "black" above.
  {
    name: "white",
    class: "bg-white text-neutral-700 dark:bg-neutral-100 dark:text-neutral-800",
    badgeClass: "bg-white",
  },
  // Tailwind's default palette tops out at 22 named hues (already used
  // above, black/white included) — these last six are one-off named
  // colors outside that palette (arbitrary hex values), the same
  // "decorative, user-chosen color" exception AGENTS.md carves out for
  // this exact picker. Each pairs a light bg tint with a hand-picked
  // lighter shade for dark-mode text, since arbitrary hex has no built-in
  // shade scale to draw one from automatically.
  {
    name: "brown",
    class: "bg-[#8B5E3C]/15 text-[#8B5E3C] dark:bg-[#8B5E3C]/30 dark:text-[#c9a67c]",
    badgeClass: "bg-[#8B5E3C]",
  },
  {
    name: "navy",
    class: "bg-[#1E3A5F]/15 text-[#1E3A5F] dark:bg-[#1E3A5F]/30 dark:text-[#7fa8d1]",
    badgeClass: "bg-[#1E3A5F]",
  },
  {
    name: "maroon",
    class: "bg-[#7B2D26]/15 text-[#7B2D26] dark:bg-[#7B2D26]/30 dark:text-[#d98c85]",
    badgeClass: "bg-[#7B2D26]",
  },
  {
    name: "olive",
    class: "bg-[#6B7A3D]/15 text-[#6B7A3D] dark:bg-[#6B7A3D]/30 dark:text-[#b3c17a]",
    badgeClass: "bg-[#6B7A3D]",
  },
  {
    name: "turquoise",
    class: "bg-[#1FB6A8]/15 text-[#1FB6A8] dark:bg-[#1FB6A8]/30 dark:text-[#7fe0d6]",
    badgeClass: "bg-[#1FB6A8]",
  },
  {
    name: "coral",
    class: "bg-[#FF6F59]/15 text-[#FF6F59] dark:bg-[#FF6F59]/30 dark:text-[#ffb3a3]",
    badgeClass: "bg-[#FF6F59]",
  },
];

export function ColorPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      {AVAILABLE_COLORS.map((col) => (
        <button
          key={col.name}
          type="button"
          onClick={() => onChange(col.class)}
          className={cn(
            // A plain `border` (not another `ring-*`) around every swatch,
            // not just white — several colors (white, yellow, lime, the
            // lightest tints) otherwise blend into the picker's own
            // background with nothing to define their edge.
            "w-7 h-7 rounded-full border border-black/10 dark:border-white/10 ring-2 ring-offset-2 transition-all active:scale-95",
            col.badgeClass,
            value === col.class
              ? "ring-slate-900 dark:ring-slate-100"
              : "ring-transparent hover:scale-110",
          )}
        />
      ))}
    </div>
  );
}
