import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Modal, Pressable, StyleSheet, Text, View, type ModalProps } from 'react-native';

import { AppTheme } from '@/constants/theme';

type AppModalProps = ModalProps & {
  title: string;
  visible: boolean;
  onClose: () => void;
};

export function AppModal({ title, visible, onClose, children, ...props }: AppModalProps) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose} {...props}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <MaterialIcons name="close" size={22} color={AppTheme.colors.primary} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: AppTheme.colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: AppTheme.colors.background,
    borderColor: AppTheme.colors.border,
    borderTopLeftRadius: AppTheme.radii.lg,
    borderTopRightRadius: AppTheme.radii.lg,
    borderWidth: 1,
    gap: 18,
    maxHeight: '88%',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: AppTheme.colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: AppTheme.colors.surface,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radii.lg,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
});
