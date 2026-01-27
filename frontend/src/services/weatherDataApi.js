import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const API_KEY = import.meta.env.VITE_API_KEY

// Axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': API_KEY,
  },
});

export const getWeatherData = async (city) => {
  try {
    console.log(`Fetching weather data for ${city} from ${API_BASE_URL}`);

    const response = await apiClient.get(`/weather/${encodeURIComponent(city)}`);

    console.log('Weather data fetched successfully:', response.data);

    return response.data.weatherData || [];
  } catch (error) {
    console.error('Error fetching weather data:', error);

    if (error.response) {
      throw new Error(`API Error: ${error.response.status} - ${error.response.data?.message || error.message}`);
    } else if (error.request) {
      throw new Error('No response from server. Please check if the API is running.');
    } else {
      throw new Error(`Request failed: ${error.message}`);
    }
  }
};