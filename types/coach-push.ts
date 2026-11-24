export type CoachPushSettings = {
  enabled: boolean;
  isChanging: boolean;
  error?: string;
  setEnabled: (enabled: boolean) => void;
};

export type CoachPushOptions = {
  userId?: string;
  isAuthLoading: boolean;
  isAppActive: boolean;
  onReply: () => void;
};
