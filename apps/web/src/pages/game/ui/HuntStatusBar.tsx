import * as React from 'react';

type HuntStatusBarProps = { label: string; value: number };

export function HuntStatusBar(props: HuntStatusBarProps): React.ReactElement {
  const { label, value } = props;
  const fillClassName =
    label === 'HP'
      ? 'hunt-status__bar-fill hunt-status__bar-fill--health'
      : 'hunt-status__bar-fill';
  const percentageLabel = label + ': ' + Math.round(value) + '%';
  const style = { '--status-value': value + '%' } as React.CSSProperties;
  return (
    <div className="hunt-status__bar-row">
      <span>{label}</span>
      <div aria-label={percentageLabel} className="hunt-status__bar">
        <span className={fillClassName} style={style} />
      </div>
    </div>
  );
}
