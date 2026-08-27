import { z } from "zod";

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
