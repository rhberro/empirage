import { z } from "zod";

const SignUpSchemaShape = {
  email: z.string().email(),
  password: z.string().min(6),
  passwordConfirmation: z.string().min(6),
};

export const SignUpSchema = z.object(SignUpSchemaShape);

export type SignUpValues = z.output<typeof SignUpSchema>;
