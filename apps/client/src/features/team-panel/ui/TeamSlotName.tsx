import { Marquee } from '@chakra-ui/react';

import { Text } from '~/shared/ui/text';

const css = {
  '--marquee-edge-color': 'colors.bg.raised',
  '--marquee-edge-size': '10%',
};

export function TeamSlotName(props: React.PropsWithChildren<unknown>): React.ReactElement {
  const { children } = props;
  const content =
    children && children.toString().length > 10 ? (
      <Marquee.Root css={css}>
        <Marquee.Edge side="start" />
        <Marquee.Viewport>
          <Marquee.Content>
            <Marquee.Item>{children}</Marquee.Item>
          </Marquee.Content>
        </Marquee.Viewport>
        <Marquee.Edge side="end" />
      </Marquee.Root>
    ) : (
      children
    );
  return (
    <Text fontSize="xs" textAlign="center" variant="label">
      {content}
    </Text>
  );
}
