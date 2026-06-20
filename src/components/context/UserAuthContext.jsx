'use client';
// src/components/context/UserAuthContext.jsx
// Backed by Clerk. Maps the Clerk user to the shape the rest of the app expects
// ({ id, email, user_metadata: { name, picture } }) so existing consumers keep
// working unchanged. Session lifetime is handled by Clerk; the legacy
// inactivity-timeout fields are kept as inert no-ops for compatibility.
import React, { createContext } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';

const UserAuthContext = createContext({
  isLoggedIn: false,
  user: null,
  isLoaded: false,
  sessionTimeRemaining: null,
  showSessionWarning: false,
  login: () => {},
  logout: () => {},
  extendSession: () => {},
  dismissSessionWarning: () => {},
});

export function UserAuthProvider({ children }) {
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { signOut } = useClerk();

  const user = clerkUser
    ? {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || '',
        user_metadata: {
          name: clerkUser.fullName || clerkUser.firstName || '',
          picture: clerkUser.imageUrl,
        },
      }
    : null;

  const value = {
    isLoggedIn: !!isSignedIn,
    user,
    isLoaded,
    // Legacy fields kept inert for compatibility with existing consumers.
    sessionTimeRemaining: null,
    showSessionWarning: false,
    login: () => {},
    logout: () => signOut({ redirectUrl: '/' }),
    extendSession: () => {},
    dismissSessionWarning: () => {},
  };

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>;
}

export default UserAuthContext;
