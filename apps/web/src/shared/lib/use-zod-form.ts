import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { DefaultValues, FieldValues, UseFormProps, UseFormReturn } from "react-hook-form";
import type { ZodType } from "zod";

export function useZodForm<TValues extends FieldValues>(
  schema: ZodType<TValues, TValues>,
  defaultValues: DefaultValues<TValues>,
): UseFormReturn<TValues, unknown, TValues> {
  const resolver = zodResolver<TValues, unknown, TValues, ZodType<TValues, TValues>>(schema);
  const useFormParameters: UseFormProps<TValues, unknown, TValues> = {
    defaultValues,
    mode: "onTouched",
    reValidateMode: "onChange",
    resolver,
  };
  return useForm<TValues, unknown, TValues>(useFormParameters);
}
