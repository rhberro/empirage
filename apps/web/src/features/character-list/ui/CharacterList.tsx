import { Button, Card, Stack, Text } from '@chakra-ui/react';
import { Link } from 'react-router-dom';

import type { Character } from '../api/get-characters';
import { useCharacters } from '../model/use-characters';
import { CharacterRow } from './CharacterRow';

function renderCharacter(character: Character): React.ReactElement {
  return <CharacterRow key={character.id} {...character} />;
}

export function CharacterList(): React.ReactElement {
  const charactersQuery = useCharacters();
  const loadingContent = charactersQuery.isPending ? <Text>Carregando personagens...</Text> : null;
  const errorContent = charactersQuery.isError ? (
    <Text>Não foi possível carregar os personagens.</Text>
  ) : null;
  const emptyContent =
    charactersQuery.isSuccess && charactersQuery.data.length === 0 ? (
      <Text>Nenhum personagem encontrado.</Text>
    ) : null;
  const characterRows = charactersQuery.data ? charactersQuery.data.map(renderCharacter) : null;
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
            <Button asChild type="button" variant="subtle">
              <Link to="/create-character">Criar personagem</Link>
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
