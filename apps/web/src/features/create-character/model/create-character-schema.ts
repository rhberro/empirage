import { z } from 'zod';

const characterGenders = ['male', 'female'] as const;

const CreateCharacterSchemaShape = {
  gender: z.enum(characterGenders),
  name: z
    .string()
    .min(3, 'O nome deve ter entre 3 e 15 caracteres.')
    .max(15, 'O nome deve ter entre 3 e 15 caracteres.')
    .regex(
      /^(?! )(?!.* {2})(?!.* $)[\p{L} '_-]+$/u,
      'Apenas letras, espaços, apóstrofo, traços e underscores são permitidos.',
    ),
};

export const CreateCharacterSchema = z.object(CreateCharacterSchemaShape);

export type CreateCharacterInput = z.input<typeof CreateCharacterSchema>;

export type CreateCharacterOutput = z.output<typeof CreateCharacterSchema>;
