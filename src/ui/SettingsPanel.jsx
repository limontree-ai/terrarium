import { RANGES } from '../../shared/worldSettings.js';

export default function SettingsPanel({ settings }) {
  return (
    <section className="settings">
      <h2>World</h2>
      <dl>
        <dt>Weather</dt>
        <dd>{settings.weather}</dd>
        <dt>Time</dt>
        <dd>{settings.timeOfDay}</dd>
        {Object.entries(RANGES).map(([key, { unit }]) => (
          <div key={key} className="row">
            <dt>{key}</dt>
            <dd>
              {Number(settings[key]).toFixed(2)}
              {unit ? ` ${unit}` : ''}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
