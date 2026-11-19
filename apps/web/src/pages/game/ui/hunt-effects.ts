import type { GameObjects, Scene } from 'phaser';

import type { Tile } from '../api/game-protocol';
import type { CaptureAttempt, HuntCombatEvent, HuntState } from '../api/hunt-protocol';
import { huntElementBackgroundColor } from '../lib/hunt-element-colors';

type CombatVisual = { event: HuntCombatEvent; startedAt: number };
type Damage = HuntCombatEvent['damages'][number];
type CombatFeedback = HuntCombatEvent['feedback'][number];
type FeedbackVisual = {
  effectiveness: Damage['effectiveness'] | undefined;
  label: GameObjects.DOMElement;
  tile: Damage['tile'];
  type: 'ability' | 'damage' | 'status';
};
type FeedbackList = Array<FeedbackVisual>;
type Feedbacks = { labels: FeedbackList; startedAt: number };
type CaptureVisual = { attempt: CaptureAttempt; startedAt: number };
type CaptureAttempts = Array<CaptureAttempt>;

const EFFECT_DURATION_MS = 260;
const FEEDBACK_DURATION_MS = 900;
const LATENCY_FLOOR_MS = 120;
const MAXIMUM_SEEN_EVENTS = 256;
const MAXIMUM_SEEN_CAPTURES = 256;
const CAPTURE_RESULT_DURATION_MS = 900;
const RANGED_DURATION_MS = 360;
const IMPACT_START_PROGRESS = 0.55;

// One snapshot may carry several combat events with server-side staggered
// occurredAt values; each effect becomes visible at its own logical instant.
export class HuntEffects {
  private readonly combat = new Map<string, CombatVisual>();
  private readonly effects: GameObjects.Graphics;
  private readonly feedback = new Map<string, Feedbacks>();
  private readonly seenCombat = new Set<string>();
  private readonly seenCaptures = new Set<string>();
  private readonly captures = new Map<string, CaptureVisual>();
  private gridOriginX = 0;
  private gridOriginY = 0;
  private tileSize = 16;
  private playerPosition: Tile = { x: 2, y: 3 };

  public constructor(scene: Scene) {
    this.effects = scene.add.graphics().setDepth(10_001).setScrollFactor(0);
  }

  public configure(
    gridOriginX: number,
    gridOriginY: number,
    tileSize: number,
    playerPosition?: Tile,
  ): void {
    this.gridOriginX = gridOriginX;
    this.gridOriginY = gridOriginY;
    this.tileSize = tileSize;
    if (playerPosition) {
      this.playerPosition = playerPosition;
    }
  }

  public apply(state: HuntState, now: number): void {
    this.applyCaptureAttempts(state.captureAttempts, now);
    for (const event of state.combatEvents) {
      this.applyCombatEvent(event, now);
    }
    while (this.seenCombat.size > MAXIMUM_SEEN_EVENTS) {
      const oldest = this.seenCombat.values().next().value;
      if (oldest === undefined) {
        break;
      }
      this.seenCombat.delete(oldest);
    }
  }

  public applyCaptureAttempts(captureAttempts: CaptureAttempts, now: number): void {
    for (const attempt of captureAttempts) {
      const capture = this.captures.get(attempt.id);
      if (capture) {
        capture.attempt = attempt;
      } else if (!this.seenCaptures.has(attempt.id)) {
        this.seenCaptures.add(attempt.id);
        this.captures.set(attempt.id, { attempt, startedAt: now });
      }
    }
    while (this.seenCaptures.size > MAXIMUM_SEEN_CAPTURES) {
      const oldest = this.seenCaptures.values().next().value;
      if (oldest === undefined) {
        break;
      }
      this.seenCaptures.delete(oldest);
    }
  }

  public applyCombatEvent(event: HuntCombatEvent, now: number): void {
    if (this.seenCombat.has(event.id)) {
      return;
    }
    this.seenCombat.add(event.id);
    const startedAt =
      event.occurredAt > 0 ? Math.max(event.occurredAt, now - LATENCY_FLOOR_MS) : now;
    const visual = { event, startedAt };
    this.combat.set(event.id, visual);
    this.createFeedback(event, startedAt);
  }

  public clear(): void {
    this.combat.clear();
    this.captures.clear();
    this.seenCombat.clear();
    this.seenCaptures.clear();
    this.effects.clear();
    for (const visual of this.feedback.values()) {
      for (const feedback of visual.labels) {
        feedback.label.destroy();
      }
    }
    this.feedback.clear();
  }

  public update(now: number): void {
    this.effects.clear();
    for (const [id, visual] of this.combat) {
      const duration = visual.event.kind === 'ranged' ? RANGED_DURATION_MS : EFFECT_DURATION_MS;
      const progress = Math.max(0, (now - visual.startedAt) / duration);
      const impactStart = visual.event.kind === 'melee' ? 0 : IMPACT_START_PROGRESS;
      if (now < visual.startedAt) {
        continue;
      }
      if (progress >= 1) {
        this.combat.delete(id);
        continue;
      }
      if (visual.event.kind === 'ranged') {
        this.drawProjectile(visual.event, progress);
      }
      if (progress >= impactStart) {
        this.drawImpactTiles(visual.event, progress, impactStart);
      }
    }
    this.updateFeedback(now);
    this.updateCaptures(now);
  }

  private updateCaptures(now: number): void {
    for (const [id, visual] of this.captures) {
      const totalDuration = Math.max(1, visual.attempt.completesAt - visual.startedAt);
      const progress = Math.max(0, Math.min(1, (now - visual.startedAt) / totalDuration));
      const flightProgress = Math.min(1, progress * 5);
      const from = this.playerPosition;
      const target = visual.attempt.position;
      const x = from.x + (target.x - from.x) * flightProgress;
      const y = from.y + (target.y - from.y) * flightProgress;
      const blinking = flightProgress === 1;
      const settled = visual.attempt.status !== 'pending';
      const color = settled
        ? visual.attempt.status === 'succeeded'
          ? 0x43a047
          : 0xe53935
        : blinking
          ? 0xfdd835
          : 0xffffff;
      this.effects.fillStyle(color);
      this.effects.fillCircle(this.screenX(x), this.screenY(y), Math.max(3, this.tileSize / 3));
      if (
        visual.attempt.settledAt &&
        now - visual.attempt.settledAt >= CAPTURE_RESULT_DURATION_MS
      ) {
        this.captures.delete(id);
      }
    }
  }

  private drawProjectile(event: HuntCombatEvent, progress: number): void {
    const x = event.from.x + (event.to.x - event.from.x) * progress;
    const y = event.from.y + (event.to.y - event.from.y) * progress;
    this.effects.fillStyle(0xffd38a);
    this.effects.fillRect(
      Math.round(this.gridOriginX + (x + 0.5) * this.tileSize - 4),
      Math.round(this.gridOriginY + (y + 0.5) * this.tileSize - 4),
      8,
      8,
    );
  }

  private drawImpactTiles(event: HuntCombatEvent, progress: number, impactStart: number): void {
    const fade = 1 - (progress - impactStart) / (1 - impactStart);
    const color = Number.parseInt(huntElementBackgroundColor(event.element).slice(1), 16);
    const tiles = event.tiles.length > 0 ? event.tiles : event.damages.map(HuntEffects.damageTile);
    for (const tile of tiles) {
      const x = this.gridOriginX + tile.x * this.tileSize;
      const y = this.gridOriginY + tile.y * this.tileSize;
      this.effects.fillStyle(color, 0.4 * fade);
      this.effects.fillRect(x, y, this.tileSize, this.tileSize);
      this.effects.lineStyle(1, color, fade);
      this.effects.strokeRect(x + 0.5, y + 0.5, this.tileSize - 1, this.tileSize - 1);
    }
  }

  private static damageTile(damage: Damage): Damage['tile'] {
    return damage.tile;
  }

  private createFeedback(event: HuntCombatEvent, startedAt: number): void {
    const labels: FeedbackList = [this.createAbilityLabel(event)];
    for (const damage of event.damages) {
      labels.push(this.createDamageLabel(damage, event.element));
    }
    for (const feedback of event.feedback) {
      labels.push(this.createStatusLabel(feedback));
    }
    this.feedback.set(event.id, { labels, startedAt });
  }

  private createAbilityLabel(event: HuntCombatEvent): FeedbackVisual {
    const labelNode = HuntEffects.feedbackNode('ability', event.abilityName.toUpperCase());
    labelNode.style.setProperty('--feedback-color', huntElementBackgroundColor(event.element));
    const label = this.effects.scene.add
      .dom(0, 0, labelNode)
      .setDepth(10_002)
      .setOrigin(0.5, 1)
      .setScrollFactor(0);
    return { effectiveness: undefined, label, tile: event.from, type: 'ability' };
  }

  private createDamageLabel(damage: Damage, element: string): FeedbackVisual {
    const labelNode = HuntEffects.feedbackNode('damage', `-${damage.amount}`);
    labelNode.classList.add(`hunt-feedback--${damage.effectiveness}`);
    labelNode.style.setProperty('--feedback-color', huntElementBackgroundColor(element));
    const label = this.effects.scene.add
      .dom(0, 0, labelNode)
      .setDepth(10_002)
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    return { effectiveness: damage.effectiveness, label, tile: damage.tile, type: 'damage' };
  }

  private createStatusLabel(feedback: CombatFeedback): FeedbackVisual {
    const labelNode = HuntEffects.feedbackNode('status', feedback.text.toUpperCase());
    labelNode.style.setProperty('--feedback-color', '#fdd835');
    const label = this.effects.scene.add
      .dom(0, 0, labelNode)
      .setDepth(10_002)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);
    return { effectiveness: undefined, label, tile: feedback.tile, type: 'status' };
  }

  private updateFeedback(now: number): void {
    for (const [id, visual] of this.feedback) {
      const elapsed = now - visual.startedAt;
      if (elapsed < 0) {
        continue;
      }
      if (elapsed >= FEEDBACK_DURATION_MS) {
        for (const feedback of visual.labels) {
          feedback.label.destroy();
        }
        this.feedback.delete(id);
        continue;
      }
      const progress = elapsed / FEEDBACK_DURATION_MS;
      const fadeAlpha = progress <= 0.75 ? 1 : 1 - (progress - 0.75) / 0.25;
      for (const feedback of visual.labels) {
        const x = this.screenX(feedback.tile.x);
        const y = this.screenY(feedback.tile.y) - progress * (feedback.type === 'ability' ? 6 : 7);
        const offsetX = feedback.type === 'damage' ? this.tileSize * 0.45 : 0;
        const offsetY = feedback.type === 'ability' ? this.tileSize / 2 : 0;
        const resisted = feedback.effectiveness === 'resisted';
        const superEffective = feedback.effectiveness === 'super-effective';
        const blink = resisted ? (Math.floor(elapsed / 100) % 2 === 0 ? 1 : 0.35) : 1;
        const impactProgress = Math.min(1, progress / 0.35);
        const scale = superEffective ? 1 + Math.sin(Math.PI * impactProgress) * 0.25 : 1;
        feedback.label
          .setAlpha(fadeAlpha * blink)
          .setPosition(x + offsetX, y - offsetY)
          .setScale(scale);
      }
    }
  }

  private static feedbackNode(type: FeedbackVisual['type'], text: string): HTMLSpanElement {
    const node = globalThis.document.createElement('span');
    node.className = `hunt-feedback hunt-feedback--${type}`;
    node.textContent = text;
    return node;
  }

  private screenX(tileX: number): number {
    return this.gridOriginX + (tileX + 0.5) * this.tileSize;
  }

  private screenY(tileY: number): number {
    return this.gridOriginY + (tileY + 0.5) * this.tileSize;
  }
}
