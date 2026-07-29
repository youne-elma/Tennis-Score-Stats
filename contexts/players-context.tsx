import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { Player, PlayerFormValues } from '@/types/player';
import { loadPlayers, savePlayers } from '@/utils/storage';

type PlayersContextValue = {
  players: Player[];
  isLoadingPlayers: boolean;
  addPlayer: (player: PlayerFormValues) => void;
  updatePlayer: (id: string, player: PlayerFormValues) => void;
  deletePlayer: (id: string) => void;
};

const PlayersContext = createContext<PlayersContextValue | null>(null);

export function PlayersProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);
  const [hasLoadedPlayers, setHasLoadedPlayers] = useState(false);

  useEffect(() => {
    let isMounted = true;

    loadPlayers()
      .then((storedPlayers) => {
        if (isMounted) {
          setPlayers(storedPlayers);
        }
      })
      .catch(() => {
        Alert.alert('Storage error', 'Could not load saved players.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingPlayers(false);
          setHasLoadedPlayers(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedPlayers) {
      return;
    }

    savePlayers(players).catch(() => {
      Alert.alert('Storage error', 'Could not save players.');
    });
  }, [hasLoadedPlayers, players]);

  const value = useMemo(
    () => ({
      players,
      isLoadingPlayers,
      addPlayer: (player: PlayerFormValues) => {
        setPlayers((currentPlayers) => [
          ...currentPlayers,
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            ...player,
          },
        ]);
      },
      updatePlayer: (id: string, player: PlayerFormValues) => {
        setPlayers((currentPlayers) =>
          currentPlayers.map((currentPlayer) =>
            currentPlayer.id === id ? { id, ...player } : currentPlayer
          )
        );
      },
      deletePlayer: (id: string) => {
        setPlayers((currentPlayers) => currentPlayers.filter((player) => player.id !== id));
      },
    }),
    [isLoadingPlayers, players]
  );

  return <PlayersContext.Provider value={value}>{children}</PlayersContext.Provider>;
}

export function usePlayers() {
  const context = useContext(PlayersContext);

  if (!context) {
    throw new Error('usePlayers must be used inside PlayersProvider');
  }

  return context;
}
