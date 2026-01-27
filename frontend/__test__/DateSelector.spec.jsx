import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import dayjs from 'dayjs';
import DateSelector from '../src/components/DateSelector';

// Mock MUI DatePicker components
vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }) => <div data-testid="localization-provider">{children}</div>,
}));

vi.mock('@mui/x-date-pickers/AdapterDayjs', () => ({
  AdapterDayjs: vi.fn(),
}));

vi.mock('@mui/x-date-pickers/DateCalendar', () => ({
  DateCalendar: ({ value, onChange, shouldDisableDate }) => (
    <div data-testid="date-calendar">
      <span data-testid="calendar-value">{value?.format('YYYY-MM-DD')}</span>
      <button onClick={() => onChange(dayjs('2025-01-20'))}>Change Date</button>
      <span data-testid="is-date-disabled">
        {shouldDisableDate(dayjs('2025-01-15')) ? 'disabled' : 'enabled'}
      </span>
    </div>
  ),
}));

describe('DateSelector', () => {
  const mockOnDateChange = vi.fn();
  const availableDates = ['2025-01-15', '2025-01-16', '2025-01-17'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders date calendar with selected date', () => {
    const selectedDate = dayjs('2025-01-15');
    render(
      <DateSelector
        selectedDate={selectedDate}
        onDateChange={mockOnDateChange}
        availableDates={availableDates}
      />
    );

    expect(screen.getByTestId('date-calendar')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-value')).toHaveTextContent('2025-01-15');
  });

  test('disables dates not in availableDates', () => {
    const selectedDate = dayjs('2025-01-15');
    render(
      <DateSelector
        selectedDate={selectedDate}
        onDateChange={mockOnDateChange}
        availableDates={['2025-01-16', '2025-01-17']} // 2025-01-15 NOT included
      />
    );

    // The mock tests shouldDisableDate with 2025-01-15
    expect(screen.getByTestId('is-date-disabled')).toHaveTextContent('disabled');
  });

  test('enables dates in availableDates', () => {
    const selectedDate = dayjs('2025-01-15');
    render(
      <DateSelector
        selectedDate={selectedDate}
        onDateChange={mockOnDateChange}
        availableDates={availableDates} // includes 2025-01-15
      />
    );

    expect(screen.getByTestId('is-date-disabled')).toHaveTextContent('enabled');
  });

  test('calls onDateChange when date changes', () => {
    const selectedDate = dayjs('2025-01-15');
    render(
      <DateSelector
        selectedDate={selectedDate}
        onDateChange={mockOnDateChange}
        availableDates={availableDates}
      />
    );

    const changeButton = screen.getByText('Change Date');
    changeButton.click();

    expect(mockOnDateChange).toHaveBeenCalledWith(dayjs('2025-01-20'));
  });
});
