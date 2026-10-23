import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { Button } from '~/shared/ui/button';
import { TextField } from '~/shared/ui/field';
import { IconBolt, IconCoin, IconHeart, IconSearch } from '~/shared/ui/icon';
import { Text } from '~/shared/ui/text';

import { BaseComponents } from './BaseComponentsSection';
import { SectionHeader } from './SectionHeader';

const TONES = ['primary', 'secondary', 'ghost', 'danger'] as const;

const PALETTES = ['arcane', 'frost', 'gold', 'blood', 'ember', 'verdant'] as const;

const TONE_LABELS: Record<(typeof TONES)[number], string> = {
  danger: 'Destrutivo',
  ghost: 'Fantasma',
  primary: 'Principal',
  secondary: 'Secundário',
};

export function ComponentsSection(): ReactElement {
  return (
    <Box marginBlockEnd="16">
      <SectionHeader
        description="O vocabulário base do sistema. Botão, texto, campo, slot, camada e barra. Toda tela do app é montada com estes componentes; nenhum deles aceita estilo solto por fora."
        id="componentes"
        title="Componentes"
      />
      <ButtonsBlock />
      <InputsBlock />
      <BarsBlock />
      <BaseComponents />
    </Box>
  );
}

function ButtonsBlock(): ReactElement {
  const toneButtons = TONES.map(renderTone);
  const paletteButtons = PALETTES.map(renderPalette);
  return (
    <Box marginBlockEnd="8">
      <Text color="fg" marginBlockEnd="1" variant="section">
        Botões
      </Text>
      <Text color="fg.muted" marginBlockEnd="4" maxW="70ch" variant="body">
        O <strong>tom</strong> decide o papel do botão: principal é a ação da tela, secundário é a
        alternativa, fantasma é a terceira opção e destrutivo é o único que usa vermelho — e ele
        nunca fica ao lado do principal. A <strong>paleta</strong> decide a cor, e é ela que carrega
        o elemento de um item.
      </Text>
      <Box alignItems="center" display="flex" flexWrap="wrap" gap="3">
        {toneButtons}
      </Box>
      <Text color="fg.subtle" marginBlockEnd="2" marginBlockStart="5" variant="meta">
        PALETAS
      </Text>
      <Box alignItems="center" display="flex" flexWrap="wrap" gap="3">
        {paletteButtons}
        <Button disabled size="sm">
          Desabilitado
        </Button>
        <Button size="sm">
          <IconSearch />
          Buscar
        </Button>
      </Box>
    </Box>
  );
}

function renderTone(tone: (typeof TONES)[number]): ReactElement {
  const label = TONE_LABELS[tone];
  return (
    <Button key={tone} size="sm" tone={tone}>
      {label}
    </Button>
  );
}

function renderPalette(palette: (typeof PALETTES)[number]): ReactElement {
  return (
    <Button key={palette} palette={palette} size="sm" tone="secondary">
      {palette}
    </Button>
  );
}

function InputsBlock(): ReactElement {
  return (
    <Box marginBlockEnd="8">
      <Text color="fg" marginBlockEnd="1" variant="section">
        Campos
      </Text>
      <Text color="fg.muted" marginBlockEnd="4" maxW="70ch" variant="body">
        O campo mantém a borda, porque a borda aqui comunica estado e não profundidade. Rótulo, erro
        e ajuda andam juntos.
      </Text>
      <Box display="flex" flexWrap="wrap" gap="4" maxW="30rem">
        <TextField
          aria-label="Buscar item"
          autoComplete="off"
          name="busca"
          placeholder="Buscar item"
        />
        <TextField
          aria-label="Sem resultado"
          autoComplete="off"
          disabled
          name="busca-vazia"
          placeholder="Sem resultado"
        />
        <TextField
          aria-invalid="true"
          aria-label="Valor inválido"
          autoComplete="off"
          invalid
          name="busca-erro"
          placeholder="Valor inválido"
        />
        <TextField
          aria-label="Buscar item"
          autoComplete="off"
          clearable
          defaultValue="Poção de Cura"
          name="busca-com-clean"
          placeholder="Buscar item"
        />
      </Box>
    </Box>
  );
}

function BarsBlock(): ReactElement {
  return (
    <Box marginBlockEnd="8">
      <Text color="fg" marginBlockEnd="1" variant="section">
        Barras de recurso
      </Text>
      <Text color="fg.muted" marginBlockEnd="4" maxW="70ch" variant="body">
        Vida e stamina nunca são só cor. Cada uma traz ícone, rótulo e número, para que a informação
        sobreviva a quem não distingue o matiz.
      </Text>
      <Box display="flex" flexWrap="wrap" gap="6">
        <ResourceBar color="hp" icon={<IconHeart />} label="Vida" ratio={0.68} />
        <ResourceBar color="stamina" icon={<IconBolt />} label="Stamina" ratio={0.42} />
        <ResourceBar color="currency.gold" icon={<IconCoin />} label="Gold" ratio={0.55} />
      </Box>
    </Box>
  );
}

type ResourceBarProps = {
  color: string;
  icon: ReactElement;
  label: string;
  ratio: number;
};

function ResourceBar(props: ResourceBarProps): ReactElement {
  const { color, icon, label, ratio } = props;
  const width = `${ratio * 100}%`;
  const percent = `${Math.round(ratio * 100)}%`;
  return (
    <Box minW="12.5rem">
      <Box alignItems="center" display="flex" gap="2" marginBlockEnd="1">
        <Box color={color} display="flex">
          {icon}
        </Box>
        <Text color="fg.muted" variant="meta">
          {label}
        </Text>
        <Text color="fg" marginInlineStart="auto" variant="numeric">
          {percent}
        </Text>
      </Box>
      <Box bg="bg.sunken" borderRadius="xs" boxShadow="recessed" height="0.5rem" overflow="hidden">
        <Box bg={color} height="full" transition="width 180ms ease-out" width={width} />
      </Box>
    </Box>
  );
}
