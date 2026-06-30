import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Modal, Vibration,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useLocation } from '../../hooks/useLocation';
import { useEmergencyCountdownSound } from '../../hooks/useEmergencyCountdownSound';

const COUNTDOWN_SEC = 30;

interface Props {
  acceleration: number;
  onSafe:    () => void;
  onTimeout: (lat: number, lng: number, accel: number) => void;
}

export default function CountdownScreen({ acceleration, onSafe, onTimeout }: Props) {
  const [seconds,     setSeconds]     = useState(COUNTDOWN_SEC);
  const [showConfirm, setShowConfirm] = useState(false);
  const { location } = useLocation();
  const {
    start: startCountdownSound,
    stop: stopCountdownSound,
  } = useEmergencyCountdownSound();

  // Pulsing ring animation
  const ring  = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring,        { toValue: 1.25, duration: 900, useNativeDriver: true }),
          Animated.timing(ring,        { toValue: 1,    duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0.2, duration: 900, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.8, duration: 900, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  useEffect(() => {
    startCountdownSound();
    return stopCountdownSound;
  }, [startCountdownSound, stopCountdownSound]);

  // Countdown timer
  useEffect(() => {
    if (seconds <= 0) {
      stopCountdownSound();
      Vibration.vibrate([500, 200, 500]);
      const lat = location?.coords.latitude  ?? 10.762622;
      const lng = location?.coords.longitude ?? 106.660172;
      onTimeout(lat, lng, acceleration);
      return;
    }

    // Vibrate every 5 seconds to warn
    if (seconds % 5 === 0) Vibration.vibrate(200);

    const t = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const handleSafe = () => {
    stopCountdownSound();
    Vibration.cancel();
    setShowConfirm(true);
  };

  const confirmSafe = () => {
    stopCountdownSound();
    setShowConfirm(false);
    onSafe();
  };

  const cancelSafeConfirmation = () => {
    setShowConfirm(false);
    startCountdownSound();
  };

  const urgencyColor = seconds <= 10 ? '#e53e3e' : seconds <= 20 ? '#dd6b20' : '#38a169';

  return (
    <View style={s.container}>
      {/* Background grid pattern */}
      <View style={s.grid} pointerEvents="none">
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={i} style={s.gridRow} />
        ))}
      </View>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerLabel}>Cảnh báo khẩn cấp</Text>
      </View>

      {/* Content */}
      <View style={s.content}>
        <Ionicons name="warning" size={32} color="#dd6b20" style={{ marginBottom: 8 }} />
        <Text style={s.title}>Phát hiện va chạm</Text>
        <Text style={s.subtitle}>Bạn đang ổn không?</Text>

        {/* Countdown number */}
        <Text style={[s.countdown, { color: urgencyColor }]}>{seconds} s</Text>

        {/* Pulsing green button */}
        <View style={s.btnWrap}>
          <Animated.View style={[
            s.ringOuter,
            { transform: [{ scale: ring }], opacity: ringOpacity, borderColor: '#38a169' },
          ]} />
          <TouchableOpacity style={s.safeBtn} onPress={handleSafe} activeOpacity={0.85}>
            <Ionicons name="radio-button-on" size={28} color="#fff" />
            <Text style={s.safeBtnText}>Tôi ổn!</Text>
          </TouchableOpacity>
        </View>

        {acceleration > 0 && (
          <Text style={s.accelInfo}>Gia tốc phát hiện: {acceleration.toFixed(1)} m/s²</Text>
        )}
      </View>

      {/* Confirm Safe Modal */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={s.confirmOverlay}>
          <View style={s.confirmCard}>
            <Text style={s.confirmTitle}>XÁC NHẬN AN TOÀN</Text>
            <Text style={s.confirmSub}>Bạn xác nhận mình đang an toàn?</Text>
            <View style={s.confirmHint}>
              <Text style={s.confirmHintText}>🟢 nút xác nhận</Text>
              <Text style={s.confirmHintText}>🔴 nút hủy</Text>
            </View>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={s.confirmYes} onPress={confirmSafe}>
                <Text style={s.confirmYesText}>Xác nhận</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmNo} onPress={cancelSafeConfirmation}>
                <Text style={s.confirmNoText}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080c10' },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.15,
  },
  gridRow: {
    flex: 1, borderBottomWidth: 1, borderBottomColor: '#1a4a3a',
    borderTopWidth: 0,
  },
  header: {
    paddingTop: 56, paddingHorizontal: 20,
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1a2a2a',
    paddingBottom: 12,
  },
  headerLabel: { fontSize: 12, color: '#4a9070', letterSpacing: 2, textTransform: 'uppercase' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  title:    { fontSize: 24, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#a0c0b0', marginBottom: 32 },
  countdown: {
    fontSize: 80, fontWeight: '900', lineHeight: 90,
    marginBottom: 48, fontVariant: ['tabular-nums'],
  },
  btnWrap:  { justifyContent: 'center', alignItems: 'center', width: 200, height: 200 },
  ringOuter: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 3,
  },
  safeBtn: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: '#276749',
    justifyContent: 'center', alignItems: 'center', gap: 6,
    shadowColor: '#38a169', shadowOpacity: 0.5,
    shadowRadius: 20, elevation: 12,
    borderWidth: 2, borderColor: '#38a169',
  },
  safeBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  accelInfo:   { marginTop: 32, fontSize: 13, color: '#4a9070' },
  // Confirm modal
  confirmOverlay: {
    flex: 1, backgroundColor: '#000000cc',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  confirmCard: {
    backgroundColor: '#111820', borderRadius: 16, padding: 24,
    width: '100%', borderWidth: 1, borderColor: '#2a3a4a',
  },
  confirmTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 8 },
  confirmSub:   { fontSize: 14, color: '#a0b0c0', textAlign: 'center', marginBottom: 12 },
  confirmHint:  { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 20 },
  confirmHintText: { fontSize: 12, color: '#607080' },
  confirmBtns:  { flexDirection: 'row', gap: 12 },
  confirmYes: {
    flex: 1, backgroundColor: '#276749', borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
  },
  confirmYesText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  confirmNo: {
    flex: 1, backgroundColor: '#9b2c2c', borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
  },
  confirmNoText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
