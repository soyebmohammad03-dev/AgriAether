import { describe, expect, it } from 'vitest';
import { UnconfiguredSoilProvider, SoilDataProviderError } from './SoilDataProvider';

describe('UnconfiguredSoilProvider', () => {
  it('always rejects rather than returning an invented reading', async () => {
    const provider = new UnconfiguredSoilProvider();
    await expect(provider.fetchCurrent({ lat: 0, lon: 0 })).rejects.toBeInstanceOf(SoilDataProviderError);
  });
});
