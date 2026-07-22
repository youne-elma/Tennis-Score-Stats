import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.brandBlock}>
        <View style={styles.logoMark}>
          <MaterialIcons name="sports-tennis" size={34} color="#07101F" />
        </View>
        <Text style={styles.appName}>Tennis Score Stats</Text>
        <Text style={styles.subtitle}>Track service score and match performance.</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Account name</Text>
          <TextInput
            autoCapitalize="none"
            placeholder="coach.kamal"
            placeholderTextColor="#6E7B91"
            style={styles.input}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            placeholder="Password"
            placeholderTextColor="#6E7B91"
            secureTextEntry
            style={styles.input}
          />
        </View>

        <Pressable style={styles.primaryButton} onPress={() => router.replace('/mode')}>
          <Text style={styles.primaryButtonText}>Login</Text>
          <MaterialIcons name="arrow-forward" size={21} color="#07101F" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#07101F',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 34,
  },
  brandBlock: {
    paddingTop: 32,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: '#F8C537',
    borderRadius: 8,
    height: 64,
    justifyContent: 'center',
    marginBottom: 22,
    width: 64,
  },
  appName: {
    color: '#F7F9FC',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 42,
  },
  subtitle: {
    color: '#AAB5C8',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 300,
  },
  form: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 18,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: '#DCE4F2',
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    backgroundColor: 'rgba(7, 16, 31, 0.72)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    color: '#F7F9FC',
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#F8C537',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonText: {
    color: '#07101F',
    fontSize: 16,
    fontWeight: '900',
  },
});
