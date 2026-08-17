import { NativeEventEmitter, NativeModules } from 'react-native';

export type AccidentMode = 'HOME' | 'OUTDOOR' | 'SUSPECT' | 'EMERGENCY';

export interface AccidentSampleEvent {
  rawAcceleration: number;
  impactAcceleration: number;
  mode: AccidentMode;
  mlReady?: boolean;
  gyroAvailable?: boolean;
  mlProbability?: number;
  latitude?: number;
  longitude?: number;
}

export interface AccidentMlResultEvent {
  accident: boolean;
  probability: number;
  threshold: number;
  lastAccel: number;
  peakAccel: number;
  impact: number;
  mlReady: boolean;
  gyroAvailable: boolean;
  modelVersion?: string;
}

export interface AccidentSuspectEvent extends AccidentSampleEvent {
  mlProbability?: number;
  modelVersion?: string;
  detectionMethod?: string;
}

interface StartMonitoringConfig {
  apiBaseUrl: string;
  homeLatitude?: number;
  homeLongitude?: number;
  homeRadiusMeters?: number;
  emergencyFullName?: string;
  emergencyBloodType?: string;
  emergencyMedicalNote?: string;
  emergencyContactsText?: string;
}

export interface EmergencyLockScreenInfo {
  fullName: string;
  bloodType: string;
  medicalNote: string;
  contactsText: string;
  locationText: string;
}

export interface AlarmVolumeInfo {
  stream: 'ALARM';
  currentVolume: number;
  maxVolume: number;
  volumePercent: number;
}

export interface LockScreenPermissionStatus {
  requiresFullScreenPermission: boolean;
  canUseFullScreenIntent: boolean;
}

export interface AccidentSnapshot extends AccidentSampleEvent {
  mlReady?: boolean;
  gyroAvailable?: boolean;
  mlThreshold?: number;
  modelVersion?: string;
}

interface AccidentDetectionModule {
  startMonitoring(config: StartMonitoringConfig): Promise<boolean>;
  stopMonitoring(): Promise<boolean>;
  markSafe(): Promise<boolean>;
  markEmergency(): Promise<boolean>;
  notifyMlSuspect(rawAcceleration: number, impactAcceleration: number): Promise<boolean>;
  playCountdownSound(): Promise<boolean>;
  stopCountdownSound(): Promise<boolean>;
  getAlarmVolumeInfo(): Promise<AlarmVolumeInfo>;
  getLockScreenPermissionStatus(): Promise<LockScreenPermissionStatus>;
  openLockScreenPermissionSettings(): Promise<boolean>;
  showEmergencyLockScreen(data: EmergencyLockScreenInfo): Promise<boolean>;
  clearEmergencyLockScreen(): Promise<boolean>;
  getSnapshot(): Promise<AccidentSnapshot>;
}

const nativeModule = NativeModules.AccidentDetection as AccidentDetectionModule | undefined;

export const AccidentDetectionNative = {
  isAvailable: !!nativeModule,

  startMonitoring(config: StartMonitoringConfig) {
    return nativeModule?.startMonitoring(config) ?? Promise.resolve(false);
  },

  stopMonitoring() {
    return nativeModule?.stopMonitoring() ?? Promise.resolve(false);
  },

  markSafe() {
    return nativeModule?.markSafe() ?? Promise.resolve(false);
  },

  markEmergency() {
    return nativeModule?.markEmergency() ?? Promise.resolve(false);
  },

  notifyMlSuspect(rawAcceleration: number, impactAcceleration: number) {
    return nativeModule?.notifyMlSuspect(rawAcceleration, impactAcceleration)
      ?? Promise.resolve(false);
  },

  playCountdownSound() {
    return nativeModule?.playCountdownSound() ?? Promise.resolve(false);
  },

  stopCountdownSound() {
    return nativeModule?.stopCountdownSound() ?? Promise.resolve(false);
  },

  getAlarmVolumeInfo() {
    return nativeModule?.getAlarmVolumeInfo() ?? Promise.resolve({
      stream: 'ALARM' as const,
      currentVolume: 0,
      maxVolume: 0,
      volumePercent: 0,
    });
  },

  getLockScreenPermissionStatus() {
    return nativeModule?.getLockScreenPermissionStatus() ?? Promise.resolve({
      requiresFullScreenPermission: false,
      canUseFullScreenIntent: true,
    });
  },

  openLockScreenPermissionSettings() {
    return nativeModule?.openLockScreenPermissionSettings() ?? Promise.resolve(false);
  },

  showEmergencyLockScreen(data: EmergencyLockScreenInfo) {
    return nativeModule?.showEmergencyLockScreen(data) ?? Promise.resolve(false);
  },

  clearEmergencyLockScreen() {
    return nativeModule?.clearEmergencyLockScreen() ?? Promise.resolve(false);
  },

  getSnapshot(): Promise<AccidentSnapshot> {
    if (nativeModule?.getSnapshot) {
      return nativeModule.getSnapshot();
    }
    return Promise.resolve({
      rawAcceleration: 0,
      impactAcceleration: 0,
      mode: 'OUTDOOR',
      mlReady: false,
      gyroAvailable: false,
      mlThreshold: 0.35,
    });
  },
};

export const accidentEventEmitter = nativeModule
  ? new NativeEventEmitter(NativeModules.AccidentDetection)
  : null;
