import { NativeEventEmitter, NativeModules } from 'react-native';

export type AccidentMode = 'HOME' | 'OUTDOOR' | 'SUSPECT' | 'EMERGENCY';

export interface AccidentSampleEvent {
  rawAcceleration: number;
  impactAcceleration: number;
  mode: AccidentMode;
  latitude?: number;
  longitude?: number;
}

interface StartMonitoringConfig {
  threshold: number;
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

interface AccidentDetectionModule {
  startMonitoring(config: StartMonitoringConfig): Promise<boolean>;
  stopMonitoring(): Promise<boolean>;
  markSafe(): Promise<boolean>;
  markEmergency(): Promise<boolean>;
  playCountdownSound(): Promise<boolean>;
  stopCountdownSound(): Promise<boolean>;
  getAlarmVolumeInfo(): Promise<AlarmVolumeInfo>;
  getLockScreenPermissionStatus(): Promise<LockScreenPermissionStatus>;
  openLockScreenPermissionSettings(): Promise<boolean>;
  showEmergencyLockScreen(data: EmergencyLockScreenInfo): Promise<boolean>;
  clearEmergencyLockScreen(): Promise<boolean>;
  getSnapshot(): Promise<AccidentSampleEvent>;
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

  getSnapshot() {
    return nativeModule?.getSnapshot() ?? Promise.resolve({
      rawAcceleration: 0,
      impactAcceleration: 0,
      mode: 'OUTDOOR' as AccidentMode,
    });
  },
};

export const accidentEventEmitter = nativeModule
  ? new NativeEventEmitter(NativeModules.AccidentDetection)
  : null;
