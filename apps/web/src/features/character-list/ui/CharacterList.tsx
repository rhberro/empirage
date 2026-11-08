import { Button, Card, EmptyState, Stack, Text } from '@chakra-ui/react';
import { Link } from 'react-router-dom';

import { Icon } from '~/shared/ui/Icon';

import type { Character } from '../api/get-characters';
import { useCharacters } from '../model/use-characters';
import { CharacterRow } from './CharacterRow';
import { CharacterRowSkeleton } from './CharacterRowSkeleton';

function renderCharacter(character: Character): React.ReactElement {
  return <CharacterRow key={character.id} {...character} />;
}

export function CharacterList(): React.ReactElement {
  const { data, isError, isPending, isSuccess } = useCharacters();
  const loadingContent = isPending ? (
    <>
      <CharacterRowSkeleton />
      {/*<CharacterRowSkeleton />*/}
      {/*<CharacterRowSkeleton />*/}
    </>
  ) : null;
  const errorContent = isError ? (
    <EmptyState.Root size="sm">
      <EmptyState.Content>
        <EmptyState.Indicator>
          <Icon name="falling" />
        </EmptyState.Indicator>
        <EmptyState.Title>Error ao carregar personagens</EmptyState.Title>
        <EmptyState.Description>Não foi possível carregar os personagens.</EmptyState.Description>
      </EmptyState.Content>
    </EmptyState.Root>
  ) : null;
  const emptyContent =
    isSuccess && data.length === 0 ? (
      <EmptyState.Root size="sm">
        <EmptyState.Content>
          <EmptyState.Indicator>
            <Icon name="falling" />
          </EmptyState.Indicator>
          <EmptyState.Title>Nenhum personagem encontrado</EmptyState.Title>
          <EmptyState.Description>
            Tente novamente ou crie um novo personagem.
          </EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    ) : null;
  const characterRows = data ? data.map(renderCharacter) : null;
  return (
    <Stack align="center" gap="10">
      <Card.Root variant="subtle">
        <Card.Header>
          <Card.Title>Personagens</Card.Title>
          <Card.Description>
            Escolha um personagem da lista ou crie um novo para começar a jornada.
          </Card.Description>
        </Card.Header>
        <Card.Body>
          <Stack gap="4">
            {loadingContent}
            {errorContent}
            {emptyContent}
            {characterRows}
            <Button asChild type="button">
              <Link to="/create-character">Novo personagem</Link>
            </Button>
          </Stack>
        </Card.Body>
      </Card.Root>
      <Text color="fg.muted" textAlign="center" textStyle="sm" maxW="md">
        Ao continuar, você concorda com os Termos de Serviço e a Política de Privacidade do
        Creatures.
      </Text>
    </Stack>
  );
}
