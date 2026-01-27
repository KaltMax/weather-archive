# Weather Archive Frontend

React-based frontend for "The Weather Archive" application. The Weather Archive is an interactive web application for exploring historical weather data with visualizations and video playback.

---

## Getting Started

### Prerequisites

- **Node.js**
- **npm**

### Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

---

## Environment Configuration

The frontend uses environment variables to configure the API endpoint.

### Environment Files

- `.env.example` - Template file with placeholder values (committed to git)
- `.env` - Production API endpoint (git-ignored)
- `.env.local` - Local development overrides (git-ignored, highest priority)

### Setup

1. Copy `.env.example` to create your environment files:
   ```bash
   cp .env.example .env
   cp .env.example .env.local
   ```

2. Edit the files with your actual API credentials:

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | API Gateway base URL |
| `VITE_API_KEY` | API key for authenticated endpoints |

### Local Development Options

**Option 1: Use AWS Hosted Backend**

Edit `.env.local`:

```env
VITE_API_BASE_URL=https://your-api-gateway-url.execute-api.region.amazonaws.com/Prod
VITE_API_KEY=your_api_key_here
```

**Option 2: Use SAM Local Backend**

Edit `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_API_KEY=your_api_key_here
```

Then start SAM Local from the infrastructure directory:
```bash
cd ../infrastructure
sam local start-api --port 3001
```

**Note:** `.env.local` takes precedence over `.env`. Restart the dev server after changing environment variables.

---

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot module replacement (HMR) |
| `npm run build` | Build production-ready bundle to `dist/` directory |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint to check code quality |
| `npm test` | Run tests with Vitest and generate coverage report |
| `npm run test:ui` | Run tests with interactive UI and coverage |

---

## Frontend Architecture

### Tech Stack

- **React 19** - UI library with functional components and hooks
- **Vite 7** - Build tool and development server
- **React Router 7** - Client-side routing
- **Material-UI** - Date picker and slider components
- **Recharts** - Interactive weather data charts
- **Tailwind CSS 4** - Styling and responsive design
- **React-Toastify** - Toast notifications
- **Day.js** - Lightweight date manipulation
- **Vitest** - Unit testing framework
- **React Testing Library** - Component testing utilities
- **Axios** - HTTP client for API requests

### Project Structure

```
frontend/
├── src/
│   ├── assets/                      # Static assets (logo, images)
│   ├── components/                  # React components
│   │   ├── DateSelector.jsx         # Date picker component
│   │   ├── Header.jsx               # Navigation header with logo
│   │   ├── Searchbar.jsx            # City search with autocomplete
│   │   ├── TimeSelector.jsx         # Hour selection slider
│   │   ├── VideoCard.jsx            # Video player component
│   │   ├── WeatherDataCard.jsx      # Chart/table visualization
│   │   └── WeatherDataDisplay.jsx   # Main weather page container
│   ├── services/                    # API service layer
│   │   ├── cityApi.js               # City search API
│   │   ├── videoApi.js              # Video URL fetching
│   │   └── weatherDataApi.js        # Weather data fetching
│   ├── App.jsx                      # Main app with routing
│   ├── main.jsx                     # Application entry point
│   └── index.css                    # Global styles and Tailwind imports
├── __test__/                        # Test files
├── test_data/                       # Mock data (videos, etc.)
├── public/                          # Public static files
└── package.json                     # Dependencies and scripts
```

### Component Overview

**Route Components:**
- `App.jsx` - Root component with routing configuration
  - Route: `/` → `Searchbar` (homepage)
  - Route: `/weather/:city` → `WeatherDataDisplay` (weather details)

**UI Components:**
- `Header.jsx` - Logo and navigation
- `Searchbar.jsx` - City search with keyboard navigation and validation
- `WeatherDataDisplay.jsx` - Main weather page orchestrating all child components
- `WeatherDataCard.jsx` - Responsive chart (desktop) and table (mobile) for weather data
- `VideoCard.jsx` - Video player with loading states
- `DateSelector.jsx` - Calendar for date selection
- `TimeSelector.jsx` - Slider for hour selection (0-23)

### Service Layer Architecture

The application uses a **centralized service layer** to abstract API calls from components:

```
Components → Service Functions → API Endpoints
```

**Service Files:**
- `cityApi.js` - City autocomplete functionality
- `weatherDataApi.js` - Fetch weather data for cities
- `videoApi.js` - Fetch video URLs based on city/date/hour

### Key Features

1. **City Search with Autocomplete**
   - Real-time filtering as user types
   - Keyboard navigation (arrow keys, Enter, Escape)
   - Validation to only allow valid cities

2. **Interactive Weather Visualization**
   - Line chart showing temperature, humidity, and air pressure
   - Responsive design (chart on desktop, table on mobile)
   - Highlights currently selected hour

3. **Date and Time Selection**
   - Calendar picker with disabled unavailable dates
   - Hour slider that updates based on available data
   - Real-time filtering of displayed data

4. **Video Playback**
   - Auto-plays video for selected city/date/hour

5. **Responsive Design**
   - Mobile-first approach with Tailwind CSS
   - Adapts to different screen sizes
   - Optimized for both desktop and mobile viewing

---

## Testing

Tests are written using **Vitest** and **React Testing Library**.

Run tests:
```bash
npm test
```

Run tests with interactive browser UI:
```bash
npm run test:ui
```

**Current Test Coverage:**
- `DateSelector.jsx` - Date selection and disabled dates
- `Searchbar.jsx` - User interactions, autocomplete, keyboard navigation
- `TimeSelector.jsx` - Hour slider functionality
- `VideoCard.jsx` - Video loading and playback
- `WeatherDataCard.jsx` - Chart rendering and responsiveness
- `WeatherDataDisplay.jsx` - Integration of child components and data fetching