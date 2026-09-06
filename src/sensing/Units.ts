/**
 * Explicit, testable unit conversions for the small set of unit pairs
 * AgriAether actually needs to convert between. Nothing here invents a
 * conversion factor — each one is a standard, checkable physical
 * relationship, cited in the comment above it.
 *
 * This module does not decide which unit an Observation is stored in — see
 * `MeasurementContract.ts` for the canonical unit per quantity. It only lets
 * a caller (e.g. a UI that wants Fahrenheit, or a future provider that
 * reports mm/h instead of mm) convert without duplicating arithmetic.
 */

/** Exact SI definition: 1 °F = (°C × 9/5) + 32. */
export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return ((fahrenheit - 32) * 5) / 9;
}

/** 1 inch = 25.4 mm exactly (international inch). */
export function millimetersToInches(mm: number): number {
  return mm / 25.4;
}

export function inchesToMillimeters(inches: number): number {
  return inches * 25.4;
}

/** 1 m/s = 3.6 km/h exactly. */
export function metersPerSecondToKmPerHour(ms: number): number {
  return ms * 3.6;
}

export function kmPerHourToMetersPerSecond(kmh: number): number {
  return kmh / 3.6;
}

/** 1 hPa = 1 mbar exactly; kPa = hPa / 10. */
export function hectopascalsToKilopascals(hpa: number): number {
  return hpa / 10;
}

export function kilopascalsToHectopascals(kpa: number): number {
  return kpa * 10;
}

/**
 * A physically plausible closed range for a quantity — used to flag
 * OUT_OF_RANGE data quality (see DataQuality.ts) rather than to reject or
 * silently clamp a value. Bounds are the same "generous real-world extreme,
 * not normal-operating-range" philosophy already used in
 * weather/WeatherObservation.ts's PLAUSIBLE_RANGES.
 */
export interface PlausibleRange {
  min: number;
  max: number;
}

export function isWithinRange(value: number, range: PlausibleRange): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}
