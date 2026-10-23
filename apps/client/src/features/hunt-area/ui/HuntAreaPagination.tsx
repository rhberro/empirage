import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { NativeButton } from '~/shared/ui/button';
import { Text } from '~/shared/ui/text';

const PAGE_BUTTON_SIZE = '2.25rem';

type HuntAreaPaginationProps = {
  current: number;
  onChange: (page: number) => void;
  total: number;
};

/**
 * The pagination of the list of areas.
 *
 * It lives in the center of the footer, and the search lives on the right:
 * one navigates between the areas, the other filters them.
 */
export function HuntAreaPagination(props: HuntAreaPaginationProps): ReactElement {
  const { current, onChange, total } = props;
  const label = `${current} / ${total}`;
  const previousDisabled = current <= 1;
  const nextDisabled = current >= total;
  const previousPage = buildPageChange(onChange, current - 1);
  const nextPage = buildPageChange(onChange, current + 1);
  return (
    <Box alignItems="center" display="flex" gap="3">
      <PageButton
        disabled={previousDisabled}
        label="‹"
        name="Página anterior"
        onPress={previousPage}
      />
      <Text color="fg.muted" variant="numeric" whiteSpace="nowrap">
        {label}
      </Text>
      <PageButton disabled={nextDisabled} label="›" name="Próxima página" onPress={nextPage} />
    </Box>
  );
}

function buildPageChange(onChange: (page: number) => void, page: number): () => void {
  return function changePage(): void {
    onChange(page);
  };
}

type PageButtonProps = {
  disabled: boolean;
  label: string;
  name: string;
  onPress: () => void;
};

function PageButton(props: PageButtonProps): ReactElement {
  const { disabled, label, name, onPress } = props;
  const cursor = disabled ? 'not-allowed' : 'pointer';
  const opacity = disabled ? 0.5 : 1;
  return (
    <NativeButton
      alignItems="center"
      aria-label={name}
      bg="bg.raised"
      borderColor="border"
      borderRadius="full"
      borderWidth="1px"
      color="fg.muted"
      cursor={cursor}
      disabled={disabled}
      display="flex"
      height={PAGE_BUTTON_SIZE}
      justifyContent="center"
      opacity={opacity}
      width={PAGE_BUTTON_SIZE}
      onClick={onPress}
    >
      <Text variant="numeric">{label}</Text>
    </NativeButton>
  );
}
