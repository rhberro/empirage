export type CombatFeedbackKind = 'ability' | 'damage';

export type CombatFeedback = {
  color?: string;
  id: string;
  kind: CombatFeedbackKind;
  text: string;
  x: number;
  y: number;
};

export type CombatFeedbackHandler = (feedback: CombatFeedback) => void;
