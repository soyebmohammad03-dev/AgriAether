import { describe, expect, it } from 'vitest';
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  millimetersToInches,
  inchesToMillimeters,
  metersPerSecondToKmPerHour,
  kmPerHourToMetersPerSecond,
  hectopascalsToKilopascals,
  kilopascalsToHectopascals,
  isWithinRange
} from './Units';

describe('Units', () => {
  it('converts Celsius/Fahrenheit round-trip at known fixed points', () => {
    expect(celsiusToFahrenheit(0)).toBeCloseTo(32);
    expect(celsiusToFahrenheit(100)).toBeCloseTo(212);
    expect(fahrenheitToCelsius(32)).toBeCloseTo(0);
    expect(fahrenheitToCelsius(212)).toBeCloseTo(100);
  });

  it('converts mm/inches using the exact 25.4 definition', () => {
    expect(millimetersToInches(25.4)).toBeCloseTo(1);
    expect(inchesToMillimeters(1)).toBeCloseTo(25.4);
  });

  it('converts m/s <-> km/h', () => {
    expect(metersPerSecondToKmPerHour(1)).toBeCloseTo(3.6);
    expect(kmPerHourToMetersPerSecond(3.6)).toBeCloseTo(1);
  });

  it('converts hPa <-> kPa', () => {
    expect(hectopascalsToKilopascals(1013.25)).toBeCloseTo(101.325);
    expect(kilopascalsToHectopascals(101.325)).toBeCloseTo(1013.25);
  });

  it('reports range membership without mutating the value', () => {
    expect(isWithinRange(50, { min: 0, max: 100 })).toBe(true);
    expect(isWithinRange(-1, { min: 0, max: 100 })).toBe(false);
    expect(isWithinRange(NaN, { min: 0, max: 100 })).toBe(false);
  });
});
