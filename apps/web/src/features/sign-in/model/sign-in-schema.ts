import { z } from 'zod';

const SignInSchemaObject = {
  email: z.email(),
  password: z.string().min(6),
};

export const SignInSchema = z.object(SignInSchemaObject);

export type SignInInput = z.input<typeof SignInSchema>;

export type SignInOutput = z.output<typeof SignInSchema>;
