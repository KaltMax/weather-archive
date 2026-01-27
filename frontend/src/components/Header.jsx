import { Link } from 'react-router-dom';
import weatherLogo from "../assets/Logo_Weather_Archive.png";

function Header() {
  return (
    <header className="w-full flex justify-center py-8">
      <Link to="/" aria-label="Go to homepage">
        <img
          src={weatherLogo}
          alt="Weather Archive Logo"
          className="h-50 cursor-pointer"
        />
      </Link>
    </header>
  )
}

export default Header;