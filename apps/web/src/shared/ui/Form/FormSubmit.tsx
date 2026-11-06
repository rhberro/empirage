import { Button } from '@chakra-ui/react';
import * as React from 'react';
import { useFormState } from 'react-hook-form';

type FormSubmitProperties = React.PropsWithChildren<unknown>;

export function FormSubmit(props: FormSubmitProperties): React.ReactElement {
  const { children } = props;
  const { isSubmitting, isValid } = useFormState();
  const disabled = isSubmitting || !isValid;
  return (
    <Button disabled={disabled} loading={isSubmitting} type="submit">
      {children}
    </Button>
  );
}
