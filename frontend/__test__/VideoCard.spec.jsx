import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import dayjs from 'dayjs';
import VideoCard from '../src/components/VideoCard';
import * as videoApi from '../src/services/videoApi';
import { toast } from 'react-toastify';

// Mock the videoApi
vi.mock('../src/services/videoApi');

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('VideoCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows "No video available" initially', () => {
    render(<VideoCard city={null} date={null} hour={null} />);
    expect(screen.getByText('No video available')).toBeInTheDocument();
  });

  test('shows loading state while fetching video', async () => {
    // Mock API to delay response
    videoApi.getVideoUrl.mockImplementation(() => new Promise(() => {}));

    render(<VideoCard city="Vienna" date={dayjs('2025-01-15')} hour={12} />);

    await waitFor(() => {
      expect(screen.getByText('Loading video...')).toBeInTheDocument();
    });
  });

  test('renders video element when URL is fetched', async () => {
    const mockVideoUrl = '/test_data/TestVideo.mp4';
    videoApi.getVideoUrl.mockResolvedValue(mockVideoUrl);

    const { container } = render(<VideoCard city="Vienna" date={dayjs('2025-01-15')} hour={12} />);

    await waitFor(() => {
      const video = container.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video.querySelector('source')).toHaveAttribute('src', mockVideoUrl);
    });
  });

  test('calls getVideoUrl with correct parameters', async () => {
    videoApi.getVideoUrl.mockResolvedValue('/test_data/TestVideo.mp4');

    const testDate = dayjs('2025-01-15');
    render(<VideoCard city="Vienna" date={testDate} hour={12} />);

    await waitFor(() => {
      expect(videoApi.getVideoUrl).toHaveBeenCalledWith('Vienna', '2025-01-15', 12);
    });
  });

  test('shows error toast when API fails', async () => {
    // Suppress console.error for this test since we're intentionally triggering an error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    videoApi.getVideoUrl.mockRejectedValue(new Error('API Error'));

    render(<VideoCard city="Vienna" date={dayjs('2025-01-15')} hour={12} />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load video. Please try again later.');
    });

    consoleErrorSpy.mockRestore();
  });

  test('does not fetch video when required props are missing', () => {
    render(<VideoCard city={null} date={null} hour={null} />);
    expect(videoApi.getVideoUrl).not.toHaveBeenCalled();
  });
});
