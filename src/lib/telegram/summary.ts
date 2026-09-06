import { todayCalendarDate } from "@/lib/date";

// The text the bot actually sends for a lançamento — built here, in code,
// instead of being handed to the model as a JSON object for it to phrase.
// Two reasons, both measured against Groq's per-minute token budget:
// a ready string is a fraction of the tokens of the object it replaces
// (which was re-sent on every later step of the turn), and it lets the
// confirmation round-trip be answered without the model at all (see
// draft.ts). Consistency is the bonus: the confirmation and the "registrei"
// that follows it are now literally the same lines, so the user can compare
// them at a glance.
//
// Formatting rules mirror persona.ts: plain text, no Markdown, no emoji,
// R$ 1.234,56, day/month (year only when it isn't the current one).

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

// Reads the digits straight out of the "yyyy-MM-dd" string rather than
// parsing it into a Date — the same reasoning as parseCalendarDate in
// src/lib/date.ts, minus the need for a Date at all: there is no
// arithmetic here, only display, so no timezone can shift the day.
export function formatCalendarDay(date: string): string {
  const [year, month, day] = date.split("-");
  return year === todayCalendarDate().slice(0, 4)
    ? `${day}/${month}`
    : `${day}/${month}/${year}`;
}

export type LancamentoSummary = {
  kindLabel: string;
  description: string;
  /** Full amount, always positive — `kindLabel` carries the direction. */
  amount: number;
  installments: number;
  installmentAmount: number;
  account: string;
  /** Physical card name, on a credit-card purchase only. */
  card: string | null;
  category: string;
  /** Non-card accounts only. */
  paymentMethodLabel: string | null;
  date: string;
  pending: boolean;
  /** Already the pt-BR label ("Todo mês"), or null for a one-off. */
  recurrenceLabel: string | null;
  /** Empty when it's all the user's own; 2+ entries when it's divided. */
  people: { name: string; amount: number | null }[];
};

export function describeLancamento(summary: LancamentoSummary): string {
  const lines = [
    `${summary.kindLabel}: ${summary.description} - ${formatMoney(summary.amount)}` +
      (summary.installments > 1
        ? ` em ${summary.installments}x de ${formatMoney(summary.installmentAmount)}`
        : ""),
    [
      summary.card
        ? `${summary.account} (cartão ${summary.card})`
        : summary.paymentMethodLabel
          ? `${summary.account} (${summary.paymentMethodLabel})`
          : summary.account,
      summary.category,
    ].join(" - "),
    [
      formatCalendarDay(summary.date),
      summary.recurrenceLabel,
      summary.pending ? "Pendente" : null,
    ]
      .filter(Boolean)
      .join(" - "),
  ];

  const divided = summary.people.filter((person) => person.amount !== null);
  if (divided.length > 0) {
    lines.push(
      `Divisão: ${divided
        .map((person) => `${person.name} ${formatMoney(person.amount ?? 0)}`)
        .join(", ")}`,
    );
  } else if (summary.people.length === 1) {
    lines.push(`De: ${summary.people[0].name}`);
  }

  return lines.join("\n");
}

export function askToConfirm(summary: LancamentoSummary): string {
  return `${describeLancamento(summary)}\n\nPosso registrar?`;
}

export function confirmedLancamento(
  summary: LancamentoSummary,
  extra: { generated?: number; invoiceDueDates?: string[] } = {},
): string {
  const lines = [`Registrei:\n${describeLancamento(summary)}`];

  if (extra.generated) {
    lines.push(`Já deixei ${extra.generated} lançamentos gerados.`);
  }

  const dueDates = extra.invoiceDueDates ?? [];
  if (dueDates.length === 1) {
    lines.push(`Cai na fatura que vence em ${formatCalendarDay(dueDates[0])}.`);
  } else if (dueDates.length > 1) {
    lines.push(
      `Parcelas nas faturas de ${formatCalendarDay(dueDates[0])} a ${formatCalendarDay(
        dueDates[dueDates.length - 1],
      )}.`,
    );
  }

  return lines.join("\n");
}
