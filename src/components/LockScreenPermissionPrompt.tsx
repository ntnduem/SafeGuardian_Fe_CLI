import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { AccidentDetectionNative } from '../native/AccidentDetectionNative';
import { styles } from './LockScreenPermissionPrompt.styles';

async function requestNotificationPermission() {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function hasNotificationPermission() {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return true;
  }

  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
}

export default function LockScreenPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [needsFullScreenSettings, setNeedsFullScreenSettings] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (Platform.OS !== 'android' || dismissed) {
      return;
    }

    const [status, notificationGranted] = await Promise.all([
      AccidentDetectionNative.getLockScreenPermissionStatus(),
      hasNotificationPermission(),
    ]);
    const needsFullScreenPermission =
      status.requiresFullScreenPermission && !status.canUseFullScreenIntent;

    setNeedsFullScreenSettings(needsFullScreenPermission);
    setVisible(!notificationGranted || needsFullScreenPermission);
  }, [dismissed]);

  useEffect(() => {
    refreshStatus();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refreshStatus();
      }
    });

    return () => subscription.remove();
  }, [refreshStatus]);

  const handleAllow = async () => {
    await requestNotificationPermission();
    if (needsFullScreenSettings) {
      await AccidentDetectionNative.openLockScreenPermissionSettings();
      return;
    }
    refreshStatus();
  };

  const handleLater = () => {
    setDismissed(true);
    setVisible(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Cấp quyền hiển thị cảnh báo</Text>
          <Text style={styles.description}>
            SafeGuardian cần quyền thông báo toàn màn hình để mở giao diện hồ sơ y tế và
            liên hệ khẩn cấp ngay trên màn hình khóa khi phát hiện tai nạn.
          </Text>
          <Text style={styles.hint}>
            Ở màn hình cài đặt tiếp theo, hãy bật mục thông báo toàn màn hình cho SafeGuardian.
          </Text>

          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.secondaryButton]} onPress={handleLater}>
              <Text style={styles.secondaryText}>Để sau</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.primaryButton]} onPress={handleAllow}>
              <Text style={styles.primaryText}>Cấp quyền</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
