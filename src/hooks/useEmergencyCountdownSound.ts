import { useCallback, useEffect } from 'react';
import { AccidentDetectionNative } from '../native/AccidentDetectionNative';

export function useEmergencyCountdownSound() {
  const start = useCallback(() => {
    AccidentDetectionNative.playCountdownSound().catch(error => {
      console.warn('Countdown sound start failed:', error);
    });
  }, []);

  const stop = useCallback(() => {
    AccidentDetectionNative.stopCountdownSound().catch(error => {
      console.warn('Countdown sound stop failed:', error);
    });
  }, []);

  useEffect(() => stop, [stop]);

  return { start, stop };
}
