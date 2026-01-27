import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import WeatherDataCard from '../src/components/WeatherDataCard';

// Mock recharts to avoid rendering complexity in tests
vi.mock('recharts', () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  Dot: (props) => <div data-testid="dot" {...props} />,
}));

describe('WeatherDataCard', () => {
  const mockDailyData = [
    {
      timestamp: '2025-01-15T09:00:00',
      temperature: 15.67,
      humidity: 65.4,
      airPressure: 1013.3,
    },
    {
      timestamp: '2025-01-15T13:00:00',
      temperature: 18.23,
      humidity: 58.9,
      airPressure: 1011.8,
    },
    {
      timestamp: '2025-01-15T17:00:00',
      temperature: 16.45,
      humidity: 72.1,
      airPressure: 1014.5,
    },
  ];

  test('renders "No data available" message when dailyData is empty', () => {
    render(<WeatherDataCard dailyData={[]} selectedHour={12} />);
    expect(screen.getByText('No data available for selected day')).toBeInTheDocument();
  });

  test('renders "No data available" message when dailyData is null', () => {
    render(<WeatherDataCard dailyData={null} selectedHour={12} />);
    expect(screen.getByText('No data available for selected day')).toBeInTheDocument();
  });

  test('displays correct date in header when data is provided', () => {
    render(<WeatherDataCard dailyData={mockDailyData} selectedHour={12} />);
    expect(screen.getByText('Weather Data for 15.01.2025')).toBeInTheDocument();
  });

  test('displays fallback header text when no data is available', () => {
    render(<WeatherDataCard dailyData={null} selectedHour={12} />);
    expect(screen.getByText(/Weather Data for Selected Day/)).toBeInTheDocument();
  });

  test('displays correctly formatted data in mobile table', () => {
    render(<WeatherDataCard dailyData={mockDailyData} selectedHour={9} />);

    // Check for formatted time values
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('13:00')).toBeInTheDocument();
    expect(screen.getByText('17:00')).toBeInTheDocument();

    // Check for rounded values (temperature rounded to 1 decimal)
    expect(screen.getByText('15.7')).toBeInTheDocument();
    expect(screen.getByText('18.2')).toBeInTheDocument();

    // Check for rounded humidity (no decimals)
    expect(screen.getByText('65')).toBeInTheDocument();
    expect(screen.getByText('59')).toBeInTheDocument();

    // Check for rounded pressure (no decimals)
    expect(screen.getByText('1013')).toBeInTheDocument();
    expect(screen.getByText('1012')).toBeInTheDocument();
    expect(screen.getByText('1015')).toBeInTheDocument();
  });

  test('highlights selected hour row in mobile table', () => {
    const { container } = render(<WeatherDataCard dailyData={mockDailyData} selectedHour={13} />);

    // Find all table rows in tbody
    const rows = container.querySelectorAll('tbody tr');

    // Find the row with 13:00
    const selectedRow = Array.from(rows).find(row => row.textContent.includes('13:00'));

    expect(selectedRow).toBeDefined();
    expect(selectedRow).toHaveClass('bg-blue-50');
  });

  test('does not highlight non-selected hour rows', () => {
    const { container } = render(<WeatherDataCard dailyData={mockDailyData} selectedHour={13} />);

    const rows = container.querySelectorAll('tbody tr');

    // Find the row with 09:00 (not selected)
    const nonSelectedRow = Array.from(rows).find(row => row.textContent.includes('09:00'));

    expect(nonSelectedRow).toBeDefined();
    expect(nonSelectedRow).not.toHaveClass('bg-blue-50');
  });

  test('sorts data by time in ascending order', () => {
    const unsortedData = [
      { timestamp: '2025-01-15T17:00:00', temperature: 16.45, humidity: 72.1, airPressure: 1014.5 },
      { timestamp: '2025-01-15T09:00:00', temperature: 15.67, humidity: 65.4, airPressure: 1013.25 },
      { timestamp: '2025-01-15T13:00:00', temperature: 18.23, humidity: 58.9, airPressure: 1012.8 },
    ];

    const { container } = render(<WeatherDataCard dailyData={unsortedData} selectedHour={13} />);

    const timeColumns = Array.from(container.querySelectorAll('tbody td:first-child'));
    const times = timeColumns.map(td => td.textContent);

    expect(times).toEqual(['09:00', '13:00', '17:00']);
  });
});
