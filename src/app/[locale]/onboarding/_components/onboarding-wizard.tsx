"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon, SpinnerIcon } from "@phosphor-icons/react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createAccount } from "@/app/[locale]/(app)/accounts/actions";
import { createCreditCardAccount } from "@/app/[locale]/(app)/cards/actions";
import { createCategory } from "@/app/[locale]/(app)/categories/actions";
import { createPerson } from "@/app/[locale]/(app)/people/actions";
import { createBudget, createBudgetGroup } from "@/app/[locale]/(app)/budgets/actions";
import type { CategoryRow } from "@/app/[locale]/(app)/categories/_types/types";
import { ONBOARDING_STEPS } from "../_constants/steps";
import { OnboardingSidebar } from "./onboarding-sidebar";
import { AccountStep, type OnboardingAccount } from "./steps/account-step";
import { CardsStep, type OnboardingCard } from "./steps/cards-step";
import { CategoriesStep, type OnboardingCategory } from "./steps/categories-step";
import { PeopleStep, type OnboardingPerson } from "./steps/people-step";
import { BudgetStep, type OnboardingBudget } from "./steps/budget-step";

const DRAFT_KEY = "fi-sync:onboarding-draft";
const TOTAL_STEPS = ONBOARDING_STEPS.length;

type Draft = {
  step: number;
  accounts: OnboardingAccount[];
  cards: OnboardingCard[];
  categories: OnboardingCategory[];
  people: OnboardingPerson[];
  budget: OnboardingBudget;
};

const EMPTY_DRAFT: Draft = {
  step: 0,
  accounts: [],
  cards: [],
  categories: [],
  people: [],
  budget: { expectedIncome: "", items: [], groups: [] },
};

type OnboardingWizardProps = {
  seededCategories: CategoryRow[];
  monthKey: string;
};

// Accumulates everything across steps in plain lifted state (no new state
// library — see plan) and only writes to the database once, on the final
// step's "Concluir", via the same real Server Actions the individual
// screens already use. A thin localStorage read/write survives a
// mid-wizard refresh, playing the same role the reference
// implementation's persisted Zustand store does, without adding one.
export function OnboardingWizard({ seededCategories, monthKey }: OnboardingWizardProps) {
  const t = useTranslations("scrn-onboarding");
  const router = useRouter();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // One-time hydration from localStorage on mount — can't use a lazy
    // useState initializer instead, since that runs during SSR too
    // (where localStorage doesn't exist) and would cause a hydration
    // mismatch against the server-rendered empty draft.
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (stored) {
        const parsed: Draft = JSON.parse(stored);
        // A draft saved before OnboardingCategory grew its `id` field
        // (crypto.randomUUID(), see categories-step.tsx) would otherwise
        // hydrate with `id: undefined`/`""` on every custom category —
        // BudgetStep's own category picker keys off that id, so a stale
        // draft like this produced duplicate/undefined React keys there.
        // Backfilling a fresh id here is only half the fix: any budget
        // item already referencing the old (missing) id has to be
        // remapped to the new one in the same pass, or that item
        // silently becomes unresolvable at final submit (its
        // categoryId matches nothing, so goNextOrFinish's own
        // validCategoryIds filter drops it and the whole budget can end
        // up with zero valid items — this was a real, verified bug: a
        // category added under an older draft shape saved fine on
        // finish, but the budget limit set for it never did, with no
        // error surfaced anywhere).
        const idRemap = new Map<string, string>();
        const categories = parsed.categories.map((category) => {
          if (category.id) return category;
          const newId = crypto.randomUUID();
          idRemap.set(category.id, newId);
          return { ...category, id: newId };
        });
        // Also backfills a draft saved before OnboardingBudget grew its
        // own `groups` field / OnboardingBudgetItem grew `groupId`.
        const budget = {
          ...parsed.budget,
          groups: parsed.budget.groups ?? [],
          items: parsed.budget.items.map((item) => ({
            ...item,
            groupId: item.groupId ?? "",
            categoryId: idRemap.get(item.categoryId) ?? item.categoryId,
          })),
        };
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraft({ ...parsed, categories, budget });
      }
    } catch {
      // Corrupted/unavailable storage — start fresh rather than block.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Storage full/unavailable (private browsing, etc.) — the wizard
      // still works in-memory for this session, just without resume.
    }
  }, [draft]);

  const { step, accounts, cards, categories, people, budget } = draft;
  const stepKey = ONBOARDING_STEPS[step].key;
  const canGoNext = stepKey !== "account" || accounts.length > 0;
  const isLastStep = step === TOTAL_STEPS - 1;

  function goBack() {
    setDraft((prev) => ({ ...prev, step: Math.max(0, prev.step - 1) }));
  }

  async function goNextOrFinish() {
    if (!isLastStep) {
      setDraft((prev) => ({ ...prev, step: prev.step + 1 }));
      return;
    }

    setIsSubmitting(true);
    try {
      for (const account of accounts) {
        const result = await createAccount(account);
        if (result.error) throw new Error(result.error);
      }
      for (const card of cards) {
        const result = await createCreditCardAccount(card);
        if (result.error) throw new Error(result.error);
      }
      // Maps each custom category's temporary draft id (see
      // OnboardingCategory's own comment) to the real Category id
      // createCategory just created it under — budget.items below may
      // reference one of these draft ids if the user gave it a limit in
      // the budget step before this final submit ever ran.
      const categoryIdMap = new Map<string, string>();
      for (const category of categories) {
        const result = await createCategory(category);
        if (result.error) throw new Error(result.error);
        if (result.category) categoryIdMap.set(category.id, result.category.id);
      }
      for (const person of people) {
        const result = await createPerson({
          name: person.name,
          phone: person.phone,
          colorStyle: person.colorStyle,
        });
        if (result.error) throw new Error(result.error);
      }
      // Same temp-id-to-real-id remap as categories above, for any group
      // the user created in the budget step's own mini "Grupos" manager
      // — a BudgetGroup only really exists once createBudgetGroup runs
      // here at final submit.
      const groupIdMap = new Map<string, string>();
      for (const group of budget.groups) {
        const result = await createBudgetGroup({ name: group.name });
        if (result.error) throw new Error(result.error);
        if (result.id) groupIdMap.set(group.id, result.id);
      }

      // A budget item can still reference a draft category the user
      // removed from the categories step after giving it a limit here
      // (BudgetStep itself just stops rendering that row, but the stale
      // reference lingers in `budget.items` until now) — dropped rather
      // than sent to createBudget, which would otherwise fail on a
      // categoryId that was never created. Same for an item the user
      // added (e.g. via a quick-add chip) but never actually typed an
      // amount for — budgetSchema (budgets/_schema/schema.ts) requires a
      // non-empty `limit` on every item, so one blank row would otherwise
      // fail validation and abort the entire onboarding finish. This step
      // is optional, so an incomplete row is silently dropped rather than
      // blocking everything else that already saved successfully above.
      const validCategoryIds = new Set([
        ...seededCategories.map((c) => c.id),
        ...categoryIdMap.values(),
      ]);
      const validItems = budget.items
        .filter((item) => item.limit.trim() !== "")
        .map((item) => ({
          ...item,
          categoryId: categoryIdMap.get(item.categoryId) ?? item.categoryId,
          // Same "silently drop rather than fail" treatment as an
          // orphaned categoryId — a group removed from the draft after
          // an item pointed at it just ungroups that item instead of
          // blocking the whole submit.
          groupId: item.groupId ? groupIdMap.get(item.groupId) : undefined,
        }))
        .filter((item) => validCategoryIds.has(item.categoryId));

      if (budget.expectedIncome.trim() !== "" && validItems.length > 0) {
        const result = await createBudget(monthKey, {
          expectedIncome: budget.expectedIncome,
          items: validItems,
        });
        if (result.error) throw new Error(result.error);
      }

      localStorage.removeItem(DRAFT_KEY);
      router.push("/");
    } catch {
      toast.error(t("errors.submit.title"));
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-svh w-full bg-background">
      <OnboardingSidebar step={step} />

      <main className="flex flex-1 flex-col overflow-y-auto p-6 sm:p-10">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("stepIndicator", { current: step + 1, total: TOTAL_STEPS })}
            </p>
            <h1 className="text-2xl font-bold">{t(`steps.${stepKey}.title`)}</h1>
            <p className="text-sm text-muted-foreground">
              {t(`steps.${stepKey}.description`)}
            </p>
          </div>

          <div className="flex-1">
            {stepKey === "account" && (
              <AccountStep
                accounts={accounts}
                onAdd={(account) =>
                  setDraft((prev) => ({ ...prev, accounts: [...prev.accounts, account] }))
                }
                onUpdate={(index, account) =>
                  setDraft((prev) => ({
                    ...prev,
                    accounts: prev.accounts.map((a, i) => (i === index ? account : a)),
                  }))
                }
                onRemove={(index) =>
                  setDraft((prev) => ({
                    ...prev,
                    accounts: prev.accounts.filter((_, i) => i !== index),
                  }))
                }
              />
            )}
            {stepKey === "cards" && (
              <CardsStep
                cards={cards}
                onAdd={(card) =>
                  setDraft((prev) => ({ ...prev, cards: [...prev.cards, card] }))
                }
                onUpdate={(index, card) =>
                  setDraft((prev) => ({
                    ...prev,
                    cards: prev.cards.map((c, i) => (i === index ? card : c)),
                  }))
                }
                onRemove={(index) =>
                  setDraft((prev) => ({
                    ...prev,
                    cards: prev.cards.filter((_, i) => i !== index),
                  }))
                }
              />
            )}
            {stepKey === "categories" && (
              <CategoriesStep
                seededCategories={seededCategories}
                categories={categories}
                onAdd={(category) =>
                  setDraft((prev) => ({
                    ...prev,
                    categories: [...prev.categories, category],
                  }))
                }
                onUpdate={(index, category) =>
                  setDraft((prev) => ({
                    ...prev,
                    categories: prev.categories.map((c, i) =>
                      i === index ? category : c,
                    ),
                  }))
                }
                onRemove={(index) =>
                  setDraft((prev) => ({
                    ...prev,
                    categories: prev.categories.filter((_, i) => i !== index),
                  }))
                }
              />
            )}
            {stepKey === "people" && (
              <PeopleStep
                people={people}
                onAdd={(person) =>
                  setDraft((prev) => ({ ...prev, people: [...prev.people, person] }))
                }
                onUpdate={(index, person) =>
                  setDraft((prev) => ({
                    ...prev,
                    people: prev.people.map((p, i) => (i === index ? person : p)),
                  }))
                }
                onRemove={(index) =>
                  setDraft((prev) => ({
                    ...prev,
                    people: prev.people.filter((_, i) => i !== index),
                  }))
                }
              />
            )}
            {stepKey === "budget" && (
              <BudgetStep
                categories={seededCategories}
                draftCategories={categories}
                value={budget}
                onChange={(next) => setDraft((prev) => ({ ...prev, budget: next }))}
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={goBack} disabled={step === 0}>
              <ArrowLeftIcon />
              {t("buttons.back")}
            </Button>
            <Button
              type="button"
              onClick={goNextOrFinish}
              disabled={!canGoNext || isSubmitting}
            >
              {isSubmitting && <SpinnerIcon className="animate-spin" />}
              {isLastStep ? t("buttons.finish") : t("buttons.next")}
              {!isLastStep && !isSubmitting && <ArrowRightIcon />}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
