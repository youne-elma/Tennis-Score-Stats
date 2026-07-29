import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  CourtView,
  DeuceScoring,
  GamesPerSet,
  MatchFormValues,
  NumberOfSets,
  TiebreakType,
  TennisMatch,
} from '@/types/match';
import { Player } from '@/types/player';

const defaultForm: MatchFormValues = {
  player1Id: '',
  player2Id: '',
  numberOfSets: '3',
  gamesPerSet: '4',
  useTiebreaks: true,
  tiebreakType: 'Standard 7 points',
  deuceScoring: 'Advantage (Long Deuce)',
  courtView: 'Behind Baseline',
};

export default function MatchesScreen() {
  const { players } = usePlayers();
  const { matches, isLoadingMatches, addMatch } = useMatches();
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<MatchFormValues>(defaultForm);

  const canCreateMatch = players.length >= 2;
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  const openCreateMatch = () => {
    if (!canCreateMatch) {
      Alert.alert(
        'Need more players',
        `Create ${2 - players.length} more player${players.length === 1 ? '' : 's'} before creating a match.`
      );
      return;
    }

    setForm({
      ...defaultForm,
      player1Id: players[0].id,
      player2Id: players[1].id,
    });
    setFormVisible(true);
  };

  const saveMatch = () => {
    if (!form.player1Id || !form.player2Id) {
      Alert.alert('Missing players', 'Select Player 1 and Player 2.');
      return;
    }

    if (form.player1Id === form.player2Id) {
      Alert.alert('Invalid match', 'Player 1 and Player 2 must be different.');
      return;
    }

    addMatch(form);
    setFormVisible(false);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.replace('/mode')}>
          <MaterialIcons name="arrow-back" size={22} color={AppTheme.colors.primary} />
        </Pressable>
        <View>
          <Text style={styles.kicker}>Service Score</Text>
          <Text style={styles.title}>Matches</Text>
        </View>
        <Pressable style={styles.profileButton} onPress={() => Alert.alert('Profile', 'Profile screen coming soon.')}>
          <MaterialIcons name="person" size={22} color={AppTheme.colors.textOnPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <AppCard tone={canCreateMatch ? 'default' : 'gold'} style={styles.requirementCard}>
          <View style={styles.requirementHeader}>
            <Text style={styles.sectionTitle}>Match requirement</Text>
            <Text style={styles.badge}>{players.length}/2 players</Text>
          </View>
          <Text style={styles.bodyText}>
            {canCreateMatch
              ? 'You can create a match and prepare service scoring.'
              : 'Go back to Players and create the missing player profiles first.'}
          </Text>
        </AppCard>

        {isLoadingMatches ? (
          <AppCard style={styles.heroPanel}>
            <MaterialIcons name="storage" size={34} color={AppTheme.colors.primary} />
            <Text style={styles.heroTitle}>Loading saved matches</Text>
            <Text style={styles.heroText}>Your match history and service events are being restored.</Text>
          </AppCard>
        ) : matches.length === 0 ? (
          <AppCard style={styles.heroPanel}>
            <MaterialIcons
              name={canCreateMatch ? 'sports-tennis' : 'groups'}
              size={34}
              color={AppTheme.colors.primary}
            />
            <Text style={styles.heroTitle}>{canCreateMatch ? 'No match yet' : 'Players required'}</Text>
            <Text style={styles.heroText}>
              {canCreateMatch
                ? 'Use the + button to create your first tennis match.'
                : 'Create at least two players before starting match setup.'}
            </Text>
            {canCreateMatch ? <AppButton title="Create match" icon="add" onPress={openCreateMatch} /> : null}
          </AppCard>
        ) : (
          matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              player1={playerById.get(match.player1Id)}
              player2={playerById.get(match.player2Id)}
            />
          ))
        )}

        <AppCard tone="gold" style={styles.previewCard}>
          <Text style={styles.sectionTitle}>Service score setup</Text>
          <Text style={styles.bodyText}>
            Created matches are ready for the scoring screen in task 5: score display, current server
            and first/second serve actions.
          </Text>
        </AppCard>
      </ScrollView>

      <Pressable style={[styles.fab, !canCreateMatch && styles.fabDisabled]} onPress={openCreateMatch}>
        <MaterialIcons name="add" size={32} color={AppTheme.colors.textOnPrimary} />
      </Pressable>

      <AppModal title="New match" visible={formVisible} onClose={() => setFormVisible(false)}>
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <PlayerPicker
            label="Player 1"
            players={players}
            selectedPlayerId={form.player1Id}
            disabledPlayerId={form.player2Id}
            onSelect={(player1Id) => setForm((current) => ({ ...current, player1Id }))}
          />

          <PlayerPicker
            label="Player 2"
            players={players}
            selectedPlayerId={form.player2Id}
            disabledPlayerId={form.player1Id}
            onSelect={(player2Id) => setForm((current) => ({ ...current, player2Id }))}
          />

          <SegmentedControl<NumberOfSets>
            label="Number of sets"
            value={form.numberOfSets}
            onChange={(numberOfSets) => setForm((current) => ({ ...current, numberOfSets }))}
            options={[
              { label: '1', value: '1' },
              { label: '2', value: '2' },
              { label: '3', value: '3' },
              { label: '5', value: '5' },
            ]}
          />

          <SegmentedControl<GamesPerSet>
            label="Games per set"
            value={form.gamesPerSet}
            onChange={(gamesPerSet) => setForm((current) => ({ ...current, gamesPerSet }))}
            options={[
              { label: '4', value: '4' },
              { label: '5', value: '5' },
              { label: '6', value: '6' },
            ]}
          />

          <AppCard style={styles.settingCard}>
            <AppToggle
              label="Use tiebreaks"
              value={form.useTiebreaks}
              onValueChange={(useTiebreaks) => setForm((current) => ({ ...current, useTiebreaks }))}
            />
          </AppCard>

          <SegmentedControl<TiebreakType>
            label="Tiebreak type"
            value={form.tiebreakType}
            onChange={(tiebreakType) => setForm((current) => ({ ...current, tiebreakType }))}
            options={[
              { label: 'Standard 7', value: 'Standard 7 points' },
              { label: 'Super 10', value: 'Super Tiebreak 10 points' },
              { label: 'Match TB', value: 'Match Tiebreak' },
            ]}
          />

          <SegmentedControl<DeuceScoring>
            label="Deuce scoring"
            value={form.deuceScoring}
            onChange={(deuceScoring) => setForm((current) => ({ ...current, deuceScoring }))}
            options={[
              { label: 'Advantage', value: 'Advantage (Long Deuce)' },
              { label: 'No-Ad', value: 'No-Ad (Short Deuce)' },
            ]}
          />

          <SegmentedControl<CourtView>
            label="Court / Viewing"
            value={form.courtView}
            onChange={(courtView) => setForm((current) => ({ ...current, courtView }))}
            options={[
              { label: 'Behind Baseline', value: 'Behind Baseline' },
              { label: 'Side View', value: 'Side View' },
            ]}
          />

          <CourtDiagram
            courtView={form.courtView}
            player1={playerById.get(form.player1Id)}
            player2={playerById.get(form.player2Id)}
          />

          <AppButton title="Create match" icon="check" onPress={saveMatch} />
        </ScrollView>
      </AppModal>
    </SafeAreaView>
  );
}

function MatchCard({
  match,
  player1,
  player2,
}: {
  match: TennisMatch;
  player1?: Player;
  player2?: Player;
}) {
  return (
    <AppCard style={styles.matchCard}>
      <View style={styles.matchCardHeader}>
        <View style={styles.matchPlayers}>
          <Text style={styles.matchTitle}>
            {formatPlayerName(player1)} vs {formatPlayerName(player2)}
          </Text>
          <Text style={styles.matchMeta}>{formatMatchDate(match.createdAt)}</Text>
        </View>
        <Text style={[styles.badge, getStatusBadgeStyle(match.status)]}>{match.status}</Text>
      </View>

      <View style={styles.matchSummaryGrid}>
        <SummaryItem label="Games/set" value={match.gamesPerSet} />
        <SummaryItem label="Tiebreak" value={match.useTiebreaks ? 'On' : 'Off'} />
        <SummaryItem label="Deuce" value={match.deuceScoring.startsWith('No-Ad') ? 'No-Ad' : 'Adv'} />
        <SummaryItem label="View" value={match.courtView === 'Side View' ? 'Side' : 'Baseline'} />
      </View>

      <AppButton
        title={match.status === 'Ended' ? 'Review match' : match.status === 'Paused' ? 'Resume scoring' : 'Start scoring'}
        icon={match.status === 'Ended' ? 'visibility' : 'play-arrow'}
        variant="secondary"
        onPress={() => router.push(`/match/${match.id}`)}
      />
    </AppCard>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function PlayerPicker({
  label,
  players,
  selectedPlayerId,
  disabledPlayerId,
  onSelect,
}: {
  label: string;
  players: Player[];
  selectedPlayerId: string;
  disabledPlayerId: string;
  onSelect: (playerId: string) => void;
}) {
  return (
    <View style={styles.pickerGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.playerOptions}>
        {players.map((player) => {
          const selected = player.id === selectedPlayerId;
          const disabled = player.id === disabledPlayerId;

          return (
            <Pressable
              key={player.id}
              disabled={disabled}
              style={[styles.playerOption, selected && styles.playerOptionSelected, disabled && styles.disabledOption]}
              onPress={() => onSelect(player.id)}>
              <PlayerAvatar photoUri={player.photoUri} size={34} />
              <View style={styles.playerOptionText}>
                <Text style={styles.playerOptionName}>{formatPlayerName(player)}</Text>
                <Text style={styles.playerOptionMeta}>{player.handedness}</Text>
              </View>
              {selected ? <MaterialIcons name="check-circle" size={20} color={AppTheme.colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CourtDiagram({
  courtView,
  player1,
  player2,
}: {
  courtView: CourtView;
  player1?: Player;
  player2?: Player;
}) {
  const player1Name = shortPlayerName(player1, 'P1');
  const player2Name = shortPlayerName(player2, 'P2');

  return (
    <AppCard style={styles.courtCard}>
      <View style={styles.courtHeader}>
        <Text style={styles.fieldLabel}>{courtView}</Text>
        <MaterialIcons name="visibility" size={18} color={AppTheme.colors.primary} />
      </View>

      {courtView === 'Behind Baseline' ? (
        <View style={styles.baselineDiagram}>
          <Text style={styles.courtHint}>Far</Text>
          <View style={styles.courtBox}>
            <View style={styles.baselinePlayerFar}>
              <Text style={styles.playerMarker}>{player2Name}</Text>
            </View>
            <View style={styles.netLine} />
            <View style={styles.baselinePlayerNear}>
              <Text style={styles.playerMarker}>{player1Name}</Text>
            </View>
          </View>
          <Text style={styles.courtHint}>Near me</Text>
        </View>
      ) : (
        <View style={styles.sideDiagram}>
          <View style={styles.sideCourtBox}>
            <View style={styles.sidePlayerLeft}>
              <Text style={styles.playerMarker}>{player1Name}</Text>
            </View>
            <View style={styles.verticalNetLine} />
            <View style={styles.sidePlayerRight}>
              <Text style={styles.playerMarker}>{player2Name}</Text>
            </View>
          </View>
          <Text style={styles.courtHint}>Side viewing position</Text>
        </View>
      )}
    </AppCard>
  );
}

function formatPlayerName(player?: Player) {
  if (!player) {
    return 'Unknown player';
  }

  return `${player.firstName} ${player.lastName}`;
}

function formatMatchDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Saved match';
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusBadgeStyle(status: TennisMatch['status']) {
  if (status === 'Ended') {
    return styles.endedBadge;
  }

  if (status === 'Paused') {
    return styles.pausedBadge;
  }

  if (status === 'In progress') {
    return styles.liveBadge;
  }

  return null;
}

function shortPlayerName(player: Player | undefined, fallback: string) {
  if (!player) {
    return fallback;
  }

  return `${player.firstName.slice(0, 1)}. ${player.lastName}`.trim();
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
  profileButton: {
    alignItems: 'center',
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radii.lg,
    height: 42,
    justifyContent: 'center',
    width: 42,
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
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
  },
  content: {
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  requirementCard: {
    gap: 8,
  },
  requirementHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroPanel: {
    alignItems: 'center',
    gap: 12,
    padding: 22,
  },
  heroTitle: {
    color: AppTheme.colors.text,
    fontSize: 21,
    fontWeight: '800',
  },
  heroText: {
    color: AppTheme.colors.text,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  previewCard: {
    gap: 8,
  },
  sectionTitle: {
    color: AppTheme.colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  badge: {
    backgroundColor: AppTheme.colors.primarySoft,
    borderRadius: AppTheme.radii.md,
    color: AppTheme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveBadge: {
    color: AppTheme.colors.success,
  },
  pausedBadge: {
    color: AppTheme.colors.textMuted,
  },
  endedBadge: {
    color: AppTheme.colors.textSubtle,
  },
  bodyText: {
    color: AppTheme.colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  matchCard: {
    gap: 14,
  },
  matchCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  matchPlayers: {
    flex: 1,
  },
  matchTitle: {
    color: AppTheme.colors.text,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 23,
  },
  matchMeta: {
    color: AppTheme.colors.textSubtle,
    fontSize: 13,
    marginTop: 4,
  },
  matchSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryItem: {
    backgroundColor: AppTheme.colors.surfaceMuted,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radii.md,
    borderWidth: 1,
    minWidth: '47%',
    padding: 10,
  },
  summaryLabel: {
    color: AppTheme.colors.textSubtle,
    fontSize: 12,
    fontWeight: '800',
  },
  summaryValue: {
    color: AppTheme.colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 3,
  },
  fab: {
    alignItems: 'center',
    backgroundColor: AppTheme.colors.primary,
    borderRadius: 28,
    bottom: 92,
    elevation: AppTheme.shadow.elevation,
    height: 58,
    justifyContent: 'center',
    position: 'absolute',
    right: 22,
    shadowColor: AppTheme.shadow.color,
    shadowOffset: AppTheme.shadow.offset,
    shadowOpacity: AppTheme.shadow.opacity,
    shadowRadius: AppTheme.shadow.radius,
    width: 58,
  },
  fabDisabled: {
    opacity: 0.58,
  },
  formContent: {
    gap: 16,
    paddingBottom: 20,
  },
  settingCard: {
    paddingVertical: 8,
  },
  pickerGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: AppTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  playerOptions: {
    gap: 8,
  },
  playerOption: {
    alignItems: 'center',
    backgroundColor: AppTheme.colors.inputSurface,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    padding: 10,
  },
  playerOptionSelected: {
    borderColor: AppTheme.colors.primary,
  },
  disabledOption: {
    opacity: 0.42,
  },
  playerOptionText: {
    flex: 1,
  },
  playerOptionName: {
    color: AppTheme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  playerOptionMeta: {
    color: AppTheme.colors.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  courtCard: {
    gap: 12,
  },
  courtHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  baselineDiagram: {
    alignItems: 'center',
    gap: 8,
  },
  courtHint: {
    color: AppTheme.colors.textSubtle,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  courtBox: {
    borderColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radii.md,
    borderWidth: 2,
    height: 180,
    justifyContent: 'space-between',
    overflow: 'hidden',
    width: '100%',
  },
  baselinePlayerFar: {
    alignItems: 'center',
    paddingTop: 16,
  },
  baselinePlayerNear: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  netLine: {
    alignSelf: 'stretch',
    backgroundColor: AppTheme.colors.textMuted,
    height: 2,
  },
  playerMarker: {
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radii.md,
    color: AppTheme.colors.textOnPrimary,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sideDiagram: {
    gap: 8,
  },
  sideCourtBox: {
    alignItems: 'center',
    borderColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radii.md,
    borderWidth: 2,
    flexDirection: 'row',
    height: 150,
    justifyContent: 'space-between',
    overflow: 'hidden',
    paddingHorizontal: 18,
    width: '100%',
  },
  verticalNetLine: {
    alignSelf: 'stretch',
    backgroundColor: AppTheme.colors.textMuted,
    width: 2,
  },
  sidePlayerLeft: {
    flex: 1,
  },
  sidePlayerRight: {
    alignItems: 'flex-end',
    flex: 1,
  },
});
