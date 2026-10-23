# Design System

Este documento é a fonte da verdade da interface do cliente. Ele descreve a direção visual, a arquitetura em camadas, os tokens, o catálogo de componentes reutilizáveis e as regras para montar uma tela nova.

> O código vive em `apps/client/src/shared/ui/` e `apps/client/src/shared/theme/`. Este documento explica **como usar**; o código é a referência dos valores exatos.

---

## 1. Em uma frase

Interface de jogo escura, densa e geométrica, com tipografia de título gravada, cor violeta para o destaque e âmbar só para moeda. O chrome ao redor do jogo é o do Dota 2; o pixel art fica no canvas do PixiJS.

---

## 2. Direção visual

| Elemento | Decisão |
| --- | --- |
| Tema | Escuro único. Sem tema claro. |
| Fundo | Azul-cinza dessaturado, chapado. Nunca preto puro, nunca gradiente. |
| Destaque | Violeta arcano (`arcane`). Seleção, aba ativa, ação principal. |
| Secundário | Ciano frio (`frost`). Estado disponível, moeda premium. |
| Moeda | Âmbar mineral (`gold`), dessaturado. Só para o gold coin. |
| Perigo | Vermelho seco (`blood`). Dano, vida, destrutivo. |
| Elementos | Laranja (`ember`) para fogo, verde-oliva (`verdant`) para planta. |
| Título | Cinzel — serifa chanfrado, de título gravado. |
| Rótulo | Barlow Semi Condensed, caixa alta, entreletra aberta. |
| Texto | Barlow, caixa normal. |
| Números | JetBrains Mono, tabulares. |
| Superfície | Sombra em camadas, não traço. |
| Raio | Quase reto: 1px a 12px. |
| Densidade | Alta. Information dense, não espaçosa. |

### Por que violeta, e não dourado

O âmbar e o verde saturados da paleta do Dota 2 funcionam dentro do jogo, mas numa interface administrativa escura eles leem como brinquedo. O violeta tem a mesma função de destaque com saturação bem menor. O âmbar continua existindo, mas só como moeda — onde ele é informação, não destaque.

---

## 3. Arquitetura

O cliente segue o **Feature-Sliced Design** (FSD v2.1). As camadas, a regra de dependência, a API pública de uma fatia e a pergunta que decide onde o código mora estão em [Estrutura](STRUCTURE.md).

> Este documento é o do **design system**: os tokens, os componentes e as regras de construção da interface. Onde o código mora é assunto da estrutura.

---

## 4. Tokens

Três camadas. A interface consome a última.

### 4.1 Base — `shared/theme/tokens.ts`

Valores brutos, sem significado de uso. Sete escalas de cor (`base`, `arcane`, `frost`, `gold`, `blood`, `ember`, `verdant`), mais fontes, raios e sombras.

### 4.2 Semântico — `shared/theme/semanticTokens.ts`

Diz para que cada cor serve. É a camada que a interface consome.

| Namespace | Uso |
| --- | --- |
| `bg` | `bg` (canvas), `bg.panel`, `bg.raised`, `bg.sunken`, `bg.overlay`, `bg.veil`, `bg.selected`, `bg.error` |
| `fg` | `fg`, `fg.muted`, `fg.subtle`, `fg.error` |
| `border` | `border`, `border.emphasized`, `border.muted`, `border.subtle`, `border.selected`, `border.error` |
| `accent` | `accent.arcane`, `accent.frost`, `accent.gold` — o destaque **decorativo**: a linha do topo do painel, a cunha de equipado, a régua da wordmark |
| `focus` | `focus.ring` — o anel de foco do sistema, em um lugar só |
| `state` | `state.selected`, `state.active`, `state.equipped`, `state.disabled` |
| `currency` | `currency.gold`, `currency.diamond` |
| `hp` / `stamina` | A vida da criatura e a stamina do treinador |
| `element` | `element.fire`, `element.water`, `element.plant`, `element.neutral` |

**Um namespace com chave `DEFAULT` se acessa pelo nome, sem sufixo.** `currency.gold` resolve `currency.gold.DEFAULT`; `currency.gold.DEFAULT` não existe. O mesmo vale para `bg` e `border`: `bg` é o canvas, `border` é a borda padrão.

**As paletas do Chakra apontam para as escalas do jogo.** `colorPalette="arcane"` é a paleta `arcane`; `colorPalette="red"` é a mesma de `blood`. O nome nativo nunca produz uma cor fora do sistema.

Cada paleta tem **papéis**, não passos. `arcane.strong` (600) é o fundo de ação destacada, `arcane.solid` (500) é o fundo do botão, `arcane.contrast` (50) é o texto sobre ele, `arcane.border` (300) é a borda, `arcane.fg` (300) é o texto do chip, `arcane.muted` (900) é o fundo hover, `arcane.textSoft` (200) é o texto suave. É assim que o `IconButton` e o `Chip` consomem uma paleta sem conhecer nenhum número.

**O anel de foco é o mesmo em toda parte.** Toda paleta tem `focusRing` apontando para `arcane.300`, então o foco nunca muda de cor conforme o elemento — nem no botão primário, onde o fundo é violeta.

**Os raios de camada** (`radii.l1`, `radii.l2`, `radii.l3`) decidem o quanto fica reto o botão, o campo e o menu. É o token `radii.l2` que resolve o raio do botão.

### 4.3 Estilo de texto — `shared/theme/textStyles.ts`

| Variante | Uso |
| --- | --- |
| `display` | A wordmark |
| `title` | Título de tela e de modal |
| `name` | Nome de criatura, de item e de trainer |
| `section` | Cabeçalho de seção |
| `label` | Rótulo de botão, de aba e de item de menu |
| `meta` | Texto secundário: nível, categoria, status |
| `body` / `bodyLarge` | Texto corrido |
| `numeric` | Valor, preço, contador, tempo |

**O `textStyle` ganha do `fontSize`.** Quem aplica um estilo de texto não consegue diminuir o tamanho com `fontSize` por prop — o estilo vence, e a prop vira código morto. Por isso o tamanho mora **dentro** do estilo, e não na prop.

**A família display é sempre 900.** `display`, `title` e `name` usam o Cinzel, e o Cinzel é um serifa de contraste alto: no peso 800 a haste fina ainda competia com o fundo escuro da interface, e no 900 o título tem presença sem perder o desenho gravado. O peso mora na família, e não em cada estilo.

### 4.4 Receitas — `shared/theme/recipes/`

Estilos que **cruzam** camadas e por isso não pertencem a nenhum componente. Uma receita é a forma do Chakra de dizer: "este estilo é o mesmo aqui e ali, e tem variantes".

| Receita | O que é |
| --- | --- |
| `layer` | A anatomia de todo diálogo, modal e drawer: raiz, posicionador, título, corpo e rodapé, com a variante `weight` (`dialog`, `modal`, `drawer`). |
| `selectionRing` | A borda de seleção, desenhada por um pseudo-elemento por cima do elemento, com a variante `size` (`md`, `sm`). |

```ts
import { useSlotRecipe } from '@chakra-ui/react';

import { layerRecipe } from '~/shared/theme';

const recipe = useSlotRecipe({ recipe: layerRecipe });
const styles = recipe({ weight: 'modal' });
```

**O anel de seleção, por recipe:**

```tsx
import { useSelectionRing } from '~/shared/theme';

const ring = useSelectionRing();

<Box _before={isSelected ? ring : undefined} />
```

Se um valor é usado por `shared/ui/` e por `entities/`, ele é da linguagem do design e vai para `shared/theme/`. Se é usado só por um componente, ele é dele e fica no arquivo dele.

---

## 5. As regras de construção

Estas sete regras definem a forma do código. Elas valem para `shared/ui/`, para as fatias de `entities/` e `features/` e para a galeria.

### R1 — Um componente por arquivo, e uma pasta por componente

Cada componente vive na sua própria pasta, em um arquivo com o mesmo nome. Uma pasta pode ter vários arquivos quando eles compõem o mesmo componente — um `Modal` que precisa de cabeçalho e rodapé vira `modal/Modal.tsx`, `modal/ModalHeader.tsx`, `modal/ModalBody.tsx` e `modal/ModalFooter.tsx`.

Dois componentes no mesmo arquivo é anti-pattern forte: mistura duas responsabilidades, o arquivo vira o lugar onde se procura "qualquer coisa que renderiza", e o nome do arquivo deixa de dizer o que ele é. Funções auxiliares e constantes **podem** ficar no mesmo arquivo, desde que não sejam exportadas como componente.

### R2 — Nomenclatura dos arquivos irmãos

Dentro da pasta de um componente, os arquivos auxiliares têm o prefixo do componente que os serve, em camelCase:

| Arquivo | Conteúdo |
| --- | --- |
| `X.tsx` | O componente `X`. |
| `x.types.ts` | Os tipos e as props de `X`. |
| `x.constants.ts` | As constantes de `X`. |
| `useX.ts` | O hook com a lógica de `X`. |
| `x.context.ts` | O React context de `X`. |

Exemplos reais:

```
shared/ui/frame/Frame.tsx      shared/ui/frame/frame.types.ts      shared/ui/frame/frame.constants.ts
shared/ui/frame/Slot.tsx           shared/ui/frame/slot.types.ts
shared/ui/modal/Modal.tsx          shared/ui/modal/modal.types.ts
shared/ui/alert/useAlerts.ts       shared/ui/alert/alert.types.ts       shared/ui/alert/alert.context.ts
entities/trainer/ui/StarterGrid.tsx  entities/trainer/model/trainer.types.ts
```

**O prefixo responde "de quem é este arquivo".** `types.ts` solto não responde; `trainer.types.ts` responde.

**E a `theme/`?** Para o que cruza camadas. O anel de seleção é usado pelo `Slot` (`shared/ui/`) e pelo `TrainerCard` (`entities/trainer/`), então mora em `shared/theme/recipes/selectionRing.ts` — não em `shared/ui/frame/ring.ts`, que fingia ser do frame e na verdade era de todo mundo.

### R3 — Composição, não configuração

**Props descrevem dados, nunca estrutura.** A estrutura vem de `children` e de partes componentes.

O anti-pattern é a prop que desenha: `title`, `subtitle`, `showIcon`, `iconPosition`, `footerText`. Cada uma delas é uma decisão de layout congelada dentro de uma prop, e cada variação nova vira mais uma prop.

O caminho certo é trocar a prop pela parte:

```tsx
// ❌ configuração: o Frame decide como o cabeçalho é
<Frame title="Loja" footer={<Button tone="primary">Comprar</Button>} />

// ✅ composição: quem monta decide a estrutura
<Frame>
  <FrameHeader>Loja</FrameHeader>
  <Box padding="4">{itens}</Box>
  <FrameFooter>
    <Button tone="primary">Comprar</Button>
  </FrameFooter>
</Frame>
```

**Como saber quando trocar uma prop por uma parte:** quando a prop tem mais de um valor possível que muda o *layout* (e não o *dado*), ela vira parte. `tone` muda a cor — continua prop. `title` muda a estrutura — vira `FrameHeader`.

**Texto entra como `children`, não como `label`.** `<Tab label="Comprar" />` vira `<Tab>Comprar</Tab>`. O `label` é um texto que a interface sempre desenhou do mesmo jeito; `children` deixa o chamador desenhar do jeito que precisar.

### R4 — A lógica fora da view

Um componente que tem estado e comportamento vira **dois arquivos**: um hook com a lógica, e o componente com a view.

```ts
// features/store/model/useStoreQuantity.ts — a lógica, sem DOM
export function useStoreQuantity(limit: number): StoreQuantityView
```

```tsx
// features/store/ui/StoreQuantityField.tsx — a view
export function StoreQuantityField(props: StoreQuantityFieldProps): ReactElement
```

O hook é testável sem renderizar nada, e a mesma lógica serve a visuais diferentes.

**Quando a lógica precisa ser compartilhada com as partes do componente**, ela vai para um context, e o hook vira `useXContext`:

```ts
// shared/ui/alert/alert.context.ts
export const AlertsContext = createContext<AlertStackValue>(STUB_STACK);

// shared/ui/alert/useAlerts.ts
export function useAlerts(): AlertStackValue
```

Assim quem mostra um aviso não sabe que existe uma fila de avisos, e quem fecha um aviso não precisa saber como ele foi mostrado.

**A lógica que o Chakra já resolve não é nossa.** O ESC, o clique fora, o *focus trap* e a restauração de foco da camada são do `Dialog` do Chakra. Escrever isso de novo é perder acessibilidade para ganhar nothing.

### R5 — Base não conhece o domínio

`shared/ui/` não importa nada de `shared/` além de `shared/theme/`. Se precisa de mais que isso, é sinal de que o componente não é base.

O que o base **pode** fazer é expor os ganchos: o `Slot` sabe o que é selecionado e equipado, mas não sabe o que é uma habilidade. Quem sabe é o domínio.

### R6 — Só token semântico, e o guarda que fiscaliza

Nenhum componente consome um passo cru de escala (`arcane.400`) nem uma cor crua (`#B8A4EF`). Ele consome o token semântico que diz o **papel** daquela cor (`state.selected`, `accent.arcane`, `bg.panel`).

A regra não é só documentação: `scripts/check-tokens.ts` resolve cada valor de cor pelo mesmo dicionário de tokens que a interface usa e falha o typecheck quando o token não existe, quando a cor é crua, ou quando um componente de `shared/ui/` consome um passo cru de escala.

> Sem essa conferência, `bg="coin"` — um token que não existe — compila, passa no typecheck e vira `background: coin`: CSS inválido, que o navegador descarta em silêncio. O elemento fica sem cor e ninguém é avisado. Foi exatamente assim que a régua da wordmark e a linha do topo do painel sumiram da tela.

### R7 — Quando o Chakra já resolve, o design system usa o Chakra

*Focus trap*, `aria-modal`, rótulo acessível, restauração do foco, scroll lock, portal, inércia do fundo, posicionamento com *flip*, região `aria-live`, navegação por setas: isso é comportamiento, e o Chakra já faz. Reescrever é trocar acessibilidade por estética.

O que é nosso é a **aparência** e, quando o comportamento é autoral, a **interação**: o popup que abre no hover como tooltip, o menu contextual que abre no clique, o aviso com barra de tempo, a aba com sublinhado violeta.

---

## 6. Catálogo de componentes

### 6.1 Shared — ação e texto

| Componente | Import | Quando usar |
| --- | --- | --- |
| `Button` | `~/shared/ui/button` | Qualquer ação. `tone`: `primary` (a ação da tela), `secondary` (alternativa), `ghost` (terceira opção), `danger` (destrutivo). `palette` escolhe a paleta do jogo quando `tone` não basta. Nunca `colorPalette` direto. |
| `Text` | `~/shared/ui/text` | Qualquer texto. `variant` vem da tabela 4.3. Nunca `fontSize` ad hoc. |
| `TextField` | `~/shared/ui/field` | Campo de texto e de senha. Já vem em 16px. `clearable` mostra o **X** dentro do campo, à direita, que limpa o valor. O X é um `<button>` de verdade, com `aria-label`. `invalid` troca a borda pela borda de erro. Campo sem rótulo visível recebe `aria-label`. |
| `IconButton` | `~/shared/ui/button` | Botão só de ícone. `tone`: `neutral`, `primary`, `secondary`, `danger`. Sempre 44px de alvo. |
| `IconBadge` | `~/shared/ui/badge` | O quadrado arredondado que segura um ícone dentro de um alerta ou de um item. |
| `Pressable` | `~/shared/ui/interactive` | Torna qualquer coisa clicável **e** acessível: é um `<button>` de verdade, com Enter e Espaço, disabled nativo, anel de foco e hover. Todo card que se clica usa este. |
| `NativeButton` | `~/shared/ui/button` | O botão sem estilo. É a base de `Pressable`, `IconButton`, `Tab` e `Chip`. |
| `Link` | `~/shared/ui/link` | Link de navegação. Sem `tone`, é link de texto: cor primária, sublinhado, hover mais claro, e o peso vem do `textStyle`. Com `tone`, é um link **com cara de botão** — o mesmo `as="button"` do shadcn, e o sublinhado some. Aceita `width`, para o botão de link ocupar a largura do card. Nenhum link de texto usa o `Link` cru do router. **Desabilitado é de verdade:** o `<a>` continua sendo clicável, então o desabilitado ganha `aria-disabled`, sai da tabulação e tem o clique cancelado — nos dois ramos. |
| `Icon` | `~/shared/ui/icon` | A primitiva do svg: `size`, traço de 2px, grade de 24. Todo ícone é composed dela. |
| Ícones | `~/shared/ui/icon` | `IconBag`, `IconBell`, `IconBolt`, `IconChest`, `IconClose`, `IconCoin`, `IconCrosshair`, `IconGem`, `IconGear`, `IconHeart`, `IconMap`, `IconPlay`, `IconPotion`, `IconPrism`, `IconSearch`, `IconStore`, `IconTeam`, `IconUsers`. |

**Um ícone novo é só o caminho:**

```tsx
// shared/ui/icon/IconSpark.tsx
import type { ReactElement } from 'react';

import { Icon } from './Icon';
import type { IconProps } from './icon.types';

export function IconSpark(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="M12 3v18M3 12h18" />
    </Icon>
  );
}
```

Nenhum svg inteiro, nenhum `DEFAULT_SIZE` repetido, nenhum `strokeWidth` reescrito. O tamanho e o traço são da primitiva.

### 6.2 Shared — superfície

| Componente | Import | Quando usar |
| --- | --- | --- |
| `Frame` | `~/shared/ui/frame` | O painel. `tone`: `panel` (padrão), `recessed` (rebaixo), `overlay` (modal), `transparent`. `accent` a linha violeta no topo. O cabeçalho e o rodapé são **partes**, não props. |
| `FrameHeader` | `~/shared/ui/frame` | O cabeçalho com divisória. Recebe `children`. |
| `FrameFooter` | `~/shared/ui/frame` | O rodapé com divisória. Recebe `children`. |
| `FrameAccent` | `~/shared/ui/frame` | A linha violeta no topo do painel. |
| `Slot` | `~/shared/ui/frame` | O slot de item, de criatura e de habilidade. `selected` (anel violeta + marcador de canto), `equipped` (cunha no canto), `empty`. |
| `SlotGrid` | `~/shared/ui/frame` | A grade de slots. As colunas se ajustam à largura (`auto-fill`) e o `rows` completa a grade com slots vazios. É a grade de inventário da mochila, do armazenamento e da loja — as três têm a mesma anatomia. |
| `CornerBracket` | `~/shared/ui/frame` | O marcador de canto do slot selecionado. |
| `EquippedWedge` | `~/shared/ui/frame` | A cunha de equipado. |
| `Cooldown` | `~/shared/ui/frame` | A sombra de cooldown que desce sobre o slot. |
| `useSelectionRing` | `~/shared/theme` | A borda de seleção, 2px em `state.selected`, desenhada por um pseudo-elemento por cima do elemento. Use quando precisar marcar a seleção em um elemento que não é `Slot`. |

### 6.3 Shared — a camada

São **três pesos da mesma camada**, com anatomia idêntica.

| | `Dialog` | `Modal` | `Drawer` |
| --- | --- | --- | --- |
| Para quê | Confirmação, aviso, decisão de duas opções | Tela com conteúdo interno: loja, área de caçada, mochila | A lateral |
| Título | À esquerda, `lg` | Centralizado, `2xl` | Centralizado, `xl` |
| Fechar | Pelos botões ou pelo ESC. **Sem** botão no canto | Pelo ESC ou pelo botão no canto | Pelo ESC, pelo botão no canto ou pelo fundo |
| Largura | ~420px, aperta no conteúdo | Declarada, com o corpo rolando | ~320px, encostada na borda |
| Fundo | **Não** fecha no clique fora | **Não** fecha no clique fora | Fecha no clique fora |

| Componente | Import |
| --- | --- |
| `Dialog` / `DialogHeader` / `DialogBody` / `DialogFooter` | `~/shared/ui/dialog` |
| `Modal` / `ModalHeader` / `ModalBody` / `ModalFooter` | `~/shared/ui/modal` |
| `Drawer` / `DrawerHeader` / `DrawerBody` / `DrawerFooter` | `~/shared/ui/drawer` |
| `Overlay` | `~/shared/ui/overlay` | O fundo escurecido da camada. |

**As três camadas são o `Dialog` do Chakra.** `Dialog`, `Modal` e `Drawer` são o mesmo componente Ark UI com pesos diferentes: o `Dialog` é a confirmação, o `Modal` é a tela com conteúdo, o `Drawer` é a lateral. O que o Chakra já resolve — *focus trap*, `aria-modal`, `aria-labelledby`, restauração do foco no gatilho, scroll lock, portal e inércia do fundo — vem de graça, e **não se reimplementa**.

**Uma camada sem cabeçalho precisa de nome.** A camada que não usa a parte de cabeçalho — um drawer com imagem no lugar do título — recebe `label`, que vira o nome acessível do diálogo. Sem ele, o leitor de tela anuncia um diálogo sem nome.

**A anatomia vive em uma receita, e os três componentes são o mesmo peso.** `shared/ui/layer/` tem a raiz, o título, o corpo e o rodapé; `Dialog`, `Modal` e `Drawer` escolhem a variante `weight` da receita `layer` e nada mais. Antes da receita, a mesma anatomia estava escrita três vezes, uma por camada — e as três cópias divergiam.

O que é nosso é a aparência: o `Dialog.Content` do Chakra com o nosso fundo, borda e sombra.

**Camada contida não é camada.** Um overlay `contained` — o que a galeria usa para mostrar um modal dentro da página — passa `modal={false}`: sem focus trap, sem `aria-modal`, sem roubar o foco da página. E o `Overlay` dele é `absolute`, não `fixed`, para não cobrir a página inteira e engolir os cliques de tudo que está embaixo.

**A camada é do Chakra, não nossa.** Escrever o `Dialog` com `Box` é trocar comportamento por estética: perde-se focus trap, `aria-modal`, rótulo acessível, restauração de foco e scroll lock. Quando o Chakra já resolve, o design system usa o Chakra.

**Inscrição acontece dentro do efeito, nunca no render.** `useEffect(subscribe(...), deps)` inscreve no `document` **durante o render** — o React recebe o `teardown` como se fosse o efeito e o chama logo após o mount. Resultado: cada re-render deixa um listener a mais no `document`, e só o primeiro teardown remove um deles. Os órfãos ficam vivos com o nó do conteúdo já desmontado: todo clique vira "fora do diálogo", o `preventDefault()` impede o foco de qualquer input, e o `onClose` antigo fecha o diálogo que está aberto.

O padrão certo é uma função de inscrição **estável**, criada uma vez e passada ao `useEffect`:

```ts
const subscribeRef = useRef<(() => void) | null>(null);
if (subscribeRef.current === null) {
  subscribeRef.current = buildSubscribe(stateRef);
}
useEffect(subscribeRef.current, DEPS);
```

É o mesmo padrão do `useHasHoverCapability`. Vale para qualquer `addEventListener` que vive dentro de um componente.

**A anatomia é a mesma, o peso não.** Todo dialog e todo modal têm cabeçalho, corpo e rodapé; o que muda é o tamanho e o que cabe dentro.

**Um diálogo é um `Dialog`, nunca um `Modal` encolhido.** E nunca dois: um diálogo que existe no app existe na galeria **como o mesmo componente**, com o mesmo texto.

### 6.4 Shared — sobreposição

`Modal` e `Drawer` são **compostos**: a raiz entrega a estrutura e o contexto, e as partes desenham. As partes vêm de `shared/ui/layer/`, e cada camada pública escolhe o seu peso.

| Componente | Import | Quando usar |
| --- | --- | --- |
| `Modal` | `~/shared/ui/modal` | Modal composto. Fecha por ESC ou pelo botão; clicar fora **não** fecha. |
| `ModalHeader` | `~/shared/ui/modal` | Cabeçalho do modal. Recebe `children`. |
| `ModalBody` | `~/shared/ui/modal` | O corpo do modal. Recebe `children`. |
| `ModalFooter` | `~/shared/ui/modal` | O rodapé do modal. Recebe `children`. |
| `Drawer` | `~/shared/ui/drawer` | Drawer lateral. Fecha por ESC e pelo clique no fundo. |
| `DrawerHeader` / `DrawerBody` / `DrawerFooter` | `~/shared/ui/drawer` | As partes do drawer. |
| `LayerRoot` / `LayerHeader` / `LayerBody` / `LayerFooter` | `~/shared/ui/layer` | A camada em si. Não se usa direto: `Dialog`, `Modal` e `Drawer` são as portas. |
| `Overlay` | `~/shared/ui/overlay` | O fundo escurecido. |

```tsx
<Modal onClose={onClose}>
  <ModalHeader>Mochila</ModalHeader>
  <ModalBody>
    <SlotGrid />
  </ModalBody>
  <ModalFooter>
    <Button tone="primary">Fechar</Button>
  </ModalFooter>
</Modal>
```

O `ModalHeader` não recebe `onClose`: ele lê do contexto do overlay. Isso é R4 aplicado — a lógica fica em um lugar e as partes se conectam a ela.

### 6.5 Shared — navegação, filtro e aviso

| Componente | Import | Quando usar |
| --- | --- | --- |
| `Tabs` / `TabBar` / `Tab` / `TabPanel` | `~/shared/ui/tab` | Navegação dentro de um modal. São as `Tabs` do Chakra (Ark UI): `role="tablist"`, `aria-selected` e navegação por setas. A aba ativa ganha o sublinhado violeta e o fundo rebaixado — o estado vem do `data-selected` do Ark, nunca de uma prop. O `Tab` recebe `children` e `value`; **toda aba vem com o seu painel** — uma aba sem painel é um botão, e usa `Chip`. O painel não tem anel de foco: um contorno em volta de metade do modal é pior do que nenhum. |
| `Chip` | `~/shared/ui/chip` | Filtro inclinado. Não é aba: é um botão que alterna, com `aria-pressed`. O texto entra como `children`. `tone`: `arcane`, `blood`, `ember`, `frost`, `gold`, `neutral`, `verdant` — uma variante por elemento, para o elemento da criatura aparecer igual em filtro, em card e em lista. O filtro que **troca de painel** — os da mochila — é uma `Tab`, e usa o mesmo componente da loja. |
| `Popup` | `~/shared/ui/popup` | O popup do sistema: o `Tooltip` do Chakra (Ark UI) com a nossa superfície. Ele espera antes de abrir, espera antes de fechar e **fica aberto enquanto o cursor está sobre o painel** — passar o mouse do slot para o painel nunca faz ele piscar. No toque não há popup: o que abre a informação é o menu. |
| `PopupCard` | `~/shared/ui/popup` | A superfície do popup, sem o popup. |
| `ContextMenu` | `~/shared/ui/menu` | O menu de ações de um elemento: o `Menu` do Chakra (Ark UI). O **clique — esquerdo ou direito do mouse** abre o mesmo menu na posição do ponteiro. No toque, o toque longo abre. O gatilho do menu vive num `Box` de `display: contents`: os atributos do menu (`id`, `data-scope`) pousam nesse wrapper, não no elemento do gatilho — assim um `Popup` aninhado ao gatilho (a tooltip da criatura) mantém a própria identidade DOM e o painel dele nasce ancorado. O `mergeTriggerProps` continua valendo dentro do `Popup`, que compõe as props do gatilho dele mesmo. |
| `ScrollArea` | `~/shared/ui/scroll` | Área rolável, com barra sempre visível. |
| `AlertsProvider` / `useAlerts` / `AlertToast` / `AlertClose` / `AlertProgress` / `AlertsViewport` | `~/shared/ui/alert` | O aviso do canto superior direito, com barra de tempo. É o `Toaster` do Chakra: a região tem `role="region"` e `aria-live="polite"`, então o leitor de tela anuncia o aviso. Ele **entra** deslizando e sai com fade; quem fecha, seja o tempo ou o botão, sempre sai animado. |

### 6.6 Brand, form, features, entities e widgets

| Componente | Import | Quando usar |
| --- | --- | --- |
| `BrandPage` | `~/shared/ui/brand` | Página de autenticação completa, com a wordmark. |
| `FormShell` | `~/shared/ui/form` | O shell do formulário. |
| `LoadingScreen` | `~/shared/ui/loading` | A tela de carregamento: a marca do jogo, o anel que gira e o "Carregando". Cobre o intervalo entre abrir o jogo e a rota entrar. |
| `FormField` | `~/shared/ui/form` | O campo do formulário, ligado ao React Hook Form: valor, `onChange`, `onBlur` e erro saem do `useController` e chegam no `TextField`. O erro **do campo** sai de dentro do `Field.Root`, e é o que amarra o `aria-invalid` e o `aria-errormessage` ao controle. O campo com erro também tem a **borda de erro**, e não só a mensagem. Recebe o `control` do formulário de forma explícita, e é por ele que o nome do campo é verificado na compilação. |
| `FormActions` | `~/shared/ui/form` | A coluna de ações do formulário. |
| `FormDivider` | `~/shared/ui/form` | O separador "ou". |
| `useZodForm` | `~/shared/ui/form` | Cria o formulário com o `zodResolver`, o schema e a política de validação do projeto. Todo formulário nasce aqui. As regras estão em [Formulários](FORMS.md). |
| `AuthUsernameField` | `~/features/authentication` | O campo de usuário **oculto**, que os gerenciadores de senha precisam para oferecer a conta salva. |
| `Wordmark` | `~/shared/ui/brand` | A marca `CREATURES` com a régua dourada. |
| `TrainerList` / `TrainerCard` / `CreateTrainerCard` | `~/entities/trainer` | A lista de treinadores e o card de criar. |
| `TrainerAvatar` / `GenderToggle` / `StarterGrid` | `~/entities/trainer` | A criação de trainer. |
| `TrainerDeleteDialog` | `~/features/delete-trainer` | O diálogo de exclusão. É o **mesmo** no app e na galeria. Sem caixa de alerta: a caixa repetia o que a descrição já dizia. O perigo fica no texto, na frase de irreversibilidade e no botão destrutivo. |
| `TrainersPanel` | `~/entities/trainer` | O painel da lista de treinadores: moldura, cabeçalho, lista, card de criar e as ações. É o **mesmo** no app e na galeria. |
| `CreateTrainerPanel` | `~/entities/trainer` | A moldura da criação de trainer. O formulário entra como `children`. |
| `BrandLayout` | `~/shared/ui/brand` | A wordmark + o conteúdo, centrado na tela. |
| `StoreModal` | `~/features/store` | A loja: abas Comprar/Vender, grade de slots, campo de quantidade com botões de soma no rodapé e total em gold coins. O `snapshot` é o catálogo de amostras da galeria. |
| `StorageModal` | `~/features/storage` | O armazenamento: seção Time e seção Criaturas, com a busca no rodapé. |
| `BackpackModal` | `~/features/backpack` | A mochila: a grade de slots do inventário. |
| `StarterCard` | `~/entities/trainer` | O card de criatura inicial, focusável pelo teclado. |
| `FormError` | `~/shared/ui/form` | A mensagem de erro do **formulário** — o erro que não pertence a um campo ("e-mail ou senha inválidos"). Não usa `Field.ErrorText`, porque aquele componente do Chakra só existe dentro de um `Field.Root` e estoura o contexto quando é renderizado sozinho. |
| `FormLabel` | `~/shared/ui/form` | O rótulo de um campo. Todo campo com rótulo usa este, para o mesmo estilo em toda parte. |
| `LegalNotice` | `~/features/authentication` | O aviso de termos e privacidade, variando a ação que o precede. |
| `Toolbar` / `ToolbarLeft` / `ToolbarRight` / `ToolbarIdentity` / `CurrencyBadge` | `~/widgets/game-hud` | A barra superior do jogo. É a **mesma** no app e na galeria — nunca duas cópias. |
| `SettingsMenu` | `~/widgets/game-hud` | O menu de configurações da tela do jogo: o botão da extrema direita da toolbar é o gatilho, e o menu tem as duas ações da sessão — "Trocar treinador" e "Sair da conta". É um **modal centralizado**, e não um menu no canto do botão: o menu de jogo é um *pausing*, e ele centraliza. |
| `ToolbarButton` | `~/widgets/game-hud` | O botão da toolbar: ele é **redondo**, como o de fechar do modal, e o `Popup` dele diz o que o botão faz. |
| `ItemTooltip` | `~/entities/item` | O popup de um item: o nome, o que ele faz e o valor dele na loja — o preço só aparece quando a loja negocia o item. |
| `TeamStrip` / `CreatureTab` / `CreaturePortrait` / `EmptyCreatureTab` | `~/widgets/game-hud` | As linguetas do time, logo abaixo da toolbar. Slot preenchido é maior e mostra o retrato com o nível e o nome da espécie; slot vazio é menor e não mostra nada. |
| `PlayButton` | `~/widgets/game-hud` | O botão de play: uma barra horizontal encostada na borda esquerda, acima da barra de habilidades, com o chevron e o rótulo. |
| `ShopButton` | `~/widgets/game-hud` | O botão da loja: um botão de texto flutuante logo acima da barra de habilidades. Flutua — nunca empurra o canvas. |
| `SkillBar` | `~/widgets/game-hud` | A barra de habilidades. É a **mesma** no app e na galeria. |

---

## 7. Como montar uma tela

### 7.1 A regra de ouro

**Toda a interface sai dos componentes acima.** Se uma tela precisa de um elemento que não existe, ele é um componente novo — em `shared/ui/` se serve a qualquer tela, em `entities/` ou `features/` se carrega regra de jogo. Nunca um `Box` com estilo solto.

Duas implementações — uma para a galeria e outra para o app — é o que faz as duas divergirem. A galeria mostra o componente real.

### 7.2 Antes de escrever: component ou layout?

```
Precisa de cor, borda, sombra ou raio?
  ├─ não → Box. Box serve para ARRUMAR, nunca para DECORAR.
  └─ sim → É um componente.
              ├─ serve a qualquer tela?        → shared/ui/
              └─ conhece regra do jogo?        → entities/ ou features/
```

### 7.3 Ordem de montagem

1. **Escolha a moldura.** `Frame` para painel, `Modal` para modal, `Drawer` para lateral, `BrandPage` para autenticação.
2. **Monte as partes da moldura** (`FrameHeader`, `FrameFooter`, `ModalBody`…) como `children`.
3. **Monte a hierarquia** com `Box` de layout: `display`, `gap`, `padding`, `alignItems`.
4. **Encha com conteúdo** usando `Text`, `Button`, `TextField`, `Slot`, `Tab`, `Chip`.
5. **Declare os estados** da superfície: carregando, vazio, erro, populado e limite.

### 7.4 Exemplo

```tsx
import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { Button } from '~/shared/ui/button';
import { Frame } from '~/shared/ui/frame';
import { FrameFooter } from '~/shared/ui/frame';
import { FrameHeader } from '~/shared/ui/frame';
import { Text } from '~/shared/ui/text';

export function CityPanel(): ReactElement {
  return (
    <Frame>
      <FrameHeader>Cidade</FrameHeader>
      <Box display="flex" flexDirection="column" gap="3" padding="4">
        <Text variant="body">Você está na cidade. A caçada continua quando fechar.</Text>
      </Box>
      <FrameFooter>
        <Button tone="primary">Entrar</Button>
      </FrameFooter>
    </Frame>
  );
}
```

### 7.5 Checklist antes de dar por pronto

- [ ] Nenhum `colorPalette` fora das paletas do jogo.
- [ ] Nenhum `fontSize` ou `fontWeight` fora de um `variant` de texto.
- [ ] Nenhum `Box` com cor, borda, sombra ou raio: isso é componente.
- [ ] Um componente por arquivo, e uma pasta por componente.
- [ ] Os arquivos irmãos seguem o prefixo do componente (`x.types.ts`, `x.constants.ts`, `useX.ts`).
- [ ] `shared/` não importa de `entities/`, `features/` ou `pages/`.
- [ ] Nenhuma prop que desenha: estrutura vem de `children` e de partes.
- [ ] A lógica com estado está em um hook, não no corpo do componente.
- [ ] Todo card clicável usa `Pressable`, e não um `onClick` solto em um `Box`.
- [ ] Todo controle clicável é `<button>` ou `<a>` de verdade — Enter e Espaço funcionam de graça.
- [ ] Nenhum botão dentro de outro botão.
- [ ] Todo link de texto usa o `Link` do design system, e não o `Link` cru do router.
- [ ] Nenhuma tela do app tem cópia de um componente que já existe em `shared/ui/`, `entities/` ou `features/`.
- [ ] Todo botão tem `tone`, não `variant` solto.
- [ ] Todo campo de formulário usa o `FormField`, e todo formulário nasce no `useZodForm`.
- [ ] Todo estado de seleção usa a borda de seleção; todo foco usa o outline externo.
- [ ] Alvo de toque de no mínimo 44px.
- [ ] Cor nunca é a única informação: sempre com ícone ou rótulo.
- [ ] A superfície tem os cinco estados.

---

## 8. Regras de uso

**Tamanho em `rem`, nunca em pixels.** A escala da interface (`app/scale`) muda o **tamanho da fonte da raiz**, e tudo que está em `rem` cresce junto: o texto, os tokens de espaçamento do Chakra e o slot, a toolbar e os botões, que são medidos em `rem`. Um tamanho em pixels é fixo, e é por isso que o slot, a toolbar e o botão de caçar ficavam do mesmo tamanho em qualquer tela, enquanto só o texto mudava. O `Slot` e o `IconButton` guardam o seu tamanho em `rem` por isso.

> A medição que depende do tamanho real do slot — a contagem de colunas da grade — lê o tamanho da fonte da raiz no momento da medição, e não um número fixo.

**O campo com erro tem borda de erro.** A mensagem embaixo do campo diz o que aconteceu; a borda vermelha diz que o campo está errado antes de a mensagem ser lida. As duas juntas, e não uma no lugar da outra.

**Cor nunca sozinha.** Vida, stamina e elemento vêm com cor **e** com ícone ou rótulo. Oito por cento dos homens tem alguma deficiência de visão de cores, e cor sozinha torna o jogo injogável para eles.

**Sombra para profundidade, borda para estado.** Painel, cartão e slot usam sombra em camadas. Borda fica para o que comunica estado ou separa layout: o traço do slot selecionado, o divisor do rodapé, a borda do campo de texto.

**Estado sem brilho.** O foco é um **outline de 2px fora do elemento**, como o padrão do Chakra (`focusVisibleRing="outside"`), na cor `arcane.300` — um passo claro, que contrasta tanto no fundo escuro do sistema quanto no fundo violeta do botão primário. A seleção é a **borda do próprio elemento** em `state.selected`. Elevação e marcador de canto completam. Nenhum estado usa halo, sombra colorida que se dissolve ou gradiente de fade: são eles que fazem a interface parecer uma vitrine em vez de um jogo.

> A borda interna foi experimentada e não serve: no botão primário ela some, porque a cor de foco era a mesma do fundo, e no card do treinador ela ficava **por trás** do conteúdo, invisível. O outline por fora é o padrão do Chakra e resolve os dois casos.

**O anel de foco é configurado em um lugar só.** O token `focus.ring` e o `focusRingColor` de cada paleta resolvem a cor; o `focusVisibleRing="outside"` vem do `NativeButton`, que é a base de todo controle clicável do sistema. Antes o anel era um objeto de CSS replicado em dez arquivos, e o campo de texto usava outra cor — havia dois anéis de foco na mesma interface.

**Raios concêntricos.** O raio externo é o raio interno mais o padding entre eles.

**Grade com coluna do tamanho do slot.** Uma grade de `1fr` com slot de tamanho fixo deixa espaço sobrando em cada célula. A coluna tem a largura do slot e a grade começa no canto.

**A grade preenche o painel.** A grade de inventário não é uma fileira: as colunas se ajustam à largura e o que sobra vira slot vazio. Uma grade com número fixo de colunas deixa o resto do painel vazio, e o painel vazio é o que faz a interface parecer quebrada.

**A grade não inventa linha.** A última linha é completada com slots vazios, mas a grade não cria linha nova: três itens fazem uma linha, não três linhas de onze. O scroll aparece quando o conteúdo realmente não cabe — e não antes.

**O divisor é um divisor.** A linha que separa o corpo do rodapé é a cor `border`. O atalho `borderTop` zera a cor da borda — a linha sai branca, fora do tema. Por isso o divisor vive em `shared/theme/divider.ts`, nas três formas longas, e é usado em todas as partes que dividem.

**Campo de texto com 16px.** O Chakra define o input em 14px, e 14px no campo mais o placeholder apagado dá leitura ruim. O `TextField` sobe para 16px, o que também evita o zoom automático do iOS ao focar.

**Texto nítido.** O `text-rendering` fica em `auto`: o padrão do Chakra, `optimizelegibility`, desliga o hinting e deixa o texto pequeno serrilhado. O `-webkit-font-smoothing: antialiased` **não** é aplicado: é um truque de macOS e no Linux derruba a qualidade.

**Fundo chapado.** Gradiente no fundo compete com o que está sobre ele e suja a leitura do canvas.

**Movimento é comunicação.** A animação diz que algo mudou. Duração curta, entrada com opacidade, escala e desfoque, e nada quando o sistema pede movimento reduzido. Toda transição é interrompível, para o jogador poder mudar de intenção no meio.

**Raios de toque.** Todo alvo de toque tem no mínimo 44px, e 48px para as ações importantes. O alvo é maior que o elemento visível.

**Estados obrigatórios.** Toda superfície que carrega ou aceita dados renderiza os cinco estados: carregando, vazio, erro, populado e limite. O estado populado é o que se desenha primeiro e o que mais some.

---

## 9. A galeria

A rota `/design-system` mostra o sistema funcionando. Ela é pública e serve de referência viva.

A galeria é a **referência viva** do que vai para a tela. Onde ela mostra um componente, é o componente real do app — nunca um mock paralelo.

A barra superior da galeria é a `Toolbar` de `widgets/game-hud/`, a mesma do jogo. É por isso que dá para ver, na própria galeria, se a interface do jogo está certa.

| Ordem | Seção | O que mostra |
| --- | --- | --- |
| 1 | Cores | As sete escalas completas |
| 2 | Tipografia | Os nove estilos de texto |
| 3 | Superfícies | Frame, Slot, Chip com tons e as sombras |
| 4 | Componentes | Botão (tom e paleta), campo com clean, slot, cooldown, popup, camadas e barras de recurso |
| 5 | Ícones | Os dezenove ícones |
| 6 | Estados | Os cinco estados, o alerta real, o popup e os modos de camada |
| 7 | Tela do jogo | A tela completa, com barra de habilidades e loja |
| 8 | Outras telas | Autenticação, treinadores, cidade e caçada |

**Modal com tamanho fixo.** Modal e drawer têm altura e largura declaradas, e o corpo é que rola. Um modal que encolhe e cresce com o conteúdo pisca a cada linha que entra ou sai.

**A anatomia é a mesma em toda parte.** Cabeçalho, corpo e rodapé. O que muda é quem monta: o `ModalHeader` centraliza o título e o botão de fechar fica no canto do painel; o `FrameHeader` é um cabeçalho de seção dentro de um painel.

**O `Text` do design system é o único que escreve texto.** O `Text` do Chakra com `textStyle` — ou qualquer `fontSize` solto — é código que sai do sistema e volta a divergir.

**Modal simples e modal composto são o mesmo componente.** Um diálogo de confirmação e a loja usam o mesmo `Modal` com o mesmo `ModalHeader`, `ModalBody` e `ModalFooter`. A diferença é só o tamanho e o que cabe dentro — nunca um componente paralelo.

---

## 10. Pendências

- Os valores de tamanho mínimo e máximo da escala da interface.
- A escala acima de 1,0, para telas grandes.
- A arte final de criatura e de item, que hoje são círculos e quadrados de cor.
- O armazenamento e a mochila ainda são mock na galeria: os dados são de mentira e a arte é um glifo. A loja já é real, com o catálogo de amostras do `SAMPLE_STORE_CATALOG`: a galeria não tem sessão, e a loja do jogo lê o catálogo do servidor. A área de caça e o drawer de detalhe já seguem os mockups de `docs/assets/`.
- O `Popup` já tem casos reais no jogo: o slot da criatura, o slot do item da loja e o slot da mochila. O que falta é provar que ele funciona bem no teclado e no toque.
- A `Tabs` do Chakra tem `aria-controls` só na aba ativa, porque o painel inativo é montado sob demanda. Se o conteúdo ficar pesado, a variante sem `lazyMount` resolve.
