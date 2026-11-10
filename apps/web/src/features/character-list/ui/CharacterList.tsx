import { Button, Card, Stack, Text } from '@chakra-ui/react';
import { Link } from 'react-router-dom';

import { CharacterListContent } from './CharacterListContent';
import { SignOutButton } from './SignOutButton';

export function CharacterList(): React.ReactElement {
  return (
    <Stack gap="10">
      <Card.Root variant="subtle">
        <Card.Header>
          <Card.Title>Personagens</Card.Title>
          <Card.Description>
            Escolha um personagem da lista ou crie um novo para começar a jornada.
          </Card.Description>
        </Card.Header>
        <Card.Body>
          <Stack gap="2">
            <CharacterListContent />
          </Stack>
        </Card.Body>
        <Card.Footer>
          <Button asChild type="button">
            <Link to="/create-character">Novo personagem</Link>
          </Button>
          <SignOutButton />
        </Card.Footer>
      </Card.Root>
      <Text color="fg.muted" textAlign="center" textStyle="sm">
        Ao continuar, você concorda com os Termos de Serviço e a Política de Privacidade do
        Creatures.
      </Text>
    </Stack>
  );
}
