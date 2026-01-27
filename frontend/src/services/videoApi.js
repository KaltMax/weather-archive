import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const API_KEY = import.meta.env.VITE_API_KEY

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': API_KEY,
  },
});

export const getVideoUrl = async (city, date, hour) => {
  try {
    console.log(`Fetching video for ${city} on ${date} at hour ${hour} from ${API_BASE_URL}`);

    const response = await apiClient.get(`/video/${encodeURIComponent(city)}`, {
      params: {
        date,
        hour,
      },
    });

    // Extract videoUrl from the response
    return response.data.videoUrl;

  } catch (error) {
    if (error.response) {
      // Server responded with error status
      if (error.response.status === 404) {
        throw new Error(`No video available for ${city} on ${date} at hour ${hour}`);
      }
      throw new Error(`API Error: ${error.response.status} - ${error.response.data?.message || error.message}`);
    } else if (error.request) {
      // No response from server
      throw new Error('No response from server. Please check if the API is running.');
    } else {
      // Request setup error
      throw new Error(`Request failed: ${error.message}`);
    }
  }
};