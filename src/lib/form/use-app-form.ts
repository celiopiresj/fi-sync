"use client";

import { createFormHook } from "@tanstack/react-form";
import { fieldContext, formContext } from "./form-context";
import { TextField } from "@/components/form/text-field";
import { SelectField } from "@/components/form/select-field";
import { DateField } from "@/components/form/date-field";
import { ToggleGroupField } from "@/components/form/toggle-group-field";
import { PhoneField } from "@/components/form/phone-field";
import { AmountField } from "@/components/form/amount-field";
import { SubmitButton } from "@/components/form/submit-button";
import {
  PickerRowField,
  DatePickerRowField,
} from "@/components/form/picker-row-field";

// TanStack Form's "compose" pattern: registers our field/form components
// once so every screen's `form.AppField`/`form.AppForm` already knows
// about `TextField`/`SubmitButton` — no per-page wiring, no manually
// passing `field`/error state around. Add new shared field types here,
// not per-page.
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    SelectField,
    DateField,
    ToggleGroupField,
    PhoneField,
    AmountField,
    PickerRowField,
    DatePickerRowField,
  },
  formComponents: {
    SubmitButton,
  },
});
