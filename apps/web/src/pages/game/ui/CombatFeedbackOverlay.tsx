import type { CSSProperties, ReactElement } from 'react';

import type { CombatFeedback } from './combat-feedback';

type CombatFeedbackOverlayProps = { feedback: Array<CombatFeedback> };
type FeedbackStyle = CSSProperties & { '--feedback-x': string; '--feedback-y': string };

export function CombatFeedbackOverlay(props: CombatFeedbackOverlayProps): ReactElement {
  const { feedback } = props;
  const labels = feedback.map(renderFeedback);
  return (
    <div aria-live="polite" className="combat-feedback" role="status">
      {labels}
    </div>
  );
}

function renderFeedback(feedback: CombatFeedback): ReactElement {
  const style: FeedbackStyle = {
    '--feedback-x': `${feedback.x}px`,
    '--feedback-y': `${feedback.y}px`,
    backgroundColor: feedback.color,
  };
  const className = `combat-feedback__label combat-feedback__label--${feedback.kind}`;
  return (
    <span className={className} key={feedback.id} style={style}>
      {feedback.text}
    </span>
  );
}
