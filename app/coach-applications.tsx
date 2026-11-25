import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppInput } from '@/components/ui/app-input';
import { AppTheme } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useChatQuery } from '@/hooks/use-chat-query';
import {
  isCoachApplicationId,
  loadCoachApplications,
  loadMyCoachApplication,
  reviewCoachApplication,
  submitCoachApplication,
  type ApplicationDecision,
  type CoachApplication,
  type CoachApplicationForm,
} from '@/utils/coach-applications';
import { loadUserRole } from '@/utils/supabase-chat';

type ApplicationView =
  | { kind: 'admin'; requests: CoachApplication[] }
  | { kind: 'applicant'; application: CoachApplication | null; canApply: boolean }
  | { kind: 'restricted' };

const statusLabels = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Declined',
};

export default function CoachApplicationsScreen() {
  const { mode, user, isLoading } = useAuth();
  const { applicationId: requestedId } = useLocalSearchParams<{ applicationId?: string }>();
  const applicationId = isCoachApplicationId(requestedId) ? requestedId : undefined;
  const storedName = user?.user_metadata.display_name;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.main}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
            onPress={() => router.canGoBack() ? router.back() : router.replace('/mode')}>
            <MaterialIcons name="arrow-back" size={22} color={AppTheme.colors.primary} />
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>Coach applications</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {isLoading ? (
            <Text style={styles.note}>Loading your account…</Text>
          ) : mode === 'authenticated' && user ? (
            <ApplicationContent
              key={user.id + ':' + (applicationId ?? 'all')}
              userId={user.id}
              name={typeof storedName === 'string' ? storedName : ''}
              applicationId={applicationId}
            />
          ) : (
            <AppCard style={styles.card}>
              <Text style={styles.note}>Sign in to view coach applications.</Text>
              <AppButton
                title="Login"
                icon="login"
                onPress={() => router.replace({
                  pathname: '/auth/login',
                  params: { coachApplicationId: applicationId ?? 'inbox' },
                } as Href)}
              />
            </AppCard>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function ApplicationContent({
  userId, name, applicationId,
}: {
  userId: string;
  name: string;
  applicationId?: string;
}) {
  const load = useCallback(async (): Promise<ApplicationView> => {
    const role = await loadUserRole(userId);
    if (role === 'admin') {
      return { kind: 'admin', requests: await loadCoachApplications(applicationId) };
    }
    if (applicationId) {
      return { kind: 'restricted' };
    }
    return { kind: 'applicant', application: await loadMyCoachApplication(userId), canApply: role === 'user' };
  }, [applicationId, userId]);
  const { data, loadFailed, refresh, setData } = useChatQuery(load);

  if (loadFailed) {
    return (
      <AppCard style={styles.card}>
        <Text accessibilityRole="alert" style={styles.error}>Could not load coach applications.</Text>
        <AppButton title="Try again" variant="secondary" onPress={refresh} />
      </AppCard>
    );
  }
  if (!data) return <Text style={styles.note}>Loading applications…</Text>;
  if (data.kind === 'restricted') {
    return <Text accessibilityRole="alert" style={styles.error}>Administrator access is required to review applications.</Text>;
  }
  if (data.kind === 'admin') {
    return (
      <AdminApplications
        requests={data.requests}
        applicationId={applicationId}
        onReview={(updated) => {
          setData((current) => current?.kind === 'admin' ? {
            ...current,
            requests: applicationId ? [updated] : current.requests.filter((request) => request.id !== updated.id),
          } : current);
          refresh();
        }}
        onRefresh={refresh}
      />
    );
  }

  return (
    <ApplicantForm
      application={data.application}
      canApply={data.canApply}
      name={name}
      onSubmitted={(application) => {
        setData((current) => current?.kind === 'applicant' ? { ...current, application } : current);
        refresh();
      }}
    />
  );
}

function ApplicantForm({
  application, canApply, name, onSubmitted,
}: {
  application: CoachApplication | null;
  canApply: boolean;
  name: string;
  onSubmitted: (application: CoachApplication) => void;
}) {
  const [form, setForm] = useState<CoachApplicationForm>(() => ({
    fullName: application?.fullName ?? name,
    club: application?.club ?? '',
    experience: application?.experience ?? '',
    motivation: application?.motivation ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const savingRequest = useRef(false);
  const canSend = canApply && (!application || application.status === 'rejected');
  const formComplete = Boolean(form.fullName.trim() && form.experience.trim() && form.motivation.trim());

  async function submit() {
    if (!canSend || !formComplete || savingRequest.current) return;
    savingRequest.current = true;
    setSaving(true);
    setFailed(false);
    try {
      onSubmitted(await submitCoachApplication(form));
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
      savingRequest.current = false;
    }
  }

  return (
    <>
      {application ? (
        <AppCard tone="muted" style={styles.card}>
          <Text accessibilityLiveRegion="polite" style={styles.heading}>{statusLabels[application.status]}</Text>
          <Text style={styles.note}>Submitted {formatDate(application.createdAt)}</Text>
          {application.reviewedAt ? <Text style={styles.note}>Reviewed {formatDate(application.reviewedAt)}</Text> : null}
        </AppCard>
      ) : !canApply ? (
        <Text style={styles.note}>Your account already has the coach role.</Text>
      ) : null}

      {canSend ? (
        <AppCard style={styles.card}>
          <Text style={styles.heading}>Become a coach</Text>
          <AppInput
            label="Full name"
            accessibilityLabel="Full name"
            autoCapitalize="words"
            maxLength={100}
            editable={!saving}
            value={form.fullName}
            onChangeText={(fullName) => setForm((current) => ({ ...current, fullName }))}
          />
          <AppInput
            label="Club (optional)"
            accessibilityLabel="Club (optional)"
            maxLength={100}
            editable={!saving}
            value={form.club}
            onChangeText={(club) => setForm((current) => ({ ...current, club }))}
          />
          <AppInput
            label="Coaching experience"
            accessibilityLabel="Coaching experience"
            multiline
            style={styles.multiline}
            maxLength={1500}
            editable={!saving}
            value={form.experience}
            onChangeText={(experience) => setForm((current) => ({ ...current, experience }))}
          />
          <AppInput
            label="Why do you want to coach?"
            accessibilityLabel="Why do you want to coach?"
            multiline
            style={styles.multiline}
            maxLength={1500}
            editable={!saving}
            value={form.motivation}
            onChangeText={(motivation) => setForm((current) => ({ ...current, motivation }))}
          />
          {failed ? (
            <Text accessibilityRole="alert" style={styles.error}>Could not submit the application. Try again.</Text>
          ) : null}
          <AppButton
            title={saving ? 'Submitting…' : 'Submit application'}
            icon="send"
            disabled={saving || !formComplete}
            onPress={submit}
          />
        </AppCard>
      ) : null}
    </>
  );
}

function AdminApplications({
  requests, applicationId, onReview, onRefresh,
}: {
  requests: CoachApplication[];
  applicationId?: string;
  onReview: (updated: CoachApplication) => void;
  onRefresh: () => void;
}) {
  const [reviewingId, setReviewingId] = useState<string>();
  const [lastDecision, setLastDecision] = useState<{ id: string; label: string }>();
  const [failedId, setFailedId] = useState<string>();
  const reviewing = useRef(false);

  async function decide(id: string, decision: ApplicationDecision) {
    if (reviewing.current) return;
    reviewing.current = true;
    setReviewingId(id);
    setFailedId(undefined);
    try {
      const updated = await reviewCoachApplication(id, decision);
      setLastDecision({ id, label: updated.fullName + ' · ' + statusLabels[updated.status] });
      onReview(updated);
    } catch {
      setFailedId(id);
      onRefresh();
    } finally {
      reviewing.current = false;
      setReviewingId(undefined);
    }
  }

  const visible = applicationId ? requests : requests.filter((request) => request.id !== lastDecision?.id);
  return (
    <>
      {applicationId ? (
        <AppButton
          title="Pending applications"
          icon="list"
          variant="secondary"
          onPress={() => router.setParams({ applicationId: undefined })}
        />
      ) : null}
      {lastDecision && !applicationId ? <Text accessibilityLiveRegion="polite" style={styles.success}>{lastDecision.label}</Text> : null}
      {visible.length === 0 ? (
        <Text style={styles.note}>{applicationId ? 'Application unavailable.' : 'No applications awaiting review.'}</Text>
      ) : null}
      {visible.map((application) => (
        <AppCard key={application.id} style={styles.card}>
          <Text style={styles.heading}>{application.fullName}</Text>
          <Text style={styles.note}>{statusLabels[application.status]} · {formatDate(application.createdAt)}</Text>
          {application.club ? <Text style={styles.body}>Club · {application.club}</Text> : null}
          <View style={styles.field}>
            <Text style={styles.label}>Experience</Text>
            <Text style={styles.body}>{application.experience}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Motivation</Text>
            <Text style={styles.body}>{application.motivation}</Text>
          </View>
          {failedId === application.id ? (
            <Text accessibilityRole="alert" style={styles.error}>Could not save the decision. Try again.</Text>
          ) : null}
          {application.status === 'pending' ? (
            <View style={styles.actions}>
              <AppButton
                title="Decline"
                variant="secondary"
                disabled={Boolean(reviewingId)}
                onPress={() => decide(application.id, 'rejected')}
              />
              <AppButton
                title={reviewingId === application.id ? 'Saving…' : 'Approve as coach'}
                icon="check"
                disabled={Boolean(reviewingId)}
                onPress={() => decide(application.id, 'approved')}
              />
            </View>
          ) : null}
        </AppCard>
      ))}
    </>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { backgroundColor: AppTheme.colors.background, flex: 1 },
  main: { alignSelf: 'center', flex: 1, maxWidth: 720, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 16 },
  backButton: {
    alignItems: 'center', borderColor: AppTheme.colors.borderGold, borderRadius: AppTheme.radii.md,
    borderWidth: 1, height: 42, justifyContent: 'center', width: 42,
  },
  title: { color: AppTheme.colors.text, flex: 1, fontSize: 24, fontWeight: '900' },
  content: { gap: 14, padding: 16, paddingTop: 4 },
  card: { gap: 14 },
  heading: { color: AppTheme.colors.text, fontSize: 18, fontWeight: '800' },
  note: { color: AppTheme.colors.textMuted, fontSize: 14 },
  label: { color: AppTheme.colors.primary, fontSize: 14, fontWeight: '800' },
  body: { color: AppTheme.colors.text, fontSize: 15, lineHeight: 21 },
  field: { gap: 4 },
  multiline: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  error: { color: AppTheme.colors.danger, fontSize: 14 },
  success: { color: AppTheme.colors.success, fontSize: 14, fontWeight: '700' },
});
