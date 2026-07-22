import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ScoreModeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.replace('/')}>
          <MaterialIcons name="logout" size={21} color="#F8C537" />
        </Pressable>
        <Pressable style={styles.profileButton}>
          <MaterialIcons name="person" size={22} color="#07101F" />
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.kicker}>Choose scoreboard</Text>
        <Text style={styles.title}>What do you want to track?</Text>
      </View>

      <View style={styles.options}>
        <Pressable style={styles.optionCard} onPress={() => router.replace('/(tabs)')}>
          <View style={styles.optionIcon}>
            <MaterialIcons name="sports-tennis" size={28} color="#07101F" />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Service Score</Text>
            <Text style={styles.optionText}>Track first serve, second serve, aces, faults and winners.</Text>
          </View>
          <MaterialIcons name="chevron-right" size={25} color="#F8C537" />
        </Pressable>

        <View style={[styles.optionCard, styles.disabledCard]}>
          <View style={[styles.optionIcon, styles.disabledIcon]}>
            <MaterialIcons name="query-stats" size={28} color="#8D99AE" />
          </View>
          <View style={styles.optionContent}>
            <Text style={[styles.optionTitle, styles.disabledText]}>Global Score</Text>
            <Text style={styles.optionText}>Coming later for full rally and match scoring.</Text>
          </View>
          <Text style={styles.comingSoon}>Soon</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#07101F',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  titleBlock: {
    marginTop: 58,
  },
  kicker: {
    color: '#F8C537',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F7F9FC',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 40,
  },
  options: {
    gap: 14,
    marginTop: 34,
  },
  optionCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.13)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 104,
    padding: 16,
  },
  disabledCard: {
    opacity: 0.68,
  },
  optionIcon: {
    alignItems: 'center',
    backgroundColor: '#F8C537',
    borderRadius: 8,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  disabledIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  optionContent: {
    flex: 1,
    gap: 5,
  },
  optionTitle: {
    color: '#F7F9FC',
    fontSize: 18,
    fontWeight: '900',
  },
  disabledText: {
    color: '#C6CEDB',
  },
  optionText: {
    color: '#AAB5C8',
    fontSize: 13,
    lineHeight: 19,
  },
  comingSoon: {
    color: '#F8C537',
    fontSize: 12,
    fontWeight: '900',
  },
});
