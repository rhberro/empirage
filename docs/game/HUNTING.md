# Caçada

## Encontros

Cada entrada de `hunting_location_species` define uma espécie que pode aparecer em um local de caça. `encounter_weight` define exclusivamente a probabilidade relativa de a espécie ser sorteada entre as espécies do mesmo local; ele não influencia IVs, raridade, atributos ou captura.

O seed gera os locais a partir de `routes.json`. O nome exibido de cada criatura é normalizado e validado contra os 151 registros de `gen1.json` antes de ser convertido no `species_id` do banco. O intervalo de `spawnChance` vira peso relativo pelo tamanho inclusivo da faixa; entradas repetidas da mesma espécie na rota, provenientes de métodos diferentes, são consolidadas somando os pesos e unindo os limites de nível. Encontros estáticos sem `spawnChance` não entram nas ondas repetíveis.

## Ondas

Cada local de caça possui faixas pré-definidas de quantidade de criaturas por onda em `hunting_location_wave_ranges`. Ao iniciar uma caça, a menor faixa disponível é selecionada. O jogador pode selecionar apenas uma das faixas daquele local durante a caça; a escolha pode ser alterada quantas vezes quiser e só é sorteada quando a próxima onda nasce. Criaturas já presentes permanecem inalteradas.

Para cada onda, o servidor sorteia uma quantidade inteira inclusiva entre o mínimo e o máximo da faixa selecionada. A espécie de cada criatura continua sendo sorteada independentemente pelo `encounter_weight` do local.

Quando um encontro surge, o servidor sorteia independentemente os seis IVs — HP, Ataque, Defesa, Ataque Especial, Defesa Especial e Velocidade — com valores inteiros entre 0 e 31. O total possível fica entre 0 e 186. Os mesmos valores permanecem no encontro durante a batalha e são persistidos se a captura for bem-sucedida.

## Atributos de combate

Cada criatura mantém seis IVs de 0 a 31, seis EVs de 0 a 252 (com máximo total de 510) e uma Nature aleatória. Nature nunca altera HP; para cada outro atributo ela aumenta um em 10% e reduz outro em 10%, após o cálculo base. Os EVs usam o rendimento da espécie derrotada registrado no `gen1.json`; somente a criatura ativa que recebe experiência recebe EVs, respeitando os limites individual e total.

Os atributos usam `floor(((2 × base + IV + floor(EV / 4)) × nível) / 100) + nível + 10` para HP e `floor((floor(((2 × base + IV + floor(EV / 4)) × nível) / 100) + 5) × Nature)` para Attack, Defense, Special Attack, Special Defense e Speed. Em batalha, estágios de −6 a +6 modificam os atributos e também Accuracy/Evasion; eles são zerados ao trocar a criatura ativa.

Moves com accuracy nula acertam sempre. Os demais aplicam sua accuracy base, o estágio de Accuracy do usuário e o estágio de Evasion do alvo; 100% acerta sempre quando os estágios são neutros. O cliente recebe feedback de erro e de alteração de estágio pelo `hunt_state`.

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
