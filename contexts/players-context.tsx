import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { Player, PlayerFormValues } from '@/types/player';
import {
  archiveSupabasePlayer,
  createSupabasePlayer,
  loadSupabasePlayers,
  syncLocalPlayersToSupabase,
  updateSupabasePlayer,
} from '@/utils/supabase-players';
import { loadPlayers, savePlayers } from '@/utils/storage';

type PlayersContextValue = {
  players: Player[];
  activePlayers: Player[];
  isLoadingPlayers: boolean;
  addPlayer: (player: PlayerFormValues) => void;
  updatePlayer: (id: string, player: PlayerFormValues) => void;
  archivePlayer: (id: string) => Promise<void>;
};

const PlayersContext = createContext<PlayersContextValue | null>(null);

export function PlayersProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);
  const [hasLoadedLocalPlayers, setHasLoadedLocalPlayers] = useState(false);
  const [syncedLocalPlayersUserId, setSyncedLocalPlayersUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPlayerSource() {
      setIsLoadingPlayers(true);
      setHasLoadedLocalPlayers(false);

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
          setHasLoadedLocalPlayers(true);
        }
      } catch {
        Alert.alert('Players error', 'Could not load players.');
      } finally {
        if (isMounted && mode !== 'loading') {
          setIsLoadingPlayers(false);
        }
      }
    }

    loadPlayerSource();

    return () => {
      isMounted = false;
    };
  }, [mode, syncedLocalPlayersUserId, user]);

  useEffect(() => {
    if (!hasLoadedLocalPlayers || mode === 'authenticated') {
      return;
    }

    savePlayers(players).catch(() => {
      Alert.alert('Storage error', 'Could not save players.');
    });
  }, [hasLoadedLocalPlayers, mode, players]);

  const value = useMemo(
    () => ({
      players,
      activePlayers: players.filter((player) => !player.archivedAt),
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
            currentPlayer.id === id ? { ...currentPlayer, ...player } : currentPlayer
          )
        );
      },
      archivePlayer: async (id: string) => {
        const player = players.find((currentPlayer) => currentPlayer.id === id);
        if (!player || player.archivedAt) {
          return;
        }

        const archivedAt = new Date().toISOString();
        if (mode === 'authenticated' && user) {
          const archivedPlayer = await archiveSupabasePlayer(id, user.id, archivedAt);
          setPlayers((currentPlayers) =>
            currentPlayers.map((currentPlayer) => (currentPlayer.id === id ? archivedPlayer : currentPlayer))
          );
          return;
        }

        const archiveLocalPlayer = (localPlayers: Player[]) => localPlayers.map((currentPlayer) =>
          currentPlayer.id === id ? { ...currentPlayer, archivedAt: currentPlayer.archivedAt ?? archivedAt } : currentPlayer
        );
        await savePlayers(archiveLocalPlayer(players));
        setPlayers(archiveLocalPlayer);
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
