import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../config/theme';
import { useLocation } from '../hooks/useLocation';

const DARK_MAP_STYLE = [
  { elementType: 'geometry',   stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { featureType: 'road',       elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'water',      elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'poi',        stylers: [{ visibility: 'off' }] },
];

export default function MapScreen() {
  const nav = useNavigation();
  const { location, loading } = useLocation();
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude:       location.coords.latitude,
        longitude:      location.coords.longitude,
        latitudeDelta:  0.01,
        longitudeDelta: 0.01,
      }, 800);
    }
  }, [location]);

  return (
    <View style={s.container}>
      {loading || !location ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={s.loadingText}>Đang xác định vị trí...</Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={s.map}
          provider={PROVIDER_GOOGLE}
          customMapStyle={DARK_MAP_STYLE}
          initialRegion={{
            latitude:       location.coords.latitude,
            longitude:      location.coords.longitude,
            latitudeDelta:  0.02,
            longitudeDelta: 0.02,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          <Marker
            coordinate={{
              latitude:  location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="Vị trí của bạn"
          />
        </MapView>
      )}

      {/* Header overlay */}
      <SafeAreaView style={s.header} pointerEvents="box-none">
        <TouchableOpacity style={s.backBtn} onPress={() => nav.goBack()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={s.coordBox}>
          <Ionicons name="location" size={14} color={Colors.primary} />
          <Text style={s.coordText}>
            {location
              ? `${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)}`
              : 'Đang xác định...'}
          </Text>
        </View>
      </SafeAreaView>

      {/* Recenter button */}
      <TouchableOpacity
        style={s.recenterBtn}
        onPress={() => {
          if (location && mapRef.current) {
            mapRef.current.animateToRegion({
              latitude:       location.coords.latitude,
              longitude:      location.coords.longitude,
              latitudeDelta:  0.01,
              longitudeDelta: 0.01,
            }, 500);
          }
        }}
      >
        <Ionicons name="locate" size={22} color={Colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  map:       { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, gap: 12,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.surfaceStrong,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  coordBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surfaceStrong, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  coordText: { color: Colors.text, fontSize: 13 },
  recenterBtn: {
    position: 'absolute', bottom: 32, right: 16,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.surfaceStrong,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.cardBorder,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
});
