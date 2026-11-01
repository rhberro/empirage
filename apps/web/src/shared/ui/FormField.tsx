import { Field } from "@chakra-ui/react";
import * as React from "react";
import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form";

type ControlledProps =
  | "defaultValue"
  | "disabled"
  | "name"
  | "onBlur"
  | "onChange"
  | "ref"
  | "value";

type GroupProps = { label: string; helperText: string };

type FormFieldProps<Values extends FieldValues, Component extends React.ElementType> = {
  control: Control<Values>;
  name: FieldPath<Values>;
  render: Component;
} & Partial<GroupProps> &
  Omit<React.ComponentPropsWithRef<Component>, ControlledProps | "render">;

export function FormField<Values extends FieldValues, TComponent extends React.ElementType>(
  props: FormFieldProps<Values, TComponent>,
): React.ReactElement {
  const {
    control,
    helperText,
    label,
    name,
    render: Component,
    required,
    ...componentProps
  } = props;
  const useControllerParameters = { control, name };
  const { field, fieldState } = useController(useControllerParameters);
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
    <Field.Root invalid={invalid} required={required} disabled={disabled}>
      {rootLabel}
      <RootComponent {...componentProps} {...field} aria-invalid={invalid} />
      {rootHelper}
      {rootError}
    </Field.Root>
  );
}
