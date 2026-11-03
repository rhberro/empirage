import { z } from "zod";

const CreateCharacterSchemaShape = {
  name: z.string().min(1),
};

export const CreateCharacterSchema = z.object(CreateCharacterSchemaShape);

export type CreateCharacterValues = z.output<typeof CreateCharacterSchema>;
