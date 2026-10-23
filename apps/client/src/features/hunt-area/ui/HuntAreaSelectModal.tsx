import { Box, Grid } from '@chakra-ui/react';
import type { HuntArea } from '@creatures/contracts/hunt';
import type { ChangeEvent, ReactElement } from 'react';
import { useState } from 'react';

import {
  clampHuntAreaPage,
  countHuntAreaPages,
  huntAreaPage,
} from '~/features/hunt-area/model/huntAreaPagination';
import { filterHuntAreas } from '~/features/hunt-area/model/huntAreaSearch';
import type { HuntAreaStatus } from '~/features/hunt-area/model/useHuntAreaList';
import { HuntAreaCard } from '~/features/hunt-area/ui/HuntAreaCard';
import { HuntAreaPagination } from '~/features/hunt-area/ui/HuntAreaPagination';
import { PanelState } from '~/shared/ui/empty';
import { TextField } from '~/shared/ui/field';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '~/shared/ui/modal';

const TITLE = 'Locais de Caça';
const SEARCH_PLACEHOLDER = 'Buscar locais ou criaturas';
const EMPTY_TITLE = 'Nenhum local de caça encontrado';
const EMPTY_DESCRIPTION =
  'Nenhum local combina com a busca. Tente o nome de um local ou de uma criatura.';
const LOADING_TITLE = 'Carregando os locais de caça...';
const LOADING_DESCRIPTION = 'A lista das áreas está chegando. Só um instante.';
const ERROR_TITLE = 'Não foi possível carregar os locais de caça.';
const ERROR_DESCRIPTION = 'A busca das áreas falhou. Tente abrir o modal de novo em instantes.';
const MODAL_WIDTH = '61.25rem';
const MODAL_HEIGHT = '45rem';
const SEARCH_WIDTH = '17.5rem';
const GRID_COLUMNS = 'repeat(4, minmax(0, 1fr))';

export type HuntAreaSelectModalProps = {
  areas: HuntArea[];
  contained?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (area: HuntArea) => void;
  status?: HuntAreaStatus;
};

/**
 * The modal of the hunt areas.
 *
 * The grid of the areas is the body, and the footer is split between the
 * pagination, in the center, and the search, on the right. The search always
 * looks at every area, and it takes the player back to the first page.
 *
 * When there is nothing to show — no result, loading or failure — the grid
 * gives place to the empty state, and the footer stays where it is.
 */
// eslint-disable-next-line max-lines-per-function
export function HuntAreaSelectModal(props: HuntAreaSelectModalProps): ReactElement {
  const { areas, contained = false, isOpen, onClose, onSelect, status = 'ready' } = props;
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');

  function handleModalClose(): void {
    setPage(1);
    setQuery('');
    onClose();
  }
  const filtered = filterHuntAreas(areas, query);
  const pageCount = countHuntAreaPages(filtered.length);
  const currentPage = clampHuntAreaPage(page, pageCount);
  const visible = huntAreaPage(filtered, currentPage);
  const cards = visible.map(buildAreaCard(onSelect));
  const body = renderBody(status, cards, filtered.length);

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>): void {
    setQuery(event.target.value);
    setPage(1);
  }

  function handlePageChange(nextPage: number): void {
    setPage(nextPage);
  }

  return (
    <Modal
      contained={contained}
      height={MODAL_HEIGHT}
      isOpen={isOpen}
      onClose={handleModalClose}
      width={MODAL_WIDTH}
    >
      <ModalHeader>{TITLE}</ModalHeader>
      <ModalBody>{body}</ModalBody>
      <ModalFooter>
        <Box alignItems="center" display="grid" gridTemplateColumns="1fr auto 1fr" width="full">
          <Box />
          <HuntAreaPagination current={currentPage} onChange={handlePageChange} total={pageCount} />
          <Box justifySelf="end" maxW={SEARCH_WIDTH} width="full">
            <TextField
              aria-label={SEARCH_PLACEHOLDER}
              clearable
              name="buscar-locais-de-caca"
              onChange={handleSearchChange}
              placeholder={SEARCH_PLACEHOLDER}
              value={query}
            />
          </Box>
        </Box>
      </ModalFooter>
    </Modal>
  );
}

function buildAreaCard(onSelect: (area: HuntArea) => void): (area: HuntArea) => ReactElement {
  return function renderCard(area: HuntArea): ReactElement {
    return <HuntAreaCard area={area} onPress={onSelect} />;
  };
}

function renderBody(status: HuntAreaStatus, cards: ReactElement[], total: number): ReactElement {
  if (status === 'loading') {
    return <PanelState description={LOADING_DESCRIPTION} title={LOADING_TITLE} variant="loading" />;
  }
  if (status === 'error') {
    return <PanelState description={ERROR_DESCRIPTION} title={ERROR_TITLE} variant="error" />;
  }
  if (total === 0) {
    return <PanelState description={EMPTY_DESCRIPTION} title={EMPTY_TITLE} variant="empty" />;
  }
  return (
    <Grid autoRows="1fr" gap="3" templateColumns={GRID_COLUMNS}>
      {cards}
    </Grid>
  );
}
