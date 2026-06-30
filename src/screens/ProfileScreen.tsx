import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, Radius } from '../config/theme';
import { UserStore, UserData } from '../store/userStore';
import { updateUser } from '../config/api';
import { useLocation } from '../hooks/useLocation';

type ProfileForm = {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  homeAddress: string;
  homeLatitude?: number;
  homeLongitude?: number;
  homeRadiusMeters?: number;
};

type TextFieldKey = 'fullName' | 'phone' | 'email' | 'address' | 'homeAddress';

export default function ProfileScreen() {
  const [user, setUser]       = useState<UserData | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm]       = useState<ProfileForm>({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    homeAddress: '',
    homeLatitude: undefined,
    homeLongitude: undefined,
    homeRadiusMeters: 500,
  });
  const { location } = useLocation();

  useEffect(() => {
    UserStore.getUser().then(u => {
      if (u) {
        setUser(u);
        setForm({
          fullName: u.fullName,
          phone: u.phone,
          email: u.email ?? '',
          address: u.address ?? '',
          homeAddress: u.homeAddress ?? '',
          homeLatitude: u.homeLatitude,
          homeLongitude: u.homeLongitude,
          homeRadiusMeters: u.homeRadiusMeters ?? 500,
        });
      }
    });
  }, []);

  const set = (k: TextFieldKey) => (v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleUseCurrentLocationAsHome = async () => {
    if (!location) {
      Alert.alert('Chưa có vị trí', 'Ứng dụng chưa lấy được GPS hiện tại. Vui lòng thử lại sau.');
      return;
    }

    const updates = {
      homeLatitude: location.coords.latitude,
      homeLongitude: location.coords.longitude,
      homeRadiusMeters: 500,
    };

    setForm(prev => ({ ...prev, ...updates }));
    await UserStore.updateUser(updates);
    setUser(prev => prev ? { ...prev, ...updates } : prev);
    Alert.alert('Đã lưu', 'Vị trí hiện tại đã được đặt làm vị trí nhà riêng.');
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) return Alert.alert('Lỗi', 'Họ tên không được để trống.');
    setSaving(true);
    try {
      await updateUser(user!.id, {
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        address: form.address,
      });
      await UserStore.updateUser(form);
      setUser(prev => prev ? { ...prev, ...form } : null);
      setEditing(false);
    } catch { Alert.alert('Lỗi', 'Không thể cập nhật thông tin.'); }
    finally { setSaving(false); }
  };

  const handleReset = () => {
    Alert.alert(
      'Đặt lại ứng dụng',
      'Toàn bộ dữ liệu cục bộ sẽ bị xóa. Bạn cần nhập lại thông tin từ đầu.',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xóa', style: 'destructive', onPress: () => UserStore.clear() },
      ]
    );
  };

  if (!user) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
      <ActivityIndicator color={Colors.primary} />
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Cá nhân</Text>
          <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)} disabled={saving}>
            {saving ? <ActivityIndicator color={Colors.primary} size="small" />
              : <Text style={s.editBtn}>{editing ? 'Lưu' : 'Chỉnh sửa'}</Text>}
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={s.avatarWrap}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user.fullName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={s.userId}>ID: {user.id}</Text>
        </View>

        {/* Info card */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Thông tin cá nhân</Text>
          {editing ? (
            <>
              <Field label="Họ và tên" value={form.fullName} onChangeText={set('fullName')} />
              <Field label="Số điện thoại" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
              <Field label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" />
              <Field label="Địa chỉ" value={form.address} onChangeText={set('address')} />
              <Field label="Địa chỉ nhà riêng" value={form.homeAddress} onChangeText={set('homeAddress')} />
              <TouchableOpacity style={s.homeLocationBtn} onPress={handleUseCurrentLocationAsHome}>
                <Ionicons name="locate" size={16} color={Colors.primary} />
                <Text style={s.homeLocationText}>Dùng vị trí hiện tại làm nhà</Text>
              </TouchableOpacity>
              <Text style={s.homeLocationHint}>
                {form.homeLatitude && form.homeLongitude
                  ? `${form.homeLatitude.toFixed(5)}, ${form.homeLongitude.toFixed(5)} - bán kính 500m`
                  : 'Chưa lưu tọa độ nhà cho HOME MODE'}
              </Text>
            </>
          ) : (
            <>
              <InfoRow icon="person"    label="Họ và tên"      value={user.fullName} />
              <InfoRow icon="call"      label="Số điện thoại"  value={user.phone} />
              <InfoRow icon="mail"      label="Email"          value={user.email}   />
              <InfoRow icon="location" label="Địa chỉ"        value={user.address} />
              <InfoRow icon="home" label="Địa chỉ nhà riêng" value={user.homeAddress} />
              <InfoRow
                icon="navigate"
                label="Tọa độ nhà"
                value={user.homeLatitude && user.homeLongitude
                  ? `${user.homeLatitude.toFixed(5)}, ${user.homeLongitude.toFixed(5)}`
                  : undefined}
              />
            </>
          )}
        </View>

        {editing && (
          <TouchableOpacity style={s.cancelBtn} onPress={() => setEditing(false)}>
            <Text style={s.cancelBtnText}>Hủy</Text>
          </TouchableOpacity>
        )}

        {/* App info */}
        <View style={s.appCard}>
          <View style={s.appRow}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
            <Text style={s.appName}>SafeGuardian</Text>
            <Text style={s.appVersion}>v1.0.0</Text>
          </View>
          <Text style={s.appDesc}>Ứng dụng hỗ trợ an toàn cá nhân và cảnh báo tai nạn giao thông</Text>
        </View>

        <TouchableOpacity style={s.resetBtn} onPress={handleReset}>
          <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
          <Text style={s.resetBtnText}>Đặt lại ứng dụng</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value?: string }) {
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon} size={16} color={Colors.textSecondary} style={{ width: 20 }} />
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={[s.infoValue, !value && { color: Colors.textMuted }]}>{value || 'Chưa cập nhật'}</Text>
      </View>
    </View>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor={Colors.textMuted} {...props} />
    </View>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.background },
  scroll:     { padding: 20, paddingBottom: 40 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title:      { fontSize: 22, fontWeight: 'bold', color: Colors.text },
  editBtn:    { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  avatarWrap: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primarySoft, justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: Colors.primary },
  userId:     { fontSize: 12, color: Colors.textMuted },
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  infoLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  infoValue: { fontSize: 14, color: Colors.text },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: Colors.inputBg, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.inputBorder,
    color: Colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  homeLocationBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.primarySoft,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md, paddingVertical: 11, marginTop: 2,
  },
  homeLocationText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  homeLocationHint: { color: Colors.textMuted, fontSize: 12, marginTop: 8, marginBottom: 4 },
  cancelBtn:     { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
  cancelBtnText: { color: Colors.textSecondary, fontSize: 15 },
  appCard: {
    backgroundColor: Colors.successSoft, borderRadius: Radius.lg, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  appRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  appName:   { fontSize: 15, fontWeight: 'bold', color: Colors.text, flex: 1 },
  appVersion: { fontSize: 12, color: Colors.textMuted },
  appDesc:   { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  resetBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  resetBtnText: { color: Colors.textMuted, fontSize: 13 },
});
