import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { Player, PlayerFormValues } from '@/types/player';
import {
  createSupabasePlayer,
  deleteSupabasePlayer,
  loadSupabasePlayers,
  syncLocalPlayersToSupabase,
  updateSupabasePlayer,
} from '@/utils/supabase-players';
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
  const { mode, user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);
  const [hasLoadedPlayers, setHasLoadedPlayers] = useState(false);
  const [syncedLocalPlayersUserId, setSyncedLocalPlayersUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPlayerSource() {
      setIsLoadingPlayers(true);

      try {
        if (mode === 'loading') {
          return;
        }

        if (mode === 'authenticated' && user) {
          const localPlayers = await loadPlayers();

          if (syncedLocalPlayersUserId !== user.id && localPlayers.length > 0) {
            await syncLocalPlayersToSupabase(user.id, localPlayers);
            setSyncedLocalPlayersUserId(user.id);
          }

          const cloudPlayers = await loadSupabasePlayers(user.id);

          if (isMounted) {
            setPlayers(cloudPlayers);
          }

          return;
        }

        const storedPlayers = await loadPlayers();

        if (isMounted) {
          setPlayers(storedPlayers);
        }
      } catch {
        Alert.alert('Players error', 'Could not load players.');
      } finally {
        if (isMounted && mode !== 'loading') {
          setIsLoadingPlayers(false);
          setHasLoadedPlayers(true);
        }
      }
    }

    loadPlayerSource();

    return () => {
      isMounted = false;
    };
  }, [mode, syncedLocalPlayersUserId, user]);

  useEffect(() => {
    if (!hasLoadedPlayers || mode === 'authenticated') {
      return;
    }

    savePlayers(players).catch(() => {
      Alert.alert('Storage error', 'Could not save players.');
    });
  }, [hasLoadedPlayers, mode, players]);

  const value = useMemo(
    () => ({
      players,
      isLoadingPlayers,
      addPlayer: async (player: PlayerFormValues) => {
        if (mode === 'authenticated' && user) {
          try {
            const createdPlayer = await createSupabasePlayer(user.id, player);
            setPlayers((currentPlayers) => [...currentPlayers, createdPlayer]);
          } catch {
            Alert.alert('Players error', 'Could not create player.');
          }

          return;
        }

        setPlayers((currentPlayers) => [
          ...currentPlayers,
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            ...player,
          },
        ]);
      },
      updatePlayer: async (id: string, player: PlayerFormValues) => {
        if (mode === 'authenticated' && user) {
          try {
            const updatedPlayer = await updateSupabasePlayer(id, user.id, player);
            setPlayers((currentPlayers) =>
              currentPlayers.map((currentPlayer) => (currentPlayer.id === id ? updatedPlayer : currentPlayer))
            );
          } catch {
            Alert.alert('Players error', 'Could not update player.');
          }

          return;
        }

        setPlayers((currentPlayers) =>
          currentPlayers.map((currentPlayer) =>
            currentPlayer.id === id ? { id, ...player } : currentPlayer
          )
        );
      },
      deletePlayer: async (id: string) => {
        if (mode === 'authenticated' && user) {
          try {
            await deleteSupabasePlayer(id, user.id);
            setPlayers((currentPlayers) => currentPlayers.filter((player) => player.id !== id));
          } catch {
            Alert.alert('Players error', 'Could not delete player.');
          }

          return;
        }

        setPlayers((currentPlayers) => currentPlayers.filter((player) => player.id !== id));
      },
    }),
    [isLoadingPlayers, mode, players, user]
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
