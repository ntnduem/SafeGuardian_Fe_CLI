import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity,
  Animated, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Colors } from '../config/theme';
import { UserStore } from '../store/userStore';
import { useEmergency } from '../context/EmergencyContext';
import { useLocation } from '../hooks/useLocation';
import { sendSosAlert } from '../config/api';
import { RootStackParamList, TabParamList } from '../navigation/AppNavigator';
import { styles as s } from './DashboardScreen.styles';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Dashboard'>,
  StackNavigationProp<RootStackParamList>
>;

export default function DashboardScreen() {
  const nav             = useNavigation<Nav>();
  const { acceleration, threshold, triggerAccident } = useEmergency();
  const { location }    = useLocation();
  const [userName, setUserName] = useState('');
  const [userId, setUserId]     = useState('');
  const [sosLoading, setSosLoading] = useState(false);

  // Pulse animation for SOS button
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  useEffect(() => {
    UserStore.getUser().then(u => {
      if (u) { setUserName(u.fullName.split(' ').pop() ?? u.fullName); setUserId(u.id); }
    });
  }, []);

  const handleSOS = async () => {
    if (!userId) return;
    setSosLoading(true);
    try {
      const lat = location?.coords.latitude  ?? 10.762622;
      const lng = location?.coords.longitude ?? 106.660172;
      await sendSosAlert(userId, lat, lng);
      Alert.alert('✅ SOS đã gửi', 'Đã thông báo đến người thân của bạn.');
    } catch {
      Alert.alert('Lỗi', 'Không thể gửi SOS. Kiểm tra kết nối mạng.');
    } finally {
      setSosLoading(false);
    }
  };

  const handleSimulate = () => {
    Alert.alert(
      'Giả lập tai nạn',
      'Hệ thống sẽ đếm ngược 30 giây. Nếu không bấm "Tôi ổn!", cảnh báo sẽ được gửi đến người thân.',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Bắt đầu', style: 'destructive', onPress: () => triggerAccident(0) },
      ]
    );
  };

  const locText = location
    ? `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`
    : 'Đang xác định vị trí...';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={s.topBar}>
          <View>
            <Text style={s.greeting}>Xin chào,</Text>
            <Text style={s.name}>{userName || '...'}</Text>
          </View>
          <TouchableOpacity style={s.mapBtn} onPress={() => nav.navigate('Map')}>
            <Ionicons name="map-outline" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Quick action cards */}
        <View style={s.cards}>
          <QuickCard icon="location" label="GPS" value={locText} color={Colors.info} />
          <QuickCard icon="people"   label="Người liên hệ" value="Xem danh sách" color={Colors.success}
            onPress={() => nav.navigate('Contacts')} />
          <QuickCard icon="medkit"   label="Hồ sơ y tế"    value="Thông tin y tế" color={Colors.warning}
            onPress={() => nav.navigate('Medical')} />
        </View>

        {/* Accelerometer indicator */}
        <View style={s.accelCard}>
          <Ionicons name="pulse-outline" size={18} color={Colors.textSecondary} />
          <Text style={s.accelText}>
            Cảm biến: {acceleration.toFixed(1)} m/s²
          </Text>
          <View style={[s.accelDot, { backgroundColor: acceleration > threshold ? Colors.primary : Colors.success }]} />
        </View>

        {/* SOS Button */}
        <View style={s.sosWrap}>
          <Text style={s.sosLabel}>WE ARE ALWAYS HERE IN CASE OF EMERGENCIES!</Text>
          <Text style={s.sosHint}>Tap to initiate emergency protocol!</Text>

          <TouchableOpacity onPress={handleSOS} disabled={sosLoading} activeOpacity={0.85}>
            <Animated.View style={[s.sosOuter, { transform: [{ scale: pulse }] }]}>
              <View style={s.sosInner}>
                <Ionicons name="radio-button-on" size={36} color="#fff" />
              </View>
            </Animated.View>
          </TouchableOpacity>

          <Text style={s.sosText}>SOS</Text>
        </View>

        {/* Simulate button */}
        <TouchableOpacity style={s.simBtn} onPress={handleSimulate}>
          <Ionicons name="warning-outline" size={18} color={Colors.primary} />
          <Text style={s.simBtnText}>Giả lập tai nạn (Demo)</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickCard({ icon, label, value, color, onPress }: {
  icon: string;
  label: string; value: string; color: string; onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={s.quickCard} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[s.quickIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={s.quickContent}>
        <Text style={s.quickLabel}>{label}</Text>
        <Text style={s.quickValue} numberOfLines={1}>{value}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />}
    </TouchableOpacity>
  );
}

