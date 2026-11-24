import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  canEditPlayers: boolean;
  addPlayer: (player: PlayerFormValues) => void;
  updatePlayer: (id: string, player: PlayerFormValues) => void;
  archivePlayer: (id: string) => Promise<void>;
};

const PlayersContext = createContext<PlayersContextValue | null>(null);
const emptyPlayers: Player[] = [];

export function PlayersProvider({ children }: { children: ReactNode }) {
  const { mode, accountId, isOnline } = useAuth();
  const source = mode === 'loading' ? undefined : accountId;
  const canReachCloud = mode === 'authenticated' && isOnline;
  const canEditPlayers = source !== undefined && (!accountId || canReachCloud);
  const [snapshot, setSnapshot] = useState<{ source: string | null; players: Player[] }>();
  const localImportAccounts = useRef(new Set<string>());
  const changes = useRef(0);
  const playerWrite = useRef<Promise<unknown>>(Promise.resolve());
  const current = snapshot?.source === source ? snapshot : undefined;
  const players = current?.players ?? emptyPlayers;

  useEffect(() => {
    if (source === undefined) return;
    const account = source;
    let active = true;

    async function restorePlayers() {
      const initialChange = changes.current;
      try {
        const stored = await loadPlayers(account);
        if (!active) return;
        setSnapshot((current) => current?.source === account ? current : { source: account, players: stored });

        if (account && canReachCloud) {
          if (!localImportAccounts.current.has(account)) {
            const guestPlayers = await loadPlayers();
            if (!active) return;
            if (guestPlayers.length) {
              await syncLocalPlayersToSupabase(account, guestPlayers);
            }
            localImportAccounts.current.add(account);
          }

          const remote = await loadSupabasePlayers(account);
          if (active && changes.current === initialChange) {
            setSnapshot((current) => changes.current === initialChange && current?.source === account
              ? { source: account, players: remote } : current);
          }
        }
      } catch {
        if (active) {
          setSnapshot((current) => current?.source === account ? current : { source: account, players: [] });
        }
      }
    }

    void restorePlayers();
    return () => { active = false; };
  }, [canReachCloud, source]);

  useEffect(() => {
    if (!current) return;
    const saved = current;
    const write = playerWrite.current.then(() => savePlayers(saved.players, saved.source));
    playerWrite.current = write.catch(() => {
      Alert.alert('Storage error', 'Could not save players on this device.');
    });
  }, [current]);

  const value = useMemo<PlayersContextValue>(() => {
    function applyChange(update: (current: Player[]) => Player[]) {
      changes.current += 1;
      setSnapshot((current) => current?.source === source && current
        ? { source: current.source, players: update(current.players) } : current);
    }

    return {
      players,
      activePlayers: players.filter((player) => !player.archivedAt),
      isLoadingPlayers: !current,
      canEditPlayers,
      addPlayer: async (player) => {
        if (!canEditPlayers) return;
        try {
          const created = accountId ? await createSupabasePlayer(accountId, player) : {
            ...player,
            id: Date.now() + '-' + Math.random().toString(16).slice(2),
          };
          applyChange((players) => [...players, created]);
        } catch {
          Alert.alert('Player error', 'Could not create player.');
        }
      },
      updatePlayer: async (id, player) => {
        if (!canEditPlayers) return;
        try {
          const updated = accountId ? await updateSupabasePlayer(id, accountId, player) : { ...player, id };
          applyChange((players) => players.map((current) => current.id === id
            ? { ...current, ...updated } : current));
        } catch {
          Alert.alert('Player error', 'Could not update player.');
        }
      },
      archivePlayer: async (id) => {
        if (!canEditPlayers) throw new Error('Connect to archive a player.');
        const player = players.find((current) => current.id === id);
        if (!player || player.archivedAt) return;

        const archivedAt = new Date().toISOString();
        const archived = accountId ? await archiveSupabasePlayer(id, accountId, archivedAt) : { ...player, archivedAt };
        if (!accountId) {
          await savePlayers(players.map((current) => current.id === id ? archived : current));
        }
        applyChange((players) => players.map((current) => current.id === id ? archived : current));
      },
    };
  }, [accountId, canEditPlayers, current, players, source]);

  return <PlayersContext.Provider value={value}>{children}</PlayersContext.Provider>;
}

export function usePlayers() {
  const context = useContext(PlayersContext);
  if (!context) {
    throw new Error('usePlayers must be used inside PlayersProvider');
  }
  return context;
}
