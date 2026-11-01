# Design System

Este documento cobre as definições do nosso design system e as regras para construir a interface da aplicação. O Chakra UI é a base visual e estrutural que devemos utilizar em toda a aplicação.

## Chakra UI

Utilizamos o Chakra UI como nosso design system. Seus componentes, tokens e recursos de composição devem ser sempre a primeira opção ao construir qualquer parte da interface.

A regra geral é simples: utilize os componentes do Chakra UI diretamente ou combine-os por composição. Isso vale para todos os componentes, desde os mais básicos, como `Text` e `Link`, passando pelos componentes de layout, como `Stack`, `Wrap`, `Splitter` e `Group`, até componentes mais complexos, como `Field` e `Dialog`.

O Chakra UI possui componentes para muitos casos de uso que podem parecer pequenos, específicos ou pouco comuns. Eles também devem ser considerados e utilizados quando forem adequados, incluindo `Presence`, `Checkmark`, `For`, `Show`, `VisuallyHidden` e outros componentes disponíveis na biblioteca.

## Regras de uso

### Utilize os componentes existentes

Antes de criar qualquer elemento, componente ou solução de layout, verifique se o Chakra UI já oferece uma solução para o caso. Não devemos substituir um componente existente por elementos genéricos com várias propriedades quando o Chakra UI já possui um componente que expressa essa intenção.

Por exemplo, para organizar elementos em uma coluna ou linha, utilize `Stack` quando ele atender ao caso. Não utilize `Box` com propriedades de layout apenas para reproduzir o comportamento que `Stack` já fornece.

A escolha do componente deve comunicar a intenção do código. `Stack`, `Wrap`, `Group`, `Splitter` e os demais componentes de layout não são apenas atalhos: eles tornam explícita a estrutura da interface e devem ser preferidos a combinações genéricas de propriedades.

### Prefira composição

Quando uma interface precisar de comportamento ou estrutura adicional, componha os componentes do Chakra UI em vez de reinventá-los. A composição deve ser a solução padrão para criar interfaces específicas da aplicação.

Wrappers são permitidos quando encapsulam uma regra real de domínio, uma composição recorrente ou uma API que simplifica significativamente o uso. Componentes próprios também podem ser criados quando representam uma composição ou comportamento específico da aplicação, desde que utilizem os componentes do Chakra UI internamente. Não crie wrappers apenas para renomear um componente do Chakra UI, repassar suas propriedades ou esconder uma composição simples que poderia permanecer explícita no local de uso.

Antes de criar um novo componente, confirme se o mesmo resultado pode ser obtido combinando componentes existentes do Chakra UI de forma simples e legível. Componentes de domínio, como um resumo de recursos do jogador ou um cabeçalho de lobby, são válidos quando encapsulam dados, comportamento ou composição próprios do produto; eles não devem reimplementar componentes visuais que o Chakra UI já oferece.

### Não ignore componentes menos utilizados

A frequência de uso não deve ser o critério para decidir se um componente do Chakra UI será utilizado. Componentes como `Presence`, `Checkmark`, `For`, `Show`, `Wrap`, `Stack`, `Bleed`, `Center`, `Aspect Ratio`, `Float`, `Separator` e `VisuallyHidden` fazem parte da nossa base e devem ser utilizados quando resolverem melhor o problema.

Evite implementar manualmente comportamentos que já são oferecidos por esses componentes. Conheça o catálogo do Chakra UI e procure a solução apropriada antes de recorrer a elementos genéricos, CSS ou abstrações próprias.

### Mantenha tudo simples

Não faça overengineering. A solução deve ter o menor número de abstrações necessário para ser clara, reutilizável e consistente com o Chakra UI.

- Prefira uma composição direta a uma abstração prematura.
- Prefira o componente sem customizações quando ele já atender ao caso.
- Não crie uma API própria para reproduzir a API de um componente do Chakra UI.
- Não adicione camadas, estados ou componentes intermediários sem uma necessidade concreta.
- Use o componente que melhor descreve a intenção da interface, mesmo que outro componente genérico também pudesse produzir o mesmo resultado.

## Customização

Nenhuma customização da base do Chakra UI deve ser feita fora do `theme`. Não devemos criar um sistema paralelo de estilos, substituir os componentes do Chakra UI ou introduzir padrões de estilização que contornem o tema da aplicação.

Quando uma necessidade visual for recorrente, avalie primeiro se ela deve ser resolvida no `theme`. Componentes específicos da aplicação devem continuar sendo composições dos componentes do Chakra UI e não versões reimplementadas dos componentes da biblioteca.

## Tokens do tema

O tema está implementado em `apps/web/src/app/theme/index.ts` e é aplicado globalmente pelo `ChakraProvider`. Ele é inspirado na linguagem visual do cliente de League of Legends: uma interface escura, densa e premium, com fundos azul-marinho, superfícies azul-petróleo, linhas douradas e ciano para interações.

O tema deve ser a fonte central das decisões visuais recorrentes, enquanto os componentes da aplicação devem se limitar à composição e ao comportamento de domínio.

### Tokens primitivos

Os tokens primitivos armazenam valores concretos que formam a base visual do sistema:

- `brand`: escala dourada usada em ações primárias, seleção e detalhes de moldura.
- `neutral`: escala azul-marinho usada em fundos, painéis, bordas e textos.
- `blue`: escala ciano usada em foco, interação e informações.
- `red`: perigo e estados negativos.
- `green`: sucesso e estados positivos.
- `yellow`: avisos e destaques secundários.
- `fonts`: `Barlow` para o corpo, `Barlow Semi Condensed` para a interface compacta, `Cinzel` para títulos e `JetBrains Mono` para conteúdo monoespaçado.
- `radii`: raios pequenos, evitando a aparência de uma interface web moderna e excessivamente arredondada.
- `shadows`: sombras discretas para diferenciar painéis.

Os valores primitivos devem ser utilizados principalmente na definição do próprio tema. Na interface, prefira os tokens semânticos.

### Semantic tokens

Os semantic tokens expressam a intenção visual e devem ser preferidos aos valores concretos:

- `bg.canvas`: fundo principal da aplicação.
- `surface.panel`: painel padrão.
- `surface.raised`: painel elevado ou controle destacado.
- `surface.sunken`: área rebaixada.
- `fg.default`: texto principal.
- `fg.muted`: texto secundário.
- `fg.subtle`: texto de menor destaque.
- `border.default`: borda padrão.
- `border.emphasized`: borda de maior contraste.
- `brand.solid`: destaque dourado principal da marca.
- `brand.emphasized`: estado dourado de maior contraste.
- `accent.solid`: destaque ciano para foco e interação.
- `accent.emphasized`: ciano de maior contraste para hover e estados ativos.
- `health.fill`: preenchimento de vida.
- `mana.fill`: preenchimento de mana.
- `experience.fill`: preenchimento de experiência.
- `status.success`, `status.danger`, `status.info` e `status.warning`: estados da interface.

Use, por exemplo:

```tsx
<Box bg="surface.panel" borderColor="border.default">
  <Text color="fg.default">Character</Text>
  <Text color="fg.muted">Ranked profile</Text>
</Box>
```

Não use diretamente um hexadecimal ou uma cor primitiva quando um semantic token expressar a intenção necessária:

```tsx
// Preferido
<Text color="fg.muted">Level 42</Text>

// Evitar
<Text color="#A9BAC8">Ranked profile</Text>
```

### Component recipes

A aparência padrão dos componentes do Chakra UI deve ser configurada por recipes. Atualmente, `Button` e `Input` possuem recipes globais. O `Button` possui:

- estilo compacto;
- tipografia em caixa alta;
- variantes `solid`, `outline` e `ghost`;
- tamanhos `sm`, `md` e `lg`;
- bordas, estados de hover e contraste alinhados ao tema.

O `Input` possui fundo rebaixado, bordas compactas e foco ciano. Dessa forma, os componentes de formulário permanecem consistentes sem repetir estilos na tela de sign in.

Por isso, o uso normal deve ser simples:

```tsx
<Button>Open Character</Button>
<Button variant="outline">Cancel</Button>
```

Não repita nos componentes as propriedades que já pertencem à recipe do tema, como `borderRadius`, `fontWeight`, `background`, `padding` ou estilos de hover.

### Modo escuro

A aplicação utiliza o modo escuro do Chakra UI como padrão. O `ThemeProvider` do `next-themes` está configurado com `defaultTheme="dark"`, `forcedTheme="dark"` e `attribute="class"`, enquanto o `ChakraProvider` recebe o nosso `system` customizado.

O `forcedTheme="dark"` mantém o modo escuro ativo mesmo que o sistema operacional ou o armazenamento local do navegador indique outro tema. Isso é intencional: a identidade visual inspirada no cliente de League of Legends foi desenhada para fundos escuros e, neste momento, não oferece alternância entre claro e escuro.

Quando cores precisarem funcionar com mais de um modo no futuro, use semantic tokens com valores condicionais (`base` e `_dark`) em vez de lógica condicional nos componentes.

### `strictTokens`

O tema utiliza `strictTokens: true`. Essa configuração faz o TypeScript rejeitar valores que não estejam definidos como tokens conhecidos nas propriedades de estilo do Chakra UI e fornece autocomplete para os valores válidos.

Isso ajuda a evitar estilos arbitrários espalhados pela aplicação. Quando um valor visual for recorrente, ele deve ser adicionado ao tema ou transformado em um semantic token, em vez de ser repetido diretamente nos componentes.

O `strictTokens` não substitui a revisão arquitetural: regras de domínio, CSS de baixo nível e abstrações fora das propriedades tipadas do Chakra ainda precisam seguir as regras deste documento.

### Onde criar novos tokens

Antes de adicionar um token, identifique sua responsabilidade:

1. Use um token primitivo quando estiver definindo um valor concreto da escala visual.
2. Use um semantic token quando o valor representar uma intenção ou estado do produto.
3. Use uma recipe quando estiver definindo variantes visuais de um componente.
4. Use uma slot recipe quando várias partes de um componente precisarem ser estilizadas em conjunto.
5. Crie um componente próprio somente quando ele encapsular composição, comportamento ou domínio da aplicação.

Não crie um semantic token apenas para renomear um token existente do Chakra UI. Utilize os tokens nativos quando eles já expressarem corretamente a intenção, como `bg.subtle`, `fg.muted` e `border.default`.
