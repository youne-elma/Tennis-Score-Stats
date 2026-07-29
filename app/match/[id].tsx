import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppModal } from '@/components/ui/app-modal';
import { AppToggle } from '@/components/ui/app-toggle';
import { PlayerAvatar } from '@/components/ui/player-avatar';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppTheme } from '@/constants/theme';
import { useMatches } from '@/contexts/matches-context';
import { usePlayers } from '@/contexts/players-context';
import {
  FaultType,
  DeuceScoring,
  GamesPerSet,
  ServiceAction,
  ServiceEvent,
  ServePhase,
  ServeType,
  ServeZone,
  TiebreakType,
} from '@/types/match';
import { Player } from '@/types/player';
import { calculateTennisScore } from '@/utils/tennis-score';
import { calculateMatchStats, PlayerMatchStats } from '@/utils/tennis-stats';

type PendingService = {
  phase: ServePhase;
  action: ServiceAction;
};

type ServiceDetailForm = {
  serveType: ServeType;
  zone: ServeZone;
  faultType: FaultType;
  pointWinnerId: string;
};

const defaultServiceDetail: ServiceDetailForm = {
  serveType: 'Flat',
  zone: 'Wide',
  faultType: 'In the net',
  pointWinnerId: '',
};

export default function MatchScoringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    matches,
    pauseMatch,
    recordServiceEvent,
    undoLastServiceEvent,
    updateMatchSettings,
    updateMatchStatus,
    updateServiceEvent,
  } = useMatches();
  const { players } = usePlayers();
  const [recentAction, setRecentAction] = useState('No service action recorded yet.');
  const [pendingService, setPendingService] = useState<PendingService | null>(null);
  const [serviceDetail, setServiceDetail] = useState<ServiceDetailForm>(defaultServiceDetail);
  const [statsVisible, setStatsVisible] = useState(false);
  const [fullStatsVisible, setFullStatsVisible] = useState(false);
  const [pauseVisible, setPauseVisible] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [editingEvent, setEditingEvent] = useState<ServiceEvent | null>(null);
  const [editDetail, setEditDetail] = useState<ServiceDetailForm>(defaultServiceDetail);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const match = matches.find((currentMatch) => currentMatch.id === id);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const player1 = match ? playerById.get(match.player1Id) : undefined;
  const player2 = match ? playerById.get(match.player2Id) : undefined;
  const score = useMemo(() => (match ? calculateTennisScore(match) : null), [match]);
  const stats = useMemo(() => (match ? calculateMatchStats(match) : null), [match]);
  const currentServer = score ? playerById.get(score.currentServerId) : player1;
  const lastEvent = match?.serviceEvents.at(-1);
  const isMatchEnded = match?.status === 'Ended' || Boolean(score?.matchWinnerId);
  const activeServePhase: ServePhase =
    lastEvent?.phase === 'First Serve' && lastEvent.action === 'Fault' ? 'Second Serve' : 'First Serve';

  useEffect(() => {
    if (!match) {
      return;
    }

    if (match.status === 'Not started') {
      updateMatchStatus(match.id, 'In progress');
    }
  }, [match, updateMatchStatus]);

  useEffect(() => {
    if (!match || !score?.matchWinnerId || match.status === 'Ended') {
      return;
    }

    updateMatchStatus(match.id, 'Ended');
    setRecentAction(`${formatPlayerName(playerById.get(score.matchWinnerId))} wins the match.`);
  }, [match, playerById, score?.matchWinnerId, updateMatchStatus]);

  if (!match || !player1 || !player2) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.missingState}>
          <MaterialIcons name="warning" size={34} color={AppTheme.colors.primary} />
          <Text style={styles.missingTitle}>Match unavailable</Text>
          <Text style={styles.missingText}>Go back to Matches and choose an existing match.</Text>
          <AppButton title="Back to matches" icon="arrow-back" onPress={() => router.replace('/(tabs)/matches')} />
        </View>
      </SafeAreaView>
    );
  }

  const handleServiceAction = (phase: ServePhase, action: ServiceAction) => {
    if (!currentServer) {
      return;
    }

    if (isMatchEnded) {
      Alert.alert('Match ended', 'This match already has a winner.');
      return;
    }

    setPendingService({ phase, action });
    setServiceDetail({
      ...defaultServiceDetail,
      pointWinnerId: action === 'In Play' ? currentServer.id : '',
    });
  };

  const closeServiceDetail = () => {
    setPendingService(null);
    setServiceDetail(defaultServiceDetail);
  };

  const saveServiceDetail = () => {
    if (!pendingService || !currentServer) {
      return;
    }

    if (pendingService.action === 'In Play' && !serviceDetail.pointWinnerId) {
      Alert.alert('Point winner required', 'Choose who won the point.');
      return;
    }

    const pointWinner =
      serviceDetail.pointWinnerId === player1.id
        ? player1
        : serviceDetail.pointWinnerId === player2.id
          ? player2
          : undefined;

    recordServiceEvent({
      matchId: match.id,
      serverId: currentServer.id,
      phase: pendingService.phase,
      action: pendingService.action,
      serveType: pendingService.action === 'In Play' ? undefined : serviceDetail.serveType,
      zone: pendingService.action === 'In Play' ? undefined : serviceDetail.zone,
      faultType: pendingService.action === 'Fault' ? serviceDetail.faultType : undefined,
      pointWinnerId: pendingService.action === 'In Play' ? serviceDetail.pointWinnerId : undefined,
    });

    if (match.status === 'Paused') {
      updateMatchStatus(match.id, 'In progress');
    }

    const detail =
      pendingService.action === 'In Play'
        ? `point won by ${formatPlayerName(pointWinner)}`
        : `${serviceDetail.serveType}, ${serviceDetail.zone}${
            pendingService.action === 'Fault' ? `, ${serviceDetail.faultType}` : ''
          }`;

    setRecentAction(`${pendingService.phase}: ${formatPlayerName(currentServer)} - ${pendingService.action} (${detail})`);
    closeServiceDetail();
  };

  const openEditLastEvent = () => {
    if (!lastEvent) {
      Alert.alert('Edit', 'No service event to edit.');
      return;
    }

    setEditingEvent(lastEvent);
    setEditDetail({
      serveType: lastEvent.serveType ?? 'Flat',
      zone: lastEvent.zone ?? 'Wide',
      faultType: lastEvent.faultType ?? 'In the net',
      pointWinnerId: lastEvent.pointWinnerId ?? lastEvent.serverId,
    });
  };

  const saveEditedEvent = () => {
    if (!editingEvent) {
      return;
    }

    updateServiceEvent(match.id, editingEvent.id, {
      serveType: editingEvent.action === 'In Play' ? undefined : editDetail.serveType,
      zone: editingEvent.action === 'In Play' ? undefined : editDetail.zone,
      faultType: editingEvent.action === 'Fault' ? editDetail.faultType : undefined,
      pointWinnerId: editingEvent.action === 'In Play' ? editDetail.pointWinnerId : undefined,
    });
    setRecentAction('Last service event edited.');
    setEditingEvent(null);
  };

  const savePause = () => {
    const reason = pauseReason.trim() || 'No reason provided';
    pauseMatch(match.id, reason);
    setRecentAction(`Match paused: ${reason}`);
    setPauseVisible(false);
    setPauseReason('');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={AppTheme.colors.primary} />
        </Pressable>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.kicker}>Live Match</Text>
          <Text style={styles.title}>Service Scoring</Text>
        </View>
        <Pressable style={styles.iconButton} onPress={() => Alert.alert('Profile', 'Profile screen coming soon.')}>
          <MaterialIcons name="person" size={22} color={AppTheme.colors.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <AppCard style={styles.scoreboard}>
          <PlayerScorePanel
            player={player1}
            pointLabel={score?.pointLabelPlayer1 ?? '0'}
            isServing={currentServer?.id === player1.id}
          />
          <View style={styles.scoreCenter}>
            <Text style={styles.scoreText}>
              {score?.player1.games ?? 0} - {score?.player2.games ?? 0}
            </Text>
            <Text style={styles.scoreMeta}>
              Set {score?.currentSetNumber ?? 1} - Game {score?.currentGameNumber ?? 1}
            </Text>
            <Text style={styles.scoreMeta}>
              Points {score?.totalPointsPlayer1 ?? 0} / {score?.totalPointsPlayer2 ?? 0}
            </Text>
            {score?.inTiebreak ? <Text style={styles.tiebreakBadge}>Tiebreak</Text> : null}
          </View>
          <PlayerScorePanel
            player={player2}
            pointLabel={score?.pointLabelPlayer2 ?? '0'}
            isServing={currentServer?.id === player2.id}
          />
        </AppCard>

        <AppCard tone="gold" style={styles.serverCard}>
          <View style={styles.serverHeader}>
            <View>
              <Text style={styles.sectionTitle}>Current server</Text>
              <Text style={styles.serverName}>{formatPlayerName(currentServer)}</Text>
              <Text style={[styles.matchStatusText, isMatchEnded && styles.matchEndedText]}>{match.status}</Text>
              {match.status === 'Paused' ? (
                <Text style={styles.pauseReason}>Paused: {match.pauseReason ?? 'No reason provided'}</Text>
              ) : null}
            </View>
            <Text style={styles.autoServerLabel}>Auto by game count</Text>
          </View>
        </AppCard>

        <AppCard style={styles.setsCard}>
          <Text style={styles.sectionTitle}>Sets</Text>
          <View style={styles.setsRow}>
            <Text style={styles.settingLabel}>{player1.firstName}</Text>
            <Text style={styles.settingValue}>{score?.player1.sets ?? 0}</Text>
          </View>
          <View style={styles.setsRow}>
            <Text style={styles.settingLabel}>{player2.firstName}</Text>
            <Text style={styles.settingValue}>{score?.player2.sets ?? 0}</Text>
          </View>
          {score?.completedSets.map((setScore, index) => (
            <Text key={`set-${index}`} style={styles.completedSetText}>
              Set {index + 1}: {setScore.player1Games}-{setScore.player2Games}
            </Text>
          ))}
        </AppCard>

        <ServeActionPanel phase={activeServePhase} disabled={isMatchEnded} onAction={handleServiceAction} />

        <AppCard style={styles.eventCard}>
          <Text style={styles.sectionTitle}>Last action</Text>
          <Text style={styles.bodyText}>{recentAction}</Text>
          <Text style={styles.eventCount}>{match.serviceEvents.length} service event(s) recorded</Text>
        </AppCard>

        {stats ? (
          <AppCard style={styles.quickStatsCard}>
            <View style={styles.quickStatsHeader}>
              <Text style={styles.sectionTitle}>Quick stats</Text>
              <Pressable onPress={() => setStatsVisible(true)}>
                <Text style={styles.linkText}>View</Text>
              </Pressable>
            </View>
            <View style={styles.quickStatsGrid}>
              <QuickStat label={`${player1.firstName} points`} value={`${stats.player1.pointsWon}`} />
              <QuickStat label={`${player2.firstName} points`} value={`${stats.player2.pointsWon}`} />
              <QuickStat label={`${player1.firstName} 1st serve`} value={`${stats.player1.firstServePercentage}%`} />
              <QuickStat label={`${player2.firstName} 1st serve`} value={`${stats.player2.firstServePercentage}%`} />
            </View>
          </AppCard>
        ) : null}

        <AppCard style={styles.matchSettingsCard}>
          <Text style={styles.sectionTitle}>Match setup</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Sets</Text>
            <Text style={styles.settingValue}>{match.numberOfSets}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Games per set</Text>
            <Text style={styles.settingValue}>{match.gamesPerSet}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Deuce</Text>
            <Text style={styles.settingValue}>{match.deuceScoring}</Text>
          </View>
        </AppCard>
      </ScrollView>

      <View style={styles.matchNav}>
        <MatchNavButton icon="query-stats" label="Stats" onPress={() => setStatsVisible(true)} />
        <MatchNavButton
          icon="undo"
          label="Undo"
          onPress={() => {
            if (match.serviceEvents.length === 0) {
              Alert.alert('Undo', 'No service event to undo.');
              return;
            }

            undoLastServiceEvent(match.id);
            setRecentAction('Last service event undone.');
          }}
        />
        <MatchNavButton icon="edit" label="Edit" onPress={openEditLastEvent} />
        <MatchNavButton
          icon="pause"
          label="Pause"
          onPress={() => setPauseVisible(true)}
        />
        <MatchNavButton
          icon="stop"
          label="End"
          onPress={() =>
            Alert.alert('End match', 'End this match?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'End',
                style: 'destructive',
                onPress: () => {
                  updateMatchStatus(match.id, 'Ended');
                  router.replace('/(tabs)/matches');
                },
              },
            ])
          }
        />
        <MatchNavButton icon="settings" label="Settings" onPress={() => setSettingsVisible(true)} />
      </View>

      <ServiceDetailModal
        visible={Boolean(pendingService)}
        pendingService={pendingService}
        player1={player1}
        player2={player2}
        server={currentServer}
        value={serviceDetail}
        onChange={setServiceDetail}
        onClose={closeServiceDetail}
        onSave={saveServiceDetail}
      />

      {stats ? (
        <StatsModal
          visible={statsVisible}
          player1={player1}
          player2={player2}
          player1Stats={stats.player1}
          player2Stats={stats.player2}
          totalPoints={stats.totalPoints}
          onOpenFullStats={() => {
            setStatsVisible(false);
            setFullStatsVisible(true);
          }}
          onClose={() => setStatsVisible(false)}
        />
      ) : null}

      {stats ? (
        <FullStatsModal
          visible={fullStatsVisible}
          player1={player1}
          player2={player2}
          player1Stats={stats.player1}
          player2Stats={stats.player2}
          onExport={() => exportMatchStats(player1, player2, stats.player1, stats.player2)}
          onClose={() => setFullStatsVisible(false)}
        />
      ) : null}

      <PauseModal
        visible={pauseVisible}
        value={pauseReason}
        onChange={setPauseReason}
        onClose={() => setPauseVisible(false)}
        onSave={savePause}
      />

      <EditEventModal
        visible={Boolean(editingEvent)}
        event={editingEvent}
        player1={player1}
        player2={player2}
        value={editDetail}
        onChange={setEditDetail}
        onClose={() => setEditingEvent(null)}
        onSave={saveEditedEvent}
      />

      <SettingsModal
        visible={settingsVisible}
        match={match}
        onClose={() => setSettingsVisible(false)}
        onSave={(settings) => {
          updateMatchSettings(match.id, settings);
          setRecentAction('Match settings updated.');
          setSettingsVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

function PlayerScorePanel({
  player,
  pointLabel,
  isServing,
}: {
  player: Player;
  pointLabel: string;
  isServing: boolean;
}) {
  return (
    <View style={styles.playerScorePanel}>
      <PlayerAvatar photoUri={player.photoUri} size={44} />
      <Text style={styles.playerName} numberOfLines={1}>
        {player.firstName}
      </Text>
      <Text style={styles.pointScore}>{pointLabel}</Text>
      {isServing ? <Text style={styles.serverBadge}>Serving</Text> : <Text style={styles.receiverBadge}>Receiving</Text>}
    </View>
  );
}

function PauseModal({
  visible,
  value,
  onChange,
  onClose,
  onSave,
}: {
  visible: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <AppModal title="Pause match" visible={visible} onClose={onClose}>
      <View style={styles.detailContent}>
        <Text style={styles.bodyText}>Use this when weather, light, injury or another interruption stops play.</Text>
        <View style={styles.optionGroup}>
          <Text style={styles.detailLabel}>Reason</Text>
          <TextInput
            multiline
            placeholder="Weather, power cut, injury..."
            placeholderTextColor={AppTheme.colors.placeholder}
            style={styles.textArea}
            value={value}
            onChangeText={onChange}
          />
        </View>
        <AppButton title="Pause match" icon="pause" onPress={onSave} />
      </View>
    </AppModal>
  );
}

function EditEventModal({
  visible,
  event,
  player1,
  player2,
  value,
  onChange,
  onClose,
  onSave,
}: {
  visible: boolean;
  event: ServiceEvent | null;
  player1: Player;
  player2: Player;
  value: ServiceDetailForm;
  onChange: (value: ServiceDetailForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!event) {
    return null;
  }

  const requiresServeDetail = event.action !== 'In Play';
  const requiresFaultDetail = event.action === 'Fault';

  return (
    <AppModal title={`Edit ${event.phase}`} visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled">
        <AppCard tone="gold" style={styles.detailIntro}>
          <Text style={styles.sectionTitle}>{event.action}</Text>
          <Text style={styles.bodyText}>Only the recorded details for the last event are editable in this step.</Text>
        </AppCard>

        {requiresServeDetail ? (
          <>
            <SegmentedControl<ServeType>
              label="Serve type"
              value={value.serveType}
              onChange={(serveType) => onChange({ ...value, serveType })}
              options={[
                { label: 'Flat', value: 'Flat' },
                { label: 'Kick', value: 'Kick' },
                { label: 'Slice', value: 'Slice' },
              ]}
            />
            <OptionGrid<ServeZone>
              label="Ball placement"
              value={value.zone}
              onChange={(zone) => onChange({ ...value, zone })}
              options={[
                { label: 'Down the line', value: 'Down the line' },
                { label: 'To the body', value: 'To the body' },
                { label: 'Wide', value: 'Wide' },
                { label: 'T center', value: 'T (center)' },
                { label: 'In the corner', value: 'In the corner' },
              ]}
            />
          </>
        ) : null}

        {requiresFaultDetail ? (
          <OptionGrid<FaultType>
            label="Fault type"
            value={value.faultType}
            onChange={(faultType) => onChange({ ...value, faultType })}
            options={[
              { label: 'In the net', value: 'In the net' },
              { label: 'Too Long', value: 'Too Long' },
              { label: 'Too Wide', value: 'Too Wide' },
              { label: 'Outside the T', value: 'Outside the T' },
            ]}
          />
        ) : null}

        {event.action === 'In Play' ? (
          <OptionGrid<string>
            label="Who won the point?"
            value={value.pointWinnerId}
            onChange={(pointWinnerId) => onChange({ ...value, pointWinnerId })}
            options={[
              { label: formatPlayerName(player1), value: player1.id },
              { label: formatPlayerName(player2), value: player2.id },
            ]}
          />
        ) : null}

        <AppButton title="Save edit" icon="check" onPress={onSave} />
      </ScrollView>
    </AppModal>
  );
}

function SettingsModal({
  visible,
  match,
  onClose,
  onSave,
}: {
  visible: boolean;
  match: {
    gamesPerSet: GamesPerSet;
    useTiebreaks: boolean;
    tiebreakType: TiebreakType;
    deuceScoring: DeuceScoring;
  };
  onClose: () => void;
  onSave: (settings: {
    gamesPerSet: GamesPerSet;
    useTiebreaks: boolean;
    tiebreakType: TiebreakType;
    deuceScoring: DeuceScoring;
  }) => void;
}) {
  const [gamesPerSet, setGamesPerSet] = useState<GamesPerSet>(match.gamesPerSet);
  const [useTiebreaks, setUseTiebreaks] = useState(match.useTiebreaks);
  const [tiebreakType, setTiebreakType] = useState<TiebreakType>(match.tiebreakType);
  const [deuceScoring, setDeuceScoring] = useState<DeuceScoring>(match.deuceScoring);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setGamesPerSet(match.gamesPerSet);
    setUseTiebreaks(match.useTiebreaks);
    setTiebreakType(match.tiebreakType);
    setDeuceScoring(match.deuceScoring);
  }, [match.deuceScoring, match.gamesPerSet, match.tiebreakType, match.useTiebreaks, visible]);

  return (
    <AppModal title="Match settings" visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.detailContent}>
        <SegmentedControl<GamesPerSet>
          label="Games per set"
          value={gamesPerSet}
          onChange={setGamesPerSet}
          options={[
            { label: '4', value: '4' },
            { label: '5', value: '5' },
            { label: '6', value: '6' },
          ]}
        />
        <AppCard style={styles.settingCard}>
          <AppToggle label="Use tiebreaks" value={useTiebreaks} onValueChange={setUseTiebreaks} />
        </AppCard>
        <SegmentedControl<TiebreakType>
          label="Tiebreak type"
          value={tiebreakType}
          onChange={setTiebreakType}
          options={[
            { label: 'Standard 7', value: 'Standard 7 points' },
            { label: 'Super 10', value: 'Super Tiebreak 10 points' },
            { label: 'Match TB', value: 'Match Tiebreak' },
          ]}
        />
        <SegmentedControl<DeuceScoring>
          label="Deuce scoring"
          value={deuceScoring}
          onChange={setDeuceScoring}
          options={[
            { label: 'Advantage', value: 'Advantage (Long Deuce)' },
            { label: 'No-Ad', value: 'No-Ad (Short Deuce)' },
          ]}
        />
        <AppButton
          title="Save settings"
          icon="check"
          onPress={() => onSave({ gamesPerSet, useTiebreaks, tiebreakType, deuceScoring })}
        />
      </ScrollView>
    </AppModal>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.quickStatTile}>
      <Text style={styles.quickStatValue}>{value}</Text>
      <Text style={styles.quickStatLabel}>{label}</Text>
    </View>
  );
}

function StatsModal({
  visible,
  player1,
  player2,
  player1Stats,
  player2Stats,
  totalPoints,
  onOpenFullStats,
  onClose,
}: {
  visible: boolean;
  player1: Player;
  player2: Player;
  player1Stats: PlayerMatchStats;
  player2Stats: PlayerMatchStats;
  totalPoints: number;
  onOpenFullStats: () => void;
  onClose: () => void;
}) {
  return (
    <AppModal title="Match stats" visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.statsContent}>
        <AppCard tone="gold" style={styles.statsSummaryCard}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.bodyText}>{totalPoints} point(s) recorded from service scoring.</Text>
        </AppCard>

        <StatsComparisonRow
          label="Points"
          player1Name={player1.firstName}
          player2Name={player2.firstName}
          player1Value={`${player1Stats.pointsWon}`}
          player2Value={`${player2Stats.pointsWon}`}
        />
        <StatsComparisonRow
          label="Points Win %"
          player1Name={player1.firstName}
          player2Name={player2.firstName}
          player1Value={`${player1Stats.pointsWinPercentage}%`}
          player2Value={`${player2Stats.pointsWinPercentage}%`}
        />
        <StatsComparisonRow
          label="First Serve %"
          player1Name={player1.firstName}
          player2Name={player2.firstName}
          player1Value={`${player1Stats.firstServePercentage}%`}
          player2Value={`${player2Stats.firstServePercentage}%`}
        />
        <StatsComparisonRow
          label="Aces"
          player1Name={player1.firstName}
          player2Name={player2.firstName}
          player1Value={`${player1Stats.aces}`}
          player2Value={`${player2Stats.aces}`}
        />
        <StatsComparisonRow
          label="Service Winners"
          player1Name={player1.firstName}
          player2Name={player2.firstName}
          player1Value={`${player1Stats.serviceWinners}`}
          player2Value={`${player2Stats.serviceWinners}`}
        />
        <StatsComparisonRow
          label="Faults"
          player1Name={player1.firstName}
          player2Name={player2.firstName}
          player1Value={`${player1Stats.faults}`}
          player2Value={`${player2Stats.faults}`}
        />
        <StatsComparisonRow
          label="Double Faults"
          player1Name={player1.firstName}
          player2Name={player2.firstName}
          player1Value={`${player1Stats.doubleFaults}`}
          player2Value={`${player2Stats.doubleFaults}`}
        />
        <StatsComparisonRow
          label="1st Serve Points Won"
          player1Name={player1.firstName}
          player2Name={player2.firstName}
          player1Value={`${player1Stats.firstServePointsWonPercentage}%`}
          player2Value={`${player2Stats.firstServePointsWonPercentage}%`}
        />
        <StatsComparisonRow
          label="2nd Serve Points Won"
          player1Name={player1.firstName}
          player2Name={player2.firstName}
          player1Value={`${player1Stats.secondServePointsWonPercentage}%`}
          player2Value={`${player2Stats.secondServePointsWonPercentage}%`}
        />
        <StatsComparisonRow
          label="Break Points"
          player1Name={player1.firstName}
          player2Name={player2.firstName}
          player1Value={`${player1Stats.breakPointsWon}/${player1Stats.breakPoints}`}
          player2Value={`${player2Stats.breakPointsWon}/${player2Stats.breakPoints}`}
        />

        <AppButton
          title="View full statistics"
          icon="bar-chart"
          variant="secondary"
          onPress={onOpenFullStats}
        />
      </ScrollView>
    </AppModal>
  );
}

function FullStatsModal({
  visible,
  player1,
  player2,
  player1Stats,
  player2Stats,
  onExport,
  onClose,
}: {
  visible: boolean;
  player1: Player;
  player2: Player;
  player1Stats: PlayerMatchStats;
  player2Stats: PlayerMatchStats;
  onExport: () => void;
  onClose: () => void;
}) {
  return (
    <AppModal title="Full statistics" visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.statsContent}>
        <DetailedStatsSection title="Service type" player={player1} stats={player1Stats} mode="serveType" />
        <DetailedStatsSection title="Service type" player={player2} stats={player2Stats} mode="serveType" />
        <DetailedStatsSection title="Placement zones" player={player1} stats={player1Stats} mode="zone" />
        <DetailedStatsSection title="Placement zones" player={player2} stats={player2Stats} mode="zone" />
        <FaultStatsSection player={player1} stats={player1Stats} />
        <FaultStatsSection player={player2} stats={player2Stats} />
        <AppButton title="Export match stats sheet" icon="download" onPress={onExport} />
      </ScrollView>
    </AppModal>
  );
}

function DetailedStatsSection({
  title,
  player,
  stats,
  mode,
}: {
  title: string;
  player: Player;
  stats: PlayerMatchStats;
  mode: 'serveType' | 'zone';
}) {
  const rows =
    mode === 'serveType'
      ? Object.entries(stats.byServeType)
      : Object.entries(stats.byZone);

  return (
    <AppCard style={styles.fullStatsCard}>
      <Text style={styles.statsRowTitle}>
        {player.firstName} - {title}
      </Text>
      {rows.map(([label, breakdown]) => (
        <View key={label} style={styles.fullStatsRow}>
          <View style={styles.fullStatsLabelBlock}>
            <Text style={styles.fullStatsLabel}>{label}</Text>
            <Text style={styles.fullStatsSubLabel}>{breakdown.attempts} attempt(s)</Text>
          </View>
          <View style={styles.fullStatsNumbers}>
            <Text style={styles.fullStatsValue}>{breakdown.successPercentage}% in</Text>
            <Text style={styles.fullStatsSubLabel}>{breakdown.pointsWonPercentage}% won</Text>
          </View>
        </View>
      ))}
    </AppCard>
  );
}

function FaultStatsSection({ player, stats }: { player: Player; stats: PlayerMatchStats }) {
  return (
    <AppCard style={styles.fullStatsCard}>
      <Text style={styles.statsRowTitle}>{player.firstName} - Fault types</Text>
      {Object.entries(stats.byFaultType).map(([label, value]) => (
        <View key={label} style={styles.fullStatsRow}>
          <Text style={styles.fullStatsLabel}>{label}</Text>
          <Text style={styles.fullStatsValue}>{value}</Text>
        </View>
      ))}
    </AppCard>
  );
}

function StatsComparisonRow({
  label,
  player1Name,
  player2Name,
  player1Value,
  player2Value,
}: {
  label: string;
  player1Name: string;
  player2Name: string;
  player1Value: string;
  player2Value: string;
}) {
  return (
    <AppCard style={styles.statsRowCard}>
      <Text style={styles.statsRowTitle}>{label}</Text>
      <View style={styles.statsValuesRow}>
        <View style={styles.statsValueBlock}>
          <Text style={styles.statsPlayerName}>{player1Name}</Text>
          <Text style={styles.statsValue}>{player1Value}</Text>
        </View>
        <View style={styles.statsDivider} />
        <View style={styles.statsValueBlock}>
          <Text style={styles.statsPlayerName}>{player2Name}</Text>
          <Text style={styles.statsValue}>{player2Value}</Text>
        </View>
      </View>
    </AppCard>
  );
}

function ServiceDetailModal({
  visible,
  pendingService,
  player1,
  player2,
  server,
  value,
  onChange,
  onClose,
  onSave,
}: {
  visible: boolean;
  pendingService: PendingService | null;
  player1: Player;
  player2: Player;
  server?: Player;
  value: ServiceDetailForm;
  onChange: (value: ServiceDetailForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!pendingService) {
    return null;
  }

  const requiresServeDetail = pendingService.action !== 'In Play';
  const requiresFaultDetail = pendingService.action === 'Fault';

  return (
    <AppModal title={`${pendingService.phase}: ${pendingService.action}`} visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled">
        <AppCard tone="gold" style={styles.detailIntro}>
          <Text style={styles.sectionTitle}>Server</Text>
          <Text style={styles.serverName}>{formatPlayerName(server)}</Text>
        </AppCard>

        {requiresServeDetail ? (
          <>
            <SegmentedControl<ServeType>
              label="Serve type"
              value={value.serveType}
              onChange={(serveType) => onChange({ ...value, serveType })}
              options={[
                { label: 'Flat', value: 'Flat' },
                { label: 'Kick', value: 'Kick' },
                { label: 'Slice', value: 'Slice' },
              ]}
            />

            <OptionGrid<ServeZone>
              label="Ball placement"
              value={value.zone}
              onChange={(zone) => onChange({ ...value, zone })}
              options={[
                { label: 'Down the line', value: 'Down the line' },
                { label: 'To the body', value: 'To the body' },
                { label: 'Wide', value: 'Wide' },
                { label: 'T center', value: 'T (center)' },
                { label: 'In the corner', value: 'In the corner' },
              ]}
            />
          </>
        ) : null}

        {requiresFaultDetail ? (
          <OptionGrid<FaultType>
            label="Fault type"
            value={value.faultType}
            onChange={(faultType) => onChange({ ...value, faultType })}
            options={[
              { label: 'In the net', value: 'In the net' },
              { label: 'Too Long', value: 'Too Long' },
              { label: 'Too Wide', value: 'Too Wide' },
              { label: 'Outside the T', value: 'Outside the T' },
            ]}
          />
        ) : null}

        {pendingService.action === 'In Play' ? (
          <OptionGrid<string>
            label="Who won the point?"
            value={value.pointWinnerId}
            onChange={(pointWinnerId) => onChange({ ...value, pointWinnerId })}
            options={[
              { label: formatPlayerName(player1), value: player1.id },
              { label: formatPlayerName(player2), value: player2.id },
            ]}
          />
        ) : null}

        <AppButton title="Save service event" icon="check" onPress={onSave} />
      </ScrollView>
    </AppModal>
  );
}

function OptionGrid<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.optionGrid}>
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              key={option.value}
              style={[styles.optionTile, selected && styles.optionTileSelected]}
              onPress={() => onChange(option.value)}>
              <Text style={[styles.optionTileText, selected && styles.optionTileTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ServeActionPanel({
  phase,
  disabled,
  onAction,
}: {
  phase: ServePhase;
  disabled?: boolean;
  onAction: (phase: ServePhase, action: ServiceAction) => void;
}) {
  return (
    <AppCard style={styles.servePanel}>
      <View style={styles.servePanelHeader}>
        <Text style={styles.sectionTitle}>{phase}</Text>
        {phase === 'Second Serve' ? <Text style={styles.secondServeBadge}>After first fault</Text> : null}
      </View>
      <View style={styles.actionGrid}>
        <ServiceActionButton disabled={disabled} label="Serves a fault" icon="close" onPress={() => onAction(phase, 'Fault')} />
        <ServiceActionButton disabled={disabled} label="Serves an ace" icon="flash-on" onPress={() => onAction(phase, 'Ace')} />
        <ServiceActionButton disabled={disabled} label="Service winner" icon="bolt" onPress={() => onAction(phase, 'Service Winner')} />
        <ServiceActionButton disabled={disabled} label="Serve in play" icon="sports-tennis" onPress={() => onAction(phase, 'In Play')} />
      </View>
    </AppCard>
  );
}

function ServiceActionButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.serviceButton,
        pressed && !disabled && styles.serviceButtonPressed,
        disabled && styles.serviceButtonDisabled,
      ]}
      onPress={onPress}>
      <MaterialIcons name={icon} size={22} color={disabled ? AppTheme.colors.textSubtle : AppTheme.colors.primary} />
      <Text style={[styles.serviceButtonText, disabled && styles.serviceButtonTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

function MatchNavButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.matchNavButton} onPress={onPress}>
      <MaterialIcons name={icon} size={22} color={AppTheme.colors.primary} />
      <Text style={styles.matchNavLabel}>{label}</Text>
    </Pressable>
  );
}

async function exportMatchStats(
  player1: Player,
  player2: Player,
  player1Stats: PlayerMatchStats,
  player2Stats: PlayerMatchStats
) {
  const sheet = buildMatchStatsSheet(player1, player2, player1Stats, player2Stats);

  try {
    await Share.share({
      title: 'Tennis match stats',
      message: sheet,
    });
  } catch {
    Alert.alert('Export failed', 'Could not open the share sheet.');
  }
}

function buildMatchStatsSheet(
  player1: Player,
  player2: Player,
  player1Stats: PlayerMatchStats,
  player2Stats: PlayerMatchStats
) {
  return [
    'Tennis Score Stats - Match Sheet',
    `${formatPlayerName(player1)} vs ${formatPlayerName(player2)}`,
    '',
    'Summary',
    formatExportRow('Points', player1, player2, `${player1Stats.pointsWon}`, `${player2Stats.pointsWon}`),
    formatExportRow('Points Win %', player1, player2, `${player1Stats.pointsWinPercentage}%`, `${player2Stats.pointsWinPercentage}%`),
    formatExportRow('First Serve %', player1, player2, `${player1Stats.firstServePercentage}%`, `${player2Stats.firstServePercentage}%`),
    formatExportRow('Aces', player1, player2, `${player1Stats.aces}`, `${player2Stats.aces}`),
    formatExportRow('Service Winners', player1, player2, `${player1Stats.serviceWinners}`, `${player2Stats.serviceWinners}`),
    formatExportRow('Faults', player1, player2, `${player1Stats.faults}`, `${player2Stats.faults}`),
    formatExportRow('Double Faults', player1, player2, `${player1Stats.doubleFaults}`, `${player2Stats.doubleFaults}`),
    formatExportRow('Break Points', player1, player2, `${player1Stats.breakPointsWon}/${player1Stats.breakPoints}`, `${player2Stats.breakPointsWon}/${player2Stats.breakPoints}`),
    '',
    `${player1.firstName} - Service Type`,
    formatBreakdownRows(player1Stats.byServeType),
    '',
    `${player2.firstName} - Service Type`,
    formatBreakdownRows(player2Stats.byServeType),
    '',
    `${player1.firstName} - Placement Zones`,
    formatBreakdownRows(player1Stats.byZone),
    '',
    `${player2.firstName} - Placement Zones`,
    formatBreakdownRows(player2Stats.byZone),
    '',
    `${player1.firstName} - Fault Types`,
    formatFaultRows(player1Stats.byFaultType),
    '',
    `${player2.firstName} - Fault Types`,
    formatFaultRows(player2Stats.byFaultType),
  ].join('\n');
}

function formatExportRow(label: string, player1: Player, player2: Player, player1Value: string, player2Value: string) {
  return `${label}: ${player1.firstName} ${player1Value} | ${player2.firstName} ${player2Value}`;
}

function formatBreakdownRows(breakdown: PlayerMatchStats['byServeType'] | PlayerMatchStats['byZone']) {
  return Object.entries(breakdown)
    .map(
      ([label, item]) =>
        `${label}: ${item.attempts} attempt(s), ${item.successPercentage}% in, ${item.pointsWonPercentage}% points won`
    )
    .join('\n');
}

function formatFaultRows(faults: PlayerMatchStats['byFaultType']) {
  return Object.entries(faults)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
}

function formatPlayerName(player?: Player) {
  if (!player) {
    return 'Unknown player';
  }

  return `${player.firstName} ${player.lastName}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  iconButton: {
    alignItems: 'center',
    borderColor: AppTheme.colors.borderGold,
    borderRadius: AppTheme.radii.lg,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  headerTitleBlock: {
    alignItems: 'center',
    flex: 1,
  },
  kicker: {
    color: AppTheme.colors.textSubtle,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  title: {
    color: AppTheme.colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  content: {
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 118,
  },
  scoreboard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  playerScorePanel: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  playerName: {
    color: AppTheme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    maxWidth: 90,
  },
  pointScore: {
    color: AppTheme.colors.primary,
    fontSize: 28,
    fontWeight: '900',
  },
  serverBadge: {
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radii.md,
    color: AppTheme.colors.textOnPrimary,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  receiverBadge: {
    color: AppTheme.colors.textSubtle,
    fontSize: 11,
    fontWeight: '800',
  },
  scoreCenter: {
    alignItems: 'center',
    borderColor: AppTheme.colors.border,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    minWidth: 96,
    paddingHorizontal: 10,
  },
  scoreText: {
    color: AppTheme.colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  scoreMeta: {
    color: AppTheme.colors.textSubtle,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  tiebreakBadge: {
    backgroundColor: AppTheme.colors.primarySoft,
    borderRadius: AppTheme.radii.md,
    color: AppTheme.colors.primary,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 6,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  serverCard: {
    gap: 10,
  },
  serverHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: AppTheme.colors.primary,
    fontSize: 15,
    fontWeight: '900',
  },
  serverName: {
    color: AppTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  pauseReason: {
    color: AppTheme.colors.textSubtle,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  matchStatusText: {
    color: AppTheme.colors.success,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  matchEndedText: {
    color: AppTheme.colors.textSubtle,
  },
  autoServerLabel: {
    color: AppTheme.colors.textSubtle,
    fontSize: 12,
    fontWeight: '800',
  },
  setsCard: {
    gap: 8,
  },
  setsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  completedSetText: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  servePanel: {
    gap: 12,
  },
  servePanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondServeBadge: {
    backgroundColor: AppTheme.colors.primarySoft,
    borderRadius: AppTheme.radii.md,
    color: AppTheme.colors.primary,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  serviceButton: {
    alignItems: 'center',
    backgroundColor: AppTheme.colors.inputSurface,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radii.md,
    borderWidth: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 94,
    padding: 10,
    width: '47.5%',
  },
  serviceButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  serviceButtonDisabled: {
    opacity: 0.45,
  },
  serviceButtonText: {
    color: AppTheme.colors.text,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
    textAlign: 'center',
  },
  serviceButtonTextDisabled: {
    color: AppTheme.colors.textSubtle,
  },
  eventCard: {
    gap: 8,
  },
  eventCount: {
    color: AppTheme.colors.textSubtle,
    fontSize: 12,
    fontWeight: '800',
  },
  quickStatsCard: {
    gap: 12,
  },
  quickStatsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkText: {
    color: AppTheme.colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickStatTile: {
    backgroundColor: AppTheme.colors.surfaceMuted,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radii.md,
    borderWidth: 1,
    minWidth: '47%',
    padding: 10,
  },
  quickStatValue: {
    color: AppTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  quickStatLabel: {
    color: AppTheme.colors.textSubtle,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  bodyText: {
    color: AppTheme.colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  matchSettingsCard: {
    gap: 10,
  },
  settingCard: {
    paddingVertical: 8,
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  settingLabel: {
    color: AppTheme.colors.textSubtle,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  settingValue: {
    color: AppTheme.colors.text,
    flex: 1.2,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  matchNav: {
    alignItems: 'center',
    backgroundColor: AppTheme.colors.tabBar,
    borderTopColor: AppTheme.colors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    left: 0,
    minHeight: 76,
    paddingBottom: 10,
    paddingHorizontal: 8,
    paddingTop: 8,
    position: 'absolute',
    right: 0,
  },
  matchNavButton: {
    alignItems: 'center',
    gap: 4,
    minWidth: 48,
  },
  matchNavLabel: {
    color: AppTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  missingState: {
    alignItems: 'center',
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  missingTitle: {
    color: AppTheme.colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  missingText: {
    color: AppTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  detailContent: {
    gap: 16,
    paddingBottom: 20,
  },
  detailIntro: {
    gap: 4,
  },
  textArea: {
    backgroundColor: AppTheme.colors.inputSurface,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radii.md,
    borderWidth: 1,
    color: AppTheme.colors.text,
    fontSize: AppTheme.typography.input,
    minHeight: 88,
    paddingHorizontal: 14,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  statsContent: {
    gap: 12,
    paddingBottom: 20,
  },
  statsSummaryCard: {
    gap: 8,
  },
  statsRowCard: {
    gap: 12,
  },
  statsRowTitle: {
    color: AppTheme.colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  statsValuesRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 12,
  },
  statsValueBlock: {
    flex: 1,
  },
  statsPlayerName: {
    color: AppTheme.colors.textSubtle,
    fontSize: 12,
    fontWeight: '800',
  },
  statsValue: {
    color: AppTheme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 3,
  },
  statsDivider: {
    backgroundColor: AppTheme.colors.border,
    width: 1,
  },
  fullStatsCard: {
    gap: 12,
  },
  fullStatsRow: {
    alignItems: 'center',
    borderTopColor: AppTheme.colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  fullStatsLabelBlock: {
    flex: 1,
  },
  fullStatsLabel: {
    color: AppTheme.colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  fullStatsSubLabel: {
    color: AppTheme.colors.textSubtle,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  fullStatsNumbers: {
    alignItems: 'flex-end',
  },
  fullStatsValue: {
    color: AppTheme.colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  optionGroup: {
    gap: 8,
  },
  detailLabel: {
    color: AppTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionTile: {
    alignItems: 'center',
    backgroundColor: AppTheme.colors.inputSurface,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    minWidth: '47%',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  optionTileSelected: {
    backgroundColor: AppTheme.colors.primary,
    borderColor: AppTheme.colors.primary,
  },
  optionTileText: {
    color: AppTheme.colors.text,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  optionTileTextSelected: {
    color: AppTheme.colors.textOnPrimary,
  },
});
