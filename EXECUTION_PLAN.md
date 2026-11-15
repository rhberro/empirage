# Plano de Execução: Escala, Confiabilidade e Comunicação

## Objetivo

Evoluir o Empirage para suportar centenas de jogadores com segurança e preparar a arquitetura para milhares, sem reintroduzir crescimento de disco proporcional a ticks ou snapshots históricos. Este plano não é uma ordem de execução cega: cada fase possui resultado, dependências, critérios de aceite e ponto de decisão.

## Princípios inegociáveis

1. O servidor é autoritativo: o cliente pede ações; nunca decide ouro, dano, captura, XP ou resultado econômico.
2. Estado visual em tempo real não é histórico de banco.
3. Dados de negócio são transacionais e idempotentes.
4. Uma caça ativa ocupa uma representação persistida compacta, não uma sequência de snapshots.
5. Toda comunicação possui contrato documentado em `docs/game/COMMUNICATION.md`.
6. Nenhuma alteração de banco é aplicada antes de validar a migração em ambiente local/descartável e confirmar o alvo remoto.

## Fase 0 — Contenção e linha de base

### Trabalho

1. Manter o servidor desligado enquanto o projeto Supabase indisponível não for resetado.
2. Preservar logs do incidente e registrar a causa: falta de espaço em `pg_wal` provocada por checkpoint histórico de caça em alta frequência.
3. Registrar métricas iniciais disponíveis: tamanho de tabelas/índices, WAL, checkpoints, duração e frequência de RPCs.
4. Confirmar explicitamente o project ref antes de qualquer `supabase db reset --linked`.

### Critério de aceite

- Não há processo de jogo escrevendo no banco afetado.
- O incidente possui registro com horário, erro, tabelas envolvidas e hipótese causal.
- O alvo do reset está confirmado como ambiente descartável.

## Fase 1 — Contratos, inventário e compatibilidade

### Trabalho

1. Manter `docs/game/COMMUNICATION.md` como fonte de verdade para HTTP, Auth, WebSocket e persistência induzida por mensagens.
2. Criar tipos de contrato compartilhados ou uma fonte gerada, para que cliente e servidor não mantenham versões manuais divergentes.
3. Definir envelope futuro comum para comandos duráveis:

```json
{
  "type": "configure_capture",
  "version": 2,
  "commandId": "uuid",
  "payload": {}
}
```

4. Definir respostas de comando com correlação:

```json
{
  "type": "command_result",
  "version": 2,
  "commandId": "uuid",
  "status": "accepted"
}
```

5. Classificar cada mensagem em um dos grupos: comando durável, comando efêmero, evento confiável, evento substituível ou presença.
6. Definir estratégia de transição: servidor aceita v1 e v2 por período definido, ou implanta cliente e servidor juntos em manutenção controlada.

### Critério de aceite

- Cada campo possui dono, semântica, validação e compatibilidade documentadas.
- Todo comando com efeito econômico ou persistente possui `commandId`.
- Não existe campo de protocolo sem parser/validador em ambos os lados.

## Fase 2 — Modelo de persistência compacto

### Trabalho

1. Redesenhar `character_hunts` como uma linha por caça ativa com `hunt_id`, `character_id` único, `user_id`, `status`, `revision`, versão do snapshot, cursor/seed de simulação, `updated_at` e snapshot mínimo.
2. Escolher uma única fonte para cada campo variável. Não duplicar inimigos, cooldowns ou eventos em colunas e JSONB simultaneamente.
3. Remover `character_hunt_checkpoint_receipts` e qualquer resultado de checkpoint que carregue snapshot/fingerprint grande.
4. Criar `game_commands` ou evoluir `character_capture_commands` para deduplicar comandos de negócio com `command_id`, tipo, hash do payload, resultado mínimo e expiração.
5. Manter criaturas, ouro, inventário e configurações em tabelas normalizadas como estado canônico.
6. Versionar o snapshot de caça. Uma versão incompatível exige migrador explícito ou descarte controlado apenas no ambiente de desenvolvimento.
7. Não criar índices em colunas que mudam a cada checkpoint, salvo depois de demonstrar necessidade por consulta.

### Critério de aceite

- Uma caça ativa não pode produzir linhas históricas de checkpoint.
- Repetir um checkpoint não muda duas vezes o estado.
- Repetir uma captura/cura não duplica criatura, XP, ouro ou item.
- O tamanho da tabela cresce com caças ativas e eventos de negócio, não com duração em ticks.

## Fase 3 — Semântica de simulação e recuperação

### Trabalho

1. Definir decisão de produto para tempo desconectado: pausar no disconnect ou avançar deterministicamente por `seed + cursor`. Documentar a escolha no design do jogo.
2. Simular uma caça somente enquanto houver sessão ativa. Nunca inicializar/simular todas as caças do banco ao subir o servidor.
3. Marcar runtime como `dirty` apenas em transições relevantes: início, onda, troca, captura, cura, pausa, saída, término e mudança efetiva de estado.
4. Coalescer checkpoint de segurança somente quando `dirty`; alvo inicial de 60–120 s após medição. Preservar checkpoint imediato em pausa, saída, troca, cura, captura e fim.
5. Em restart/desconexão, persistir, marcar pausa e remover runtime de memória. No reconnect, recuperar apenas a caça daquele personagem.
6. Usar `revision` e update condicional como proteção contra escritor concorrente. Em comandos econômicos, adquirir locks em ordem fixa: caça, personagem e criatura.

### Critério de aceite

- Encerrar o processo em diferentes pontos não duplica transações nem corrompe caça.
- Reconectar carrega somente a caça do jogador e não desperta caças inativas.
- Dois executores concorrentes detectam conflito sem sobrescrever estado silenciosamente.

## Fase 4 — Transporte WebSocket escalável

### Trabalho

1. Separar mensagens confiáveis de mensagens substituíveis. `snapshot`, telemetria visual e presença podem ser substituídos; resultados de comando e mudanças econômicas não.
2. Trocar o `hunt_state` monolítico por projeções de interesse:
   - estado inicial completo ao entrar/reconectar;
   - deltas compactos por mudança;
   - eventos de combate efêmeros com sequência;
   - coleção paginada sob demanda;
   - re-snapshot sob demanda ao detectar lacuna.
3. Definir orçamento de payload por tipo e medir bytes médios/p95/p99. Proibir anexar dados de coleção, catálogo ou mapas completos a eventos de combate frequentes.
4. Acrescentar `eventId`/sequência por fluxo e `commandId` por comando. O cliente descarta duplicatas e solicita recuperação se houver lacuna.
5. Formalizar códigos de fechamento, comportamento de reconexão e fila local apenas para comandos idempotentes. Nunca reenviar entrada de movimento antiga.
6. Manter ping/pong nativo e remover o tipo JSON `heartbeat` se ele não fizer parte do contrato real.
7. Delimitar interesse na cidade: cada cliente recebe apenas jogadores no mesmo mapa/zona e, futuramente, numa área de interesse próxima.
8. Fixar limites por conexão: tamanho de mensagem, taxa por categoria, bytes pendentes, tamanho de fila e tempo de autenticação.

### Critério de aceite

- O cliente reconecta sem executar duas vezes uma compra ou captura.
- Um jogador não recebe atualizações de entidades fora de sua zona de interesse.
- O estado inicial permite reconstruir a interface; deltas posteriores permanecem pequenos.
- Sob backpressure, eventos substituíveis são descartados primeiro e eventos críticos levam a recuperação explícita, não corrupção visual silenciosa.

## Fase 5 — Separação arquitetural do servidor

### Trabalho

1. Separar transporte WebSocket, aplicação de comandos, domínio de caça, projeção de estado e persistência em módulos com interfaces explícitas.
2. Criar um roteador de comandos que valida envelope, autenticação, autorização, idempotência e versão antes de atingir o domínio.
3. Criar projetores dedicados para cidade, caça e coleção; nenhum projetor deve montar dados que seu consumidor não usa.
4. Centralizar lifecycle: autenticação, entrada, desconexão, suspensão, persistência e shutdown devem compartilhar a mesma máquina de estados.
5. Garantir que cada caça tenha um único executor lógico. Preparar uma abstração de roteamento por `hunt_id` para futura distribuição entre instâncias.
6. Proibir o uso de memória de processo como única fonte de verdade de dados econômicos ou de sessão recuperável.

### Critério de aceite

- Uma mudança em HTTP não exige alterar o motor de caça.
- Uma mudança no formato visual não altera a transação econômica.
- Cada transição de caça tem estado anterior, estado seguinte, persistência exigida e evento emitido claramente definidos.

## Fase 6 — Escala horizontal e presença

### Trabalho

1. Antes de múltiplas instâncias, definir afinidade de conexão no balanceador para WebSocket.
2. Escolher camada de coordenação externa para presença, roteamento de caça e publicação entre instâncias. Redis é candidato, mas a decisão deve considerar operação, custo e durabilidade.
3. Usar canais/salas por mapa e zona; nunca transmitir para todos os sockets para filtrar no processo.
4. Fazer dono da caça ser determinístico por `hunt_id`; uma instância só pode simular sua partição.
5. Planejar failover: a nova instância recupera checkpoint, respeita revision e não reexecuta comandos já deduplicados.
6. Configurar pool e limite de concorrência de flushes. Muitos disconnects simultâneos não podem abrir trabalho ilimitado contra Postgres.

### Critério de aceite

- Duas instâncias não simulam a mesma caça.
- Queda de uma instância não duplica resultado econômico.
- A transmissão entre instâncias respeita interesse, limite de tamanho e backpressure.

## Fase 7 — Observabilidade e operação

### Trabalho

1. Criar métricas: conexões, caças em memória/pausadas, mensagens por tipo, bytes por tipo, atraso de tick, buffer de saída, reconexões, rejeições e fechamentos.
2. Criar métricas de persistência: checkpoints por motivo, tamanho de snapshot, latência RPC, retries, conflitos de revision, falhas e comandos deduplicados.
3. Criar métricas de banco: tamanho de tabela/índices, WAL, duração de checkpoint, dead tuples, atraso de autovacuum, conexões, locks e consultas lentas.
4. Criar alertas antes de exaustão: disco 70% e 80%, crescimento anormal, erros de persistência, falhas de readiness e latência p95 fora do orçamento.
5. Adicionar health checks distintos: liveness do processo, readiness com consulta leve ao banco e disponibilidade da simulação.
6. Incluir `huntId`, `characterId`, `commandId`, `connectionGeneration` e causa de persistência nos logs estruturados, nunca token.

### Critério de aceite

- Um alerta avisa antes de disco esgotar.
- Um erro de captura pode ser seguido nos logs por `commandId` sem expor segredos.
- É possível responder qual tabela, índice ou tipo de mensagem está crescendo.

## Fase 8 — Retenção, manutenção e segurança

### Trabalho

1. Expirar comandos idempotentes após janela maior que a máxima de retry, inicialmente 24 h; limpar em lotes pequenos ou por partições diárias.
2. Manter histórico somente para fatos de negócio necessários: início/fim de caça, captura, item gasto e XP concedido. Nunca armazenar tick ou evento visual como auditoria.
3. Se houver histórico volumoso, particionar por período, definir retenção de 30/90 dias e exportar analytics para sistema próprio.
4. Revisar funções `SECURITY DEFINER`: `search_path` seguro, validação de invariantes, execução revogada de `PUBLIC`, somente `service_role` quando apropriado.
5. Revisar RLS, permissões de tabelas expostas e ausência de chave secreta no navegador.

### Critério de aceite

- Nenhuma tabela operacional cresce sem política de retenção.
- Funções privilegiadas não estão acessíveis a `anon`, `authenticated` ou `PUBLIC` sem necessidade justificada.
- Limpeza não causa delete massivo nem degradação de autovacuum.

## Fase 9 — Validação de carga e rollout

### Trabalho

1. Definir cenários: cidade com presença, caça contínua, captura, cura, reconexão, queda do processo, deploy, muitas desconexões e tentativa duplicada.
2. Medir em ambiente descartável, começando com centenas de sessões e evoluindo até a meta de capacidade. Registrar CPU, memória, tráfego, WAL, latência, locks e crescimento de tabelas.
3. Definir orçamentos antes do teste: tamanho p95/p99 de evento, mensagens/s por conexão, atraso de tick, tempo de recuperação e escrita por caça/hora.
4. Aplicar a migração limpa somente após validação local. Para o ambiente remoto descartável: parar servidor, confirmar project ref, resetar, aplicar migrations, iniciar e validar manualmente os fluxos críticos.
5. Executar rollout em etapas: contrato compatível, observabilidade, persistência compacta, projeções/deltas, depois escala horizontal.

### Critério de aceite

- Nenhum teste de sessão longa apresenta crescimento de disco proporcional a segundos de caça.
- Falhas de rede e reinícios não duplicam dados econômicos.
- A meta definida de jogadores é atingida com margem de CPU, memória, banco e rede.

## Ordem recomendada

1. Fases 0 e 1.
2. Fases 2 e 3, incluindo reset do ambiente descartável somente no momento seguro.
3. Fase 7 antes de ampliar carga.
4. Fase 4 para preparar o protocolo para crescimento de `hunt_state`.
5. Fases 5 e 8 para consolidar limites arquiteturais e operacionais.
6. Fase 9 como gate de qualidade.
7. Fase 6 quando houver necessidade real de múltiplas instâncias ou a carga medida justificar.

## Decisões pendentes de produto

- O que acontece com a caça durante logout/desconexão: pausa ou progressão determinística offline?
- Quais fatos de caça precisam de histórico/auditoria e por quanto tempo?
- Quais zonas/mapas e distâncias definem interesse visual de presença?
- Qual meta mensurável de jogadores simultâneos e qual orçamento de latência por região?
