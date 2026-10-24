# Captura e Level-up

## Objetivo

Implementar a progressão das criaturas (experiência → nível → atributos) e o
último elemento base da caçada: a captura de criaturas selvagens desmaiadas.

## Decisões

- **Curva de nível:** experiência total para atingir o nível N = `100 × (N − 1)²`
  (nível 2 = 100, 3 = 400, 4 = 900, …). Fórmulas em
  `apps/shared/contracts/attributes.ts` (`experienceForLevel`, `levelForExperience`,
  `experienceForNextLevel`).
- **Dispositivo de captura:** consumido a cada tentativa, capture ou não.
- **Atributos:** já calculados por `calculateAttribute`/`calculateMaxHp` (d=0.3,
  k=0.05); no level-up apenas o nível sobe e os atributos/vida máxima recalculam.

## Contrato (já definido)

- `apps/shared/contracts/attributes.ts`: funções de nível.
- `apps/shared/contracts/huntSim.ts`:
  - `HuntCaptureDevice` (itemId, multiplier, name, quantity, slot).
  - `HuntTeamMemberActor` (id, fainted, level, speciesName, speciesSlug).
  - Eventos `capture` e `level_up`.
  - `HuntSnapshot.device` + `HuntSnapshot.team`; `HuntDelta.device?` + `HuntDelta.team?`.

## Frente servidor (`apps/server/**`, `supabase/**`)

1. **Migração + seed:** coluna `capture_multiplier` em `items` (dispositivos),
   seed com 5 dispositivos (1×–5×).
2. **Level-up:** em `deaths.ts` `grantExperience`, após somar XP, recalcular o
   nível com `levelForExperience`; se subiu, recalcular atributos e `maxHp` e
   curar a diferença, emitir evento `level_up`. Persistir `level` em
   `persistence.ts` `saveTeamState`.
3. **Dispositivo:** mapear o dispositivo equipado (slot 6 do gear) + quantidade
   da mochila no `SimTeamMemberInput`/`SimTeamMember`; expor em `wire.ts`
   (`device` no snapshot/delta).
4. **Captura:** no desmaio, a selvagem vira **corpo** no chão por alguns segundos
   (não é removida na hora); se houver dispositivo equipado com quantidade,
   dispara a bola, rola `capture_chance × capture_multiplier`; sucesso → cria
   criatura (nível 1, atributos base, PV aleatório 0–100%, XP 0), consome o
   dispositivo, insere no banco (`creatures`) e entra no slot vago do time ou no
   armazenamento; falha → consome o dispositivo e rola o drop normalmente.
   Evento `capture` com o resultado.
5. **Time:** expor `team` (id, fainted, level, species) no snapshot/delta para a
   barra de criaturas refletir desmaiadas e level em tempo real.

## Frente cliente (`apps/client/**`)

1. **Barra de criaturas:** refletir o estado desmaiada (fundo vermelho suave +
   opacidade reduzida) usando o `team` do hunt store; assinar o `team`.
2. **Troca manual:** já existe (clique + cooldown 5 s); garantir que funciona
   durante a caçada.
3. **Animações de troca:** criatura "saindo" (entra na bola), espera 2 s,
   criatura "entrando" (sai da bola). Gerar as animações proceduralmente.
4. **Bola de captura:** a bola sai do treinador e vai até o corpo no chão
   (evento `capture`); sucesso anima a captura.
5. **Dispositivo:** exibir multiplicador/quantidade no slot do dispositivo.

## Critérios de aceite

- Caçar rende XP; ao atingir 100 XP a criatura sobe para o nível 2 e os atributos
  crescem; o nível persiste após a caçada.
- Criatura selvagem desmaiada vira corpo por alguns segundos; com dispositivo
  equipado, a bola voa até o corpo e há chance de captura (chance × multiplicador).
- Capturada entra no time (slot vago) ou armazenamento, nível 1, atributos base,
  PV aleatório, XP 0, e aparece no armazenamento após recarregar.
- Barra de criaturas mostra desmaiada em vermelho/opacidade e troca com clique
  (cooldown 5 s); desmaio troca automaticamente para a próxima apta.
