import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Vibration,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { UserStore, UserData } from '../../store/userStore';
import { getContacts, getEmergencyProfile } from '../../config/api';

interface Props {
  alertId: string | null;
  latitude: number;
  longitude: number;
  onDismiss: () => void;
}

interface Contact {
  fullName: string;
  relationship?: string;
  phone: string;
  email?: string;
  isPrimary?: boolean;
}

interface Profile {
  fullName: string;
  bloodType?: string;
  medicalNote?: string;
  primaryContact?: Contact;
}

function relLabel(value?: string) {
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

export default function AlertSentScreen({ alertId, latitude, longitude, onDismiss }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Vibration.vibrate([300, 100, 300, 100, 300]);
    Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    const load = async () => {
      const localUser = await UserStore.getUser();
      setUser(localUser);
      if (!localUser) return;

      try {
        const [profileRes, contactsRes] = await Promise.all([
          getEmergencyProfile(localUser.id),
          getContacts(localUser.id),
        ]);
        setProfile(profileRes.data?.data ?? null);
        setContacts(contactsRes.data?.data ?? []);
      } catch {
        setProfile({
          fullName: localUser.fullName,
          bloodType: localUser.bloodType ?? 'Chưa cập nhật',
          medicalNote: localUser.medicalNote ?? 'Không có',
        });
        setContacts([]);
      }
    };

    load();
    return () => Vibration.cancel();
  }, [opacity]);

  const displayName = profile?.fullName || user?.fullName || 'Người dùng SafeGuardian';
  const bloodType = profile?.bloodType || user?.bloodType || 'Chưa cập nhật';
  const medicalNote = profile?.medicalNote || user?.medicalNote || 'Không có';
  const emergencyContacts = contacts.length
    ? contacts
    : profile?.primaryContact
      ? [profile.primaryContact]
      : [];
  const mapUrl = `https://maps.google.com/?q=${latitude},${longitude}`;

  return (
    <View style={s.container}>
      <View style={s.grid} pointerEvents="none">
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={i} style={s.gridRow} />
        ))}
      </View>

      <View style={s.header}>
        <Text style={s.headerLabel}>CẢNH BÁO KHẨN CẤP</Text>
      </View>

      <Animated.View style={[{ flex: 1 }, { opacity }]}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.statusWrap}>
            <View style={s.statusIcon}>
              <Ionicons name="alert-circle" size={36} color="#e53e3e" />
            </View>
            <Text style={s.statusTitle}>Không nhận được phản hồi</Text>
            <Text style={s.statusSub}>Thông tin khẩn cấp đang được hiển thị trên màn hình khóa</Text>

            <View style={s.sendingRow}>
              <Ionicons name="mail" size={14} color="#38a169" />
              <Text style={s.sendingText}>Cảnh báo đã được gửi đến người thân</Text>
            </View>
          </View>

          <View style={s.card}>
            <View style={s.cardHeader}>
              <Ionicons name="person" size={18} color="#90cdf4" />
              <Text style={s.cardTitle}>Người gặp nạn</Text>
            </View>
            <Text style={s.personName}>{displayName}</Text>
          </View>

          <View style={s.card}>
            <View style={s.cardHeader}>
              <Ionicons name="medkit" size={18} color="#e53e3e" />
              <Text style={s.cardTitle}>Hồ sơ y tế</Text>
            </View>
            <InfoRow label="Nhóm máu" value={bloodType} />
            <InfoRow label="Ghi chú y tế" value={medicalNote} />
          </View>

          <View style={s.card}>
            <View style={s.cardHeader}>
              <Ionicons name="call" size={18} color="#38a169" />
              <Text style={s.cardTitle}>Liên hệ khẩn cấp</Text>
            </View>
            {emergencyContacts.length ? (
              emergencyContacts.map((contact, index) => (
                <View key={`${contact.phone}-${index}`} style={s.contactBlock}>
                  <Text style={s.contactName}>{contact.fullName}</Text>
                  <Text style={s.contactMeta}>
                    {relLabel(contact.relationship)}{contact.isPrimary ? ' - liên hệ chính' : ''}
                  </Text>
                  <Text style={s.contactPhone}>{contact.phone}</Text>
                  {!!contact.email && <Text style={s.contactEmail}>{contact.email}</Text>}
                </View>
              ))
            ) : (
              <Text style={s.emptyText}>Chưa có liên hệ khẩn cấp</Text>
            )}
          </View>

          <View style={s.card}>
            <View style={s.cardHeader}>
              <Ionicons name="location" size={18} color="#3182ce" />
              <Text style={s.cardTitle}>Vị trí hiện tại</Text>
            </View>
            <Text style={s.coordText}>{latitude.toFixed(6)}, {longitude.toFixed(6)}</Text>
            <Text style={s.mapUrl} numberOfLines={1}>{mapUrl}</Text>
          </View>

          {!!alertId && <Text style={s.alertId}>Mã cảnh báo: {alertId}</Text>}

          <TouchableOpacity style={s.dismissBtn} onPress={onDismiss}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={s.dismissBtnText}>Tôi đã được trợ giúp</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.medRow}>
      <Text style={s.medLabel}>{label}:</Text>
      <Text style={s.medValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080c10' },
  grid: { ...StyleSheet.absoluteFillObject, opacity: 0.12 },
  gridRow: { flex: 1, borderBottomWidth: 1, borderBottomColor: '#3a1a1a' },
  header: {
    paddingTop: 56, paddingHorizontal: 20, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#2a1a1a', paddingBottom: 12,
  },
  headerLabel: { fontSize: 12, color: '#d96c6c', letterSpacing: 2, textTransform: 'uppercase' },
  scroll: { padding: 20, paddingBottom: 40 },
  statusWrap: { alignItems: 'center', marginBottom: 24, paddingTop: 8 },
  statusIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#e53e3e22', justifyContent: 'center', alignItems: 'center',
    marginBottom: 12, borderWidth: 2, borderColor: '#e53e3e44',
  },
  statusTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  statusSub: { fontSize: 14, color: '#c79090', marginTop: 6, marginBottom: 14, textAlign: 'center' },
  sendingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0f2a1f', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  sendingText: { fontSize: 13, color: '#38a169' },
  card: {
    backgroundColor: '#111820', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#1a2a3a',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#c0d0e0' },
  personName: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  medRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8 },
  medLabel: { fontSize: 13, color: '#8aa3b5', width: 90 },
  medValue: { flex: 1, fontSize: 13, color: '#d7e5ec', fontWeight: '500' },
  contactBlock: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#203040' },
  contactName: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  contactMeta: { fontSize: 12, color: '#8aa3b5', marginTop: 2 },
  contactPhone: { fontSize: 15, color: '#90c0a0', marginTop: 3 },
  contactEmail: { fontSize: 13, color: '#8aa3b5', marginTop: 2 },
  emptyText: { fontSize: 13, color: '#8aa3b5' },
  coordText: { fontSize: 15, color: '#fff', fontWeight: '500' },
  mapUrl: { fontSize: 12, color: '#4a8ab0', marginTop: 4 },
  alertId: { fontSize: 11, color: '#5c7080', textAlign: 'center', marginBottom: 16 },
  dismissBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#276749', borderRadius: 14, paddingVertical: 16,
    borderWidth: 1, borderColor: '#38a169',
  },
  dismissBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
