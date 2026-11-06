import { z } from 'zod';

const CreateCharacterSchemaShape = {
  name: z.string().min(1),
};

export const CreateCharacterSchema = z.object(CreateCharacterSchemaShape);

export type CreateCharacterInput = z.input<typeof CreateCharacterSchema>;

export type CreateCharacterOutput = z.output<typeof CreateCharacterSchema>;
