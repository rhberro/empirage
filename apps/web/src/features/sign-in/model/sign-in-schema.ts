import { z } from "zod";

const SignInSchemaObject = {
  email: z.string().email(),
  password: z.string().min(6),
};

export const SignInSchema = z.object(SignInSchemaObject);

export type SignInValues = z.output<typeof SignInSchema>;
