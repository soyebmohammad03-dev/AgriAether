/**
 * The spectral bands this codebase knows how to name. Not every
 * multispectral sensor has every band — see MultispectralReading, which
 * only ever carries the bands a given reading actually has.
 */
export type SpectralBand = 'BLUE' | 'GREEN' | 'RED' | 'RED_EDGE' | 'NIR';

export const SPECTRAL_BAND_WAVELENGTH_NM: Record<SpectralBand, { center: number; range: [number, number] }> = {
  BLUE: { center: 475, range: [450, 500] },
  GREEN: { center: 560, range: [530, 590] },
  RED: { center: 660, range: [630, 690] },
  RED_EDGE: { center: 720, range: [705, 745] },
  NIR: { center: 840, range: [770, 900] }
};
