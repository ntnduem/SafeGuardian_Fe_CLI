import axios from 'axios';

// Đổi thành IP máy chạy backend khi test trên điện thoại thật.
// Ví dụ: http://192.168.1.5:8080
// export const BASE_URL = 'http://10.47.24.24:8080';
export const BASE_URL = 'https://safeguardianbe-production.up.railway.app';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export interface ContactPayload {
  fullName: string;
  phone: string;
  relationship?: string;
  email?: string;
  priority?: number;
  isPrimary?: boolean;
}

// User
export const createUser = (data: {
  fullName: string;
  phone: string;
  email?: string;
  bloodType?: string;
  dateOfBirth?: string;
  gender?: string;
  medicalNote?: string;
  address?: string;
}) => api.post('/api/users', data);

export const getUser = (userId: string) =>
  api.get(`/api/users/${userId}`);

export const updateUser = (userId: string, data: Partial<{
  fullName: string;
  phone: string;
  email: string;
  bloodType: string;
  medicalNote: string;
  address: string;
}>) => api.put(`/api/users/${userId}`, data);

// Emergency Contact
export const createContact = (userId: string, data: ContactPayload) =>
  api.post(`/api/users/${userId}/contacts`, data);

export const getContacts = (userId: string) =>
  api.get(`/api/users/${userId}/contacts`);

export const updateContact = (contactId: string, data: Partial<ContactPayload>) =>
  api.put(`/api/contacts/${contactId}`, data);

export const deleteContact = (contactId: string) =>
  api.delete(`/api/contacts/${contactId}`);

// Emergency Alert
export const sendSosAlert = (userId: string, latitude: number, longitude: number) =>
  api.post('/api/emergency-alerts/sos', { userId, latitude, longitude });

export const sendSimulationAlert = (userId: string, latitude: number, longitude: number) =>
  api.post('/api/emergency-alerts/simulation', { userId, latitude, longitude });

export const sendAccidentAlert = (
  userId: string,
  eventId: string | null,
  latitude: number,
  longitude: number,
  acceleration: number,
) =>
  api.post('/api/emergency-alerts/accident', {
    userId,
    eventId,
    latitude,
    longitude,
    acceleration,
  });

export const cancelAlert = (alertId: string) =>
  api.patch(`/api/emergency-alerts/${alertId}/cancel`, {
    reason: 'Người dùng xác nhận an toàn',
  });

export const getAlerts = (userId: string) =>
  api.get(`/api/users/${userId}/emergency-alerts`);

// Emergency Profile
export const getEmergencyProfile = (userId: string) =>
  api.get(`/api/users/${userId}/emergency-profile`);

// Accident Event
export const createAccidentEvent = (data: {
  userId: string;
  eventType: string;
  acceleration: number;
  threshold: number;
  latitude: number;
  longitude: number;
  mlProbability?: number;
  modelVersion?: string;
  detectionMethod?: string;
  isConfirmedAccident?: boolean;
}) => api.post('/api/accident-events', data);

export interface ImuSample {
  accX: number;
  accY: number;
  accZ: number;
  gyroX: number;
  gyroY: number;
  gyroZ: number;
  accMagnitude?: number;
  gyroMagnitude?: number;
}

export interface AccidentPredictResult {
  accident: boolean;
  probability: number;
  threshold: number;
  modelVersion: string;
  windowSize: number;
}

export interface ModelInfo {
  ready: boolean;
  modelVersion?: string;
  windowSize: number;
  stride: number;
  numFeatures?: number;
  threshold: number;
  featureOrder?: string[];
}

export const getModelInfo = () =>
  api.get<{ success: boolean; data: ModelInfo }>('/api/ml/model-info');

export const predictAccident = (samples: ImuSample[]) =>
  api.post<{ success: boolean; data: AccidentPredictResult }>(
    '/api/ml/accident/predict',
    { samples },
    { timeout: 4000 },
  );

export async function pingBackend(): Promise<boolean> {
  try {
    await api.get('/api/ml/model-info', { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export default api;
