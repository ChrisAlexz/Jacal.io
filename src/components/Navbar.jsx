import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Navbar.css';
import logo from '../assets/jacal.jpg';
import DropdownMenu from './DropdownMenu';

// Import the *default* export from UserAuthContext
import UserAuthContext from './context/UserAuthContext';

const Navbar = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useContext(UserAuthContext);

  // REMOVED: Sensitive logging that exposes user data in production
  // console.log('Navbar isLoggedIn:', isLoggedIn);
  // console.log('Navbar user:', user);

  return (
    <div className="navbar">
      <Link to="/">
        <img src={logo} alt="Logo" className="logo" />
      </Link>
      <ul>
        <li><Link to="/">Home</Link></li>
        <li><Link to="/set">Sets</Link></li>
        <li><Link to="/about">About</Link></li>
      </ul>
      <div className="auth-section">
        {isLoggedIn ? (
          <DropdownMenu user={user} />
        ) : (
          <button
            className="signup-button"
            onClick={() => navigate('/register')}
          >
            Sign Up
          </button>
        )}
      </div>
    </div>
  );
};

export default Navbar;