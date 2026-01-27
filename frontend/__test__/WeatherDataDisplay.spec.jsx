import { render, screen, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WeatherDataDisplay from '../src/components/WeatherDataDisplay';
import * as weatherDataApi from '../src/services/weatherDataApi';

// Mock the API
vi.mock('../src/services/weatherDataApi');

// Mock child components to simplify testing
vi.mock('../src/components/WeatherDataCard', () => ({
  default: ({ dailyData, selectedHour }) => (
    <div data-testid="weather-data-card">
      <span data-testid="daily-data-count">{dailyData?.length || 0}</span>
      <span data-testid="selected-hour">{selectedHour}</span>
    </div>
  ),
}));

vi.mock('../src/components/VideoCard', () => ({
  default: ({ city, date, hour }) => (
    <div data-testid="video-card">
      <span data-testid="video-city">{city}</span>
      <span data-testid="video-date">{date?.format('YYYY-MM-DD')}</span>
      <span data-testid="video-hour">{hour}</span>
    </div>
  ),
}));

vi.mock('../src/components/DateSelector', () => ({
  default: ({ selectedDate, onDateChange, availableDates }) => (
    <div data-testid="date-selector">
      <span data-testid="date-selected">{selectedDate?.format('YYYY-MM-DD')}</span>
      <span data-testid="available-dates-count">{availableDates?.length || 0}</span>
      <button onClick={() => onDateChange(selectedDate)}>Change Date</button>
    </div>
  ),
}));

vi.mock('../src/components/TimeSelector', () => ({
  default: ({ selectedHour, onHourChange, availableHours }) => (
    <div data-testid="time-selector">
      <span data-testid="hour-selected">{selectedHour}</span>
      <span data-testid="available-hours-count">{availableHours?.length || 0}</span>
      <button onClick={(e) => onHourChange(e, 15)}>Change Hour</button>
    </div>
  ),
}));

describe('WeatherDataDisplay', () => {
  const mockWeatherData = [
    { timestamp: '2025-01-15T08:00:00', temperature: 15.5, humidity: 65, airPressure: 1013 },
    { timestamp: '2025-01-15T12:00:00', temperature: 18.2, humidity: 58, airPressure: 1012 },
    { timestamp: '2025-01-15T16:00:00', temperature: 16.4, humidity: 72, airPressure: 1014 },
    { timestamp: '2025-01-16T08:00:00', temperature: 14.1, humidity: 70, airPressure: 1015 },
    { timestamp: '2025-01-16T12:00:00', temperature: 17.8, humidity: 60, airPressure: 1013 },
  ];

  const renderWithRouter = (city = 'Vienna') => {
    return render(
      <MemoryRouter initialEntries={[`/weather/${city}`]}>
        <Routes>
          <Route path="/weather/:city" element={<WeatherDataDisplay />} />
        </Routes>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('displays city name from URL params', async () => {
    weatherDataApi.getWeatherData.mockResolvedValue([]);
    renderWithRouter('Vienna');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Vienna' })).toBeInTheDocument();
    });
  });

  test('fetches weather data on mount', async () => {
    weatherDataApi.getWeatherData.mockResolvedValue(mockWeatherData);
    renderWithRouter('Vienna');

    await waitFor(() => {
      expect(weatherDataApi.getWeatherData).toHaveBeenCalledWith('Vienna');
    });
  });

  test('sets up initial state from weather data', async () => {
    weatherDataApi.getWeatherData.mockResolvedValue(mockWeatherData);
    renderWithRouter('Vienna');

    await waitFor(() => {
      // Extracts 2 unique dates from mock data
      expect(screen.getByTestId('available-dates-count')).toHaveTextContent('2');
      // Sets first date (2025-01-15) as selected
      expect(screen.getByTestId('date-selected')).toHaveTextContent('2025-01-15');
      // Extracts 3 hours (8, 12, 16) for first date
      expect(screen.getByTestId('available-hours-count')).toHaveTextContent('3');
      // Sets first hour (8) as selected
      expect(screen.getByTestId('hour-selected')).toHaveTextContent('8');
    });
  });

  test('filters daily data for selected date', async () => {
    weatherDataApi.getWeatherData.mockResolvedValue(mockWeatherData);
    renderWithRouter('Vienna');

    await waitFor(() => {
      // First date (2025-01-15) has 3 data points
      expect(screen.getByTestId('daily-data-count')).toHaveTextContent('3');
    });
  });

  test('updates selected hour when hour changes', async () => {
    weatherDataApi.getWeatherData.mockResolvedValue(mockWeatherData);
    renderWithRouter('Vienna');

    await waitFor(() => {
      expect(screen.getByTestId('hour-selected')).toHaveTextContent('8');
    });

    const changeHourButton = screen.getByText('Change Hour');

    await act(async () => {
      changeHourButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('hour-selected')).toHaveTextContent('15');
    });
  });
});