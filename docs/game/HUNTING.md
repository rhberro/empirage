# Caçada

## Encontros

Cada entrada de `hunting_location_species` define uma espécie que pode aparecer em um local de caça. `encounter_weight` define exclusivamente a probabilidade relativa de a espécie ser sorteada entre as espécies do mesmo local; ele não influencia IVs, raridade, atributos ou captura.

O seed gera os locais a partir de `routes.json`. O nome exibido de cada criatura é normalizado e validado contra os 151 registros de `pokedex_151.json` antes de ser convertido no `species_id` do banco. O intervalo de `spawnChance` vira peso relativo pelo tamanho inclusivo da faixa; entradas repetidas da mesma espécie na rota, provenientes de métodos diferentes, são consolidadas somando os pesos e unindo os limites de nível. Encontros estáticos sem `spawnChance` não entram nas ondas repetíveis.

## Ondas

Cada local de caça possui faixas pré-definidas de quantidade de criaturas por onda em `hunting_location_wave_ranges`. Ao iniciar uma caça, a menor faixa disponível é selecionada. O jogador pode selecionar apenas uma das faixas daquele local durante a caça; a escolha pode ser alterada quantas vezes quiser e só é sorteada quando a próxima onda nasce. Criaturas já presentes permanecem inalteradas.

Para cada onda, o servidor sorteia uma quantidade inteira inclusiva entre o mínimo e o máximo da faixa selecionada. A espécie de cada criatura continua sendo sorteada independentemente pelo `encounter_weight` do local.

Quando um encontro surge, o servidor sorteia independentemente os seis IVs — HP, Ataque, Defesa, Ataque Especial, Defesa Especial e Velocidade — com valores inteiros entre 0 e 31. O total possível fica entre 0 e 186. Os mesmos valores permanecem no encontro durante a batalha e são persistidos se a captura for bem-sucedida.

## Atributos de combate

Cada criatura mantém seis IVs de 0 a 31, seis EVs de 0 a 252 (com máximo total de 510) e uma Nature aleatória. Nature nunca altera HP; para cada outro atributo ela aumenta um em 10% e reduz outro em 10%, após o cálculo base. Os EVs usam o rendimento da espécie derrotada registrado no `pokedex_151.json`; somente a criatura ativa que recebe experiência recebe EVs, respeitando os limites individual e total.

Os atributos usam `floor(((2 × base + IV + floor(EV / 4)) × nível) / 100) + nível + 10` para HP e `floor((floor(((2 × base + IV + floor(EV / 4)) × nível) / 100) + 5) × Nature)` para Attack, Defense, Special Attack, Special Defense e Speed. Em batalha, estágios de −6 a +6 modificam os atributos e também Accuracy/Evasion; eles são zerados ao trocar a criatura ativa.

O intervalo global mínimo entre o uso de quaisquer habilidades por um mesmo combatente (GCD) é de 1,5 s. Os tempos de recarga individuais (cooldown) são proporcionais à função e ao impacto do golpe: ataques básicos leves variam entre 1,5 s e 2,0 s, ataques médios e fortes variam de 2,5 s a 5,0 s, e finalizadores de alto poder alcançam até 8,0 s a 10,0 s. Habilidades de status puro que alteram estágios de atributos possuem cooldown de 6,0 s a 8,0 s, e efeitos de condição severa (como sono, congelamento ou paralisia) possuem cooldown de 8,0 s a 10,0 s. Quando uma habilidade sem dano aplica apenas alteração de estágios e todos os alvos afetados já se encontram com os respectivos atributos no limite (+6 para bônus ou −6 para penalidades), a habilidade é considerada saturada e não entra no conjunto de habilidades disponíveis para execução; para criaturas selvagens, ela é excluída do sorteio aleatório, e para a criatura ativa do jogador, ela é ignorada em favor do próximo move disponível da esquerda para a direita na barra de habilidades.

Moves com accuracy nula acertam sempre. Os demais aplicam sua accuracy base, o estágio de Accuracy do usuário e o estágio de Evasion do alvo; 100% acerta sempre quando os estágios são neutros. O cliente recebe feedback de erro e de alteração de estágio pelo `hunt_state`.

Quando duas ações ficam prontas na mesma atualização, o servidor as resolve por prioridade do move, depois por Speed já modificada por estágios e, por fim, por identificador do combatente para desempate determinístico. Todo ataque de dano tem chance base de crítico de 1/24 e crítico multiplica o dano por 1,5; moves com razão especial alteram essa chance pelo efeito estruturado. O cliente recebe `Critical hit` apenas como feedback visual, sem decidir dano.

O servidor resolve o alvo a partir do catálogo do move. Moves de alvo único usam um inimigo elegível dentro do alcance; moves de área atingem imediatamente todos os inimigos elegíveis, e sua área registrada determina as casas renderizadas pelo cliente. Moves que miram aliado usam um aliado elegível; como a caçada atual só posiciona a criatura ativa, a ausência de outro aliado faz o alvo voltar para a própria criatura. A entrega `melee` ou `ranged` do catálogo define a animação, sem alterar a decisão autoritativa de dano.

Moves por nível entram automaticamente na lista de moves aprendidos quando a criatura alcança o nível exigido. Nesta fase, somente esses moves aparecem na configuração e são executáveis em batalha. Moves associados à evolução, TM e HM permanecem registrados no catálogo apenas como referência para futuras formas explícitas de aprendizado.

O seed traduz o catálogo local para efeitos estruturados por move. Cada efeito declara tipo, alvo, chance, magnitude, duração, intervalo e requisito quando aplicável. O motor executa primitivas genéricas de dano, alteração de HP, estágio, condição, bloqueio da próxima ação, dano recorrente e requisito de alvo; ele não interpreta descrição ou nome de move durante a batalha. A chance do efeito vem do catálogo, e efeitos de estágio que compartilham a mesma chance em um move são resolvidos juntos. Condições de burn, freeze, paralysis, poison, sleep e confusion também são aplicadas pelo servidor; o cliente recebe somente o evento visual e o estado autoritativo resultante.

O mesmo catálogo descreve golpes de múltiplos acertos, dano fixo, dano proporcional ao HP, dano por nível, OHKO, críticos ampliados, acerto garantido, status aleatório, reset de estágios, screens por categoria, recuperação total com sono, auto-nocaute e recoil quando o golpe falha. Screens e condições de descanso são persistidos no checkpoint; portanto, não são removidos por reconexão.

As famílias clássicas de Gen 1 também são declaradas no catálogo como efeitos estruturados, incluindo múltiplos hits, dano fixo, dano por nível, fração de HP, OHKO, razão de crítico, ataques inevitáveis, status aleatório e limpeza de estágios. A geração do seed produz `docs/game/GEN1_MOVE_EFFECT_COVERAGE.json` e falha se algum move aprendível por nível das 151 espécies ficar sem classificação. `Pay Day`, `Roar`, `Teleport` e `Whirlwind` estão explicitamente fora do escopo de combate atual porque dependem de recompensa, fuga ou viagem no mundo.

O catálogo local registra, por move, o percentual de drain, recoil, recuperação de HP máximo e chance de flinch. Drain positivo recupera o percentual do dano efetivamente causado; drain negativo aplica recoil da mesma proporção. A recuperação respeita o HP máximo e produz feedback visual sem permitir que o cliente altere a vida. Ao acertar e causar dano, um move com chance de flinch deixa a criatura atingida incapaz de executar sua próxima ação; a condição é consumida nesse bloqueio e o cliente recebe o feedback visual correspondente.

Moves que aprisionam o alvo aplicam dano recorrente por quatro ou cinco ticks. `Leech Seed` aplica dano recorrente até o alvo sair de combate, e `Nightmare` somente causa seu dano recorrente enquanto o alvo permanecer dormindo. Esses efeitos, inclusive seus requisitos, são persistidos no checkpoint e resolvidos exclusivamente pelo servidor.

## Raridade

A raridade é derivada exclusivamente da soma dos seis IVs. Esta tabela é a fonte de verdade para a classificação exibida, o filtro de captura e a coluna gerada `creatures.rarity`:

| Raridade | Faixa de IV total | Percentual |
| --- | ---: | ---: |
| Comum | 0–74 | 0–40% |
| Incomum | 75–111 | 41–60% |
| Rara | 112–139 | 61–75% |
| Épica | 140–167 | 76–90% |
| Lendária | 168–186 | 91–100% |

O percentual é apenas uma representação de design do total máximo de 186 IVs. O servidor e o banco trabalham com o total inteiro para evitar arredondamento.

## Equipe durante a caçada

O checkpoint da caça persiste a vida de cada criatura da equipe. Ao trocar ou recuperar uma caça, cada criatura mantém exatamente o HP que possuía antes da transição. Uma criatura que desmaiar durante a caçada permanece indisponível para troca enquanto aquela execução estiver ativa.

Ao encerrar a caça e retornar à cidade, a execução é finalizada e não há HP de combate persistente fora dela. Portanto, toda nova caça inicia cada integrante da equipe com HP máximo, independentemente de qual criatura estava ativa ou desmaiou na caça anterior.

## Captura automática

Quando uma criatura é derrotada, o sistema de captura automática usa a Pokébola selecionada, caso a raridade esteja configurada como alvo e haja ouro suficiente. Cada tentativa consome uma bola, com sucesso ou falha.

As únicas bolas disponíveis na configuração automática são Pokébola, Great Ball e Ultra Ball. A Master Ball é exclusiva de eventos e drops raros, portanto não é vendida nem pode ser selecionada para consumo automático.

| Raridade | Pokébola | Great Ball | Ultra Ball |
| --- | ---: | ---: | ---: |
| Comum | 38% | 43,7% | 43,7% |
| Incomum | 4,5% | 5,1% | 5,1% |
| Rara | 1,2% | 1,4% | 1,4% |
| Épica | 0,012% | 0,018% | 0,049% |
| Lendária | 0,0095% | 0,014% | 0,038% |

Os bônus de isca, VIP e amuleto de captura não fazem parte do jogo e não são aplicados a essas chances.
