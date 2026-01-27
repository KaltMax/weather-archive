import PropTypes from 'prop-types';
import Slider from '@mui/material/Slider';

function TimeSelector({ selectedHour, onHourChange, availableHours }) {
  // Generate marks for the slider based on available hours
  const generateHourMarks = () => {
    return availableHours
      .filter(hour => hour % 3 === 0)
      .map(hour => ({
        value: hour,
        label: `${hour}:00`
      }));
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
      <h2 className="text-xl font-bold mb-4 text-gray-700">
        Time Selection (Hour)
      </h2>
      <div className="w-full px-4 py-8">
        <Slider
          value={selectedHour}
          onChange={onHourChange}
          aria-label="Hour selection"
          step={1}
          valueLabelDisplay="auto"
          marks={generateHourMarks()}
          min={availableHours.length > 0 ? Math.min(...availableHours) : 0}
          max={availableHours.length > 0 ? Math.max(...availableHours) : 23}
          disabled={availableHours.length === 0}
        />
      </div>
      {availableHours.length === 0 && (
        <div className="text-gray-500 text-center mt-4">
          No hours available for selected date
        </div>
      )}
    </div>
  );
}

TimeSelector.propTypes = {
  selectedHour: PropTypes.number.isRequired,
  onHourChange: PropTypes.func.isRequired,
  availableHours: PropTypes.array.isRequired
};

export default TimeSelector;