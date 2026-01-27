import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const API_KEY = import.meta.env.VITE_API_KEY;

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': API_KEY,
  },
});

export const getCities = async (query) => {
  console.log(`Fetching city suggestions for query: "${query}" from ${API_BASE_URL}`);

  try {
    const response = await apiClient.get('/cities', {
      params: { query }
    });

    console.log('API Response:', response.data);
    
    // Return the array directly if it's already an array
    return Array.isArray(response.data) ? response.data : [];
  }
  catch (error) {
    console.error('Error fetching city suggestions:', error);
    if (error.response) {
      throw new Error(`API Error: ${error.response.status} - ${error.response.data?.message || error.message}`);
    } else if (error.request) {
      throw new Error('No response from server. Please check if the API is running.');
    } else {
      throw new Error(`Request failed: ${error.message}`);
    }
  }
};