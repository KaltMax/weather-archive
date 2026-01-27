import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header.jsx';
import SearchBar from './components/Searchbar.jsx';
import { ToastContainer } from 'react-toastify';
import WeatherDataDisplay from './components/WeatherDataDisplay.jsx';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <Routes>
          <Route path="/" element={
            <div className="flex flex-col items-center justify-center px-8">
              <SearchBar />
            </div>
          } />
          <Route path="/weather/:city" element={
            <div className="px-8">
              <WeatherDataDisplay />
            </div>
          } />
        </Routes>

        <ToastContainer position="bottom-left" />
      </div>
    </Router>
  )
}

export default App
