import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { MatchFormValues, ServiceEvent, ServiceEventInput, TennisMatch } from '@/types/match';
import { loadMatches, saveMatches } from '@/utils/storage';

type MatchesContextValue = {
  matches: TennisMatch[];
  isLoadingMatches: boolean;
  addMatch: (match: MatchFormValues) => void;
  updateMatchStatus: (id: string, status: TennisMatch['status']) => void;
  pauseMatch: (id: string, pauseReason: string) => void;
  updateMatchSettings: (id: string, settings: Partial<MatchFormValues>) => void;
  recordServiceEvent: (event: ServiceEventInput) => void;
  updateServiceEvent: (matchId: string, eventId: string, event: Partial<ServiceEvent>) => void;
  undoLastServiceEvent: (matchId: string) => void;
};

const MatchesContext = createContext<MatchesContextValue | null>(null);

export function MatchesProvider({ children }: { children: ReactNode }) {
  const [matches, setMatches] = useState<TennisMatch[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [hasLoadedMatches, setHasLoadedMatches] = useState(false);

  useEffect(() => {
    let isMounted = true;

    loadMatches()
      .then((storedMatches) => {
        if (isMounted) {
          setMatches(storedMatches);
        }
      })
      .catch(() => {
        Alert.alert('Storage error', 'Could not load saved matches.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingMatches(false);
          setHasLoadedMatches(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedMatches) {
      return;
    }

    saveMatches(matches).catch(() => {
      Alert.alert('Storage error', 'Could not save matches.');
    });
  }, [hasLoadedMatches, matches]);

  const value = useMemo(
    () => ({
      matches,
      isLoadingMatches,
      addMatch: (match: MatchFormValues) => {
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
      updateMatchStatus: (id: string, status: TennisMatch['status']) => {
        setMatches((currentMatches) =>
          currentMatches.map((match) =>
            match.id === id
              ? {
                  ...match,
                  status,
                  endedAt: status === 'Ended' ? new Date().toISOString() : match.endedAt,
                }
              : match
          )
        );
      },
      pauseMatch: (id: string, pauseReason: string) => {
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
      updateMatchSettings: (id: string, settings: Partial<MatchFormValues>) => {
        setMatches((currentMatches) =>
          currentMatches.map((match) => (match.id === id ? { ...match, ...settings } : match))
        );
      },
      recordServiceEvent: (event: ServiceEventInput) => {
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
      updateServiceEvent: (matchId: string, eventId: string, event: Partial<ServiceEvent>) => {
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
      undoLastServiceEvent: (matchId: string) => {
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
    [isLoadingMatches, matches]
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
