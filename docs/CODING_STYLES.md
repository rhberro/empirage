# Estilos de Código

As regras deste documento são adicionais e obrigatórias. Além delas, todo o código
deve seguir também os estilos descritos no
`node_modules/@rhberro/oxsome/CODING_STYLES.md`,
empacotado em `@rhberro/oxsome` e aplicado via `oxlint.config.ts`.

Os dois documentos são obrigatórios. Havendo conflito, valem as regras descritas
aqui.

## Logging

Use o logger estruturado (pino) em `services/` e em qualquer código de servidor em `apps/`. Não use `console.log`/`console.error` fora de depuração local rápida, que é removida antes do commit.

## Comentários

Sem comentários, a menos que expliquem um _porquê_ não óbvio — uma restrição oculta, uma gambiarra, um detalhe sutil. Nunca expliquem o _o quê_ o código faz: funções e variáveis bem nomeadas já fazem isso.

## Funções, Objetos e Arrays Inline

A regra `oxsome/no-inline-functions-objects-arrays` proíbe literais de funções, objetos e arrays como primeiro argumento de chamadas ou construtores. Neste projeto, a mesma orientação deve ser aplicada, sempre que possível, aos demais argumentos: evite passar valores inline e dê um nome a eles antes da chamada.

Isso melhora a legibilidade, facilita a inspeção do valor e evita que argumentos com estruturas relevantes fiquem escondidos na chamada.

isso sim:

```ts
const params = { character_id: characterId };

const { error } = await supabase.rpc('select_character', params);
```

isso não:

```ts
const { error } = await supabase.rpc(
  'select_character', { character_id: characterId }
);
```

Essa é uma orientação de preferência, não uma proibição absoluta. Literais inline podem ser usados quando não houver uma forma razoável de evitá-los ou quando a API exigir uma estrutura inline para funcionar corretamente. Nesses casos, não crie uma variável artificial apenas para cumprir esta orientação.

## Componentes React

Componente é declaração de função, seguindo a regra `oxsome/no-arrow-functions`.

isso sim:

```tsx
function PlayerCard(props: PlayerCardProps) {
  const { name, level } = props;
  return <div>...</div>;
}
```

isso não:

```tsx
const PlayerCard = (props: PlayerCardProps) => { ... }
```

### Composição

Use composição para componentes com múltiplas partes relacionadas ou estruturas
configuráveis. Prefira composição a uma grande quantidade de props booleanas ou
props que controlam diretamente a estrutura interna.

Não é necessário usar composição em componentes simples e específicos.

isso sim:

```tsx
function MyCard(props: React.PropsWithChildren<unknown>) {
  return <div>{props.children}</div>;
}

function MyCardIcon() {
  return <div>Icon</div>;
}

function MyCardContent(props: React.PropsWithChildren<unknown>) {
  return <div>{props.children}</div>;
}

MyCard.Icon = MyCardIcon;

MyCard.Content = MyCardContent;

function Page() {
  return (
    <MyCard>
      <MyCard.Icon />
      <MyCard.Content>Alerta!</MyCard.Content>
    </MyCard>
  );
}
```

isso não:

```tsx
type MyCardProps = { content: string; icon: string };

function MyCard(props: Partial<MyCardProps>) {
  const { content, icon } = props;
  return (
    <div>
      {icon ? <Icon name={icon} /> : null}
      {content ? <div>{content}</div> : null}
    </div>
  );
}
```

### Subcomponentes

#### Quando Extrair

Extraia um subcomponente quando ele tiver uma fronteira clara de responsabilidade, reutilização, estado, composição ou isolamento de renderização. A extração, por si só, não impede re-renderizações; esse benefício depende de como o estado é consumido e de como o componente é memorizado.

isso sim:

```tsx
function MyForm() {
  return (
    <form>
      <FormField {...} />
      <FormField {...} />
      <FormField {...} />
      <Divider />
      <FormField {...} />
      <FormField {...} />
      <FormField {...} />
      <Divider />
      <MyFormSubmitButton />
    </form>
  );
}

function MyFormSubmitButton() {
  const { isValid } = useFormState();
  return <button disabled={!isValid} type="submit">Salvar</button>;
}
```

> Extraiu o botão porque ele possui uma dependência de estado própria. Como `MyForm` não consome `isValid`, o formulário não passa a depender desse estado. O isolamento efetivo de renderizações depende de como `useFormState` implementa suas subscriptions ou memoização.

isso não:

```tsx
function MyForm() {
  return (
    <form>
      <MyFormFirstSection />
      <Divider />
      <MyFormSecondSection />
      <Divider />
      <MyFormSubmitButton />
    </form>
  );
}

function MyFormFirstSection() { ... }

function MyFormSecondSection() { ... }

function MyFormSubmitButton() { ... }
```

> Dividiu os blocos apenas por agrupamento visual, sem criar uma fronteira útil de responsabilidade, reutilização, estado, composição ou isolamento de renderização. Isso aumenta a quantidade de componentes sem melhorar a estrutura do código.

isso não:

```tsx
function MyForm() {
  const { isValid } = useFormState();
  return (
    <form>
      <FormField {...} />
      <FormField {...} />
      <FormField {...} />
      <Divider />
      <FormField {...} />
      <FormField {...} />
      <FormField {...} />
      <Divider />
      <button disabled={!isValid} type="submit">Salvar</button>
    </form>
  );
}
```

> Criou em um único componente e fez o componente raiz depender de `isValid`, embora esse estado seja utilizado apenas pelo botão. Isso pode fazer o formulário e sua subárvore serem renderizados novamente sem necessidade, dependendo da implementação de `useFormState` e da memoização dos filhos.
