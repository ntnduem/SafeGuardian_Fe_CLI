import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER_ID:   'safeguardian_user_id',
  USER_DATA: 'safeguardian_user_data',
};

export interface UserData {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  bloodType?: string;
  medicalNote?: string;
  address?: string;
  homeAddress?: string;
  homeLatitude?: number;
  homeLongitude?: number;
  homeRadiusMeters?: number;
  dateOfBirth?: string;
  gender?: string;
  status?: string;
}

export const UserStore = {
  async saveUser(user: UserData): Promise<void> {
    await AsyncStorage.setItem(KEYS.USER_ID, user.id);
    await AsyncStorage.setItem(KEYS.USER_DATA, JSON.stringify(user));
  },

  async getUserId(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.USER_ID);
  },

  async getUser(): Promise<UserData | null> {
    const raw = await AsyncStorage.getItem(KEYS.USER_DATA);
    return raw ? JSON.parse(raw) : null;
  },

  async updateUser(updates: Partial<UserData>): Promise<void> {
    const existing = await this.getUser();
    if (existing) {
      await this.saveUser({ ...existing, ...updates });
    }
  },

  async clear(): Promise<void> {
    await AsyncStorage.multiRemove([KEYS.USER_ID, KEYS.USER_DATA]);
  },
};
