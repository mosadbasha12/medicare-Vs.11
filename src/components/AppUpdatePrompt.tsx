import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { checkForAppUpdate, RemoteAppVersion } from '../services/updateService';

export default function AppUpdatePrompt() {
  const [update, setUpdate] = useState<RemoteAppVersion | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    checkForAppUpdate()
      .then(setUpdate)
      .catch(() => {
        setUpdate(null);
      });
  }, []);

  if (!update) return null;

  const openDownload = async () => {
    setOpening(true);
    try {
      await Linking.openURL(update.apkUrl);
    } finally {
      setOpening(false);
    }
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => !update.force && setUpdate(null)}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <View style={styles.iconBadge}>
            <FontAwesome5 name="download" size={22} color={COLORS.primaryLight} />
          </View>
          <Text style={styles.title}>تحديث جديد متاح</Text>
          <Text style={styles.message}>
            يوجد إصدار أحدث من Medicare رقم {update.versionName}. حمّل ملف APK وثبته فوق النسخة الحالية.
          </Text>
          {!!update.notes && <Text style={styles.notes}>{update.notes}</Text>}

          <TouchableOpacity style={styles.primaryButton} onPress={openDownload} disabled={opening}>
            {opening ? (
              <ActivityIndicator color={COLORS.textPrimary} />
            ) : (
              <Text style={styles.primaryButtonText}>تحميل التحديث</Text>
            )}
          </TouchableOpacity>

          {!update.force && (
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setUpdate(null)}>
              <Text style={styles.secondaryButtonText}>لاحقا</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    padding: 24,
  },
  panel: {
    backgroundColor: COLORS.bgBase,
    borderColor: COLORS.borderColor,
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  notes: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    marginTop: 22,
    width: '100%',
  },
  primaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
