import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { BASE_URL, getContacts } from '../config/api';
import {
  AccidentDetectionNative,
  accidentEventEmitter,
  AccidentMlResultEvent,
  AccidentSampleEvent,
  AccidentSuspectEvent,
} from '../native/AccidentDetectionNative';
import { UserStore } from '../store/userStore';

const DEFAULT_THRESHOLD = 0.35;

export interface AccidentEvent {
  acceleration: number;
  confidence: number;
  timestamp: number;
  mlProbability?: number;
  modelVersion?: string;
  detectionMethod: 'cnn-lstm' | 'simulation';
  skipCountdown?: boolean;
  latitude?: number;
  longitude?: number;
}

async function requestMonitoringPermissions() {
  if (Platform.OS !== 'android') return;

  const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  if (Platform.Version >= 33) {
    permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  const result = await PermissionsAndroid.requestMultiple(permissions);
  const locationGranted =
    result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
    PermissionsAndroid.RESULTS.GRANTED;

  if (!locationGranted) {
    console.warn(
      '[AccidentDetection] Location denied; background GPS disabled, native ML sensors still active.',
    );
  }
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

export function useAccidentDetection(
  onDetected: (event: AccidentEvent) => void,
  onCancelled?: () => void,
) {
  const [acceleration, setAcceleration] = useState(0);
  const [mlReady, setMlReady] = useState(false);
  const [lastProbability, setLastProbability] = useState<number | null>(null);
  const [modelVersion, setModelVersion] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [gyroAvailable, setGyroAvailable] = useState<boolean | null>(null);
  const [mlThreshold, setMlThreshold] = useState(DEFAULT_THRESHOLD);

  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const onCancelledRef = useRef(onCancelled);
  onCancelledRef.current = onCancelled;
  const lastTriggerRef = useRef(0);

  const handleSuspect = (
    rawAcceleration: number,
    probability?: number,
    version?: string,
    extra?: { skipCountdown?: boolean; latitude?: number; longitude?: number },
  ) => {
    const now = Date.now();
    if (!extra?.skipCountdown && now - lastTriggerRef.current < 8000) return;
    lastTriggerRef.current = now;
    onDetectedRef.current({
      acceleration: rawAcceleration,
      confidence: Math.round(Math.min(1, probability ?? 0) * 100),
      timestamp: now,
      mlProbability: probability,
      modelVersion: version,
      detectionMethod: 'cnn-lstm',
      skipCountdown: extra?.skipCountdown,
      latitude: extra?.latitude,
      longitude: extra?.longitude,
    });
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      await requestMonitoringPermissions();
      if (!mounted) return;

      const user = await UserStore.getUser();
      if (!mounted) return;

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
        apiBaseUrl: BASE_URL,
        homeLatitude: user?.homeLatitude,
        homeLongitude: user?.homeLongitude,
        homeRadiusMeters: user?.homeRadiusMeters ?? 500,
        emergencyFullName: user?.fullName ?? 'Người dùng SafeGuardian',
        emergencyBloodType: user?.bloodType ?? 'Chưa cập nhật',
        emergencyMedicalNote: user?.medicalNote ?? 'Không có',
        emergencyContactsText: formatContactsForNative(contacts),
      });

      const snapshot = await AccidentDetectionNative.getSnapshot();
      if (!mounted) return;
      setAcceleration(snapshot.rawAcceleration ?? 0);
      setMlReady(!!snapshot.mlReady);
      setGyroAvailable(snapshot.gyroAvailable ?? null);
      setOfflineMode(!snapshot.mlReady);
      if (snapshot.mlThreshold) setMlThreshold(snapshot.mlThreshold);
      if (snapshot.mlProbability != null) setLastProbability(snapshot.mlProbability);
      if (snapshot.modelVersion) setModelVersion(snapshot.modelVersion);
      if (snapshot.mode === 'SUSPECT') {
        handleSuspect(snapshot.rawAcceleration ?? 0, snapshot.mlProbability, snapshot.modelVersion);
      }
    })();

    const sampleSub = accidentEventEmitter?.addListener(
      'accidentSample',
      (event: AccidentSampleEvent) => {
        setAcceleration(event.rawAcceleration ?? 0);
        if (event.mlReady != null) {
          setMlReady(event.mlReady);
          setOfflineMode(!event.mlReady);
        }
        if (event.gyroAvailable != null) setGyroAvailable(event.gyroAvailable);
        if (event.mlProbability != null) setLastProbability(event.mlProbability);
      },
    );

    const mlSub = accidentEventEmitter?.addListener(
      'accidentMlResult',
      (event: AccidentMlResultEvent) => {
        setMlReady(true);
        setOfflineMode(false);
        setLastProbability(event.probability);
        setMlThreshold(event.threshold);
        setGyroAvailable(event.gyroAvailable);
        if (event.modelVersion) setModelVersion(event.modelVersion);
        console.log(
          `[AccidentDetection] ML p=${event.probability.toFixed(3)} accident=${event.accident} threshold=${event.threshold}` +
          ` lastAccel=${event.lastAccel.toFixed(1)} m/s² peakAccel=${event.peakAccel.toFixed(1)} m/s² impact=${event.impact.toFixed(1)} m/s²`,
        );
      },
    );

    const statusSub = accidentEventEmitter?.addListener(
      'accidentMlStatus',
      (event: { mlReady?: boolean; gyroAvailable?: boolean; threshold?: number; modelVersion?: string }) => {
        setMlReady(!!event.mlReady);
        setOfflineMode(!event.mlReady);
        if (event.gyroAvailable != null) setGyroAvailable(event.gyroAvailable);
        if (event.threshold != null) setMlThreshold(event.threshold);
        if (event.modelVersion) setModelVersion(event.modelVersion);
      },
    );

    const suspectSub = accidentEventEmitter?.addListener(
      'accidentSuspect',
      (event: AccidentSuspectEvent) => {
        console.log(
          `[AccidentDetection] Native ML suspect peakAccel=${(event.rawAcceleration ?? 0).toFixed(1)} p=${event.mlProbability ?? 'n/a'}`,
        );
        handleSuspect(event.rawAcceleration ?? 0, event.mlProbability, event.modelVersion);
      },
    );

    const timeoutSub = accidentEventEmitter?.addListener(
      'accidentCountdownTimeout',
      (event: AccidentSuspectEvent) => {
        console.log(
          `[AccidentDetection] Native SOS timeout peakAccel=${(event.rawAcceleration ?? 0).toFixed(1)} p=${event.mlProbability ?? 'n/a'}`,
        );
        handleSuspect(event.rawAcceleration ?? 0, event.mlProbability, event.modelVersion, {
          skipCountdown: true,
          latitude: event.latitude,
          longitude: event.longitude,
        });
      },
    );

    const cancelledSub = accidentEventEmitter?.addListener('accidentCancelled', () => {
      onCancelledRef.current?.();
    });

    return () => {
      mounted = false;
      sampleSub?.remove();
      mlSub?.remove();
      statusSub?.remove();
      suspectSub?.remove();
      timeoutSub?.remove();
      cancelledSub?.remove();
    };
  }, []);

  return {
    acceleration,
    mlReady,
    lastProbability,
    modelVersion,
    offlineMode,
    gyroAvailable,
    mlThreshold,
  };
}
