import type { WeatherResult } from '../weather/WeatherService';

/**
 * Renders the current external weather context, or an honest "unavailable"
 * state — never a fabricated reading. Updated only when a weather refresh
 * completes (roughly every few minutes), not every render frame.
 */
export class WeatherPanel {
  private readonly freshness = document.getElementById('weatherFreshness');
  private readonly temp = document.getElementById('weatherTemp');
  private readonly humidity = document.getElementById('weatherHumidity');
  private readonly wind = document.getElementById('weatherWind');
  private readonly provider = document.getElementById('weatherProvider');

  update(result: WeatherResult | null): void {
    if (!result) {
      this.setText(this.freshness, 'UNAVAILABLE');
      this.freshness?.classList.remove('deferred');
      this.freshness?.classList.add('deferred');
      this.setText(this.temp, '—');
      this.setText(this.humidity, '—');
      this.setText(this.wind, '—');
      this.setText(this.provider, 'none');
      return;
    }

    const { observation, freshness } = result;
    this.setText(this.freshness, freshness);
    this.setText(this.temp, observation.airTemperatureC !== null ? `${observation.airTemperatureC.toFixed(1)}°C` : 'n/a');
    this.setText(this.humidity, observation.relativeHumidityPercent !== null ? `${observation.relativeHumidityPercent.toFixed(0)}%` : 'n/a');
    this.setText(
      this.wind,
      observation.windSpeedMs !== null ? `${observation.windSpeedMs.toFixed(1)} m/s${observation.windDirectionDeg !== null ? ` @ ${observation.windDirectionDeg.toFixed(0)}°` : ''}` : 'n/a'
    );
    this.setText(this.provider, observation.provider);
  }

  private setText(el: HTMLElement | null, text: string): void {
    if (el) el.textContent = text;
  }
}
