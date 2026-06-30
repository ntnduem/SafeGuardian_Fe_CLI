import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface LocationObject {
  coords: {
    latitude: number;
    longitude: number;
    altitude?: number | null;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
  timestamp: number;
}

async function requestLocationPermission() {
  if (Platform.OS !== 'android') {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function useLocation() {
  const [location, setLocation] = useState<LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let watchId: number | null = null;
    let mounted = true;

    (async () => {
      const granted = await requestLocationPermission();
      if (!granted) {
        setError('Quyen truy cap vi tri bi tu choi.');
        setLoading(false);
        return;
      }

      Geolocation.getCurrentPosition(
        current => {
          if (!mounted) return;
          setLocation(current);
          setLoading(false);
        },
        err => {
          if (!mounted) return;
          setError(err.message);
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      );

      watchId = Geolocation.watchPosition(
        loc => setLocation(loc),
        err => setError(err.message),
        {
          enableHighAccuracy: true,
          distanceFilter: 10,
          interval: 5000,
          fastestInterval: 2000,
        },
      );
    })();

    return () => {
      mounted = false;
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
      }
    };
  }, []);

  return { location, loading, error };
}
