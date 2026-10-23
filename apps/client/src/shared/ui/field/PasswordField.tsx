import { Box, Input } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { ClearControl } from './ClearControl';
import type { TextFieldProps } from './field.types';
import { PasswordVisibilityButton } from './PasswordVisibilityButton';
import { usePasswordField } from './usePasswordField';
import { useTextField } from './useTextField';

const FIELD_HEIGHT = '2.375rem';
const PADDING_WITH_TOGGLE = '2.75rem';
const PADDING_WITH_CLEAR_AND_TOGGLE = '4.75rem';
const CLEAR_OFFSET = '3rem';

/**
 * O campo de senha.
 *
 * Tem o mesmo desenho do `TextField` — fundo, borda, altura, tipografia — e
 * ganha o botão que mostra e oculta a senha. O botão fica dentro do campo,
 * à direita, e o texto do input reserva o espaço dele.
 */
export function PasswordField(props: TextFieldProps): ReactElement {
  const { clearable = false } = props;
  const field = useTextField(props);
  const password = usePasswordField();
  const endPadding = clearable ? PADDING_WITH_CLEAR_AND_TOGGLE : PADDING_WITH_TOGGLE;
  const clearControl =
    clearable && field.hasValue ? (
      <ClearControl offset={CLEAR_OFFSET} onClick={field.handleClear} />
    ) : null;

  return (
    <Box position="relative" width="full">
      <Input
        bg="bg.sunken"
        borderColor={field.borderColor}
        borderRadius="sm"
        color="fg"
        focusVisibleRing="outside"
        fontSize="md"
        height={FIELD_HEIGHT}
        paddingInlineEnd={endPadding}
        ref={field.inputRefCallback}
        value={field.shownValue}
        onChange={field.handleChange}
        {...field.inputProps}
        type={password.inputType}
      />
      {clearControl}
      <PasswordVisibilityButton
        isVisible={password.isVisible}
        label={password.buttonLabel}
        onToggle={password.toggleVisibility}
      />
    </Box>
  );
}
