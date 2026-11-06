import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type { DefaultValues, FieldValues, SubmitHandler } from 'react-hook-form';
import type { z } from 'zod';

import { FormField } from './FormField';
import type { FormFieldComponent } from './FormField';
import { FormSubmit } from './FormSubmit';

type FormInput<Schema extends z.ZodType> =
  z.input<Schema> extends FieldValues ? z.input<Schema> : never;

type FormOutput<Schema extends z.ZodType> =
  z.output<Schema> extends FieldValues ? z.output<Schema> : never;

type FormConfiguration<Schema extends z.ZodType> = {
  defaultValues: DefaultValues<FormInput<Schema>>;
  onSubmit: SubmitHandler<FormOutput<Schema>>;
};

type FormElementProperties = Omit<React.ComponentPropsWithoutRef<'form'>, 'children' | 'onSubmit'>;

type FormProperties<Schema extends z.ZodType> = React.PropsWithChildren<FormConfiguration<Schema>> &
  FormElementProperties;

type FormComponent<Schema extends z.ZodType> = {
  Field: FormFieldComponent<FormInput<Schema>>;
  Submit: typeof FormSubmit;
} & ((props: FormProperties<Schema>) => React.ReactElement);

export function createForm<Schema extends z.ZodType>(schema: Schema): FormComponent<Schema> {
  function Form(props: FormProperties<Schema>): React.ReactElement {
    const { children, defaultValues, onSubmit, ...formProperties } = props;
    const resolverSchema = schema as z.ZodType<FormOutput<Schema>, FormInput<Schema>>;
    const useFormParameters = {
      defaultValues,
      mode: 'onTouched' as const,
      resolver: zodResolver<FormInput<Schema>, unknown, FormOutput<Schema>>(resolverSchema),
    };
    const form = useForm<FormInput<Schema>, unknown, FormOutput<Schema>>(useFormParameters);
    const submit = form.handleSubmit(onSubmit);

    return (
      <FormProvider {...form}>
        <form {...formProperties} onSubmit={submit}>
          {children}
        </form>
      </FormProvider>
    );
  }

  const form = Form as FormComponent<Schema>;
  const field = FormField as FormFieldComponent<FormInput<Schema>>;
  form.Field = field;
  form.Submit = FormSubmit;

  return form;
}
