import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z.email(),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
