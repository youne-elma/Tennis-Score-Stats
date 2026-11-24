import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppModal } from '@/components/ui/app-modal';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { defaultMatchHistoryFilters, type MatchHistoryFilters } from '@/utils/match-history-filters';

type MatchHistoryFilterModalProps = {
  filters: MatchHistoryFilters;
  players: { label: string; value: string }[];
  onApply: (filters: MatchHistoryFilters) => void;
  onClose: () => void;
};

const periods: { label: string; value: MatchHistoryFilters['period'] }[] = [
  { label: 'All dates', value: 'all' },
  { label: 'Last 7 days', value: 'last-seven-days' },
  { label: 'This month', value: 'this-month' },
];

const statuses: { label: string; value: MatchHistoryFilters['status'] }[] = [
  { label: 'All', value: 'all' },
  { label: 'Not started', value: 'Not started' },
  { label: 'In progress', value: 'In progress' },
  { label: 'Paused', value: 'Paused' },
  { label: 'Ended', value: 'Ended' },
];

export function MatchHistoryFilterModal({ filters, players, onApply, onClose }: MatchHistoryFilterModalProps) {
  const [draft, setDraft] = useState(filters);

  return (
    <AppModal title="Match filters" visible onClose={onClose}>
      <ScrollView contentContainerStyle={styles.fields}>
        <SegmentedControl
          label="Player"
          options={[{ label: 'All players', value: '' }, ...players]}
          value={draft.playerId}
          onChange={(playerId) => setDraft((current) => ({ ...current, playerId }))}
          wrap
        />
        <SegmentedControl
          label="Period"
          options={periods}
          value={draft.period}
          onChange={(period) => setDraft((current) => ({ ...current, period }))}
          wrap
        />
        <SegmentedControl
          label="Status"
          options={statuses}
          value={draft.status}
          onChange={(status) => setDraft((current) => ({ ...current, status }))}
          wrap
        />
      </ScrollView>
      <View style={styles.actions}>
        <AppButton title="Reset filters" variant="secondary" onPress={() => onApply(defaultMatchHistoryFilters)} />
        <AppButton title="Apply filters" onPress={() => onApply(draft)} />
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 16, paddingBottom: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
});
