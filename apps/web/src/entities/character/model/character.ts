export type CharacterId = string;

export type Character = {
  avatar_url: string | null;
  experience: number;
  gender: string;
  id: CharacterId;
  level: number;
  name: string;
};
