# Handoff UX — painel do time no HUD

## Estado e decisões já tomadas

- **TeamPanel é um WIP intencional.** Sua função definida pelo usuário é servir de prova técnica para isolar atualizações de renderização por slot e tornar-se o substituto visual futuro de `TeamStrip`. Não é uma versão pronta nem uma proposta para remover o design existente.
- **TeamStrip continua sendo a referência comportamental.** Só deve ser removido depois de a paridade funcional em cidade e caçada estar demonstrada e aceita.
- **SkillBar é uma trilha independente.** A integração ou conclusão do painel do time não deve reativar, redesenhar ou alterar a barra de habilidades (`GameHud.tsx:100–112`; `SkillBar.tsx:14–90`).
- Este handoff especifica comportamento e validação; não escolhe aparência nova. O visual deve permanecer dentro do design system existente: tema escuro, denso e geométrico, seleção violeta e componentes/tokens existentes (`docs/technical/client/DESIGN_SYSTEM.md:9–32, 229–241`).

## Fonte de verdade e escopo do cliente

O cliente mostra o estado recebido; o servidor decide as regras do jogo (`docs/technical/ARCHITECTURE.md:11–26`). O painel não deve criar estado de gameplay local para preencher lacunas de cidade/caçada nem antecipar sucesso de uma troca.

O mockup e as regras de produto especificam no máximo cinco linguetas, slots vazios, criatura ativa destacada, nome da espécie e nível no retrato; não mostram vida, elemento ou apelido no slot (`docs/game/PLAY_SCREEN.md:85–96`). A troca de uma criatura apta é feita pelo slot e obedece ao cooldown; a interface mostra máscara e contagem durante a espera (`PLAY_SCREEN.md:98–104`). Essa regra é o resultado esperado, mas a aprovação da troca continua com o servidor.

O mundo mantém janela fixa de 34×20 sqm e zoom inteiro em modo cover; os elementos HTML do HUD se adaptam ao espaço, sem mudar o conteúdo (`PLAY_SCREEN.md:45–51, 146–150`). A convenção geral pede a mesma interface em desktop e celular, mudando a escala dos elementos dentro dos limites acordados (`docs/game/INTERFACE.md:7–11`). O jogo móvel é paisagem; retrato exibe o overlay de orientação (`PLAY_SCREEN.md:152–154`).

## Paridade funcional exigida antes de retirar TeamStrip

| Caso | Comportamento que deve permanecer | Evidência atual e lacuna |
| --- | --- | --- |
| Cinco posições | Exibir exatamente cinco posições do time, sem perder a ordem de slot. | `TeamStrip.tsx:14, 79–110` define cinco posições e preenche ausências por slot; `TeamPanel.tsx:42–48` renderiza cinco filhos fixos. Falta provar o mapeamento de dados em ambas as fases. |
| Slot vazio | Mostrar uma posição vazia identificável como espaço no time; não transformá-la em ação de seleção. | `TeamStrip.tsx:91–96, 113–124` cria placeholders; `TeamSlot.tsx:14–21` deixa vazio sem criatura, mas `TeamSlotImage.tsx:8–11` não recebe dados da criatura e usa `identifier="1"`. |
| Slot preenchido | Mostrar retrato/identidade, espécie e nível conforme os dados válidos do estado. Preservar o padrão do design atual, sem inventar ornamento ou conteúdo. | `CreatureTab.tsx:44–47, 87–123` combina dados de cidade e hunt; `TeamSlot.tsx:13–20` lê apenas nome/nível; `useCreatureAt.tsx:7–19` lê apenas `snapshot.team[position]`. Identificador de imagem e preenchimento em cidade não estão ligados no WIP. |
| Ativo | Destacar a criatura ativa na cidade e a criatura que está em campo na caçada. Não inferir ativo pelo índice do slot. | `TeamStrip.tsx:98–107, 125–134` compara IDs; `CreatureTab.tsx:39–43` aplica anel e cores. `TeamPanel` não recebe `activeId` nem `hunting` (`TeamPanel.tsx:9–10`). |
| Desmaiado / indisponível | Preservar estado visual de criatura desmaiada e impedir seleção se a regra atual assim o exige; não usar só cor para transmitir estado. | `CreatureTab.tsx:45, 52–60, 99–100` usa `fainted`, desabilita o controle e reduz opacidade. `useCreatureAt.tsx:16–17` não seleciona nem retorna esse campo. Conservar rótulo/indicador acessível além da cor, conforme `DESIGN_SYSTEM.md:507–509`. |
| Troca e cooldown | Selecionar criatura apta chama o callback com o ID; durante cooldown, mostrar a máscara e a contagem nas posições não ativas. Não declarar troca concluída localmente. | `CreatureTab.tsx:48–56, 138–160` mantém a máscara fora do slot ativo; `TeamStrip.tsx:100–107, 127–134` encaminha o callback. `TeamPanel` não é interativo hoje: `TeamSlot.tsx:22–34` retorna `Flex`, não botão, e `GameHud.tsx:97` monta sem props. |
| Captura e nível | Quando o estado autoritativo fornecer um membro novo ou nível atualizado, o slot correspondente reflete os dados recebidos sem regra local de captura/XP. Não criar dispositivo, probabilidade, XP, fórmula ou timing de level-up. | `TeamStrip.tsx:73–78, 79–110` usa a lista viva do servidor durante hunt; `CreatureTab.tsx:24–26, 44–47` lê membro, nível e espécie. `TeamPanel` lê nível/nome do snapshot, mas não ID, membro completo ou fonte de cidade. Captura/level-up continuam decisões de produto e roadmap (`refactoring/03-plano-de-execucao.md:50–52`; `04-decisoes-pendentes.md:12–15`). |
| Recolher / expandir | Botão acessível alterna entre estados, informa a ação seguinte e mantém os slots recuperáveis. Preservar o padrão e o tempo de transição atuais até aprovação de outra coisa. | TeamStrip usa estado React e desloca a fileira (`TeamStrip.tsx:37, 44–68`); TeamPanel alterna classe diretamente (`TeamPanel.tsx:11–15, 17–30`) e usa `CollapseButton` (`:49`). O deslocamento, o botão e o espaço visível não estão demonstrados como equivalentes. |
| Desktop: ponteiro e foco | Hover continua sendo perceptível sem substituir o indicador persistente de ativo. Controles recebem foco visível e operam por teclado. Se houver tooltip, manter as regras do popup global. | `TeamStrip` usa `CreatureTab` dentro de `Pressable`; `Pressable.tsx:9–29` fornece elemento button, hover e `disabled`. A implementação atual não mostra tooltip do slot; `INTERFACE.md:15–24` define tooltip de hover e interação contextual geral, então a aplicação específica ao time precisa ser decidida. |
| Teclado e toque | Ações essenciais funcionam sem mouse; alvos respeitam o mínimo documentado e não exigem hover. | Botão nativo oferece interação de teclado em `Pressable.tsx:14–27`; o botão de recolher TeamStrip é nativo e tem `aria-label` dinâmico (`TeamStrip.tsx:139–168`). TeamPanel usa `CollapseButton` com `IconButton` rotulado (`features/team-panel/ui/CollapseButton.tsx:6–15`), mas os slots não são controles. `DESIGN_SYSTEM.md:487–495` pede controles semânticos e alvos mínimos de 44px. Não há prova de teclado/toque no navegador. |
| Escala e mobile | O HUD permanece legível e dentro da área útil em desktop e celular paisagem; o zoom do HUD acompanha a escala do canvas conforme o padrão atual; em retrato prevalece o overlay global. | `TeamStrip.tsx:38–39, 46–57` usa `useCanvasScale`; `TeamPanel.tsx:4, 9–10, 32–40` usa `useCanvasTransform`. `useCanvasScale.ts:5–35` limita a escala máxima à referência desktop e deriva o zoom do mundo. A escala já é tentativa demonstrável, mas não há evidência visual em tamanhos reais. |

### Interação ainda sujeita a decisão

O comportamento de produto da fileira diz que clicar numa criatura apta troca a ativa (`PLAY_SCREEN.md:98–104`). A convenção geral de popup diz que hover mostra tooltip, clique ou botão direito abre menu contextual e toque abre menu (`INTERFACE.md:17–24`). O `TeamStrip` atual seleciona diretamente por `Pressable` e não compõe um `Popup` (`TeamStrip.tsx:100–107, 127–134`). **Não mudar esse gesto por inferência:** definir se os slots do time são uma exceção explícita à convenção genérica, ou se o menu contextual deve coexistir com a ação de troca. A escolha precisa preservar toque direto e acessibilidade.

## Estado do WIP: demonstrado versus aberto

### Demonstrado no código, não equivalente a aceite UX

- `GameHud` já monta `TeamPanel`, enquanto `TeamStrip` legado permanece comentado; o mesmo arquivo também mantém a trilha da barra de habilidades comentada (`apps/client/src/pages/play/ui/GameHud.tsx:58–113`). Esse estado é de integração WIP, não prova de paridade.
- `useCreatureAt` faz seleção rasa do recorte `level`/`speciesName` por posição do snapshot de hunt (`features/team-panel/model/useCreatureAt.tsx:7–19`). Isso demonstra a estratégia técnica de isolamento adotada para o TeamPanel, conforme decisão do usuário; **não é por si só relatório de perfil/performance nem comprovação de que os cinco slots têm paridade**.
- `TeamPanel` renderiza cinco `TeamSlot` e tem estado colapsado por CSS (`features/team-panel/ui/TeamPanel.tsx:9–50`); `TeamSlot` apresenta a estrutura nome/nível (`TeamSlot.tsx:11–34`). `TeamSlotImage` ainda usa ID fixo (`TeamSlotImage.tsx:5–12`).
- TeamStrip é uma referência de comportamento mais completa: cidade usa `slots`, hunt usa `huntTeam`, preenche vazios, calcula ativo por ID e encaminha seleção (`widgets/game-hud/ui/TeamStrip.tsx:28–43, 79–137`). O membro vivo de hunt também fornece `fainted`, nível e espécie para o tab (`widgets/game-hud/ui/CreatureTab.tsx:18–27, 44–57`).

### Aberto para completar

- Fonte coerente de cidade e hunt, contrato do view-model e significado do índice versus `teamSlot`; a decisão pendente existente reconhece que TeamPanel só lê snapshot de hunt e cidade ainda não está ligada (`refactoring/01-diagnostico.md:19–23`; `04-decisoes-pendentes.md:12–13`).
- Identidade/imagem correta por criatura, ID para troca, `activeId`, cooldown, total do cooldown e estado de indisponibilidade.
- Atualização observável de membro/captura/nível nos dados que forem efetivamente suportados; regras de gameplay permanecem fora deste handoff.
- Semântica e posição visual do recolhimento; foco/hover/teclado/toque dos slots; decisão sobre popup contextual.
- Validação de escala, sobreposição com toolbar/canvas e layout em mobile paisagem; não assumir que o comportamento responsivo está provado apenas por `useCanvasScale`.

## Plano incremental de conclusão

1. **Fechar decisões bloqueantes** listadas ao final deste documento. Confirmar os dados que existem hoje em cada fase, sem acrescentar regra de jogo nem acoplar slots a tick de render.
2. **Concluir o modelo do slot:** preservar posição, membro/ID, espécie, nível, ativo e indisponibilidade; obter fonte válida tanto na cidade como na hunt. Garantir que mudança em campo não consumido não force render do slot. Cobrir mudanças de slot, vazio/preenchido e dados ausentes em testes. Esta etapa mantém o propósito técnico do TeamPanel e não depende de alteração visual.
3. **Concluir a interação:** tornar cada slot um controle semântico só se selecionável; encaminhar intenção pelo callback existente da página, tratar desmaiada/vazia conforme regra e exibir cooldown sem afirmar êxito antes da resposta autoritativa. Implementar foco/teclado/toque e decidir popup. Botão de recolher deve anunciar a ação seguinte e ser acessível.
4. **Aprovar aparência em isolamento:** comparar TeamPanel e TeamStrip lado a lado em uma galeria/harness ou cenário de desenvolvimento que não renderize as duas fileiras sobrepostas no HUD final. Usar apenas tokens e componentes do sistema existente; não redesenhar nem remover o TeamStrip nesta fase.
5. **Integrar por contexto:** plugar TeamPanel na cidade com state de cidade e na hunt com state vivo, mantendo exatamente cinco slots. Testar transição cidade → hunt → cidade, captura/alteração recebida quando suportadas, troca e cooldown; manter TeamStrip disponível como referência até todo aceite passar.
6. **Aposentar TeamStrip somente após aceite:** registrar screenshots e resultados de interação abaixo; remover a referência antiga em tarefa de implementação posterior, não nesta especificação. SkillBar permanece fora do escopo e segue seu próprio handoff.

## Critérios de aceite visual e de interação

- **Composição:** cinco posições em linha sob a toolbar e sobre o canvas, sem empurrar/redimensionar o canvas; cidade e hunt preservam posição e hierarquia do HUD descritas em `PLAY_SCREEN.md:27–39, 85–96`.
- **Dados/estados:** screenshots mostram exemplo de time parcial com vazios, time preenchido, ativo destacado, criatura desmaiada/indisponível, cooldown com contagem e transição de colapsado para expandido. Captura ou level-up só entram no roteiro se dados reais suportarem; marcar como não disponível quando não houver fluxo funcional, sem mock ser apresentado como prova de gameplay.
- **Interação:** testar seleção de slot por mouse, Enter/Espaço e toque; testar slot vazio e indisponível; confirmar que a troca é encaminhada, cooldown apresentado e estado ativo acompanha a fonte autoritativa. Testar botão colapsar/expandir por ponteiro e teclado, nome acessível e retorno de foco quando aplicável.
- **Hover e foco:** capturar estado hover sem confundi-lo com seleção; foco visível segue o sistema (`DESIGN_SYSTEM.md:513–517`). Se tooltip/menu for aprovado, verificar comportamento desktop e toque conforme `INTERFACE.md:17–24`; não introduzir tooltip ou menu silenciosamente.
- **Tamanho:** conferir referência desktop 1280×720, viewport desktop amplo e viewport celular em paisagem estreito; verificar escala do HUD, safe area, colisão com painéis da hunt/SkillBar e área clicável. Em retrato, confirmar que o overlay de orientação da tela prevalece (`PLAY_SCREEN.md:152–154`). Registrar viewport e escala nos resultados; não fixar valores de breakpoints ainda não aprovados.
- **Legibilidade:** nomes longos não ocultam nível/slot vizinho; não depender só de cor para indicar ativo ou indisponível; animação de recolhimento respeita movimento reduzido (`DESIGN_SYSTEM.md:509, 535–539`).
- **Prova de não regressão:** mesmo estado de dados e mesmo viewport para comparar comportamento e screenshots de TeamStrip referência e TeamPanel candidato. Os snapshots não podem mostrar somente um estado feliz.

### Evidências para o executor da validação

Usar `agent-browser` como ferramenta principal conforme `AGENTS.md:72–74`; testar `/game` com fixtures/cenários reproduzíveis para cidade e hunt. Registrar screenshot por estado, viewport e interação (pelo menos `team-panel-city-desktop`, `team-panel-hunt-desktop`, `team-panel-collapsed`, `team-panel-mobile-landscape`), além de screenshot dos estados ativos/indisponíveis/cooldown quando disponíveis. Guardar evidências no PR ou no local combinado pela equipe, sem adicioná-las ao repositório por suposição. Incluir roteiro, dados usados, viewport, ações, resultado observado, diferenças para TeamStrip e limitações; se login/fixtures impedirem o cenário, registrar o bloqueio e não declarar aceite visual.

## Perguntas que exigem escolha antes do aceite final

1. **Fonte de cidade:** o TeamPanel consumirá diretamente o `PlayerState` já passado por `GameHud`, ou outro seletor/adapter? Confirmar campos válidos e se IDs/slots são garantidos. A integração deve respeitar dependências FSD e a regra de que cliente não decide gameplay.
2. **Gesto de seleção:** confirmar exceção de clique/toque direto para troca ou adoção de menu contextual por slot. Se popup existir, quais informações e ações pertencem ao hover versus menu? O clique de desktop precisa continuar trocando sem surpresa?
3. **Captura e nível:** quais fluxos reais já fornecem membro novo e nível atualizado durante hunt/cidade? O que deve aparecer imediatamente e o que só após snapshot? Não definir regras de captura/XP aqui.
4. **Recolhimento:** manter exatamente o comportamento/direção de deslocamento do TeamStrip (fileira sobe, parcialmente visível e botão ao lado) ou preservar o comportamento atual do TeamPanel (slots sobem e botão próprio)? Qual área precisa continuar visível como pista de expansão?
5. **Mobile e limites:** em celular paisagem, manter escala atual derivada do zoom do canvas ou definir uma escala/limite próprio para o time? Valores mínimos/máximos de escala continuam pendentes em `INTERFACE.md:64–69`; não cristalizar sem decisão.
6. **Critério de prova de renderização:** quais medições do profiler e limiar aceitável serão registrados? O padrão de seletor já é a finalidade técnica declarada; um número de melhoria não deve ser inventado. O plano existente pede baseline reproduzível antes de alegações de desempenho (`refactoring/02-arquitetura-alvo.md:13–14`; `03-plano-de-execucao.md:7–22`).

## Referências do projeto

- Produto e interação: `docs/game/PLAY_SCREEN.md:27–39, 85–104, 146–154`; `docs/game/INTERFACE.md:7–24, 40–46, 64–69`.
- Design e acessibilidade: `docs/technical/client/DESIGN_SYSTEM.md:9–32, 229–241, 247–258, 417–420, 477–497, 503–539`.
- Arquitetura e limites: `docs/technical/ARCHITECTURE.md:11–26`; `refactoring/02-arquitetura-alvo.md:7–23`.
- Diagnóstico e plano prévios: `refactoring/01-diagnostico.md:19–30`; `refactoring/03-plano-de-execucao.md:16–26, 43–48, 54–58`; `refactoring/04-decisoes-pendentes.md:12–15, 27–28`.
- Implementação de referência: `apps/client/src/pages/play/ui/GameHud.tsx:58–113`; `apps/client/src/widgets/game-hud/ui/TeamStrip.tsx:14–69, 73–137, 139–169`; `apps/client/src/widgets/game-hud/ui/CreatureTab.tsx:18–71, 87–160`; `apps/client/src/widgets/game-hud/ui/EmptyCreatureTab.tsx:4–20`; `apps/client/src/widgets/game-hud/ui/SkillBar.tsx:14–90`; `apps/client/src/pages/play/ui/GameScreen.tsx:54–112`.
- WIP TeamPanel: `apps/client/src/features/team-panel/ui/TeamPanel.tsx:9–50`; `TeamSlot.tsx:9–36`; `TeamSlotImage.tsx:5–12`; `TeamSlotOverlay.tsx:5–15`; `TeamSlotName.tsx:5–31`; `CollapseButton.tsx:6–17`; `apps/client/src/features/team-panel/model/useCreatureAt.tsx:5–20`.
