// src/components/Home.jsx - Route to MarketingHome or Dashboard based on auth state
import React, { useContext } from 'react';
import UserAuthContext from './context/UserAuthContext';
import MarketingHome from './MarketingHome';
import Dashboard from './Dashboard';
import '../styles/Home.css';

export default function Home() {
  const { user } = useContext(UserAuthContext);
  return user ? <Dashboard /> : <MarketingHome />;
}
