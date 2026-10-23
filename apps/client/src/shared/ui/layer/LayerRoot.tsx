import {
  Box,
  Dialog as ChakraDialog,
  Drawer as ChakraDrawer,
  Portal,
  type SystemStyleObject,
  useSlotRecipe,
} from '@chakra-ui/react';
import type { ElementType, ReactElement, ReactNode } from 'react';

import { layerRecipe, type LayerWeight } from '~/shared/theme';
import { Overlay } from '~/shared/ui/overlay';

import type { LayerRootProps } from './layer.types';
import { LayerCloseButton } from './LayerCloseButton';
import { useOpenCycle } from './useOpenCycle';

/**
 * A camada: a raiz de todo dialogo, modal e drawer.
 *
 * O comportamento vem do `Dialog` do Chakra — *focus trap*, `aria-modal`,
 * rotulo acessivel, restauracao do foco no gatilho, scroll lock, portal e
 * inercia do fundo. O que e nosso e o **peso**, que vive na receita `layer`.
 *
 * A lateral usa o `Drawer` do Chakra — o mesmo `Dialog` com a receita `drawer`,
 * que e quem traz o deslize pela borda e a saida animada. O modal e o
 * dialogo usam o `Dialog` e a animacao nativa de escala.
 */
export function LayerRoot(props: LayerRootProps): ReactElement {
  const {
    children,
    closable = false,
    contained = false,
    height,
    isOpen,
    label,
    onClose,
    weight,
    width,
  } = props;
  const recipe = useSlotRecipe({ recipe: layerRecipe });
  const styles = recipe({ weight });
  const layer = describeLayer(contained, weight, onClose);
  const content = resolveContent(weight);
  const contentHeight = computeContentHeight(weight, height);
  const maxHeight = computeMaxHeight(contained, weight);
  const positioner = resolvePositioner(weight);
  const resetKey = useOpenCycle(isOpen);
  const surface = (
    <Portal disabled={contained}>
      <Overlay contained={contained} weight={weight} />
      <LayerSurface
        closable={closable}
        closeStyles={styles.close}
        content={content}
        contentHeight={contentHeight}
        label={label}
        layer={layer}
        maxHeight={maxHeight}
        onClose={onClose}
        positioner={positioner}
        positionerStyles={styles.positioner}
        resetKey={resetKey}
        rootStyles={styles.root}
        width={width}
      >
        {children}
      </LayerSurface>
    </Portal>
  );
  return <LayerRootSurface isOpen={isOpen} layer={layer} surface={surface} weight={weight} />;
}

/**
 * A raiz da camada, no componente que o peso pede. O `Drawer` so existe com
 * `placement` — por isso a raiz e escolhida aqui, e nao a do `Dialog`.
 */
function LayerRootSurface(props: LayerRootSurfaceProps): ReactElement {
  const { isOpen, layer, surface, weight } = props;
  if (weight === 'drawer') {
    return (
      <ChakraDrawer.Root
        closeOnEscape
        closeOnInteractOutside={layer.closeOnOutside}
        modal={layer.isModalLayer}
        onOpenChange={layer.openChange}
        open={isOpen}
        placement="end"
      >
        {surface}
      </ChakraDrawer.Root>
    );
  }
  return (
    <ChakraDialog.Root
      closeOnEscape
      closeOnInteractOutside={layer.closeOnOutside}
      modal={layer.isModalLayer}
      onOpenChange={layer.openChange}
      open={isOpen}
    >
      {surface}
    </ChakraDialog.Root>
  );
}

type LayerRootSurfaceProps = {
  isOpen: boolean;
  layer: LayerDescription;
  surface: ReactElement;
  weight: LayerWeight;
};

/**
 * As pecas da camada no namespace do peso: o `Dialog` e o `Drawer` sao o mesmo
 * componente Ark UI, mas cada um carrega a sua receita de slots, e misturar os
 * dois namespaces quebra o contexto de estilos.
 */
function resolvePositioner(weight: LayerWeight): ElementType {
  return weight === 'drawer' ? ChakraDrawer.Positioner : ChakraDialog.Positioner;
}

function resolveContent(weight: LayerWeight): ElementType {
  return weight === 'drawer' ? ChakraDrawer.Content : ChakraDialog.Content;
}

type LayerSurfaceProps = {
  children: ReactNode;
  closable: boolean;
  closeStyles: SystemStyleObject;
  content: ElementType;
  contentHeight: string | undefined;
  label: string | undefined;
  layer: LayerDescription;
  maxHeight: string;
  onClose: () => void;
  positioner: ElementType;
  positionerStyles: SystemStyleObject;
  resetKey: number;
  rootStyles: SystemStyleObject;
  width: string | undefined;
};

function LayerSurface(props: LayerSurfaceProps): ReactElement {
  const {
    children,
    closable,
    closeStyles,
    content,
    contentHeight,
    label,
    layer,
    maxHeight,
    onClose,
    positioner,
    positionerStyles,
    resetKey,
    rootStyles,
    width,
  } = props;
  const Positioner = positioner;
  const Content = content;
  return (
    <Positioner
      css={positionerStyles}
      height={layer.size}
      inset={layer.inset}
      position={layer.position}
      width={layer.size}
    >
      <LayerContent
        closable={closable}
        closeStyles={closeStyles}
        content={Content}
        height={contentHeight}
        label={label}
        maxHeight={maxHeight}
        onClose={onClose}
        resetKey={resetKey}
        styles={rootStyles}
        width={width}
      >
        {children}
      </LayerContent>
    </Positioner>
  );
}

type LayerDescription = {
  closeOnOutside: boolean;
  inset: string | undefined;
  isModalLayer: boolean;
  openChange: (details: { open: boolean }) => void;
  position: string;
  size: string | undefined;
};

function describeLayer(
  contained: boolean,
  weight: LayerWeight,
  onClose: () => void,
): LayerDescription {
  return {
    closeOnOutside: weight === 'drawer' && !contained,
    inset: contained ? '0' : undefined,
    isModalLayer: !contained,
    openChange: buildOpenChange(onClose),
    position: contained ? 'absolute' : 'fixed',
    size: contained ? '100%' : undefined,
  };
}

/**
 * A altura maxima da camada. A lateral e encostada na borda e toma a tela
 * inteira; as demais sobram a folga do positioner em volta.
 */
function computeMaxHeight(contained: boolean, weight: LayerWeight): string {
  if (contained) {
    return '100%';
  }
  return weight === 'drawer' ? '100dvh' : 'calc(100dvh - 4rem)';
}

/**
 * A lateral e sempre da altura da tela: a altura dela vem da receita, nao do
 * `height` de quem chama. O `height` do modal continua valendo.
 */
function computeContentHeight(weight: LayerWeight, height: string | undefined): string | undefined {
  return weight === 'drawer' ? undefined : height;
}

type LayerContentProps = {
  children: ReactNode;
  closable: boolean;
  closeStyles: SystemStyleObject;
  content: ElementType;
  height: string | undefined;
  label: string | undefined;
  maxHeight: string;
  onClose: () => void;
  resetKey: number;
  styles: SystemStyleObject;
  width: string | undefined;
};

function LayerContent(props: LayerContentProps): ReactElement {
  const {
    children,
    closable,
    closeStyles,
    content,
    height,
    label,
    maxHeight,
    onClose,
    resetKey,
    styles,
    width,
  } = props;
  const Content = content;
  const closeButton = closable ? (
    <LayerCloseButton closeStyles={closeStyles} onClose={onClose} />
  ) : null;
  return (
    <Content aria-label={label} css={styles} height={height} maxHeight={maxHeight} width={width}>
      <Box
        borderRadius="inherit"
        display="flex"
        flex="1"
        flexDirection="column"
        key={resetKey}
        minH="0"
        overflow="visible"
      >
        {children}
      </Box>
      {closeButton}
    </Content>
  );
}

function buildOpenChange(onClose: () => void): (details: { open: boolean }) => void {
  return function handleOpenChange(details: { open: boolean }): void {
    if (!details.open) {
      onClose();
    }
  };
}
