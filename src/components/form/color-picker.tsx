import { cn } from "@/lib/utils";

export const AVAILABLE_COLORS = [
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
            "w-7 h-7 rounded-full ring-2 ring-offset-2 transition-all active:scale-95",
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
