import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { MatchFormValues, ServiceEvent, ServiceEventInput, TennisMatch } from '@/types/match';
import {
  createSupabaseMatch,
  createSupabaseServiceEvent,
  deleteSupabaseServiceEvent,
  loadSupabaseMatches,
  updateSupabaseMatch,
  updateSupabaseServiceEvent,
} from '@/utils/supabase-matches';
import { loadMatches, saveMatches } from '@/utils/storage';

type MatchesContextValue = {
  matches: TennisMatch[];
  isLoadingMatches: boolean;
  matchesLoadFailed: boolean;
  retryLoadMatches: () => void;
  addMatch: (match: MatchFormValues) => void;
  updateMatchStatus: (id: string, status: TennisMatch['status']) => void;
  pauseMatch: (id: string, pauseReason: string) => void;
  updateMatchSettings: (id: string, settings: Partial<MatchFormValues>) => void;
  recordServiceEvent: (event: ServiceEventInput) => void;
  updateServiceEvent: (matchId: string, eventId: string, event: Partial<ServiceEvent>) => void;
  undoLastServiceEvent: (matchId: string) => void;
};

const MatchesContext = createContext<MatchesContextValue | null>(null);
const emptyMatches: TennisMatch[] = [];

export function MatchesProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth();
  const [matches, setMatches] = useState<TennisMatch[]>([]);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadResult, setLoadResult] = useState<{ userId: string | null; attempt: number; failed: boolean }>();
  const sourceUserId = mode === 'loading' ? undefined : mode === 'authenticated' ? user?.id : null;
  const currentLoad = loadResult?.userId === sourceUserId && loadResult?.attempt === loadAttempt ? loadResult : undefined;
  const isLoadingMatches = !currentLoad;
  const matchesLoadFailed = currentLoad?.failed === true;
  const retryLoadMatches = useCallback(() => setLoadAttempt((attempt) => attempt + 1), []);

  useEffect(() => {
    if (sourceUserId === undefined) {
      return;
    }

    const controller = new AbortController();
    const userId = sourceUserId;

    async function loadMatchSource() {
      try {
        const nextMatches = userId === null ? await loadMatches() : await loadSupabaseMatches(userId, controller.signal);

        if (!controller.signal.aborted) {
          setMatches(nextMatches);
          setLoadResult({ userId, attempt: loadAttempt, failed: false });
        }
      } catch {
        if (!controller.signal.aborted) {
          setLoadResult({ userId, attempt: loadAttempt, failed: true });
        }
      }
    }

    void loadMatchSource();
    return () => controller.abort();
  }, [loadAttempt, sourceUserId]);

  useEffect(() => {
    if (sourceUserId !== null || isLoadingMatches || matchesLoadFailed) {
      return;
    }

    saveMatches(matches).catch(() => {
      Alert.alert('Storage error', 'Could not save matches.');
    });
  }, [isLoadingMatches, matches, matchesLoadFailed, sourceUserId]);

  const value = useMemo(
    () => ({
      matches: isLoadingMatches || matchesLoadFailed ? emptyMatches : matches,
      isLoadingMatches,
      matchesLoadFailed,
      retryLoadMatches,
      addMatch: async (match: MatchFormValues) => {
        if (mode === 'authenticated' && user) {
          try {
            const createdMatch = await createSupabaseMatch(user.id, match);
            setMatches((currentMatches) => [createdMatch, ...currentMatches]);
          } catch {
            Alert.alert('Matches error', 'Could not create match.');
          }

          return;
        }

        setMatches((currentMatches) => [
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            createdAt: new Date().toISOString(),
            status: 'Not started',
            serviceEvents: [],
            ...match,
          },
          ...currentMatches,
        ]);
      },
      updateMatchStatus: async (id: string, status: TennisMatch['status']) => {
        const endedAt = status === 'Ended' ? new Date().toISOString() : undefined;

        if (mode === 'authenticated' && user) {
          try {
            const updatedMatch = await updateSupabaseMatch(id, user.id, { status, endedAt });
            setMatches((currentMatches) =>
              currentMatches.map((match) =>
                match.id === id ? { ...updatedMatch, serviceEvents: match.serviceEvents } : match
              )
            );
          } catch {
            Alert.alert('Matches error', 'Could not update match status.');
          }

          return;
        }

        setMatches((currentMatches) =>
          currentMatches.map((match) =>
            match.id === id
              ? {
                  ...match,
                  status,
                  endedAt: endedAt ?? match.endedAt,
                }
              : match
          )
        );
      },
      pauseMatch: async (id: string, pauseReason: string) => {
        if (mode === 'authenticated' && user) {
          try {
            const updatedMatch = await updateSupabaseMatch(id, user.id, {
              status: 'Paused',
              pauseReason,
            });
            setMatches((currentMatches) =>
              currentMatches.map((match) =>
                match.id === id ? { ...updatedMatch, serviceEvents: match.serviceEvents } : match
              )
            );
          } catch {
            Alert.alert('Matches error', 'Could not pause match.');
          }

          return;
        }

        setMatches((currentMatches) =>
          currentMatches.map((match) =>
            match.id === id
              ? {
                  ...match,
                  status: 'Paused',
                  pauseReason,
                }
              : match
          )
        );
      },
      updateMatchSettings: async (id: string, settings: Partial<MatchFormValues>) => {
        if (mode === 'authenticated' && user) {
          try {
            const updatedMatch = await updateSupabaseMatch(id, user.id, settings);
            setMatches((currentMatches) =>
              currentMatches.map((match) =>
                match.id === id ? { ...updatedMatch, serviceEvents: match.serviceEvents } : match
              )
            );
          } catch {
            Alert.alert('Matches error', 'Could not update match settings.');
          }

          return;
        }

        setMatches((currentMatches) =>
          currentMatches.map((match) => (match.id === id ? { ...match, ...settings } : match))
        );
      },
      recordServiceEvent: async (event: ServiceEventInput) => {
        if (mode === 'authenticated' && user) {
          try {
            const createdEvent = await createSupabaseServiceEvent(user.id, event);
            setMatches((currentMatches) =>
              currentMatches.map((match) =>
                match.id === event.matchId
                  ? {
                      ...match,
                      serviceEvents: [...match.serviceEvents, createdEvent],
                    }
                  : match
              )
            );
          } catch {
            Alert.alert('Scoring error', 'Could not save service event.');
          }

          return;
        }

        setMatches((currentMatches) =>
          currentMatches.map((match) =>
            match.id === event.matchId
              ? {
                  ...match,
                  serviceEvents: [
                    ...match.serviceEvents,
                    {
                      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                      createdAt: new Date().toISOString(),
                      ...event,
                    },
                  ],
                }
              : match
          )
        );
      },
      updateServiceEvent: async (matchId: string, eventId: string, event: Partial<ServiceEvent>) => {
        if (mode === 'authenticated' && user) {
          try {
            const updatedEvent = await updateSupabaseServiceEvent(matchId, eventId, user.id, event);
            setMatches((currentMatches) =>
              currentMatches.map((match) =>
                match.id === matchId
                  ? {
                      ...match,
                      serviceEvents: match.serviceEvents.map((serviceEvent) =>
                        serviceEvent.id === eventId ? updatedEvent : serviceEvent
                      ),
                    }
                  : match
              )
            );
          } catch {
            Alert.alert('Scoring error', 'Could not update service event.');
          }

          return;
        }

        setMatches((currentMatches) =>
          currentMatches.map((match) =>
            match.id === matchId
              ? {
                  ...match,
                  serviceEvents: match.serviceEvents.map((serviceEvent) =>
                    serviceEvent.id === eventId ? { ...serviceEvent, ...event } : serviceEvent
                  ),
                }
              : match
          )
        );
      },
      undoLastServiceEvent: async (matchId: string) => {
        if (mode === 'authenticated' && user) {
          const match = matches.find((currentMatch) => currentMatch.id === matchId);
          const lastEvent = match?.serviceEvents.at(-1);

          if (!lastEvent) {
            return;
          }

          try {
            await deleteSupabaseServiceEvent(matchId, lastEvent.id, user.id);
            setMatches((currentMatches) =>
              currentMatches.map((currentMatch) =>
                currentMatch.id === matchId
                  ? {
                      ...currentMatch,
                      serviceEvents: currentMatch.serviceEvents.slice(0, -1),
                    }
                  : currentMatch
              )
            );
          } catch {
            Alert.alert('Scoring error', 'Could not undo service event.');
          }

          return;
        }

        setMatches((currentMatches) =>
          currentMatches.map((match) =>
            match.id === matchId
              ? {
                  ...match,
                  serviceEvents: match.serviceEvents.slice(0, -1),
                }
              : match
          )
        );
      },
    }),
    [isLoadingMatches, matches, matchesLoadFailed, mode, retryLoadMatches, user]
  );

  return <MatchesContext.Provider value={value}>{children}</MatchesContext.Provider>;
}

export function useMatches() {
  const context = useContext(MatchesContext);

  if (!context) {
    throw new Error('useMatches must be used inside MatchesProvider');
  }

  return context;
}
