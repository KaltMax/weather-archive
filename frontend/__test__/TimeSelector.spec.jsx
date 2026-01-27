import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import TimeSelector from '../src/components/TimeSelector';

describe('TimeSelector', () => {
  const mockOnHourChange = vi.fn();

  test('shows "no hours available" message when availableHours is empty', () => {
    render(
      <TimeSelector
        selectedHour={12}
        onHourChange={mockOnHourChange}
        availableHours={[]}
      />
    );

    expect(screen.getByText('No hours available for selected date')).toBeInTheDocument();
  });

  test('does not show "no hours available" message when hours exist', () => {
    render(
      <TimeSelector
        selectedHour={12}
        onHourChange={mockOnHourChange}
        availableHours={[0, 1, 2, 3, 4, 5]}
      />
    );

    expect(screen.queryByText('No hours available for selected date')).not.toBeInTheDocument();
  });

  test('slider is disabled when no hours are available', () => {
    render(
      <TimeSelector
        selectedHour={12}
        onHourChange={mockOnHourChange}
        availableHours={[]}
      />
    );

    const slider = screen.getByRole('slider');
    expect(slider).toBeDisabled();
  });

  test('slider is not disabled when hours are available', () => {
    render(
      <TimeSelector
        selectedHour={12}
        onHourChange={mockOnHourChange}
        availableHours={[0, 6, 12, 18]}
      />
    );

    const slider = screen.getByRole('slider');
    expect(slider).not.toBeDisabled();
  });
});
