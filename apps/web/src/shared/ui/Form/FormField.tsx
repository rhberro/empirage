import { Field } from '@chakra-ui/react';
import * as React from 'react';
import { useController } from 'react-hook-form';
import type { FieldPath, FieldValues } from 'react-hook-form';

type ControlledProperties =
  | 'defaultValue'
  | 'disabled'
  | 'name'
  | 'onBlur'
  | 'onChange'
  | 'ref'
  | 'value';

type GroupProperties = { helperText: string; label: string };

type FormFieldProperties<Values extends FieldValues, ComponentType extends React.ElementType> = {
  name: FieldPath<Values>;
  render: ComponentType;
} & Partial<GroupProperties> &
  Omit<React.ComponentPropsWithRef<ComponentType>, ControlledProperties | 'render'>;

export type FormFieldComponent<Values extends FieldValues> = <
  ComponentType extends React.ElementType,
>(
  props: FormFieldProperties<Values, ComponentType>,
) => React.ReactElement;

export function FormField<
  Values extends FieldValues = FieldValues,
  ComponentType extends React.ElementType = React.ElementType,
>(props: FormFieldProperties<Values, ComponentType>): React.ReactElement {
  const { helperText, label, name, render: Component, required, ...componentProperties } = props;
  const controllerParameters = { name };
  const { field, fieldState } = useController<Values>(controllerParameters);
  const { disabled } = field;
  const { error, error: { message } = {}, invalid } = fieldState;
  const rootLabel = label ? (
    <Field.Label>
      {label}
      <Field.RequiredIndicator />
    </Field.Label>
  ) : null;
  const rootHelper = helperText ? <Field.HelperText>{helperText}</Field.HelperText> : null;
  const rootError = error ? <Field.ErrorText>{message}</Field.ErrorText> : null;
  const RootComponent = Component as React.ElementType;
  return (
    <Field.Root disabled={disabled} invalid={invalid} required={required}>
      {rootLabel}
      <RootComponent {...componentProperties} {...field} aria-invalid={invalid} />
      {rootHelper}
      {rootError}
    </Field.Root>
  );
}
