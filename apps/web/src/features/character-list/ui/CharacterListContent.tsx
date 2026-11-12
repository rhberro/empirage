import { EmptyState, For } from '@chakra-ui/react';
import * as React from 'react';

import type { Character } from '~/entities/character';
import { Icon } from '~/shared/ui/Icon';

import { useCharacters } from '../model/use-characters';
import { CharacterRow } from './CharacterRow';
import { CharacterRowSkeleton } from './CharacterRowSkeleton';

function renderCharacter(character: Character): React.ReactElement {
  return <CharacterRow key={character.id} {...character} />;
}

/**
 * O motivo de separar este componente do CharacterList é porque somente este pedaço
 * do componente precisa das propriedades da query useCharacters, movendo a query
 * para um componente a parte faz com que somente este pedaço sofra "rerender" ao
 * decorrer da query e o container CharacterList se mantem sem sofrer "rerender".
 */
export function CharacterListContent(): React.ReactElement {
  const { data, isError, isPending, isSuccess } = useCharacters();
  if (isPending) {
    return (
      <>
        <CharacterRowSkeleton />
        <CharacterRowSkeleton />
        <CharacterRowSkeleton />
      </>
    );
  }
  if (isError) {
    return (
      <EmptyState.Root size="sm">
        <EmptyState.Content>
          <EmptyState.Indicator>
            <Icon name="falling" />
          </EmptyState.Indicator>
          <EmptyState.Title>Error ao carregar personagens</EmptyState.Title>
          <EmptyState.Description>Não foi possível carregar os personagens.</EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }
  if (isSuccess && data.length === 0) {
    return (
      <EmptyState.Root size="sm">
        <EmptyState.Content>
          <EmptyState.Indicator>
            <Icon name="search_off" />
          </EmptyState.Indicator>
          <EmptyState.Title>Nenhum personagem encontrado</EmptyState.Title>
          <EmptyState.Description>
            Crie um novo personagem para iniciar a jornada.
          </EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }
  return <For each={data}>{renderCharacter}</For>;
}
