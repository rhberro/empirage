import { config } from '../config.ts';
import type { Position } from './game-types.ts';

type InterestCell = { x: number; y: number };

function interestCell(position: Position): InterestCell {
  const size = config.websocketInterestCellSizeTiles;
  return { x: Math.floor(position.x / size), y: Math.floor(position.y / size) };
}

export function isWithinInterest(observer: Position, subject: Position): boolean {
  const observerCell = interestCell(observer);
  const subjectCell = interestCell(subject);
  return (
    Math.abs(observerCell.x - subjectCell.x) <= 1 && Math.abs(observerCell.y - subjectCell.y) <= 1
  );
}
