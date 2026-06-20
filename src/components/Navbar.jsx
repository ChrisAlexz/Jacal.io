import { logger } from '../utils/logger';
import React, { useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import '../styles/Navbar.css';
import logo from '../assets/jacal.jpg';
import DropdownMenu from './DropdownMenu';

// Import the *default* export from UserAuthContext
import UserAuthContext from './context/UserAuthContext';

const Navbar = () => {
  const router = useRouter();
  const { isLoggedIn, user } = useContext(UserAuthContext);

  // REMOVED: Sensitive logging that exposes user data in production
  // logger.debug('Navbar isLoggedIn:', isLoggedIn);
  // logger.debug('Navbar user:', user);

  return (
    <div className="navbar">
      <Link href="/">
        <img src={logo.src} alt="Logo" className="logo" />
      </Link>
      <ul>
        <li><Link href="/">Home</Link></li>
        <li><Link href="/set">Sets</Link></li>
        <li><Link href="/about">About</Link></li>
      </ul>
      <div className="auth-section">
        {isLoggedIn ? (
          <DropdownMenu user={user} />
        ) : (
          <button
            className="signup-button"
            onClick={() => router.push('/register')}
          >
            Sign Up
          </button>
        )}
      </div>
    </div>
  );
};

export default Navbar;