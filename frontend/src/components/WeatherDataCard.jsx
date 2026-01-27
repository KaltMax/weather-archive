import PropTypes from 'prop-types';
import { useCallback } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Dot
} from 'recharts';

// Enable UTC plugin
dayjs.extend(utc);

function WeatherDataCard({ dailyData, selectedHour }) {
  // Prepare chart data from dailyData prop
  const chartData = dailyData ? dailyData.map(data => ({
    time: dayjs.utc(data.timestamp).format('HH:mm'),
    humidity: Math.round(data.humidity),
    temperature: Math.round(data.temperature * 10) / 10,
    pressure: Math.round(data.airPressure)
  })).sort((a, b) => a.time.localeCompare(b.time)) : [];

  // Customize active dot for humidity line based on selected hour
  const humidityActiveDot = useCallback((props) => {
    const { key, ...restProps } = props;
    const isSelected = props.payload.time === String(selectedHour).padStart(2, '0') + ':00';
    return <Dot key={key} {...restProps} r={isSelected ? 6 : 4} fill={isSelected ? '#4444ff' : '#8884d8'} />;
  }, [selectedHour]);

  // Customize active dot for temperature line based on selected hour
  const temperatureActiveDot = useCallback((props) => {
    const { key, ...restProps } = props;
    const isSelected = props.payload.time === String(selectedHour).padStart(2, '0') + ':00';
    return <Dot key={key} {...restProps} r={isSelected ? 6 : 4} fill={isSelected ? '#44aa44' : '#82ca9d'} />;
  }, [selectedHour]);

  // Customize active dot for pressure line based on selected hour
  const pressureActiveDot = useCallback((props) => {
    const { key, ...restProps } = props;
    const isSelected = props.payload.time === String(selectedHour).padStart(2, '0') + ':00';
    return <Dot key={key} {...restProps} r={isSelected ? 6 : 4} fill={isSelected ? '#ff4400' : '#ff7300'} />;
  }, [selectedHour]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold mb-4 text-gray-700">
        Weather Data for {dailyData && dailyData.length > 0 ? dayjs.utc(dailyData[0].timestamp).format('DD.MM.YYYY') : 'Selected Day'}
      </h2>
      {chartData.length > 0 ? (
        <>
          <div className="w-full h-96 hidden md:block">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 120, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="time" />

                <YAxis
                  yAxisId="temperature"
                  orientation="left"
                  domain={['dataMin - 5', 'dataMax + 5']}
                  tickFormatter={(value) => value.toFixed(2)}
                  label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', offset: -12 }}
                  stroke="#82ca9d"
                />

                <YAxis
                  yAxisId="humidity"
                  orientation="right"
                  domain={[0, 100]}
                  label={{ value: 'Humidity (%)', angle: 90, position: 'insideRight', offset: 12 }}
                  stroke="#8884d8"
                />

                <YAxis
                  yAxisId="pressure"
                  orientation="right"
                  domain={['dataMin - 10', 'dataMax + 10']}
                  tickFormatter={(value) => value.toFixed(2)}
                  width={60}
                  tickMargin={6}
                  axisLine
                  label={{ value: 'Pressure (hPa)', angle: 90, position: 'right', offset: 12 }}
                  stroke="#ff7300"
                  className="translate-x-12 [transform-box:fill-box] [transform-origin:center]"
                />

                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'humidity') return [`${value}%`, 'Humidity'];
                    if (name === 'temperature') return [`${value}°C`, 'Temperature'];
                    if (name === 'pressure') return [`${value} hPa`, 'Air Pressure'];
                    return [value, name];
                  }}
                />

                <Legend />
                <Line
                  yAxisId="humidity"
                  type="monotone"
                  dataKey="humidity"
                  stroke="#8884d8"
                  strokeWidth={1}
                  name="Humidity"
                  dot={humidityActiveDot}
                  activeDot={humidityActiveDot}
                />

                <Line
                  yAxisId="temperature"
                  type="monotone"
                  dataKey="temperature"
                  stroke="#82ca9d"
                  strokeWidth={1}
                  name="Temperature"
                  dot={temperatureActiveDot}
                  activeDot={temperatureActiveDot}
                />

                <Line
                  yAxisId="pressure"
                  type="monotone"
                  dataKey="pressure"
                  stroke="#ff7300"
                  strokeWidth={1}
                  name="Air Pressure"
                  dot={pressureActiveDot}
                  activeDot={pressureActiveDot}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="md:hidden w-full overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200">
                <tr className="text-left text-gray-600">
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium text-right">Temp (°C)</th>
                  <th className="px-3 py-2 font-medium text-right">Humidity (%)</th>
                  <th className="px-3 py-2 font-medium text-right">Pressure (hPa)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {chartData.map((row) => {
                  const isSelected = row.time === String(selectedHour).padStart(2, '0') + ':00';
                  return (
                    <tr
                      key={row.time}
                      className={`${isSelected ? 'bg-blue-50' : 'odd:bg-white even:bg-gray-50'} hover:bg-gray-100/60`}
                    >
                      <td className="px-3 py-2 font-medium text-gray-800">{row.time}</td>
                      <td className="px-3 py-2 text-right">{row.temperature.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right">{row.humidity}</td>
                      <td className="px-3 py-2 text-right">{row.pressure}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-3 mb-2 text-center text-gray-500">
          No data available for selected day
        </div>
      )}
    </div>
  );
}

WeatherDataCard.propTypes = {
  dailyData: PropTypes.arrayOf(PropTypes.shape({
    temperature: PropTypes.number,
    humidity: PropTypes.number,
    airPressure: PropTypes.number,
    timestamp: PropTypes.string
  })),
  selectedHour: PropTypes.number,
  payload: PropTypes.object,
  key: PropTypes.string
};

export default WeatherDataCard;