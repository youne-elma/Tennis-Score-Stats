import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppModal } from '@/components/ui/app-modal';
import { AppTheme } from '@/constants/theme';
import { useChatQuery } from '@/hooks/use-chat-query';
import { assignChatCoach, loadChatCoaches } from '@/utils/supabase-chat';

type CoachAssignmentProps = {
  threadId: string;
  assignedCoachId?: string;
  onAssigned: () => void;
};

export function CoachAssignment({ threadId, assignedCoachId, onAssigned }: CoachAssignmentProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      <AppButton
        title={assignedCoachId ? 'Change assigned coach' : 'Assign coach'}
        icon="person-add"
        variant="secondary"
        onPress={() => setShowPicker(true)}
      />
      {showPicker ? (
        <AssignmentPicker
          threadId={threadId}
          assignedCoachId={assignedCoachId}
          onClose={() => setShowPicker(false)}
          onAssigned={() => {
            setShowPicker(false);
            onAssigned();
          }}
        />
      ) : null}
    </>
  );
}

function AssignmentPicker({
  threadId, assignedCoachId, onClose, onAssigned,
}: CoachAssignmentProps & { onClose: () => void }) {
  const { data: coaches, loadFailed, refresh } = useChatQuery(loadChatCoaches);
  const [selected, setSelected] = useState(assignedCoachId ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const saving = useRef(false);
  const options = [{ user_id: '', name: 'Unassigned' }, ...(coaches ?? [])];
  const canSave = selected !== (assignedCoachId ?? '')
    && (selected === '' || Boolean(coaches?.some((coach) => coach.user_id === selected)));

  async function save() {
    if (!canSave || saving.current) return;
    saving.current = true;
    setIsSaving(true);
    setSaveFailed(false);
    try {
      await assignChatCoach(threadId, selected || null);
      onAssigned();
    } catch {
      setSaveFailed(true);
      refresh();
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  return (
    <AppModal title="Assign coach" visible onClose={() => { if (!isSaving) onClose(); }}>
      <ScrollView contentContainerStyle={styles.content}>
        {loadFailed ? (
          <>
            <Text accessibilityRole="alert" style={styles.error}>Could not load coaches.</Text>
            <AppButton title="Try again" variant="secondary" onPress={refresh} />
          </>
        ) : coaches ? (
          <View role="radiogroup" aria-label="Coach" style={styles.options}>
            {options.map((coach) => (
              <AppButton
                key={coach.user_id}
                title={coach.name}
                accessibilityRole="radio"
                aria-checked={coach.user_id === selected}
                variant={coach.user_id === selected ? 'primary' : 'secondary'}
                disabled={isSaving}
                onPress={() => setSelected(coach.user_id)}
              />
            ))}
          </View>
        ) : <Text style={styles.note}>Loading coaches…</Text>}
        {saveFailed ? <Text accessibilityRole="alert" style={styles.error}>Could not save the assignment. Try again.</Text> : null}
      </ScrollView>
      <AppButton title={isSaving ? 'Saving…' : 'Save assignment'} onPress={save} disabled={!canSave || isSaving} />
    </AppModal>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  options: { gap: 8 },
  note: { color: AppTheme.colors.textMuted },
  error: { color: AppTheme.colors.danger },
});
