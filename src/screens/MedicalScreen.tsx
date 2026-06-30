import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, Radius } from '../config/theme';
import { UserStore } from '../store/userStore';
import { updateUser } from '../config/api';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function MedicalScreen() {
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState({ bloodType: '', medicalNote: '' });
  const [userId, setUserId] = useState('');

  useEffect(() => {
    UserStore.getUser().then(u => {
      if (u) {
        setUserId(u.id);
        setForm({ bloodType: u.bloodType ?? '', medicalNote: u.medicalNote ?? '' });
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUser(userId, { bloodType: form.bloodType, medicalNote: form.medicalNote });
      await UserStore.updateUser({ bloodType: form.bloodType, medicalNote: form.medicalNote });
      setEditing(false);
    } catch { Alert.alert('Lỗi', 'Không thể lưu thông tin.'); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Hồ sơ y tế</Text>
          <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)} disabled={saving}>
            {saving
              ? <ActivityIndicator color={Colors.primary} size="small" />
              : <Text style={s.editBtn}>{editing ? 'Lưu' : 'Chỉnh sửa'}</Text>}
          </TouchableOpacity>
        </View>

        {/* Emergency card */}
        <View style={s.emergencyCard}>
          <Ionicons name="alert-circle" size={20} color={Colors.primary} />
          <Text style={s.emergencyText}>
            Thông tin này sẽ được gửi đến người thân khi có sự cố khẩn cấp
          </Text>
        </View>

        {/* Blood type */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="water" size={20} color={Colors.primary} />
            <Text style={s.cardTitle}>Nhóm máu</Text>
          </View>
          {editing ? (
            <View style={s.bloodRow}>
              {BLOOD_TYPES.map(bt => (
                <TouchableOpacity
                  key={bt}
                  style={[s.bloodBtn, form.bloodType === bt && s.bloodBtnActive]}
                  onPress={() => setForm(p => ({ ...p, bloodType: bt }))}
                >
                  <Text style={[s.bloodBtnText, form.bloodType === bt && s.bloodBtnTextActive]}>{bt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={s.valueWrap}>
              <Text style={[s.value, !form.bloodType && { color: Colors.textMuted }]}>
                {form.bloodType || 'Chưa cập nhật'}
              </Text>
            </View>
          )}
        </View>

        {/* Medical note */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="document-text" size={20} color={Colors.info} />
            <Text style={s.cardTitle}>Tiền sử bệnh / Dị ứng</Text>
          </View>
          {editing ? (
            <TextInput
              style={s.textarea}
              value={form.medicalNote}
              onChangeText={v => setForm(p => ({ ...p, medicalNote: v }))}
              placeholder="VD: Dị ứng Penicillin, tiểu đường type 2..."
              placeholderTextColor={Colors.textMuted}
              multiline numberOfLines={4}
              textAlignVertical="top"
            />
          ) : (
            <Text style={[s.value, !form.medicalNote && { color: Colors.textMuted }]}>
              {form.medicalNote || 'Chưa có ghi chú'}
            </Text>
          )}
        </View>

        {/* Instructions */}
        <View style={s.infoCard}>
          <Text style={s.infoTitle}>💡 Tại sao cần điền thông tin y tế?</Text>
          <Text style={s.infoText}>
            Khi xảy ra tai nạn, thông tin nhóm máu và bệnh lý giúp nhân viên y tế cấp cứu
            nhanh hơn và chính xác hơn.{'\n\n'}
            Thông tin này cũng được gửi trong email cảnh báo đến người thân của bạn.
          </Text>
        </View>

        {editing && (
          <TouchableOpacity style={s.cancelBtn} onPress={() => setEditing(false)}>
            <Text style={s.cancelBtnText}>Hủy chỉnh sửa</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:  { fontSize: 22, fontWeight: 'bold', color: Colors.text },
  editBtn: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  emergencyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.primarySoft, borderRadius: Radius.md,
    padding: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  emergencyText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle:  { fontSize: 15, fontWeight: '600', color: Colors.text },
  bloodRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bloodBtn:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.inputBorder, backgroundColor: Colors.inputBg },
  bloodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  bloodBtnText:   { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  bloodBtnTextActive: { color: '#fff' },
  valueWrap:  { backgroundColor: Colors.inputBg, borderRadius: Radius.sm, padding: 12 },
  value:      { fontSize: 16, color: Colors.text, fontWeight: '500' },
  textarea: {
    backgroundColor: Colors.inputBg, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.inputBorder,
    color: Colors.text, padding: 12, fontSize: 15, minHeight: 100,
  },
  infoCard: {
    backgroundColor: Colors.infoSoft, borderRadius: Radius.lg,
    padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  infoTitle: { fontSize: 14, fontWeight: '600', color: Colors.info, marginBottom: 8 },
  infoText:  { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  cancelBtn: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontSize: 15 },
});
