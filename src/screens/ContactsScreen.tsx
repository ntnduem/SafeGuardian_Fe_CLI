import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Radius } from '../config/theme';
import { UserStore } from '../store/userStore';
import {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
} from '../config/api';

interface Contact {
  id: string;
  fullName: string;
  relationship: string;
  phone: string;
  email?: string;
  isPrimary?: boolean;
  priority?: number;
}

type ContactForm = {
  fullName: string;
  relationship: string;
  phone: string;
  email: string;
  isPrimary: boolean;
};

const RELATIONSHIPS = ['Father', 'Mother', 'Brother', 'Sister', 'Spouse', 'Friend', 'Other'];

const INITIAL_FORM: ContactForm = {
  fullName: '',
  relationship: 'Father',
  phone: '',
  email: '',
  isPrimary: false,
};

export default function ContactsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [detail, setDetail] = useState<Contact | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [userId, setUserId] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ContactForm>(INITIAL_FORM);

  const isEditing = !!editingContact;

  const set = (k: keyof ContactForm) => (v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const load = useCallback(async () => {
    const uid = await UserStore.getUserId();
    if (!uid) return;
    setUserId(uid);
    setLoading(true);
    try {
      const res = await getContacts(uid);
      setContacts(res.data.data ?? []);
    } catch {
      setContacts([]);
      Alert.alert('Lỗi', 'Không thể tải danh sách liên hệ khẩn cấp.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const relLabel = useCallback((r: string) => {
    const map: Record<string, string> = {
      Father: 'Cha',
      Mother: 'Mẹ',
      Brother: 'Anh/Em trai',
      Sister: 'Chị/Em gái',
      Spouse: 'Vợ/Chồng',
      Friend: 'Bạn bè',
      Other: 'Khác',
    };
    return map[r] ?? r;
  }, []);

  const modalTitle = useMemo(
    () => isEditing ? 'Chỉnh sửa liên hệ' : 'Thêm liên hệ khẩn cấp',
    [isEditing],
  );

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingContact(null);
  };

  const closeForm = () => {
    setShowModal(false);
    resetForm();
  };

  const openAddForm = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditForm = (contact: Contact) => {
    setDetail(null);
    setEditingContact(contact);
    setForm({
      fullName: contact.fullName,
      relationship: contact.relationship || 'Other',
      phone: contact.phone,
      email: contact.email ?? '',
      isPrimary: !!contact.isPrimary,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) return Alert.alert('Lỗi', 'Vui lòng nhập họ và tên.');
    if (!form.phone.trim()) return Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại.');

    setSaving(true);
    const payload = {
      fullName: form.fullName.trim(),
      relationship: form.relationship,
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      isPrimary: form.isPrimary,
      priority: form.isPrimary ? 1 : contacts.length + 1,
    };

    try {
      if (editingContact) {
        await updateContact(editingContact.id, payload);
        Alert.alert('Đã cập nhật', 'Thông tin liên hệ đã được lưu.');
      } else {
        await createContact(userId, payload);
        Alert.alert('Đã thêm', 'Liên hệ khẩn cấp đã được thêm vào danh sách.');
      }
      closeForm();
      load();
    } catch {
      Alert.alert('Lỗi', isEditing
        ? 'Không thể cập nhật liên hệ. Vui lòng thử lại.'
        : 'Không thể thêm liên hệ. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (contact: Contact) => {
    Alert.alert('Xóa liên hệ', `Xóa "${contact.fullName}" khỏi danh sách?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteContact(contact.id);
            setDetail(null);
            load();
          } catch {
            Alert.alert('Lỗi', 'Không thể xóa liên hệ. Vui lòng thử lại.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Liên hệ khẩn cấp</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAddForm}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : contacts.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
          <Text style={s.emptyText}>Chưa có liên hệ khẩn cấp</Text>
          <Text style={s.emptyHint}>Thêm người thân để nhận cảnh báo khi có sự cố.</Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={c => c.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} onPress={() => setDetail(item)} activeOpacity={0.8}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{item.fullName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={s.cardContent}>
                <View style={s.nameRow}>
                  <Text style={s.name} numberOfLines={1}>{item.fullName}</Text>
                  {item.isPrimary && (
                    <View style={s.primaryBadge}>
                      <Text style={s.primaryBadgeText}>Chính</Text>
                    </View>
                  )}
                </View>
                <Text style={s.rel}>{relLabel(item.relationship)}</Text>
                <Text style={s.phone}>{item.phone}</Text>
              </View>
              <TouchableOpacity
                style={s.iconBtn}
                onPress={() => openEditForm(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="create-outline" size={18} color={Colors.info} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.iconBtn}
                onPress={() => handleDelete(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{modalTitle}</Text>

            <MField label="Họ và tên *" value={form.fullName} onChangeText={set('fullName')} />
            <MField label="Số điện thoại *" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
            <MField label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" />

            <Text style={s.fieldLabel}>Quan hệ</Text>
            <View style={s.relRow}>
              {RELATIONSHIPS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[s.relBtn, form.relationship === r && s.relBtnActive]}
                  onPress={() => set('relationship')(r)}
                >
                  <Text style={[s.relBtnText, form.relationship === r && s.relBtnTextActive]}>
                    {relLabel(r)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={s.primaryToggle} onPress={() => set('isPrimary')(!form.isPrimary)}>
              <Ionicons name={form.isPrimary ? 'checkbox' : 'square-outline'} size={20} color={Colors.primary} />
              <Text style={s.primaryToggleText}>Đặt làm liên hệ chính</Text>
            </TouchableOpacity>

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={closeForm}>
                <Text style={s.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.saveBtnText}>{isEditing ? 'Cập nhật' : 'Lưu'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!detail} animationType="slide" transparent>
        <TouchableOpacity style={s.modalOverlay} onPress={() => setDetail(null)} activeOpacity={1}>
          <TouchableOpacity style={s.detailSheet} activeOpacity={1}>
            <View style={s.modalHandle} />
            <View style={s.detailAvatar}>
              <Text style={s.detailAvatarText}>{detail?.fullName.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={s.detailName}>{detail?.fullName}</Text>
            <Text style={s.detailRel}>{relLabel(detail?.relationship ?? '')}</Text>
            <View style={s.detailRow}>
              <Ionicons name="call" size={16} color={Colors.success} />
              <Text style={s.detailRowText}>{detail?.phone}</Text>
            </View>
            {detail?.email && (
              <View style={s.detailRow}>
                <Ionicons name="mail" size={16} color={Colors.textSecondary} />
                <Text style={s.detailRowText}>{detail.email}</Text>
              </View>
            )}
            {detail?.isPrimary && (
              <View style={s.detailPrimary}>
                <Ionicons name="star" size={14} color={Colors.warning} />
                <Text style={s.detailPrimaryText}>Liên hệ chính</Text>
              </View>
            )}
            {detail && (
              <View style={s.detailActions}>
                <TouchableOpacity style={s.detailEditBtn} onPress={() => openEditForm(detail)}>
                  <Ionicons name="create-outline" size={16} color="#fff" />
                  <Text style={s.detailEditText}>Chỉnh sửa</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.detailDeleteBtn} onPress={() => handleDelete(detail)}>
                  <Ionicons name="trash-outline" size={16} color={Colors.primary} />
                  <Text style={s.detailDeleteText}>Xóa</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function MField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor={Colors.textMuted} {...props} />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: 'bold', color: Colors.text },
  addBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  emptyHint: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 40 },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: 14, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primarySoft, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: Colors.primary },
  cardContent: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  primaryBadge: { backgroundColor: Colors.successSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  primaryBadgeText: { fontSize: 10, color: Colors.success, fontWeight: '600' },
  rel: { fontSize: 12, color: Colors.textSecondary },
  phone: { fontSize: 13, color: Colors.textMuted, marginTop: 1 },
  iconBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surfaceStrong, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.cardBorder, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: Colors.inputBg, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.inputBorder,
    color: Colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  relRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  relBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.inputBorder, backgroundColor: Colors.inputBg },
  relBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  relBtnText: { color: Colors.textSecondary, fontSize: 12 },
  relBtnTextActive: { color: '#fff' },
  primaryToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  primaryToggleText: { color: Colors.textSecondary, fontSize: 14 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontSize: 15 },
  saveBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  detailSheet: {
    backgroundColor: Colors.surfaceStrong, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder,
  },
  detailAvatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primarySoft, justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  detailAvatarText: { fontSize: 28, fontWeight: 'bold', color: Colors.primary },
  detailName: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  detailRel: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  detailRowText: { fontSize: 15, color: Colors.text },
  detailPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: Colors.warningSoft, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  detailPrimaryText: { color: Colors.warning, fontSize: 13, fontWeight: '600' },
  detailActions: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 20 },
  detailEditBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12,
  },
  detailEditText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  detailDeleteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.primarySoft, borderRadius: Radius.md, paddingVertical: 12,
  },
  detailDeleteText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
});
