import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Colors, Radius } from '../config/theme';
import { createUser } from '../config/api';
import { UserStore } from '../store/userStore';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useLocation } from '../hooks/useLocation';

type Nav = StackNavigationProp<RootStackParamList>;

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function OnboardingScreen() {
  const nav = useNavigation<Nav>();
  const [loading, setLoading] = useState(false);
  const [homeCoords, setHomeCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const { location } = useLocation();
  const [form, setForm] = useState({
    fullName:   '',
    phone:      '',
    email:      '',
    bloodType:  '',
    medicalNote: '',
    address:    '',
    homeAddress: '',
  });

  const set = (key: keyof typeof form) => (val: string) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleUseCurrentLocationAsHome = () => {
    if (!location) {
      Alert.alert('Chưa có vị trí', 'Ứng dụng chưa lấy được GPS hiện tại. Vui lòng thử lại sau.');
      return;
    }
    setHomeCoords({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });
    Alert.alert('Đã lưu', 'Vị trí hiện tại sẽ được dùng làm vị trí nhà riêng.');
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) return Alert.alert('Lỗi', 'Vui lòng nhập họ tên.');
    if (!form.phone.trim())    return Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại.');

    setLoading(true);
    try {
      const res = await createUser({
        fullName:    form.fullName.trim(),
        phone:       form.phone.trim(),
        email:       form.email.trim() || undefined,
        bloodType:   form.bloodType || undefined,
        medicalNote: form.medicalNote.trim() || undefined,
        address:     form.address.trim() || undefined,
      });
      const user = res.data.data;
      await UserStore.saveUser({
        ...user,
        homeAddress: form.homeAddress.trim() || undefined,
        homeLatitude: homeCoords?.latitude,
        homeLongitude: homeCoords?.longitude,
        homeRadiusMeters: 500,
      });
      nav.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (e: any) {
      Alert.alert('Lỗi kết nối', e.message ?? 'Không thể tạo tài khoản. Kiểm tra backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.logoWrap}>
              <Ionicons name="shield-checkmark" size={48} color={Colors.primary} />
            </View>
            <Text style={s.title}>SafeGuardian</Text>
            <Text style={s.subtitle}>Nhập thông tin để bắt đầu</Text>
          </View>

          {/* Form */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>Thông tin cơ bản</Text>

            <Field label="Họ và tên *" placeholder="Nguyễn Văn A"
              value={form.fullName} onChangeText={set('fullName')} />
            <Field label="Số điện thoại *" placeholder="0901234567"
              value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
            <Field label="Email" placeholder="example@gmail.com"
              value={form.email} onChangeText={set('email')} keyboardType="email-address" />
            <Field label="Địa chỉ" placeholder="TP. Hồ Chí Minh"
              value={form.address} onChangeText={set('address')} />
            <Field label="Địa chỉ nhà riêng" placeholder="Nhập địa chỉ nhà riêng"
              value={form.homeAddress} onChangeText={set('homeAddress')} />
            <TouchableOpacity style={s.homeLocationBtn} onPress={handleUseCurrentLocationAsHome}>
              <Ionicons name="locate" size={16} color={Colors.primary} />
              <Text style={s.homeLocationText}>Dùng vị trí hiện tại làm nhà</Text>
            </TouchableOpacity>
            <Text style={s.homeLocationHint}>
              {homeCoords
                ? `${homeCoords.latitude.toFixed(5)}, ${homeCoords.longitude.toFixed(5)} - bán kính 500m`
                : 'Chưa lưu tọa độ nhà cho HOME MODE'}
            </Text>
          </View>

          <View style={s.card}>
            <Text style={s.sectionTitle}>Thông tin y tế khẩn cấp</Text>

            {/* Blood type selector */}
            <Text style={s.label}>Nhóm máu</Text>
            <View style={s.bloodRow}>
              {BLOOD_TYPES.map(bt => (
                <TouchableOpacity
                  key={bt}
                  style={[s.bloodBtn, form.bloodType === bt && s.bloodBtnActive]}
                  onPress={() => set('bloodType')(form.bloodType === bt ? '' : bt)}
                >
                  <Text style={[s.bloodBtnText, form.bloodType === bt && s.bloodBtnTextActive]}>
                    {bt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Field label="Ghi chú bệnh lý"
              placeholder="Tiền sử bệnh, dị ứng thuốc..."
              value={form.medicalNote} onChangeText={set('medicalNote')}
              multiline numberOfLines={3} />
          </View>

          <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.saveBtnText}>Bắt đầu sử dụng</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={[s.input, props.multiline && { height: 80, textAlignVertical: 'top' }]}
        placeholderTextColor={Colors.textMuted}
        {...props} />
    </View>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 28, marginTop: 12 },
  logoWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primarySoft, justifyContent: 'center', alignItems: 'center',
    marginBottom: 12, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  title:    { fontSize: 28, fontWeight: 'bold', color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 14 },
  label:  { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
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
  bloodRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  bloodBtn:         {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBg,
  },
  bloodBtnActive:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  bloodBtnText:     { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  bloodBtnTextActive: { color: '#fff' },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.45, shadowRadius: 14, elevation: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
