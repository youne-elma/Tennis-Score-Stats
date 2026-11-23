import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

const refreshInterval = 8_000;

export function useChatQuery<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [loadFailed, setLoadFailed] = useState(false);
  const refreshCurrent = useRef<(() => void) | null>(null);
  const refresh = useCallback(() => refreshCurrent.current?.(), []);

  useFocusEffect(
    useCallback(() => {
      let isFocused = true;
      let isLoading = false;
      let refreshQueued = false;

      async function loadData() {
        if (isLoading) {
          refreshQueued = true;
          return;
        }

        isLoading = true;
        try {
          const nextData = await load();
          if (isFocused) {
            setData(nextData);
            setLoadFailed(false);
          }
        } catch {
          if (isFocused) {
            setLoadFailed(true);
          }
        } finally {
          isLoading = false;
          if (isFocused && refreshQueued) {
            refreshQueued = false;
            void loadData();
          }
        }
      }

      refreshCurrent.current = loadData;
      const interval = setInterval(loadData, refreshInterval);
      void loadData();

      return () => {
        isFocused = false;
        refreshCurrent.current = null;
        clearInterval(interval);
      };
    }, [load])
  );

  return { data, loadFailed, refresh };
}
