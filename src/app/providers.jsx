'use client';
// src/app/providers.jsx - global client chrome (auth context + navbar + page shell)
import { UserAuthProvider } from '../components/context/UserAuthContext';
import Navbar from '../components/Navbar';

export default function Providers({ children }) {
  return (
    <UserAuthProvider>
      <div className="app-container min-h-screen">
        <Navbar />
        <div className="page-content px-4 py-6">{children}</div>
      </div>
    </UserAuthProvider>
  );
}
