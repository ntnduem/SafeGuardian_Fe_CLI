import { useEffect, useState } from 'react';
import { accelerometer, setUpdateIntervalForType, SensorTypes } from 'react-native-sensors';
import { calculateImuMagnitude } from '../utils/imu';

const THRESHOLD = 25.0;

export function useAccelerometer() {
  const [acceleration, setAcceleration] = useState(0);
  const [exceeded, setExceeded] = useState(false);

  useEffect(() => {
    setUpdateIntervalForType(SensorTypes.accelerometer, 200);

    const sub = accelerometer.subscribe(({ x, y, z }) => {
      const { rawMagnitude, impactMagnitude } = calculateImuMagnitude(x, y, z);
      setAcceleration(rawMagnitude);

      if (impactMagnitude > THRESHOLD) {
        setExceeded(true);
        setTimeout(() => setExceeded(false), 2000);
      }
    });

    return () => sub.unsubscribe();
  }, []);

  return { acceleration, exceeded, threshold: THRESHOLD };
}
