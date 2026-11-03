import { Center } from "@chakra-ui/react";

import { CharacterList } from "~/features/character-list";

const pagePadding = { base: "6", md: "12" };

export function CharactersPage(): React.ReactElement {
  return (
    <Center bg="bg.canvas" minH="100dvh" p={pagePadding}>
      <CharacterList />
    </Center>
  );
}
