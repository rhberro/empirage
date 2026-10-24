export type Gender = 'male' | 'female';

export type NewTrainerInput = {
  name: string;
  gender: Gender;
  starterSpeciesId: string;
};

export type Trainer = {
  id: string;
  name: string;
  gender: Gender;
  level: number;
  starterSpeciesId: string;
  createdAt: string;
  /** Wallet and stamina are persisted with the trainer but stay optional while the API still serves the legacy shape. */
  gold?: number;
  diamonds?: number;
  staminaMinutes?: number;
};

export type TrainerErrorCode =
  | 'invalid_name'
  | 'invalid_gender'
  | 'invalid_starter'
  | 'invalid_trainer'
  | 'starter_unavailable'
  | 'name_taken'
  | 'max_trainers_reached'
  | 'trainer_not_found'
  | 'creature_not_found'
  | 'team_full'
  | 'invalid_team_command'
  | 'swap_cooldown'
  | 'last_creature'
  | 'last_team_member'
  | 'unauthenticated';
