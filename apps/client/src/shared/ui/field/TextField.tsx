import { Box, Input } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { ClearControl } from './ClearControl';
import type { TextFieldProps } from './field.types';
import { PasswordField } from './PasswordField';
import { useTextField } from './useTextField';

const PASSWORD_TYPE = 'password';

/**
 * O campo de texto.
 *
 * O campo de senha é o mesmo campo com o botão de mostrar e ocultar: o
 * `type="password"` é o que separa os dois. Quem escreve o formulário não
 * precisa saber a diferença — escreve `TextField` e pronto.
 */
export function TextField(props: TextFieldProps): ReactElement {
  const { type } = props;
  if (type === PASSWORD_TYPE) {
    return <PasswordField {...props} />;
  }
  return <TextInput {...props} />;
}

function TextInput(props: TextFieldProps): ReactElement {
  const { clearable = false } = props;
  const field = useTextField(props);
  const clearControl =
    clearable && field.hasValue ? <ClearControl onClick={field.handleClear} /> : null;

  return (
    <Box position="relative" width="full">
      <Input
        bg="bg.sunken"
        borderColor={field.borderColor}
        borderRadius="sm"
        color="fg"
        focusVisibleRing="outside"
        fontSize="md"
        height="2.375rem"
        paddingInlineEnd={field.endPadding}
        ref={field.inputRefCallback}
        value={field.shownValue}
        onChange={field.handleChange}
        {...field.inputProps}
      />
      {clearControl}
    </Box>
  );
}
