import { Tooltip as ChakraTooltip, Portal } from '@chakra-ui/react';
import * as React from 'react';

export interface TooltipProps extends ChakraTooltip.RootProps {
  content: React.ReactNode;
  contentProps?: ChakraTooltip.ContentProps;
  disabled?: boolean;
  portalRef?: React.RefObject<HTMLElement | null>;
  portalled?: boolean;
  showArrow?: boolean;
}

function TooltipComponent(
  props: TooltipProps,
  ref: React.ForwardedRef<HTMLDivElement>,
): React.ReactElement {
  const {
    showArrow,
    children,
    disabled,
    portalled = true,
    content,
    contentProps,
    portalRef,
    ...rest
  } = props;
  if (disabled) {
    return React.createElement(React.Fragment, null, children);
  }
  const shouldDisablePortal = !portalled;
  const arrow = showArrow ? (
    <ChakraTooltip.Arrow>
      <ChakraTooltip.ArrowTip />
    </ChakraTooltip.Arrow>
  ) : null;
  return (
    <ChakraTooltip.Root {...rest}>
      <ChakraTooltip.Trigger asChild>{children}</ChakraTooltip.Trigger>
      <Portal disabled={shouldDisablePortal} container={portalRef}>
        <ChakraTooltip.Positioner>
          <ChakraTooltip.Content ref={ref} {...contentProps}>
            {arrow}
            {content}
          </ChakraTooltip.Content>
        </ChakraTooltip.Positioner>
      </Portal>
    </ChakraTooltip.Root>
  );
}

export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(TooltipComponent);
