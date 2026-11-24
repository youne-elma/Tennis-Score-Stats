import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppModal } from '@/components/ui/app-modal';
import { AppTheme } from '@/constants/theme';
import { useMatches } from '@/contexts/matches-context';
import type { TennisMatch } from '@/types/match';
import { formatSharedMatchScore } from '@/utils/shared-match-stats';
import { calculateTennisScore } from '@/utils/tennis-score';

const labels = {
  synced: 'Synced',
  pending: 'Saved on this device · waiting to sync',
  syncing: 'Syncing…',
  failed: 'Saved on this device · sync will retry',
  conflict: 'Needs review · this match changed online',
  blocked: 'Saved on this device · a player was archived online',
};

export function MatchSyncNotice({ match }: { match: TennisMatch }) {
  const { getMatchSync, resolveMatchConflict, retryMatchSync } = useMatches();
  const [showConflict, setShowConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingChoice = useRef(false);
  const [error, setError] = useState(false);
  const sync = getMatchSync(match.id);

  if (!sync) return null;
  const { status, conflict } = sync;

  async function choose(choice: 'device' | 'online') {
    if (!conflict || savingChoice.current) return;
    savingChoice.current = true;
    setSaving(true);
    setError(false);
    try {
      if (await resolveMatchConflict(match.id, conflict, choice)) {
        setShowConflict(false);
      } else {
        setError(true);
      }
    } finally {
      savingChoice.current = false;
      setSaving(false);
    }
  }

  return (
    <View style={styles.notice}>
      <Text style={[styles.label, status === 'synced' && styles.synced]}>{labels[status]}</Text>
      {conflict ? (
        <AppButton title="Review versions" variant="secondary" onPress={() => setShowConflict(true)} />
      ) : status === 'failed' || status === 'blocked' ? (
        <AppButton title="Retry sync" icon="refresh" variant="secondary" onPress={() => retryMatchSync(match.id)} />
      ) : null}

      {conflict && showConflict ? (
        <AppModal title="Choose a match version" visible onClose={() => { if (!saving) setShowConflict(false); }}>
          <Text style={styles.detail}>This device · {describe(match)}</Text>
          <Text style={styles.detail}>
            {conflict.remote ? 'Online · ' + describe(conflict.remote.match) : 'The online copy was removed.'}
          </Text>
          <Text style={styles.label}>
            {conflict.remote
              ? 'Keeping this device replaces the online version when sync resumes. Using online discards the changes on this device.'
              : 'Keeping this device restores the match when sync resumes. Removing this copy discards the match on this device.'}
          </Text>
          {error ? <Text accessibilityRole="alert" style={styles.label}>Could not save your choice. Try again.</Text> : null}
          <AppButton title="Keep this device’s version" disabled={saving} onPress={() => choose('device')} />
          <AppButton
            title={conflict.remote ? 'Use online version' : 'Remove this copy'}
            variant="danger"
            disabled={saving}
            onPress={() => choose('online')}
          />
        </AppModal>
      ) : null}
    </View>
  );
}

function describe(match: TennisMatch) {
  return formatSharedMatchScore(calculateTennisScore(match)) + ' · ' + match.serviceEvents.length + ' service events';
}

const styles = StyleSheet.create({
  notice: { gap: 8 },
  label: { color: AppTheme.colors.textMuted, fontSize: 13, fontWeight: '600' },
  synced: { color: AppTheme.colors.success },
  detail: { color: AppTheme.colors.text, fontSize: 15, fontWeight: '700' },
});
