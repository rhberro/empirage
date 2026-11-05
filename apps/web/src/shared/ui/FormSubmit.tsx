import { Button } from '@chakra-ui/react';
import { Control, type FieldValues, useFormState } from 'react-hook-form';

type FormSubmitProperties<V extends FieldValues> = React.PropsWithChildren<{ control: Control<V> }>;

export function FormSubmit<FV extends FieldValues>(
  props: FormSubmitProperties<FV>,
): React.ReactElement {
  const { children, control } = props;
  const useFormStateParameters = { control };
  const { isSubmitting, isValid } = useFormState(useFormStateParameters);
  const disabled = isSubmitting || !isValid;
  return (
    <Button disabled={disabled} type="submit">
      {children}
    </Button>
  );
}
