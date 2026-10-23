import { SegmentGroup, visuallyHiddenStyle } from '@chakra-ui/react';
import type { Gender } from '@creatures/contracts/trainer';
import type { ReactElement } from 'react';

import { GENDER_LABELS, GENDERS } from './genderToggle.constants';

type GenderToggleProps = {
  onChange: (gender: Gender) => void;
  value: Gender;
};

const GENDER_LABEL = 'Gênero';

/**
 * Largura mínima comum aos dois itens: o rótulo mais longo (MASCULINO)
 * precisa de ≈7.6rem com o padding atual — o 8rem iguala as pílulas em
 * qualquer escala, porque aquí tudo (rótulo, padding e largura) é rem.
 */
const ITEM_MIN_WIDTH = '8rem';

const ITEM_STYLE = {
  '& input': {
    ...visuallyHiddenStyle,
  },
  '&::before': {
    content: 'none',
    display: 'none',
  },
};

function renderItem(gender: Gender): ReactElement {
  return <GenderItem key={gender} gender={gender} />;
}

/**
 * A seleção de gênero.
 *
 * O `SegmentGroup` do Chakra cuida da parte difícil: o papel de radio, a
 * navegação pelas setas e o estado marcado. O que é do projeto — o fundo
 * afundado, o item selecionado em cima, a tipografia de rótulo e o alvo de
 * toque de 2.75rem — continua aqui, no mesmo desenho do toggle anterior.
 */
export function GenderToggle(props: GenderToggleProps): ReactElement {
  const { onChange, value } = props;

  function handleValueChange(details: SegmentGroup.ValueChangeDetails): void {
    onChange(details.value as Gender);
  }

  const items = GENDERS.map(renderItem);

  return (
    <SegmentGroup.Root
      alignSelf="center"
      aria-label={GENDER_LABEL}
      bg="bg.sunken"
      borderRadius="sm"
      boxShadow="recessed"
      gap="1"
      marginInline="auto"
      padding="1"
      size="lg"
      value={value}
      width="fit-content"
      onValueChange={handleValueChange}
    >
      <SegmentGroup.Indicator bg="bg.raised" borderRadius="xs" boxShadow="sm" />
      {items}
    </SegmentGroup.Root>
  );
}

type GenderItemProps = {
  gender: Gender;
};

function GenderItem(props: GenderItemProps): ReactElement {
  const { gender } = props;
  const label = GENDER_LABELS[gender];

  return (
    <SegmentGroup.Item
      borderRadius="xs"
      css={ITEM_STYLE}
      minW={ITEM_MIN_WIDTH}
      paddingBlock="2"
      paddingInline="5"
      value={gender}
    >
      <SegmentGroup.ItemText color="inherit" textStyle="label">
        {label}
      </SegmentGroup.ItemText>
      <SegmentGroup.ItemHiddenInput />
    </SegmentGroup.Item>
  );
}
