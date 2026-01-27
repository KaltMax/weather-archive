import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { getWeatherData } from '../services/weatherDataApi';
import WeatherDataCard from './WeatherDataCard';
import VideoCard from './VideoCard';
import DateSelector from './DateSelector';
import TimeSelector from './TimeSelector';

// Enable UTC plugin
dayjs.extend(utc);

/**
 * Data flow:
 * 1. Extract city from URL params
 * 2. Fetch weather data for city
 * 3. Extract available dates from data
 * 4. Set first date as selected
 * 5. Filter available hours for selected date
 * 6. User can change date/hour via selectors
 * 7. Chart and video update based on selections
 */

function WeatherDataDisplay() {
  const { city } = useParams();
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedHour, setSelectedHour] = useState(12);
  const [availableDates, setAvailableDates] = useState([]);
  const [availableHours, setAvailableHours] = useState([]);
  const [fetchedWeatherData, setFetchedWeatherData] = useState([]);

  // Update available hours when selected date in DateSelector changes
  const updateAvailableHours = useCallback((dateString) => {
    if (fetchedWeatherData) {
      const hoursForDate = fetchedWeatherData
        .filter(d => dayjs.utc(d.timestamp).format('YYYY-MM-DD') === dateString)
        .map(d => dayjs.utc(d.timestamp).hour())
        .sort((a, b) => a - b);

      setAvailableHours([...new Set(hoursForDate)]);

      if (hoursForDate.length > 0) {
        setSelectedHour(hoursForDate[0]);
      }
    }
  }, [fetchedWeatherData]);

  // Fetch weather data when city changes
  useEffect(() => {
    const fetchData = async () => {
      if (city) {
        const data = await getWeatherData(city);
        setFetchedWeatherData(data);
      }
    };
    fetchData();
  }, [city]);

  // Update available dates when fetched weather data changes
  useEffect(() => {
    if (fetchedWeatherData && fetchedWeatherData.length > 0) {
      const dates = [...new Set(fetchedWeatherData.map(data => dayjs.utc(data.timestamp).format('YYYY-MM-DD')))];
      setAvailableDates(dates);

      if (dates.length > 0) {
        const firstDate = dayjs.utc(dates[0]);
        setSelectedDate(firstDate);
        updateAvailableHours(firstDate.format('YYYY-MM-DD'));
      }
    }
  }, [fetchedWeatherData, updateAvailableHours]);

  // Handle date change from DateSelector component
  const handleDateChange = useCallback((newDate) => {
    const dateString = newDate.format('YYYY-MM-DD');
    if (availableDates.includes(dateString)) {
      setSelectedDate(newDate);
      updateAvailableHours(dateString);
    }
  }, [availableDates, updateAvailableHours]);

  // Handle hour change from TimeSelector component
  const handleHourChange = (event, newValue) => {
    setSelectedHour(newValue);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
        {city || 'Weather Data'}
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 mb-6">

        <VideoCard city={city} date={selectedDate} hour={selectedHour} />
        
        <WeatherDataCard
          dailyData={fetchedWeatherData.filter(d =>
            dayjs.utc(d.timestamp).format('YYYY-MM-DD') === selectedDate.format('YYYY-MM-DD')
          )}
          selectedHour={selectedHour}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DateSelector
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          availableDates={availableDates}
        />

        <TimeSelector
          selectedHour={selectedHour}
          onHourChange={handleHourChange}
          availableHours={availableHours}
        />
      </div>
    </div>
  )
}

export default WeatherDataDisplay;