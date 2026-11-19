import * as React from 'react';

import {
  selectDisplayedTrainerAvatarUrl,
  selectDisplayedTrainerLevel,
  selectDisplayedTrainerName,
  useGameStore,
} from '../../model/game-store';
import { GoldStatus } from './GoldStatus';

export function TrainerStatus(): React.ReactElement {
  const avatarUrl = useGameStore(selectDisplayedTrainerAvatarUrl);
  const level = useGameStore(selectDisplayedTrainerLevel);
  const name = useGameStore(selectDisplayedTrainerName);

  if (!name || level === undefined) {
    return <div />;
  }

  const trainerInitial = name.slice(0, 1).toUpperCase();
  const trainerAvatar = avatarUrl ? (
    <img alt="" className="hunt-status__avatar-image" src={avatarUrl} />
  ) : (
    <span aria-hidden="true">{trainerInitial}</span>
  );

  return (
    <>
      <section aria-label="Treinador atual" className="hunt-status__panel hunt-status__trainer">
        <div className="hunt-status__avatar">{trainerAvatar}</div>
        <div>
          <strong>{name}</strong>
          <span>Nível {level}</span>
        </div>
      </section>
      <GoldStatus />
    </>
  );
}
