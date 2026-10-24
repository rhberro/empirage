# Arquitetura-alvo conservadora

Status: **planejado**. O objetivo é clarificar ownership e reduzir trabalho/re-render comprovado, preservando caminhos existentes. Não é decisão de migrar tudo para protocolo novo, event sourcing, cache distribuído ou rewrite.

## Ownership de estado

| Domínio | Fonte autoritativa | Projeção cliente | Consumidor visual | Limite de ownership |
|---|---|---|---|---|
| Player/trainer | Server + persistência relacional; mutações autorizadas no servidor. Estado agregado é reconstruído pelo loader/broadcaster. | `playerStateSync` global com `(epoch, rev)`, listeners e fallback REST. | React HUD/features (TeamPanel na cidade; skillbar quando integrada), sem client-side gameplay. | `entities/team/model/playerStateSync.ts` aplica estado; não duplicar cópia mutável por widget. |
| Cidade/world | Registro de atores/movimento no servidor; posição durável via persistência já existente. | `worldStore` mapa/path/prediction/revision/server clock. Predição local é visual temporária, sujeita à resposta server. | World Pixi lê store/timeline por frame. | `worldStore` é projeção de mundo, não substitui player state. `worldRev` por observador. |
| Hunt | `HuntRuntime.state` no servidor durante a sessão; DB guarda checkpoint e efeitos duráveis. | `huntStore` snapshot + deltas/events/huntRev. | React consome seletores de fatos de HUD; Hunt Pixi lê timeline/event store no ticker. | Hunt state não é PlayerState: player snapshot emitido ao fechar/necessidade de sync reconcilia dados persistidos para cidade. |
| Interface | Nenhuma autoridade sobre gameplay. | Seletores e props derivados de stores. TeamPanel substitui visualmente o slot/team strip na UI conforme decisão, mas legado não sai até paridade comprovada. Skillbar incompleta é fluxo/entrega separada. | React só reage a campos selecionados; Pixi desacoplado. | Ownership de composição é `GameHud`; estado/seletores no slice/fatia apropriada; gate visual segue o [handoff do designer](05-ux-hud.md). |

## Classificação de fatos

- **Persistente/estrutural:** treinador, time/ordem/coleções, inventário, loadout, moedas e campos de sessão/checkpoint que garantem continuidade. São escritos por serviço/DB segundo regra atual; snapshot player é projeção agregada, não o registro persistente.
- **Estado vivo mutável:** posição/atores e simulação da hunt em memória no servidor; snapshots e deltas espelham esse estado. Checkpoint de hunt não é event log completo nem autorização para cliente recomputar simulação.
- **Eventos efêmeros:** cast, damage, death, spawn, loot/capture/experience etc. do `HuntRuntimeEvent` têm instante/id e propósito de animação/feed. Efeito cliente não credita DB e não substitui os campos de snapshot/delta.
- **Derivados temporais:** stamina/cooldown/segmento de caminhada resolvidos por timestamps e relógio de servidor. Enviar timestamp absoluto quando já é contrato; UI calcula contagem/posição para render, não decide resultado.
- Classificar cada campo consultando usos e persistência antes de refatorar; campos mistos (ex. vida live versus vida persistida em fim) precisam de ponto de reconciliação explícito.

## Fluxos propostos (sem mudar o protocolo por antecipação)

### Bootstrap e updates

1. Autenticar/autorizar conexão; sessão do trainer e visibilidade validadas no servidor.
2. Player: `select_trainer`/mutação segue o caminho existente; `command_result` correlaciona pedido e informa revisão; `state_snapshot` é full truth entregue pela fila. Não aplicar ack como estado.
3. Cidade: `world_state` bootstrapa actors/you e worldRev. `actor_update`/`actor_leave` aplicam updates completos com revisão; move result confirma caminho. Cliente interpola timestamps.
4. Hunt: `hunt_state` inicializa snapshot e relógio/huntRev; `hunt_delta` entrega patch e eventos do período; `hunt_ended` fecha fase/ledger e pode ser seguido por player snapshot.
5. Stores aplicam cada mensagem atomicamente: construir próximo snapshot e mapa/team fora da publicação e fazer um único set; preservar referências de entidades/slots não alterados (structural sharing). Um slot só deve se invalidar quando sua seleção muda em campo efetivamente lido.

### Reconexão, epoch e lacuna

- Player `epoch` diferente significa nova época: descartar cursor anterior e aceitar snapshot completo. Mesmo epoch, revisão velha/igual ignora; gap agenda fallback REST atualmente debounced. Fallback REST com `sinceRev` devolve 204 se sem novidades, ou estado inteiro se mais novo.
- World `worldRev` não é epoch do player. Hoje aceita revisões estritamente maiores e reconnect reseta e recebe world_state. Não inventar sequência por `+1` sem demonstrar que não há saltos legítimos nem mensagens filtradas por observador.
- Hunt `huntRev` também não se compara com os outros. **Política planejada**: após medir/confirmar contiguidade por receptor, se `incoming <= current` descartar; se `incoming > current` mas rev não contígua e mensagem é patch, não merge parcial silencioso: marcar incoerência e acionar snapshot/reconnect de hunt existente. Até haver garantia, teste e mecanismo de snapshot explícito, não impor `+1` como regra de produção. Snapshot completo pode restaurar estado por epoch/session identity; redefinir lifecycle de hunt não é apenas número de revisão.
- Eventos podem ser deduplicados por ID para efeitos visuais caso retransmissão seja possível, sem usar isso como mecanismo de dedupe de persistência. Side effects idempotentes e ordenados permanecem responsabilidade servidor.

### Comandos e acks

Cliente envia intenção com `reqId`, forma validada e protocolo versionado; servidor valida identidade, ownership, regra e serializa operação no domínio. Ack/command_result responde sucesso/falha e revisão do estado esperado. Atualização observável vem do push state/domain apropriado; timeout usa fallback já disponível. Compras/vendas/inventário nunca sofrem “last write wins”/coalescência sem idempotency e sem preservar operações distintas.

## Invariantes obrigatórios

1. Servidor decide regras e continua simulando hunt offline; reconectar não cria nova batalha nem reinicia curso.
2. Ordem por account/trainer, replay/catch-up determinístico e aleatoriedade/cursor persistido permanecem reproduzíveis; snapshots/deltas devem convergir ao mesmo estado final.
3. Autorização/visibilidade por destinatário é verificada para cada mensagem, snapshot, fallback e comando. Mensagem incremental não pode incluir dado de outro treinador por reuso de cache.
4. Snapshot é recuperação completa; patch não pode ser tratado como completo. Ao detectar gap, cliente não continua silenciosamente como se nada faltasse.
5. Efeitos visuais são temporais e não mutam fatos persistentes. Evento duplicado não pode repetir loot/capture/credit.
6. Store update deve ser atômico; seletores são estáveis e estreitos. React não renderiza a cada tick; Pixi lê modelo/timeline imperativamente e usa relógio alinhado.
7. Mutação financeira, compra/venda e comandos com side effects preservam sequência/idempotência.

## Simplificação, não expansão

- Chakra: manter provider singleton e `createSystem(defaultConfig, config)`; não substituir sistema de tokens, não criar novo provider nem redesenhar tokens para resolver hipótese de perf. Corrigir inconsistência local comprovada com semantic tokens/recipes existentes. Recipe compartilhada continua no theme; estilo usado por um componente fica nele conforme design system.
- FSD: respeitar fronteiras atuais, API pública e direção de dependência. Mover código entre slices só se houver responsabilidade real/mais de um consumidor e owner claro; não reestruturar camada para resolver um seletor estreito.
- Não criar cache service, abstração de transporte única, Redux/event bus, delta framework, schema de eventos ou compat layer genérica de implementação única sem baseline e necessidade comprovada.
- Custo aceito da abordagem conservadora: podem continuar snapshots completos/REST e duplicação de payload até evidência de custo; ganha-se menor risco de compatibilidade, replay e data loss. Otimização posterior deve comparar redução real com complexidade operacional.

## Fora de decisão

Payload de deltas do player, perfil de meta de performance, implantação multi-processo, estratégia final de mixed-version e políticas futuras de multiplayer permanecem perguntas em `04-decisoes-pendentes.md`. Sem event sourcing e sem rewrite são limites estabelecidos; formato de otimização não.
