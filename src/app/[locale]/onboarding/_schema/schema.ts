import { z } from "zod";

export const onboardingAccountSchema = z.object({
  name: z.string().min(1),
});

export type OnboardingAccountValues = z.infer<typeof onboardingAccountSchema>;

export const emptyOnboardingAccountFormValues: OnboardingAccountValues = {
  name: "",
};
