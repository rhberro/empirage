import type { GameObjects, Scene } from 'phaser';

import type { HuntCombatEvent, HuntState } from '../api/hunt-protocol';
import { huntElementBackgroundColor } from '../lib/hunt-element-colors';

type CombatVisual = { event: HuntCombatEvent; startedAt: number };
type Damage = HuntCombatEvent['damages'][number];
type FeedbackVisual = {
  label: GameObjects.DOMElement;
  tile: Damage['tile'];
  type: 'ability' | 'damage';
};
type FeedbackList = Array<FeedbackVisual>;
type Feedbacks = { labels: FeedbackList; startedAt: number };

const EFFECT_DURATION_MS = 260;
const FEEDBACK_DURATION_MS = 900;
const LATENCY_FLOOR_MS = 120;
const MAXIMUM_SEEN_EVENTS = 256;
const RANGED_DURATION_MS = 360;

// One snapshot may carry several combat events with server-side staggered
// occurredAt values; each effect becomes visible at its own logical instant.
export class HuntEffects {
  private readonly combat = new Map<string, CombatVisual>();
  private readonly effects: GameObjects.Graphics;
  private readonly feedback = new Map<string, Feedbacks>();
  private readonly seenCombat = new Set<string>();
  private gridOriginX = 0;
  private gridOriginY = 0;
  private tileSize = 16;

  public constructor(scene: Scene) {
    this.effects = scene.add.graphics().setDepth(10_001).setScrollFactor(0);
  }

  public configure(gridOriginX: number, gridOriginY: number, tileSize: number): void {
    this.gridOriginX = gridOriginX;
    this.gridOriginY = gridOriginY;
    this.tileSize = tileSize;
  }

  public apply(state: HuntState, now: number): void {
    for (const event of state.combatEvents) {
      if (this.seenCombat.has(event.id)) {
        continue;
      }
      this.seenCombat.add(event.id);
      // Late snapshots must still show the attack briefly; only events still in
      // the future wait for their logical instant.
      const startedAt =
        event.occurredAt > 0 ? Math.max(event.occurredAt, now - LATENCY_FLOOR_MS) : now;
      const visual = { event, startedAt };
      this.combat.set(event.id, visual);
      this.createFeedback(event, startedAt);
    }
    while (this.seenCombat.size > MAXIMUM_SEEN_EVENTS) {
      const oldest = this.seenCombat.values().next().value;
      if (oldest === undefined) {
        break;
      }
      this.seenCombat.delete(oldest);
    }
  }

  public clear(): void {
    this.combat.clear();
    this.seenCombat.clear();
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
      if (now < visual.startedAt) {
        continue;
      }
      if (progress >= 1) {
        this.combat.delete(id);
        continue;
      }
      if (visual.event.kind === 'ranged') {
        this.drawProjectile(visual.event, progress);
      } else if (visual.event.kind === 'area') {
        this.drawArea(visual.event, progress);
      } else {
        this.drawImpact(visual.event, progress);
      }
    }
    this.updateFeedback(now);
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

  private drawArea(event: HuntCombatEvent, progress: number): void {
    this.effects.fillStyle(0xffd38a, 1 - progress * 0.75);
    for (const tile of event.tiles) {
      this.effects.fillRect(
        this.gridOriginX + (tile.x + 0.5) * this.tileSize - 4,
        this.gridOriginY + (tile.y + 0.5) * this.tileSize - 4,
        8,
        8,
      );
    }
  }

  private drawImpact(event: HuntCombatEvent, progress: number): void {
    const x = this.gridOriginX + (event.to.x + 0.5) * this.tileSize;
    const y = this.gridOriginY + (event.to.y + 0.5) * this.tileSize;
    this.effects.lineStyle(2, 0xffd38a, 1 - progress);
    this.effects.strokeCircle(x, y, Math.max(3, this.tileSize * (0.2 + progress * 0.25)));
  }

  private createFeedback(event: HuntCombatEvent, startedAt: number): void {
    const labels: FeedbackList = [this.createAbilityLabel(event)];
    for (const damage of event.damages) {
      labels.push(this.createDamageLabel(damage));
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
    return { label, tile: event.from, type: 'ability' };
  }

  private createDamageLabel(damage: Damage): FeedbackVisual {
    const labelNode = HuntEffects.feedbackNode('damage', `-${damage.amount}`);
    const label = this.effects.scene.add
      .dom(0, 0, labelNode)
      .setDepth(10_002)
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    return { label, tile: damage.tile, type: 'damage' };
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
      const alpha = progress <= 0.75 ? 1 : 1 - (progress - 0.75) / 0.25;
      for (const feedback of visual.labels) {
        const x = this.screenX(feedback.tile.x);
        const y =
          this.screenY(feedback.tile.y) - progress * (feedback.type === 'ability' ? 24 : 28);
        const offsetX = feedback.type === 'damage' ? this.tileSize * 0.45 : 0;
        const offsetY = feedback.type === 'ability' ? this.tileSize / 2 : 0;
        feedback.label.setAlpha(alpha).setPosition(x + offsetX, y - offsetY);
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
