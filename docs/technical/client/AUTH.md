# Autenticação do Cliente

Este documento descreve a arquitetura de autenticação no cliente: como a sessão é representada, como o roteamento protegido funciona, como os fluxos do [fluxo de autenticação do jogo](../../game/AUTHENTICATION.md) são implementados e por que esta arquitetura existe nesta forma.

> A autenticação do **produto** (regras, telas, mensagens, comportamentos) está em [Autenticação](../../game/AUTHENTICATION.md). Este documento descreve apenas a **arquitetura técnica** do módulo no cliente.

## Índice

| Tópico | Descrição |
| --- | --- |
| [Princípios](#princípios) | As regras que governam todo o módulo de autenticação. |
| [Máquina de Estados](#máquina-de-estados) | Os estados possíveis da sessão e as transições entre eles. |
| [Single Source of Truth](#single-source-of-truth) | Por que `onAuthStateChange` é o único caminho para atualizar a sessão. |
| [AuthAdapter](#authadapter) | A camada fina entre a store e o Supabase Auth. |
| [Roteamento Protegido](#roteamento-protegido) | Como `createBrowserRouter` + `loader` substituem `<RequireAuth>`. |
| [Fluxos](#fluxos) | Como signin, signup, OAuth, recovery e signout são executados. |
| [O e-mail pendente de confirmação](#o-e-mail-pendente-de-confirmação) | O cadastro sem sessão e o que a tela mostra nele. |
| [A lista de treinadores compartilhada](#a-lista-de-treinadores-compartilhada) | A query que a tela da lista lê, e o store do que é da sessão. |
| [A rota pós-autenticação](#a-rota-pós-autenticação) | A rota `/post-auth`, que decide o destino de quem entra pelo Google ou pelo link de confirmação. |
| [O merge da conta Google](#o-merge-da-conta-google) | A fusão da conta Google com a conta de e-mail e senha, e o que acontece quando ela falha. |
| [Testes](#testes) | O que está coberto e como. |
| [Pendências](#pendências) | Limitações conhecidas. |

## Princípios

1. **Uma única fonte da verdade.** A sessão do usuário mora em uma store Zustand. Nenhum outro lugar do cliente lê `supabase.auth.getSession()` fora do `shared/auth`, nem mantém uma cópia paralela da sessão.
2. **`onAuthStateChange` é o único caminho.** A store nunca chama `getSession()` para hidratar. O evento `INITIAL_SESSION` do listener cobre isso. Isso elimina a corrida entre `getSession()` e o primeiro `onAuthStateChange`, que era parte do loop original.
3. **Identidade, não referência.** A comparação de sessão é por `user.id` (e `access_token` quando relevante), nunca por referência de objeto `Session`. Supabase cria um objeto `Session` novo a cada evento, mesmo quando nada mudou.
4. **Roteamento por loader, não por componente de guard.** As rotas protegidas usam `loader` + `throw redirect()`. O componente da rota nunca é renderizado sem sessão válida. Isso evita o padrão que dispara o [bug conhecido do `react-router-dom@7.18.4`](https://github.com/remix-run/react-router/issues/15501) (freeze ao clicar múltiplos `<Link>` em sequência rápida com guard aninhado).
5. **Sem retry automático.** Erros de rede não geram retentativa. O usuário decide quando tentar de novo.
6. **Handlers estáveis.** As funções expostas pela store (`signIn`, `signOut`, etc.) têm identidade estável entre renders. Páginas que dependem delas não re-renderizam sem motivo.
7. **`StrictMode` ligado.** O módulo é escrito de forma compatível com a dupla renderização do `StrictMode` em desenvolvimento. Reativar `<StrictMode>` é parte desta arquitetura.

## Máquina de Estados

A sessão tem **quatro estados** finitos, com transições determinísticas.

Estados:

| Estado | Significado | `user` |
| --- | --- | --- |
| `INITIALIZING` | Antes do primeiro `INITIAL_SESSION` do listener. Mostra spinner. | `null` |
| `UNAUTHENTICATED` | Sem sessão. Páginas públicas são acessíveis. | `null` |
| `AUTHENTICATED` | Sessão válida. Rotas protegidas acessíveis. | `User` |
| `RECOVERING` | Sessão de recuperação de senha (`PASSWORD_RECOVERY`). Permite apenas `/reset-password`. | `User` |

O `user` é o `AuthUser` do contrato (`@creatures/contracts/auth`): `{ email, id, provider }`. O `provider` é o provedor da identidade ativa — `email` para uma conta de senha, `google` para uma conta que entrou pelo Google, `null` quando o provedor é desconhecido. Ele vem do `app_metadata.provider` do Supabase e é o que permite ao cliente saber se uma sessão pode ser fundida com uma conta de e-mail e senha.

Eventos que causam transição:

| Evento Supabase | Transição |
| --- | --- |
| `INITIAL_SESSION` sem `user` | `INITIALIZING` → `UNAUTHENTICATED` |
| `INITIAL_SESSION` com `user` | `INITIALIZING` → `AUTHENTICATED` |
| `SIGNED_IN` | `*` → `AUTHENTICATED` |
| `SIGNED_OUT` | `*` → `UNAUTHENTICATED` |
| `TOKEN_REFRESHED` | `AUTHENTICATED` → `AUTHENTICATED` (mesmo `user.id`) |
| `USER_UPDATED` | `AUTHENTICATED` → `AUTHENTICATED` (mesmo `user.id`) |
| `PASSWORD_RECOVERY` | `*` → `RECOVERING` |

Eventos que não mudam o estado não disparam re-render. Comparação por `user.id` evita o churn de identidade que a comparação por referência causava.

## Single Source of Truth

### Por que `getSession()` é proibido no caminho de hidratação

O `GoTrueClient` do `@supabase/supabase-js` emite `INITIAL_SESSION` automaticamente ao assinar `onAuthStateChange`, com a sessão já carregada do `localStorage`. Chamar `supabase.auth.getSession()` em paralelo:

1. Não traz informação nova — a sessão lida do storage é a mesma.
2. Abre uma janela de corrida entre dois caminhos de hidratação.
3. Em cenários como o callback OAuth, dispara `INITIAL_SESSION` (sessão nula, hash ainda sendo processado) seguido de `SIGNED_IN` (sessão presente). A store que ouve os dois fica em estado intermediário que, combinado com `<Navigate>` no render, produzia o loop.

A store se hidrata **somente** esperando o primeiro `INITIAL_SESSION` do listener.

### Por que identidade, não referência

A cada emissão do listener, Supabase constrói um novo objeto `Session`. Comparar por `===` nunca bate. Comparar por `user.id` (e, quando relevante, `access_token`) bate quando realmente não há mudança e ignora quando há.

A store calcula a próxima identidade antes de chamar `set`:

```
nextIdentity = newSession?.user.id ?? null
currentIdentity = getState().user?.id ?? null
if (nextIdentity === currentIdentity && event !== 'PASSWORD_RECOVERY') {
  // Não há mudança observável. Não chama set. Não notifica listeners.
}
```

## AuthAdapter

A store depende apenas de uma interface fina. O Supabase é uma implementação. Isso:

- Isola o resto do código de `@supabase/supabase-js`.
- Permite testar a store com mock adapter.
- Abre porta para troca futura de provedor sem refactor do código de UI.

### Interface

```
interface AuthAdapter {
  subscribe(handler: (event: AuthEvent, session: Session | null) => void): () => void
  signInWithPassword(input: { email: string; password: string }): Promise<AuthAdapterResult>
  signUp(input: { email: string; password: string; path: string }): Promise<AuthAdapterResult>
  signInWithOAuth(input: { provider: 'google'; path: string }): Promise<AuthAdapterResult>
  signOut(): Promise<void>
  resetPasswordForEmail(input: { email: string; path: string }): Promise<AuthAdapterResult>
  updateUser(input: { password: string }): Promise<AuthAdapterResult>
}
```

`AuthAdapterResult` é `{ ok: true; redirectUrl?: string } | { ok: false; code: AuthErrorCode }`. Os códigos de erro são definidos pela store, não pelo Supabase — a tradução acontece dentro do `SupabaseAuthAdapter`.

O `path` do cadastro é a rota de destino pós-autenticação: ela vira o `emailRedirectTo` do link de confirmação. O `path` do OAuth é a rota para onde o provedor devolve o jogador.

### Os códigos de erro são exaustivos

`AuthErrorCode` é um conjunto fechado. Cada tela tem um mapa `Record<AuthErrorCode, string>` com a mensagem de cada código (`SIGNIN_ERROR_MESSAGES`, `SIGNUP_ERROR_MESSAGES`, `RESET_ERROR_MESSAGES`, `FORGOT_ERROR_MESSAGES`, em `features/authentication/model/auth.messages.ts`). Um código novo no contrato que não entra no mapa quebra a compilação, em vez de cair numa mensagem que não é a dele.

### Implementação

`SupabaseAuthAdapter` é o único arquivo que importa `@supabase/supabase-js`. Ele:

- Constrói o `SupabaseClient` na primeira chamada.
- Assina `onAuthStateChange` e traduz os eventos (`INITIAL_SESSION`, `SIGNED_IN`, etc.) para a forma da store.
- Encapsula `signInWithPassword`, `signUp`, etc. e traduz `AuthError` para `AuthErrorCode` usando o mapper de erros.

A fábrica do cliente é `shared/auth/supabase/client.ts`, e ela cria o `SupabaseClient` **na primeira uso** — importar o módulo não exige as variáveis de ambiente do Supabase. Quem consome a fábrica são só os dois arquivos do próprio `shared/auth`: o `SupabaseAuthAdapter` e o `shared/auth/token.ts`.

O token de acesso é lido em `shared/auth/token.ts` e exposto pelo `shared/auth` como `getAccessToken()`. Ele chega ao cliente HTTP por injeção: o `ApiDeps` do `shared/api` recebe a função `getAccessToken` de quem monta as dependências, e o `shared/api` nunca sabe onde o token vem.

## Roteamento Protegido

A proteção das rotas sai do componente `<RequireAuth>` e vai para o `loader` de cada rota protegida.

### `createBrowserRouter` substitui `<Routes>`

```
const router = createBrowserRouter([
  { path: '/signin', Component: SignInPage },
  { path: '/signup', Component: SignUpPage },
  { path: '/forgot-password', Component: ForgotPasswordPage },
  { path: '/terms', Component: TermsPage },
  { path: '/privacy', Component: PrivacyPage },
  { path: '/reset-password', Component: ResetPasswordPage, loader: resetPasswordLoader },
  {
    Component: ProtectedShell,
    loader: requireAuthLoader,
    children: [
      { path: '/trainers', Component: TrainersPage },
      { path: '/trainers/new', Component: NewTrainerPage },
      { path: '/game', Component: PlayScreenPage },
    ],
  },
  { path: '*', loader: () => redirect('/signin') },
]);
```

### `requireAuthLoader`

Lê o estado atual da store. Se for `AUTHENTICATED`, retorna `null`. Caso contrário, lança `redirect('/signin')` com `replace`.

A leitura é **síncrona** (Zustand expõe `getState()`), sem chamada de rede. O loader não chama `getSession()` do Supabase.

### `resetPasswordLoader`

Lê o estado da store. Aceita `RECOVERING` ou `AUTHENTICATED` (caso o usuário já tenha sessão e queira redefinir). Para outros estados, lança `redirect('/signin')`.

### Por que isso resolve o loop original

O loop original tinha três ingredientes:

1. `<RequireAuth>` retornando `<Navigate>` durante o render.
2. `AuthProvider` realocando `value` a cada render (memo de função).
3. Bug do `react-router-dom@7.18.4` com `<Navigate>` + `<Link>` em padrão aninhado.

A nova arquitetura:

1. Substitui `<Navigate>` por `loader` + `throw redirect()` — sem `<Navigate>` no DOM.
2. Zustand expõe estado estável; mudanças não causam re-render de quem não consome o que mudou.
3. Não há guard aninhado; as rotas protegidas são filhas diretas de `ProtectedShell`, e `ProtectedShell` é apenas um wrapper de layout, sem lógica de redirect.

## Fluxos

### Signin (`POST /signin`)

```
1. Usuário submete formulário.
2. Página chama auth.signIn({ email, password }).
3. Store chama adapter.signInWithPassword.
4. Adapter traduz AuthError → AuthErrorCode em falha.
5. Store NÃO muda de estado em falha (status permanece o atual).
6. Em sucesso, adapter retorna ok. onAuthStateChange do Supabase dispara SIGNED_IN.
7. Store move para AUTHENTICATED.
8. Página recebe ok e navega para /trainers.
```

Em falha, a sessão não é alterada. A navegação não acontece. O erro é apresentado no formulário.

O destino pós-autenticação é sempre `/trainers`. Quem decide se a conta tem ou não um treinador é a **tela da lista**, que descobre que a lista veio vazia e leva o jogador para a criação. A decisão não mora aqui porque a lista é lida por uma query compartilhada: perguntar por ela no momento do login seria pedir o mesmo recurso duas vezes.

### Signup

```
1. Usuário submete formulário.
2. Página chama auth.signUp({ email, password }).
3. Store valida senha (8–64 chars) antes de chamar adapter.
4. Adapter chama supabase.auth.signUp com options.emailRedirectTo = origem + /post-auth.
5. Se e-mail já existe → adapter retorna { ok: false, code: 'email_already_exists' }.
6. Se a conta é nova e o projeto pede confirmação de e-mail →
   adapter retorna { ok: false, code: 'email_confirmation_required' }.
7. Se a conta é nova e a confirmação é automática → adapter retorna ok,
   a sessão é criada, onAuthStateChange dispara SIGNED_IN.
8. Store move para AUTHENTICATED.
9. Página navega para /trainers.
```

O passo 6 é o caso de um projeto com a confirmação automática de e-mail desligada: a conta existe, mas a sessão só chega depois que o jogador confirma o e-mail. O tratamento está em [O e-mail pendente de confirmação](#o-e-mail-pendente-de-confirmação).

### OAuth Google

```
1. Usuário clica em "Entrar com Google" (ou "Registrar com Google" na tela de signup).
2. Página chama auth.signInWithGoogle().
3. Adapter chama supabase.auth.signInWithOAuth com skipBrowserRedirect.
4. Adapter retorna { ok: true, redirectUrl: 'https://accounts.google.com/...' }.
5. Página faz globalThis.location.href = redirectUrl.
6. Após login no Google, Supabase redireciona para POST_AUTH_PATH (/post-auth).
7. O cliente carrega /post-auth.
8. postAuthLoader roda. Se status === INITIALIZING, espera o primeiro INITIAL_SESSION.
9. INITIAL_SESSION chega com user. Status → AUTHENTICATED.
10. O loader pede o merge da conta Google (ver "O merge da conta Google").
11. Só então o loader redireciona para /trainers.
```

A store não tem ação para `redirect()`. A página que pediu o OAuth navega por `globalThis.location.href` (full page reload, intencional).

**O botão é o mesmo nas duas telas.** "Entrar com Google" e "Registrar com Google" chamam a mesma ação da store e produzem a mesma requisição: o Supabase cria a conta quando ela ainda não existe, e funde a identidade Google com a conta existente quando o e-mail já estiver cadastrado. Não há dois fluxos, há um fluxo com dois rótulos.

A criação automática da conta pelo Google depende da configuração do provedor no painel do Supabase: **Authentication → Providers → Google → Automatically create accounts** (ligado por padrão). Não existe um parâmetro `should_create_user` no `supabase-js` — esse nome é de outra biblioteca. O que garante o comportamento é a configuração do provedor.

O `skipBrowserRedirect` evita a navegação dupla: sem ele o SDK navega sozinho e a página navecia também.

### Recuperação de senha (request)

```
1. Usuário submete e-mail em /forgot-password.
2. Página chama auth.requestPasswordReset(email).
3. Adapter chama supabase.auth.resetPasswordForEmail com redirectTo=/reset-password.
4. Independente de o e-mail existir, adapter retorna ok (não revela).
5. Página exibe alerta "Se o e-mail existir em nossa base de dados, enviamos um link de recuperação."
```

### Recuperação de senha (clicar no link)

```
1. Usuário clica no link do e-mail.
2. Supabase processa o hash e cria uma sessão de recovery.
3. Redireciona para /reset-password.
4. resetPasswordLoader roda. Se status === INITIALIZING, espera INITIAL_SESSION.
5. onAuthStateChange dispara PASSWORD_RECOVERY → store move para RECOVERING.
6. Loader passa. /reset-password renderiza o formulário.
```

O detalhe que importa é o status `RECOVERING` ser distinto de `AUTHENTICATED`. O `resetPasswordLoader` aceita ambos, mas só `RECOVERING` é o caminho esperado via link.

### Reset (submeter nova senha)

```
1. Usuário submete nova senha em /reset-password.
2. Página chama auth.updatePassword(newPassword).
3. Adapter chama supabase.auth.updateUser({ password }).
4. Adapter retorna ok.
5. Página chama auth.signOut().
6. onAuthStateChange dispara SIGNED_OUT → store move para UNAUTHENTICATED.
7. Página exibe alerta "Senha redefinida com sucesso. Faça login para continuar."
8. Página navega para /signin.
```

### Signout

```
1. Usuário clica em "Sair da conta" em /trainers.
2. Página chama auth.signOut().
3. Adapter chama supabase.auth.signOut.
4. onAuthStateChange dispara SIGNED_OUT → store move para UNAUTHENTICATED.
5. Página navega para /signin.
```

## O e-mail pendente de confirmação

Um projeto do Supabase pode ter a confirmação automática de e-mail desligada. Nesses projeto, `supabase.auth.signUp` devolve `session: null` — a conta é criada, mas o jogador ainda não tem sessão.

Isso **não é uma falha**: é um estado legítimo do cadastro. O adapter traduz esse retorno para o código `email_confirmation_required`, e a tela de signup faz duas coisas:

1. Mostra o aviso "Enviamos um e-mail de confirmação para &lt;e-mail&gt;. Confirme para entrar.".
2. **Não navega.** O jogador não vai para `/trainers` nem para `/trainers/new`: ele ainda não tem sessão, e o `requireAuthLoader` o devolveria para a tela de entrada.

O caminho do link é o `emailRedirectTo` do cadastro: a origem do cliente mais a rota de destino pós-autenticação (`/post-auth`). Esse endereço precisa estar na lista de URLs de redirecionamento do projeto Supabase (**Authentication → URL Configuration → Redirect URLs**).

O link volta no formato PKCE: a URL chega com `?code=`, e o cliente Supabase troca o código por uma sessão no primeiro carregamento da página. Por isso o `emailRedirectTo` é uma URL do próprio cliente, e não a do Supabase.

Com a confirmação automática **ligada**, o `signUp` devolve a sessão, o `onAuthStateChange` dispara `SIGNED_IN` e o fluxo segue o redirecionamento normal: o jogador vai para `/trainers`.

O e-mail que já está cadastrado é reconhecido pelo servidor do Supabase, que devolve um usuário sem identidades em vez de um erro. O adapter traduz esse caso para `email_already_exists`, e a tela mostra "Este e-mail já está cadastrado. Tente Entrar.".

## A lista de treinadores compartilhada

A lista de treinadores da conta é lida por uma **query do TanStack Query**, e não por um store: a chave e o fetcher moram em `shared/api/queries/trainerQueries.ts`, e o cache é compartilhado pelo cliente inteiro.

- O `useTrainers` (`entities/trainer/model/useTrainers.ts`) é a camada que as telas usam: ele entrega a lista, o carregando e o erro, e o pedido que já está em andamento é aguardado em vez de duplicado.
- O store Zustand (`entities/trainer/model/trainersStore.ts`) guarda só o que é **da sessão**: o treinador que o jogador escolheu e o fato de a lista já ter sido lida.

O motivo é o estado compartilhado: a tela de listar e a tela de criar treinador mostravam listas separadas, cada uma refazendo `GET /api/trainers`. Com uma query só, as duas telas leem o mesmo cache, e a tela que cria treinador não lê mais um estado velho.

A lista muda por ação do jogador, e por isso ela nunca fica velha sozinha: a `staleTime` é `0` e a invalidação é feita pela mutação que criou, editou ou deletou o treinador.

> A decisão "conta sem treinador → tela de criação" mora na **tela da lista**, em `pages/trainers/model/emptyTrainersRedirect.ts`. Quem descobre que a lista veio vazia é a tela, e é ela que sabe o que fazer com isso.

Cobertos pela suíte `authStore.spec.ts`:

- Inicialização sem sessão persistida. Após subscribe, status = UNAUTHENTICATED.
- Sessão persistida. Adapter emite INITIAL_SESSION com user. Status = AUTHENTICATED.
- Signin sucesso. Adapter retorna ok, SIGNED_IN chega, status = AUTHENTICATED.
- Signin falha. Adapter retorna erro, status não muda.
- Signout. SIGNED_OUT chega, status = UNAUTHENTICATED.
- TOKEN_REFRESHED. Mesmo user.id. Status = AUTHENTICATED. Store não chama set desnecessariamente.
- PASSWORD_RECOVERY. Status = RECOVERING.
- Signin network error. Código = 'network'. Status não muda.
- Signup sem sessão (e-mail pendente de confirmação). Código = 'email_confirmation_required'. Status não muda.
- Throttle de renders. 5 signIn em sequência causam no máximo 1 re-render do consumidor (verificado com seletor de identidade).
- Cleanup do listener. unsubscribe remove o listener do adapter.

O adapter é um **test double** (`shared/auth/store/authTestDouble.ts`): implementa a interface `AuthAdapter` e mantém uma fila de eventos controlada pelos testes. Ele não é um mock de runtime — nenhum arquivo de produção o importa, e o nome do arquivo não tem "mock" para que a busca por mocks no código de produção não encontre nada.

## A rota pós-autenticação

As três entradas no jogo chegam de jeitos diferentes, e as três precisam decidir o mesmo destino:

| Entrada | Como volta |
| --- | --- |
| Login por senha | A sessão nasce na página, e a própria tela decide o destino. |
| Login pelo Google | Página nova, sessão na URL (PKCE). |
| Link de confirmação de e-mail | Página nova, sessão na URL (PKCE). |

O Google e o link de confirmação não passam pela tela de login: o Supabase devolve o jogador direto ao cliente, em uma página nova, com o código da sessão na URL. Por isso existe a rota `/post-auth`:

```
1. O Supabase redireciona para /post-auth?code=...
2. O cliente troca o código pela sessão no primeiro carregamento.
3. O postAuthLoader espera o primeiro status definitivo da store.
4. Sem sessão → redireciona para /signin.
5. Com sessão Google → pede o merge da conta (ver "O merge da conta Google").
6. Redireciona para /trainers.
```

A rota **nunca desenha**: o loader sempre redireciona. Ela existe para que uma conta que entra pelo Google ou pela confirmação de e-mail chegue na **tela da lista de treinadores**, que é quem decide se o jogador precisa criar um treinador.

O mesmo destino vale para quem já está autenticado e abre `/signin`, `/signup` ou `/forgot-password`: o guard redireciona para `/post-auth`, e a rota aplica a mesma regra.

## O merge da conta Google

A regra de produto ([Autenticação](../../game/AUTHENTICATION.md)) é: quem entra pelo Google e já tem uma conta de e-mail e senha com o mesmo e-mail não pode ganhar uma conta duplicada — a conta Google é fundida com a existente. A fusão em si é do servidor; o cliente só a **pede**, na rota `/post-auth`.

### Quando acontece

O merge é pedido pelo `postAuthLoader`, quando a sessão está autenticada e o `user` tem `provider === 'google'` e um e-mail. Qualquer outra sessão (inclusive a de e-mail e senha) não pede nada: não há o que fundir.

Ele acontece **depois** que o jogador entra pelo Google e **antes** de decidir para onde ele vai. A ordem não é um detalhe: o merge transfere os treinadores da conta de senha para a conta Google, e a lista de treinadores que a tela da lista vai ler é a da conta fundida. Decidir antes do merge faria um jogador que já tinha dois treinadores ver uma lista vazia e cair na tela de criação achando que não tem nenhum.

### O que o cliente manda

`POST /api/auth/google-merge`, com o e-mail no corpo e o token da sessão no `Authorization`. A resposta é traduzida em `shared/api/endpoints/auth.ts`:

| Resposta do servidor | No cliente |
| --- | --- |
| `200 { merged: true }` | `ok: true`, `merged: true` — as contas foram fundidas. |
| `409 no_password_account` | `ok: true`, `merged: false` — não havia conta de senha com esse e-mail. |
| `409 not_google_account` | `ok: true`, `merged: false` — a sessão atual não é uma conta Google. |
| `409 email_unverified` | `ok: false`, código `email_unverified` — o Google não confirmou o e-mail. |
| `400 invalid_email` | `ok: false`, código `invalid_email`. |
| `401` | `ok: false`, código `unauthenticated`. |
| erro de rede | `ok: false`, código `network`. |

Os dois `409` que viram `ok: true` **não são erro para quem está entrando**: `no_password_account` é o caso normal de quem entra pelo Google pela primeira vez, e `not_google_account` é o caso de uma sessão que não é Google. O `email_unverified`, esse sim, é um erro real — a regra de produto só permite o merge com o e-mail verificado.

### Quando o merge falha

**Um merge que falhou não tranca a pessoa fora do jogo.** O jogador já está autenticado: o `postAuthLoader` leva o motivo da falha junto com o destino e segue para o destino normal.

O cliente não tem logger, então o motivo da falha não é registrado em log: ele volta no resultado do merge (`resolvePostAuth` devolve `{ destination, merge }`), que é o que a suíte de testes lê. A consequência de uma falha é visível no jogo — os treinadores da conta antiga continuam na conta antiga —, e não na entrada do jogador.

### Onde o código mora

| Peça | Onde mora |
| --- | --- |
| O pedido ao servidor | `shared/api/endpoints/auth.ts` (acesso puro a recurso, sem regra de domínio). |
| A regra "só uma sessão Google funde" | `features/authentication/model/googleMerge.ts`. |
| A ordem merge → destino | `features/authentication/model/postAuthRedirect.ts` (`resolvePostAuth`). |
| A chamada | `app/router/loaders.ts` (`postAuthLoader`). |

## Testes

- `shared/api/endpoints/auth.spec.ts` — cada resposta do servidor traduzida: o merge confirmado, a conta sem senha, a sessão que não é Google, o e-mail não verificado, o e-mail malformado, a sessão ausente e o erro de rede.
- `features/authentication/model/__tests__/postAuthRedirect.spec.ts` — o merge roda **antes** da decisão do destino, uma falha do merge não impede a entrada, e uma sessão que não é Google não pede merge.
- `shared/auth/store/supabaseAdapter.spec.ts` — a sessão carrega o `provider` da identidade (`email`, `google` e nenhum).
- `shared/auth/store/authStore.spec.ts` — o `provider` chega no estado da store.

## Pendências

- **A falha do merge não vira log.** O cliente não tem logger, e a falha é engolida de propósito para não trancar o jogador fora do jogo. Se o merge falhar com frequência em produção, o primeiro passo é instrumentar o cliente antes de mexer no fluxo.
- **`react-router-dom@7.18.4` e o bug #15501.** Não há fix na linha v7. A arquitetura atual mitiga o padrão que dispara o bug (sem `<Navigate>` em guard, sem `<RequireAuth>` envolvendo layout). Se um padrão diferente reproduzir o freeze, a saída é migrar para v8 — mas isso é decisão de produto, não de auth.