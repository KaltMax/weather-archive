import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getCities } from '../services/cityApi';

function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [cities, setCities] = useState([]);

  // Fetch cities when query changes (with debouncing)
  useEffect(() => {
    // Don't fetch if query is empty
    if (query.length === 0) {
      setCities([]);
      return;
    }

    // Debounce: wait 400ms after user stops typing
    const debounceTimer = setTimeout(async () => {
      try {
        const result = await getCities(query);
        setCities(result);
      } catch (error) {
        console.error('Failed to fetch cities:', error);
        setCities([]);
      }
    }, 400);

    // Cleanup: cancel the timer if query changes before timeout
    return () => clearTimeout(debounceTimer);
  }, [query]);

  // Handle input change of the search bar
  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setShowSuggestions(e.target.value.length > 0);
    setSelectedIndex(-1);
  };

  // Handle clicking on a suggestion
  const handleSuggestionClick = (city) => {
    setQuery(city);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  // Handle search action and navigate if a valid city is selected
  const handleSearch = () => {
    const matchedCity = cities.find(city => city.toLowerCase() === query.toLowerCase());
    if (matchedCity) {
      navigate(`/weather/${encodeURIComponent(matchedCity)}`);
    } else {
      toast.error('Please select a valid city from the autocomplete suggestions.');
    }
  };

  // Handle keyboard navigation in suggestions
  const handleKeyDown = (e) => {
    if (!showSuggestions || cities.length === 0) {
      if (e.key === 'Enter') {
        handleSearch();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < cities.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : cities.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          setQuery(cities[selectedIndex]);
          setShowSuggestions(false);
          setSelectedIndex(-1);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto relative">
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search for a city..."
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
          />

          {showSuggestions && cities.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border-2 border-gray-200 border-t-0 rounded-b-lg shadow-lg z-10 max-h-60 overflow-y-auto">
              {cities.map((city, index) => (
                <div
                  key={city}
                  onClick={() => handleSuggestionClick(city)}
                  className={`px-4 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 ${index === selectedIndex
                      ? 'bg-blue-100 text-blue-800'
                      : 'hover:bg-gray-100'
                    }`}
                >
                  {city}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleSearch}
          className="px-8 py-3 text-lg bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Search
        </button>
      </div>
    </div>
  );
}

export default SearchBar;