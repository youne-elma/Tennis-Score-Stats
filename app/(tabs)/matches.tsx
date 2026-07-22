import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MatchesScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.replace('/mode')}>
          <MaterialIcons name="arrow-back" size={22} color="#F8C537" />
        </Pressable>
        <View>
          <Text style={styles.kicker}>Service Score</Text>
          <Text style={styles.title}>Matches</Text>
        </View>
        <Pressable style={styles.profileButton} onPress={() => Alert.alert('Profile', 'Profile screen coming soon.')}>
          <MaterialIcons name="person" size={22} color="#07101F" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroPanel}>
          <MaterialIcons name="sports-tennis" size={34} color="#F8C537" />
          <Text style={styles.heroTitle}>No match yet</Text>
          <Text style={styles.heroText}>
            Use the + button to create a tennis match once you have at least two players.
          </Text>
        </View>

        <View style={styles.matchPreview}>
          <View style={styles.matchHeader}>
            <Text style={styles.sectionTitle}>Next in task 4</Text>
            <Text style={styles.badge}>Planned</Text>
          </View>
          <Text style={styles.bodyText}>
            Match creation will include Player 1, Player 2, sets, games per set, tiebreaks,
            deuce scoring and court viewing position.
          </Text>
        </View>

        <View style={styles.statsPreview}>
          <Text style={styles.sectionTitle}>Stats area</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Points</Text>
            <Text style={styles.statValue}>--</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>First serve %</Text>
            <Text style={styles.statValue}>--</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Aces</Text>
            <Text style={styles.statValue}>--</Text>
          </View>
        </View>
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={() => Alert.alert('New match', 'Match creation form will be built in task 4.')}>
        <MaterialIcons name="add" size={32} color="#07101F" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#07101F',
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
    borderColor: 'rgba(248, 197, 55, 0.28)',
    borderRadius: 18,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  profileButton: {
    alignItems: 'center',
    backgroundColor: '#F8C537',
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  kicker: {
    color: '#8D99AE',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  title: {
    color: '#F7F9FC',
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
  heroPanel: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    padding: 22,
  },
  heroTitle: {
    color: '#F7F9FC',
    fontSize: 21,
    fontWeight: '800',
    marginTop: 12,
  },
  heroText: {
    color: '#DCE4F2',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  matchPreview: {
    backgroundColor: 'rgba(248, 197, 55, 0.08)',
    borderColor: 'rgba(248, 197, 55, 0.18)',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  matchHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#F8C537',
    fontSize: 15,
    fontWeight: '800',
  },
  badge: {
    backgroundColor: 'rgba(248, 197, 55, 0.14)',
    borderRadius: 8,
    color: '#F8C537',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  bodyText: {
    color: '#DCE4F2',
    fontSize: 14,
    lineHeight: 21,
  },
  statsPreview: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  statRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    color: '#DCE4F2',
    fontSize: 14,
  },
  statValue: {
    color: '#F7F9FC',
    fontSize: 16,
    fontWeight: '800',
  },
  fab: {
    alignItems: 'center',
    backgroundColor: '#F8C537',
    borderRadius: 28,
    bottom: 92,
    elevation: 8,
    height: 58,
    justifyContent: 'center',
    position: 'absolute',
    right: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    width: 58,
  },
});
