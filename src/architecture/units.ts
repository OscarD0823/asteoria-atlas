export type DisplayUnit = 'm' | 'cm' | 'mm';
export const unitFactor = (unit: DisplayUnit) => unit === 'cm' ? 100 : unit === 'mm' ? 1000 : 1;
export const fromMeters = (value: number, unit: DisplayUnit) => value * unitFactor(unit);
export const toMeters = (value: number, unit: DisplayUnit) => value / unitFactor(unit);
export function dimensionText(value: number, unit: DisplayUnit = 'm') { return `${fromMeters(value, unit).toLocaleString('es-CO', { maximumFractionDigits: unit === 'm' ? 3 : unit === 'cm' ? 1 : 0 })} ${unit}`; }
export const printedLengthMm = (meters: number, scale: number) => meters * 1000 / scale;
