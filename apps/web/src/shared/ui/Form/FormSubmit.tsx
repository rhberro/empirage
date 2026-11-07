import { Button, ButtonProps } from '@chakra-ui/react';
import * as React from 'react';
import { useFormState } from 'react-hook-form';

type FormSubmitProperties = React.PropsWithChildren<ButtonProps>;

export function FormSubmit(props: FormSubmitProperties): React.ReactElement {
  const { children, ...properties } = props;
  const { isSubmitting, isValid } = useFormState();
  const disabled = isSubmitting || !isValid;
  return (
    <Button {...properties} disabled={disabled} loading={isSubmitting} type="submit">
      {children}
    </Button>
  );
}
