import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { AppInput } from "@/components/ui/app-input";
import { AppModal } from "@/components/ui/app-modal";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { AppTheme } from "@/constants/theme";
import { usePlayers } from "@/contexts/players-context";
import { Gender, Handedness, Player, PlayerFormValues } from "@/types/player";

const emptyForm: PlayerFormValues = {
  firstName: "",
  lastName: "",
  gender: "Male",
  handedness: "Right-handed",
  birthdayDate: "",
  strengths: "",
  weaknesses: "",
  photoUri: "",
};

export default function PlayersScreen() {
  const insets = useSafeAreaInsets();
  const { players, isLoadingPlayers, addPlayer, updatePlayer, deletePlayer } =
    usePlayers();
  const [formVisible, setFormVisible] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [form, setForm] = useState<PlayerFormValues>(emptyForm);
  const [birthdayPickerVisible, setBirthdayPickerVisible] = useState(false);

  const openCreateForm = () => {
    setEditingPlayer(null);
    setForm(emptyForm);
    setFormVisible(true);
  };

  const openEditForm = (player: Player) => {
    setEditingPlayer(player);
    setForm({
      firstName: player.firstName,
      lastName: player.lastName,
      gender: player.gender,
      handedness: player.handedness,
      birthdayDate: player.birthdayDate,
      strengths: player.strengths ?? "",
      weaknesses: player.weaknesses ?? "",
      photoUri: player.photoUri ?? "",
    });
    setFormVisible(true);
  };

  const closeForm = () => {
    setFormVisible(false);
    setEditingPlayer(null);
    setForm(emptyForm);
    setBirthdayPickerVisible(false);
  };

  const savePlayer = () => {
    const nextPlayer = {
      ...form,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      birthdayDate: form.birthdayDate.trim(),
      strengths: form.strengths?.trim(),
      weaknesses: form.weaknesses?.trim(),
      photoUri: form.photoUri?.trim(),
    };

    if (
      !nextPlayer.firstName ||
      !nextPlayer.lastName ||
      !nextPlayer.birthdayDate
    ) {
      Alert.alert(
        "Missing information",
        "First name, last name and birthday date are required.",
      );
      return;
    }

    if (!isValidBirthdayDate(nextPlayer.birthdayDate)) {
      Alert.alert(
        "Invalid birthday date",
        "Use YYYY-MM-DD and choose a real date.",
      );
      return;
    }

    if (nextPlayer.photoUri && !isValidPhotoUrl(nextPlayer.photoUri)) {
      Alert.alert(
        "Invalid photo URL",
        "Photo must be a valid http or https URL.",
      );
      return;
    }

    if (editingPlayer) {
      updatePlayer(editingPlayer.id, nextPlayer);
    } else {
      addPlayer(nextPlayer);
    }

    closeForm();
  };

  const confirmDeletePlayer = (player: Player) => {
    Alert.alert(
      "Delete player",
      `Delete ${player.firstName} ${player.lastName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deletePlayer(player.id);
            closeForm();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          style={styles.iconButton}
          onPress={() => router.replace("/mode")}
        >
          <MaterialIcons
            name="arrow-back"
            size={22}
            color={AppTheme.colors.primary}
          />
        </Pressable>
        <View>
          <Text style={styles.kicker}>Service Score</Text>
          <Text style={styles.title}>Players</Text>
        </View>
        <Pressable
          style={styles.profileButton}
          onPress={() => Alert.alert("Profile", "Profile screen coming soon.")}
        >
          <MaterialIcons
            name="person"
            size={22}
            color={AppTheme.colors.textOnPrimary}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 108 + Math.max(insets.bottom, 12) },
        ]}
      >
        <AppCard
          tone={players.length >= 2 ? "default" : "gold"}
          style={styles.notice}
        >
          <MaterialIcons
            name={players.length >= 2 ? "check-circle" : "info-outline"}
            size={20}
            color={
              players.length >= 2
                ? AppTheme.colors.success
                : AppTheme.colors.primary
            }
          />
          <Text style={styles.noticeText}>
            {players.length >= 2
              ? "You have enough players to create a match."
              : `Create ${2 - players.length} more player${players.length === 1 ? "" : "s"} before starting a match.`}
          </Text>
        </AppCard>

        {isLoadingPlayers ? (
          <AppCard style={styles.emptyState}>
            <MaterialIcons
              name="storage"
              size={32}
              color={AppTheme.colors.primary}
            />
            <Text style={styles.emptyTitle}>Loading saved players</Text>
            <Text style={styles.emptyText}>
              Your local player profiles are being restored.
            </Text>
          </AppCard>
        ) : players.length === 0 ? (
          <AppCard style={styles.emptyState}>
            <PlayerAvatar size={58} />
            <Text style={styles.emptyTitle}>No players yet</Text>
            <Text style={styles.emptyText}>
              Create your first players to prepare the match setup.
            </Text>
            <AppButton
              title="Create player"
              icon="add"
              onPress={openCreateForm}
            />
          </AppCard>
        ) : (
          players.map((player) => (
            <Pressable key={player.id} onPress={() => openEditForm(player)}>
              <AppCard style={styles.playerCard}>
                <PlayerAvatar photoUri={player.photoUri} />
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>
                    {player.firstName} {player.lastName}
                  </Text>
                  <Text style={styles.playerMeta}>
                    {player.gender} - {player.handedness}
                  </Text>
                  <Text style={styles.playerMeta}>
                    Birthday: {player.birthdayDate}
                  </Text>
                </View>
                <MaterialIcons
                  name="edit"
                  size={22}
                  color={AppTheme.colors.primary}
                />
              </AppCard>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Pressable
        style={[styles.fab, { bottom: 40 + Math.max(insets.bottom) }]}
        onPress={openCreateForm}
      >
        <MaterialIcons
          name="add"
          size={32}
          color={AppTheme.colors.textOnPrimary}
        />
      </Pressable>

      <AppModal
        title={editingPlayer ? "Edit player" : "New player"}
        visible={formVisible}
        onClose={closeForm}
      >
        <ScrollView
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarPreview}>
            <PlayerAvatar photoUri={form.photoUri} size={72} />
            <Text style={styles.avatarText}>
              Photo is optional. Leave empty to use the default icon.
            </Text>
          </View>

          <AppInput
            label="First Name"
            placeholder="Rafael"
            value={form.firstName}
            onChangeText={(firstName) =>
              setForm((current) => ({ ...current, firstName }))
            }
          />
          <AppInput
            label="Last Name"
            placeholder="Nadal"
            value={form.lastName}
            onChangeText={(lastName) =>
              setForm((current) => ({ ...current, lastName }))
            }
          />

          <SegmentedControl<Gender>
            label="Gender"
            value={form.gender}
            onChange={(gender) =>
              setForm((current) => ({ ...current, gender }))
            }
            options={[
              { label: "Male", value: "Male" },
              { label: "Female", value: "Female" },
              { label: "Other", value: "Other" },
            ]}
          />

          <SegmentedControl<Handedness>
            label="Handedness"
            value={form.handedness}
            onChange={(handedness) =>
              setForm((current) => ({ ...current, handedness }))
            }
            options={[
              { label: "Right", value: "Right-handed" },
              { label: "Left", value: "Left-handed" },
              { label: "Both", value: "Ambidextrous" },
            ]}
          />

          <View style={styles.datePickerGroup}>
            <Text style={styles.fieldLabel}>Birthday date</Text>
            <Pressable
              style={styles.datePickerButton}
              onPress={() => setBirthdayPickerVisible(true)}
            >
              <View>
                <Text
                  style={[
                    styles.datePickerValue,
                    !form.birthdayDate && styles.datePickerPlaceholder,
                  ]}
                >
                  {form.birthdayDate || "Select birthday date"}
                </Text>
                <Text style={styles.datePickerHint}>YYYY-MM-DD</Text>
              </View>
              <MaterialIcons
                name="calendar-month"
                size={22}
                color={AppTheme.colors.primary}
              />
            </Pressable>

            {birthdayPickerVisible ? (
              <DateTimePicker
                value={parseBirthdayDate(form.birthdayDate)}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={(_, selectedDate) => {
                  if (!selectedDate) {
                    setBirthdayPickerVisible(false);
                    return;
                  }

                  setForm((current) => ({
                    ...current,
                    birthdayDate: formatBirthdayDate(selectedDate),
                  }));
                  setBirthdayPickerVisible(false);
                }}
              />
            ) : null}
          </View>

          <AppInput
            label="Photo"
            placeholder="Photo URL optional"
            value={form.photoUri}
            onChangeText={(photoUri) =>
              setForm((current) => ({ ...current, photoUri }))
            }
          />

          <View style={styles.textAreaGroup}>
            <Text style={styles.fieldLabel}>Strengths optional</Text>
            <TextInput
              multiline
              placeholder="Serve, forehand, return..."
              placeholderTextColor={AppTheme.colors.placeholder}
              style={styles.textArea}
              value={form.strengths}
              onChangeText={(strengths) =>
                setForm((current) => ({ ...current, strengths }))
              }
            />
          </View>

          <View style={styles.textAreaGroup}>
            <Text style={styles.fieldLabel}>Weaknesses optional</Text>
            <TextInput
              multiline
              placeholder="Second serve, backhand under pressure..."
              placeholderTextColor={AppTheme.colors.placeholder}
              style={styles.textArea}
              value={form.weaknesses}
              onChangeText={(weaknesses) =>
                setForm((current) => ({ ...current, weaknesses }))
              }
            />
          </View>

          <View style={styles.formActions}>
            {editingPlayer ? (
              <AppButton
                title="Delete"
                icon="delete"
                variant="danger"
                onPress={() => confirmDeletePlayer(editingPlayer)}
              />
            ) : null}
            <AppButton
              title={editingPlayer ? "Save changes" : "Create player"}
              icon="check"
              onPress={savePlayer}
            />
          </View>
        </ScrollView>
      </AppModal>
    </SafeAreaView>
  );
}

function isValidBirthdayDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime()) || date > new Date()) {
    return false;
  }

  return date.toISOString().slice(0, 10) === value;
}

function parseBirthdayDate(value: string) {
  if (!isValidBirthdayDate(value)) {
    return new Date(2000, 0, 1);
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatBirthdayDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isValidPhotoUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  iconButton: {
    alignItems: "center",
    borderColor: AppTheme.colors.borderGold,
    borderRadius: AppTheme.radii.lg,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  profileButton: {
    alignItems: "center",
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radii.lg,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  kicker: {
    color: AppTheme.colors.textSubtle,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
    textAlign: "center",
    textTransform: "uppercase",
  },
  title: {
    color: AppTheme.colors.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
  },
  content: {
    gap: 14,
    paddingHorizontal: 20,
  },
  notice: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  noticeText: {
    color: AppTheme.colors.text,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: "center",
    gap: 12,
    padding: 22,
  },
  emptyTitle: {
    color: AppTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  emptyText: {
    color: AppTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  playerCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: AppTheme.colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  playerMeta: {
    color: AppTheme.colors.textSubtle,
    fontSize: 13,
    marginTop: 3,
  },
  fab: {
    alignItems: "center",
    backgroundColor: AppTheme.colors.primary,
    borderRadius: 28,
    elevation: AppTheme.shadow.elevation,
    height: 58,
    justifyContent: "center",
    position: "absolute",
    right: 22,
    shadowColor: AppTheme.shadow.color,
    shadowOffset: AppTheme.shadow.offset,
    shadowOpacity: AppTheme.shadow.opacity,
    shadowRadius: AppTheme.shadow.radius,
    width: 58,
  },
  formContent: {
    gap: 16,
    paddingBottom: 20,
  },
  avatarPreview: {
    alignItems: "center",
    gap: 8,
  },
  avatarText: {
    color: AppTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  textAreaGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: AppTheme.colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  datePickerGroup: {
    gap: 8,
  },
  datePickerButton: {
    alignItems: "center",
    backgroundColor: AppTheme.colors.inputSurface,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radii.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  datePickerValue: {
    color: AppTheme.colors.text,
    fontSize: AppTheme.typography.input,
    fontWeight: "800",
  },
  datePickerPlaceholder: {
    color: AppTheme.colors.placeholder,
  },
  datePickerHint: {
    color: AppTheme.colors.textSubtle,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
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
    textAlignVertical: "top",
  },
  formActions: {
    gap: 10,
  },
});
