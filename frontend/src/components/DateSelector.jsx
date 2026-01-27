import PropTypes from 'prop-types';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';

function DateSelector({ selectedDate, onDateChange, availableDates }) {
  const shouldDisableDate = (date) => {
    return !availableDates.includes(date.format('YYYY-MM-DD'));
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-1">
      <h2 className="text-xl font-bold mb-4 text-gray-700">
        Date Selection
      </h2>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DateCalendar
          value={selectedDate}
          onChange={onDateChange}
          shouldDisableDate={shouldDisableDate}
        />
      </LocalizationProvider>
    </div>
  );
}

DateSelector.propTypes = {
  selectedDate: PropTypes.object.isRequired,
  onDateChange: PropTypes.func.isRequired,
  availableDates: PropTypes.array.isRequired
};

export default DateSelector;