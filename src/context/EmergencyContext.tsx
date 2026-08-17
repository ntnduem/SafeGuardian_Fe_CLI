import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Modal } from 'react-native';
import CountdownScreen from '../screens/emergency/CountdownScreen';
import AlertSentScreen from '../screens/emergency/AlertSentScreen';
import { UserStore } from '../store/userStore';
import { sendSimulationAlert, sendAccidentAlert, createAccidentEvent, getContacts } from '../config/api';
import { AccidentEvent, useAccidentDetection } from '../hooks/useAccidentDetection';
import { AccidentDetectionNative } from '../native/AccidentDetectionNative';

type EmergencyState = 'idle' | 'countdown' | 'alertSent';
export const ML_ACCIDENT_THRESHOLD = 0.35;

interface EmergencyContextType {
  state: EmergencyState;
  acceleration: number;
  mlReady: boolean;
  lastProbability: number | null;
  offlineMode: boolean;
  gyroAvailable: boolean | null;
  mlThreshold: number;
  triggerAccident: (acceleration?: number, extras?: Partial<AccidentEvent>) => void;
  cancelEmergency: () => void;
}

const EmergencyContext = createContext<EmergencyContextType>({
  state: 'idle',
  acceleration: 0,
  mlReady: false,
  lastProbability: null,
  offlineMode: true,
  gyroAvailable: null,
  mlThreshold: ML_ACCIDENT_THRESHOLD,
  triggerAccident: () => {},
  cancelEmergency: () => {},
});

export const useEmergency = () => useContext(EmergencyContext);

interface AlertInfo {
  alertId: string | null;
  latitude: number;
  longitude: number;
  acceleration: number;
}

interface AlertExtras {
  mlProbability?: number;
  modelVersion?: string;
  detectionMethod?: string;
}

interface EmergencyContact {
  fullName: string;
  relationship?: string;
  phone: string;
  email?: string;
  isPrimary?: boolean;
}

function relationshipLabel(value?: string) {
  const map: Record<string, string> = {
    Father: 'Cha',
    Mother: 'Mẹ',
    Brother: 'Anh/Em trai',
    Sister: 'Chị/Em gái',
    Spouse: 'Vợ/Chồng',
    Friend: 'Bạn bè',
    Other: 'Khác',
  };
  return value ? (map[value] ?? value) : 'Liên hệ';
}

function formatEmergencyContacts(contacts: EmergencyContact[]) {
  if (!contacts.length) {
    return 'Chưa có liên hệ khẩn cấp';
  }

  return contacts
    .slice()
    .sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary))
    .slice(0, 3)
    .map(contact => {
      const primary = contact.isPrimary ? ' - chính' : '';
      return `${contact.fullName} (${relationshipLabel(contact.relationship)}${primary}): ${contact.phone}`;
    })
    .join('\n');
}

export function EmergencyProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EmergencyState>('idle');
  const [alertInfo, setAlertInfo] = useState<AlertInfo>({
    alertId: null, latitude: 0, longitude: 0, acceleration: 0,
  });
  const accelerationRef = useRef<number>(0);
  const extrasRef = useRef<AlertExtras>({});
  const stateRef = useRef<EmergencyState>('idle');
  stateRef.current = state;

  const triggerAccident = useCallback((acceleration = 0, extras?: Partial<AccidentEvent>) => {
    if (stateRef.current !== 'idle') return;

    const isSimulation = acceleration === 0 && extras?.detectionMethod !== 'cnn-lstm';
    const isMlConfirmed = extras?.detectionMethod === 'cnn-lstm';

    if (!isSimulation && !isMlConfirmed) {
      console.warn('[Emergency] Blocked alert: only ML-confirmed accidents trigger notifications');
      return;
    }

    accelerationRef.current = acceleration;
    extrasRef.current = {
      mlProbability: extras?.mlProbability,
      modelVersion: extras?.modelVersion,
      detectionMethod: extras?.detectionMethod ?? (isSimulation ? 'simulation' : 'cnn-lstm'),
    };
    setState('countdown');
  }, []);

  const cancelEmergency = useCallback(() => {
    AccidentDetectionNative.markSafe();
    AccidentDetectionNative.clearEmergencyLockScreen();
    setState('idle');
  }, []);

  const onCountdownEnd = useCallback(async (lat: number, lng: number, accel: number) => {
    const extras = extrasRef.current;
    try {
      await AccidentDetectionNative.markEmergency();
      const user = await UserStore.getUser();
      const userId = user?.id ?? await UserStore.getUserId();
      if (!userId) return;

      let contacts: EmergencyContact[] = [];
      try {
        const contactRes = await getContacts(userId);
        contacts = contactRes.data?.data ?? [];
      } catch {
        contacts = [];
      }

      await AccidentDetectionNative.showEmergencyLockScreen({
        fullName: user?.fullName ?? 'Người dùng SafeGuardian',
        bloodType: user?.bloodType ?? 'Chưa cập nhật',
        medicalNote: user?.medicalNote ?? 'Không có',
        contactsText: formatEmergencyContacts(contacts),
        locationText: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      });

      const eventRes = await createAccidentEvent({
        userId,
        eventType: 'STRONG_IMPACT',
        acceleration: accel,
        threshold: extras.mlProbability != null ? ML_ACCIDENT_THRESHOLD : 0,
        latitude: lat,
        longitude: lng,
        mlProbability: extras.mlProbability,
        modelVersion: extras.modelVersion,
        detectionMethod: extras.detectionMethod ?? (accel > 0 ? 'cnn-lstm' : 'simulation'),
        isConfirmedAccident: true,
      });
      const eventId = eventRes.data?.data?.id ?? null;

      const res = accel > 0
        ? await sendAccidentAlert(userId, eventId, lat, lng, accel)
        : await sendSimulationAlert(userId, lat, lng);

      const alertId = res.data?.data?.id ?? null;
      setAlertInfo({ alertId, latitude: lat, longitude: lng, acceleration: accel });
      setState('alertSent');
    } catch (e) {
      console.error('Emergency alert error:', e);
      setState('alertSent');
    }
  }, []);

  const onNativeAccident = useCallback((event: AccidentEvent) => {
    if (event.skipCountdown) {
      extrasRef.current = {
        mlProbability: event.mlProbability,
        modelVersion: event.modelVersion,
        detectionMethod: event.detectionMethod,
      };
      accelerationRef.current = event.acceleration;
      onCountdownEnd(event.latitude ?? 0, event.longitude ?? 0, event.acceleration);
      return;
    }
    triggerAccident(event.acceleration, event);
  }, [onCountdownEnd, triggerAccident]);

  const onNativeCancelled = useCallback(() => {
    AccidentDetectionNative.clearEmergencyLockScreen();
    setState('idle');
  }, []);

  const { acceleration, mlReady, lastProbability, offlineMode, gyroAvailable, mlThreshold } =
    useAccidentDetection(onNativeAccident, onNativeCancelled);

  return (
    <EmergencyContext.Provider value={{
      state,
      acceleration,
      mlReady,
      lastProbability,
      offlineMode,
      gyroAvailable,
      mlThreshold,
      triggerAccident,
      cancelEmergency,
    }}>
      {children}

      <Modal visible={state === 'countdown'} animationType="slide" statusBarTranslucent>
        <CountdownScreen
          acceleration={accelerationRef.current}
          onSafe={cancelEmergency}
          onTimeout={onCountdownEnd}
        />
      </Modal>

      <Modal visible={state === 'alertSent'} animationType="fade" statusBarTranslucent>
        <AlertSentScreen
          alertId={alertInfo.alertId}
          latitude={alertInfo.latitude}
          longitude={alertInfo.longitude}
          onDismiss={cancelEmergency}
        />
      </Modal>
    </EmergencyContext.Provider>
  );
}
