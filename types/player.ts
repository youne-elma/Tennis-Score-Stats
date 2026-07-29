export type Gender = 'Female' | 'Male' | 'Other';

export type Handedness = 'Right-handed' | 'Left-handed' | 'Ambidextrous';

export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  handedness: Handedness;
  birthdayDate: string;
  strengths?: string;
  weaknesses?: string;
  photoUri?: string;
};

export type PlayerFormValues = Omit<Player, 'id'>;
