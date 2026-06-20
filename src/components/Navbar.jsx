import React from 'react';
import Link from 'next/link';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/nextjs';
import '../styles/Navbar.css';
import logo from '../assets/jacal.jpg';

const Navbar = () => {
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
        <SignedOut>
          <SignInButton mode="modal">
            <button className="signin-button">Sign In</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="signup-button">Sign Up</button>
          </SignUpButton>
        </SignedOut>
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </div>
    </div>
  );
};

export default Navbar;