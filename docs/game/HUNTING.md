# Caçada

## Encontros

Cada entrada de `hunting_location_species` define uma espécie que pode aparecer em um local de caça. `encounter_weight` define exclusivamente a probabilidade relativa de a espécie ser sorteada entre as espécies do mesmo local; ele não influencia IVs, raridade, atributos ou captura.

## Ondas

Cada local de caça possui faixas pré-definidas de quantidade de criaturas por onda em `hunting_location_wave_ranges`. Ao iniciar uma caça, a menor faixa disponível é selecionada. O jogador pode selecionar apenas uma das faixas daquele local durante a caça; a escolha pode ser alterada quantas vezes quiser e só é sorteada quando a próxima onda nasce. Criaturas já presentes permanecem inalteradas.

Para cada onda, o servidor sorteia uma quantidade inteira inclusiva entre o mínimo e o máximo da faixa selecionada. A espécie de cada criatura continua sendo sorteada independentemente pelo `encounter_weight` do local.

Quando um encontro surge, o servidor sorteia independentemente os seis IVs — HP, Ataque, Defesa, Ataque Especial, Defesa Especial e Velocidade — com valores inteiros entre 0 e 31. O total possível fica entre 0 e 186. Os mesmos valores permanecem no encontro durante a batalha e são persistidos se a captura for bem-sucedida.

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
