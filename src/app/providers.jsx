'use client';
// src/app/providers.jsx - global client chrome (auth context + navbar + page shell)
import { UserAuthProvider } from '../components/context/UserAuthContext';
import TubelightNavbar from '../components/TubelightNavbar';

export default function Providers({ children }) {
  return (
    <UserAuthProvider>
      <div className="app-container">
        <TubelightNavbar />
        <div className="page-content">{children}</div>
      </div>
    </UserAuthProvider>
  );
}
