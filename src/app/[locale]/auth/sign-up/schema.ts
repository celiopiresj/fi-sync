import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
});

export type SignUpValues = z.infer<typeof signUpSchema>;
