import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  AccidentDetectionNative,
  accidentEventEmitter,
  AccidentSampleEvent,
} from '../native/AccidentDetectionNative';
import { getContacts } from '../config/api';
import { UserStore } from '../store/userStore';

type EmergencyState = 'idle' | 'countdown' | 'alertSent';

interface UseAccidentDetectionOptions {
  emergencyState: EmergencyState;
  threshold: number;
  cooldownMs: number;
  onAccident: (acceleration: number) => void;
}

async function requestMonitoringPermissions() {
  if (Platform.OS !== 'android') return true;

  const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  if (Platform.Version >= 33) {
    permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  const result = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every(
    permission => result[permission] === PermissionsAndroid.RESULTS.GRANTED,
  );
}

interface EmergencyContact {
  fullName: string;
  relationship?: string;
  phone: string;
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

function formatContactsForNative(contacts: EmergencyContact[]) {
  if (!contacts.length) return 'Chưa có liên hệ khẩn cấp';
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

export function useAccidentDetection({
  emergencyState,
  threshold,
  cooldownMs,
  onAccident,
}: UseAccidentDetectionOptions) {
  const [acceleration, setAcceleration] = useState(0);
  const stateRef = useRef(emergencyState);
  const lastTriggerRef = useRef(0);
  const onAccidentRef = useRef(onAccident);

  useEffect(() => {
    stateRef.current = emergencyState;
  }, [emergencyState]);

  useEffect(() => {
    onAccidentRef.current = onAccident;
  }, [onAccident]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const user = await UserStore.getUser();
      if (!mounted) return;

      const hasPermissions = await requestMonitoringPermissions();
      if (!mounted || !hasPermissions) return;

      let contacts: EmergencyContact[] = [];
      if (user?.id) {
        try {
          const response = await getContacts(user.id);
          contacts = response.data?.data ?? [];
        } catch {
          contacts = [];
        }
      }

      await AccidentDetectionNative.startMonitoring({
        threshold,
        homeLatitude: user?.homeLatitude,
        homeLongitude: user?.homeLongitude,
        homeRadiusMeters: user?.homeRadiusMeters ?? 500,
        emergencyFullName: user?.fullName ?? 'Người dùng SafeGuardian',
        emergencyBloodType: user?.bloodType ?? 'Chưa cập nhật',
        emergencyMedicalNote: user?.medicalNote ?? 'Không có',
        emergencyContactsText: formatContactsForNative(contacts),
      });

      const snapshot = await AccidentDetectionNative.getSnapshot();
      if (mounted) {
        setAcceleration(snapshot.rawAcceleration ?? 0);
        if (snapshot.mode === 'SUSPECT' && stateRef.current === 'idle') {
          lastTriggerRef.current = Date.now();
          onAccidentRef.current(snapshot.rawAcceleration ?? 0);
        }
      }
    })();

    const sampleSub = accidentEventEmitter?.addListener(
      'accidentSample',
      (event: AccidentSampleEvent) => {
        setAcceleration(event.rawAcceleration ?? 0);
      },
    );

    const suspectSub = accidentEventEmitter?.addListener(
      'accidentSuspect',
      (event: AccidentSampleEvent) => {
        const now = Date.now();
        const raw = event.rawAcceleration ?? 0;
        const impact = event.impactAcceleration ?? 0;

        setAcceleration(raw);

        if (
          impact > threshold &&
          stateRef.current === 'idle' &&
          now - lastTriggerRef.current > cooldownMs
        ) {
          lastTriggerRef.current = now;
          onAccidentRef.current(raw);
        }
      },
    );

    return () => {
      mounted = false;
      sampleSub?.remove();
      suspectSub?.remove();
    };
  }, [cooldownMs, threshold]);

  return { acceleration, threshold };
}
