import { z } from 'zod';

declare global {
  type InferShape<T extends z.ZodRawShape> = {
    [K in keyof T]: z.infer<T[K]>;
  };
}

export {};
