import { WeatherWidget } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16, maxWidth: 440 };

export const Barcellona = () => (
  <div style={stage}>
    <WeatherWidget
      data={{
        temperature: 27,
        feelsLike: 29,
        condition: 'Soleggiato',
        humidity: 58,
        windSpeed: 14,
        forecast: [
          { day: 'Domani', high: 28, low: 21, condition: 'Soleggiato' },
          { day: 'Martedì', high: 26, low: 20, condition: 'Nuvoloso' },
          { day: 'Mercoledì', high: 24, low: 19, condition: 'Pioggia' },
          { day: 'Giovedì', high: 27, low: 21, condition: 'Soleggiato' },
          { day: 'Venerdì', high: 29, low: 22, condition: 'Soleggiato' },
        ],
      }}
    />
  </div>
);

export const Predefinito = () => (
  <div style={stage}>
    <WeatherWidget />
  </div>
);
