export const GRAVITY_MS2 = 9.80665;

export interface ImuMagnitude {
  rawMagnitude: number;
  impactMagnitude: number;
}

export function calculateImuMagnitude(x: number, y: number, z: number): ImuMagnitude {
  const rawMagnitude = Math.sqrt(x * x + y * y + z * z);
  return {
    rawMagnitude,
    impactMagnitude: Math.abs(rawMagnitude - GRAVITY_MS2),
  };
}
