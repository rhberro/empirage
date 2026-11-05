import { z } from 'zod';

function refineConfirmPassword(data: SignUpShape): boolean {
  return data.password === data.passwordConfirmation;
}

const refineConfirmPasswordParameters = {
  error: 'As senhas não coincidem.',
  path: ['passwordConfirmation'],
};

const SignUpSchemaShape = {
  email: z.email(),
  password: z.string().min(6),
  passwordConfirmation: z.string().min(6),
};

export const SignUpSchema = z
  .object(SignUpSchemaShape)
  .refine(refineConfirmPassword, refineConfirmPasswordParameters);

export type SignUpShape = InferShape<typeof SignUpSchemaShape>;

export type SignUpInput = z.input<typeof SignUpSchema>;

export type SignUpOutput = z.output<typeof SignUpSchema>;
