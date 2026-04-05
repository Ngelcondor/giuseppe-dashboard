'use client';

import React from 'react';
import { Cloud, CloudRain, Sun, Wind, Droplets } from 'lucide-react';
import { CompactWidget } from '@/components/layout/WidgetWrapper';

interface WeatherData {
  temperature: number;
  feelsLike: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  forecast: Array<{
    day: string;
    high: number;
    low: number;
    condition: string;
  }>;
}

interface WeatherWidgetProps {
  data?: WeatherData;
  isLoading?: boolean;
}

const defaultWeather: WeatherData = {
  temperature: 22,
  feelsLike: 20,
  condition: 'Soleggiato',
  humidity: 65,
  windSpeed: 12,
  forecast: [
    { day: 'Domani', high: 24, low: 18, condition: 'Soleggiato' },
    { day: 'Mercoledì', high: 20, low: 15, condition: 'Nuvoloso' },
    { day: 'Giovedì', high: 18, low: 13, condition: 'Pioggia' },
    { day: 'Venerdì', high: 23, low: 17, condition: 'Soleggiato' },
    { day: 'Sabato', high: 25, low: 19, condition: 'Soleggiato' },
  ],
};

const getWeatherIcon = (condition: string) => {
  switch (condition.toLowerCase()) {
    case 'soleggiato':
      return <Sun size={32} className="text-yellow-400" />;
    case 'nuvoloso':
      return <Cloud size={32} className="text-slate-400" />;
    case 'pioggia':
      return <CloudRain size={32} className="text-blue-400" />;
    default:
      return <Sun size={32} className="text-yellow-400" />;
  }
};

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  data = defaultWeather,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <CompactWidget title="🌤️ Meteo">
        <div className="space-y-3">
          <div className="h-8 bg-slate-700 rounded animate-pulse" />
          <div className="h-4 bg-slate-700 rounded animate-pulse" />
        </div>
      </CompactWidget>
    );
  }

  return (
    <CompactWidget title="🌤️ Meteo">
      <div className="space-y-4">
        {/* Current Weather */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-slate-100">{data.temperature}°C</p>
            <p className="text-sm text-slate-400">Percepito: {data.feelsLike}°C</p>
            <p className="text-sm text-slate-300 mt-1">{data.condition}</p>
          </div>
          <div className="flex-shrink-0">
            {getWeatherIcon(data.condition)}
          </div>
        </div>

        {/* Weather Details */}
        <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <Droplets size={16} className="text-blue-400" />
            <div>
              <p className="text-xs text-slate-400">Umidità</p>
              <p className="text-sm font-medium text-slate-100">{data.humidity}%</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Wind size={16} className="text-cyan-400" />
            <div>
              <p className="text-xs text-slate-400">Vento</p>
              <p className="text-sm font-medium text-slate-100">{data.windSpeed} km/h</p>
            </div>
          </div>
        </div>

        {/* 5-Day Forecast */}
        <div className="pt-4 border-t border-slate-700 space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase">Previsione 5 giorni</p>
          <div className="space-y-1">
            {data.forecast.map((day, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <span className="text-slate-300 w-16">{day.day}</span>
                <span className="text-slate-400">{day.condition}</span>
                <span className="text-slate-100 font-medium w-12 text-right">
                  {day.high}° / {day.low}°
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CompactWidget>
  );
};
