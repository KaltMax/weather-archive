import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { vi } from 'vitest';
import SearchBar from '../src/components/Searchbar';
import * as cityApi from '../src/services/cityApi';

// Mock the cityApi
vi.mock('../src/services/cityApi');

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('SearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cityApi.getCities.mockResolvedValue([]);
  });

  test('renders search input and button', () => {
    render(<SearchBar />);
    expect(screen.getByPlaceholderText('Search for a city...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  test('shows suggestions when typing', async () => {
    const user = userEvent.setup();
    cityApi.getCities.mockResolvedValue(['Vienna', 'Villach']);

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Search for a city...');

    await user.type(input, 'Vie');

    await waitFor(() => {
      expect(screen.getByText('Vienna')).toBeInTheDocument();
      expect(screen.getByText('Villach')).toBeInTheDocument();
    });
  });

  test('filters cities based on query', async () => {
    const user = userEvent.setup();
    cityApi.getCities.mockResolvedValue(['Vienna']);

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Search for a city...');

    await user.type(input, 'Vienna');

    await waitFor(() => {
      expect(cityApi.getCities).toHaveBeenCalledWith('Vienna');
    });
  });

  test('selects suggestion on click', async () => {
    const user = userEvent.setup();
    cityApi.getCities.mockResolvedValue(['Vienna', 'Villach']);

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Search for a city...');

    await user.type(input, 'Vi');

    await waitFor(() => {
      expect(screen.getByText('Vienna')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Vienna'));

    expect(input.value).toBe('Vienna');
  });

  test('navigates to weather page on valid search', async () => {
    const user = userEvent.setup();
    cityApi.getCities.mockResolvedValue(['Vienna']);

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Search for a city...');
    const searchButton = screen.getByRole('button', { name: /search/i });

    await user.type(input, 'Vienna');
    
    // Click on the suggestion to select it
    const suggestion = await screen.findByText('Vienna');
    await user.click(suggestion);
    
    await user.click(searchButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/weather/Vienna');
    });
  });

  test('handles keyboard navigation with ArrowDown', async () => {
    const user = userEvent.setup();
    cityApi.getCities.mockResolvedValue(['Vienna', 'Villach']);

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Search for a city...');

    await user.type(input, 'Vi');

    await waitFor(() => {
      expect(screen.getByText('Vienna')).toBeInTheDocument();
    });

    await user.keyboard('{ArrowDown}');

    // First item should be highlighted
    expect(screen.getByText('Vienna')).toHaveClass('bg-blue-100');
  });

  test('hides suggestions on Escape key', async () => {
    const user = userEvent.setup();
    cityApi.getCities.mockResolvedValue(['Vienna']);

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Search for a city...');

    await user.type(input, 'Vienna');

    await waitFor(() => {
      expect(screen.getByText('Vienna')).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');

    expect(screen.queryByText('Vienna')).not.toBeInTheDocument();
  });
});