import { Button, HStack, Spinner, Text } from '@chakra-ui/react';
import * as React from 'react';

type StoragePaginationProps = {
  loading: boolean;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export function StoragePagination(props: StoragePaginationProps): React.ReactElement | null {
  const { loading, onPageChange, page, pageCount } = props;
  if (pageCount <= 1) {
    return null;
  }
  function showPreviousPage(): void {
    onPageChange(page - 1);
  }
  function showNextPage(): void {
    onPageChange(page + 1);
  }
  const isPreviousDisabled = page === 1 || loading;
  const isNextDisabled = page === pageCount || loading;
  const loadingIndicator = loading ? <Spinner size="xs" /> : null;
  const pageLabel = `Página ${page} de ${pageCount}`;

  return (
    <HStack justify="space-between">
      <Button disabled={isPreviousDisabled} onClick={showPreviousPage} size="sm" variant="outline">
        Anterior
      </Button>
      <HStack gap="2">
        {loadingIndicator}
        <Text color="fg.muted" fontSize="xs">
          {pageLabel}
        </Text>
      </HStack>
      <Button disabled={isNextDisabled} onClick={showNextPage} size="sm" variant="outline">
        Próxima
      </Button>
    </HStack>
  );
}
