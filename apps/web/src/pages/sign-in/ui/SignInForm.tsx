import { Input } from '@chakra-ui/react';
import * as React from 'react';

import { FormField } from '~/shared/ui/FormField';

import { useSignInForm } from '../model/use-sign-in-form';

export function SignInForm(): React.ReactElement {
  const { control, handleSubmit } = useSignInForm();
  return (
    <form onSubmit={handleSubmit}>
      <FormField control={control} label="E-mail" name="email" render={Input} />
      <FormField control={control} label="Senha" name="password" render={Input} type="password" />
    </form>
  );
}
