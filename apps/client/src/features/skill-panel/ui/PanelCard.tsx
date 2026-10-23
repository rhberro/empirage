import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import type { PanelCardEntry } from '~/features/skill-panel/model/skillPanel.types';
import { useSelectionRing } from '~/shared/theme';
import { AbilityCard } from '~/shared/ui/ability';
import { Slot } from '~/shared/ui/frame';
import { IconBolt, IconPotion, IconPrism } from '~/shared/ui/icon';
import { Pressable } from '~/shared/ui/interactive';
import { Text } from '~/shared/ui/text';

type PanelCardProps = {
  entry: PanelCardEntry;
  onSelect: (id: string) => void;
};

// eslint-disable-next-line max-lines-per-function
export function PanelCard(props: PanelCardProps): ReactElement {
  const { entry, onSelect } = props;
  const selectionRing = useSelectionRing();
  const background = entry.selected ? 'bg.raised' : 'transparent';
  const ring = entry.selected ? selectionRing : undefined;

  function handlePress(): void {
    onSelect(entry.id);
  }

  if (entry.kind === 'ability') {
    return (
      <Pressable disabled={entry.disabled} onPress={handlePress} width="full">
        <Box _before={ring} bg={background} position="relative" width="full">
          <AbilityCard
            cooldownMs={entry.cooldownMs}
            damage={entry.damage}
            description={entry.description}
            element={entry.element}
            name={entry.name}
            selected={entry.selected}
          />
        </Box>
      </Pressable>
    );
  }

  const glyphColor = readGlyphColor(entry.kind);
  const glyph = renderGlyph(entry.kind);

  return (
    <Pressable disabled={entry.disabled} onPress={handlePress} width="full">
      <Box
        _before={ring}
        alignItems="center"
        bg={background}
        borderColor="border"
        borderRadius="sm"
        borderWidth="1px"
        display="flex"
        gap="3"
        padding="2"
        position="relative"
        textAlign="left"
        width="full"
      >
        <Slot>
          <Box
            alignItems="center"
            color={glyphColor}
            display="flex"
            height="full"
            justifyContent="center"
            width="full"
          >
            {glyph}
          </Box>
        </Slot>
        <PanelCardText entry={entry} />
      </Box>
    </Pressable>
  );
}

type PanelCardTextProps = {
  entry: PanelCardEntry;
};

function PanelCardText(props: PanelCardTextProps): ReactElement {
  const { entry } = props;
  const descriptionNode =
    entry.description === null ? null : (
      <Text
        color="fg.muted"
        overflow="hidden"
        textOverflow="ellipsis"
        variant="body"
        whiteSpace="nowrap"
      >
        {entry.description}
      </Text>
    );
  const noteNode =
    entry.note === null ? null : (
      <Text color="fg.subtle" variant="meta">
        {entry.note}
      </Text>
    );
  return (
    <Box minW="0">
      <Text color="fg" overflow="hidden" variant="name" whiteSpace="nowrap">
        {entry.name}
      </Text>
      {descriptionNode}
      {noteNode}
    </Box>
  );
}

function readGlyphColor(kind: PanelCardEntry['kind']): string {
  if (kind === 'consumable') {
    return 'verdant.fg';
  }
  if (kind === 'device') {
    return 'frost.fg';
  }
  return 'fg.subtle';
}

function renderGlyph(kind: PanelCardEntry['kind']): ReactElement {
  if (kind === 'consumable') {
    return <IconPotion />;
  }
  if (kind === 'device') {
    return <IconPrism />;
  }
  return <IconBolt />;
}
