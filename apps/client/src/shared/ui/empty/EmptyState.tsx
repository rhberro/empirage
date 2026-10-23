import { EmptyState as ChakraEmptyState } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { Icon } from '~/shared/ui/icon';

export type EmptyStateIcon = 'empty' | 'search';

/**
 * The tone of the state. The `error` tone paints the title with the error
 * color of the theme, so a failure is not read as a search that found nothing.
 */
export type EmptyStateTone = 'default' | 'error';

export type EmptyStateProps = {
  /** The sentence under the title, when the title is not enough. */
  description?: string;
  /** The mark of the state. Defaults to the magnifier of a search that found nothing. */
  icon?: EmptyStateIcon;
  title: string;
  /** The tone of the state. Defaults to the neutral one. */
  tone?: EmptyStateTone;
};

const ICON_PATHS: Record<EmptyStateIcon, ReactElement> = {
  empty: (
    <>
      <path d="M4 9V5a1 1 0 0 1 1-1h4" />
      <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
      <path d="M15 4h4a1 1 0 0 1 1 1v4" />
      <path d="M9 20H5a1 1 0 0 1-1-1v-4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
};

const INDICATOR_SIZE = '3.5rem';
const INDICATOR_FONT_SIZE = '1.5rem';
const ICON_SIZE = '1.5rem';

/**
 * The type of the project, applied over the recipe of the Chakra: the slot
 * brings the semantics (`h3` and `p`), the style brings the voice.
 */
const TITLE_STYLES = {
  textStyle: 'name',
} as const;

const DESCRIPTION_STYLES = {
  maxW: '40ch',
  textAlign: 'center',
  textStyle: 'body',
} as const;

/**
 * The state of nothing there.
 *
 * The anatomy is the `EmptyState` of Chakra — `Root` > `Content` > `Indicator`
 * / `Title` / `Description` — because the component already owns the centered
 * layout and the semantic markup: the title is a heading and the description
 * is a paragraph. The mark is ours, drawn with the same `currentColor` as
 * every other icon, and the type is ours, so the panel speaks with the same
 * voice as the rest of the interface.
 *
 * It lives in the body of a panel, where the grid would be, and it takes the
 * whole area, so the footer with the search does not move.
 */
export function EmptyState(props: EmptyStateProps): ReactElement {
  const { description, icon = 'search', title, tone = 'default' } = props;
  const failed = tone === 'error';
  const indicatorBackground = failed ? 'bg.error' : 'bg.sunken';
  const indicatorColor = failed ? 'fg.error' : 'fg.subtle';
  const titleColor = failed ? 'fg.error' : 'fg';
  const sentence =
    description === undefined ? null : <EmptySentence failed={failed} text={description} />;
  return (
    <ChakraEmptyState.Root
      display="flex"
      flexDirection="column"
      height="full"
      justifyContent="center"
      padding="8"
      width="full"
    >
      <ChakraEmptyState.Content>
        <ChakraEmptyState.Indicator
          bg={indicatorBackground}
          borderRadius="full"
          boxShadow="recessed"
          boxSize={INDICATOR_SIZE}
          color={indicatorColor}
          fontSize={INDICATOR_FONT_SIZE}
        >
          <Icon size={ICON_SIZE}>{ICON_PATHS[icon]}</Icon>
        </ChakraEmptyState.Indicator>
        <ChakraEmptyState.Title css={TITLE_STYLES} color={titleColor}>
          {title}
        </ChakraEmptyState.Title>

        {sentence}
      </ChakraEmptyState.Content>
    </ChakraEmptyState.Root>
  );
}

/**
 * The type of the project, applied over the recipe of the Chakra: the slot
 * brings the semantics (`h3` and `p`), the style brings the voice.
 */
function EmptySentence(props: { failed: boolean; text: string }): ReactElement {
  const { failed, text } = props;
  const color = failed ? 'fg.error' : 'fg.muted';
  return (
    <ChakraEmptyState.Description css={DESCRIPTION_STYLES} color={color}>
      {text}
    </ChakraEmptyState.Description>
  );
}
