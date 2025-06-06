// src/components/context/UserAuthContext.jsx - ENHANCED WITH SESSION MANAGEMENT
import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../supabase';

// Session configuration
const SESSION_CONFIG = {
  WARNING_TIME: 5 * 60 * 1000, // 5 minutes in milliseconds
  TIMEOUT_TIME: 30 * 60 * 1000, // 30 minutes in milliseconds
  CHECK_INTERVAL: 60 * 1000, // Check every minute
  STORAGE_KEY: 'user_activity_timestamp'
};

// Create the context
const UserAuthContext = createContext({
  isLoggedIn: false,
  user: null,
  sessionTimeRemaining: null,
  showSessionWarning: false,
  login: () => {},
  logout: () => {},
  extendSession: () => {},
  dismissSessionWarning: () => {}
});

// Session Warning Component
const SessionWarningModal = ({ timeRemaining, onExtend, onLogout, onDismiss }) => {
  const [countdown, setCountdown] = useState(Math.ceil(timeRemaining / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onLogout]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="session-warning-overlay">
      <div className="session-warning-modal">
        <div className="session-warning-header">
          <div className="warning-icon">⚠️</div>
          <h3>Session Expiring Soon</h3>
        </div>
        
        <div className="session-warning-body">
          <p>Your session will expire in:</p>
          <div className="countdown-timer">
            {formatTime(countdown)}
          </div>
          <p>Would you like to extend your session?</p>
        </div>
        
        <div className="session-warning-actions">
          <button 
            className="extend-session-btn"
            onClick={onExtend}
          >
            Extend Session
          </button>
          <button 
            className="logout-now-btn"
            onClick={onLogout}
          >
            Logout Now
          </button>
        </div>
        
        <button 
          className="dismiss-warning-btn"
          onClick={onDismiss}
          title="Continue working (warning will reappear)"
        >
          ×
        </button>
      </div>
    </div>
  );
};

// Provider component
export function UserAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(null);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  
  const sessionIntervalRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const logoutTimeoutRef = useRef(null);

  // Update last activity time
  const updateActivity = useCallback(() => {
    const now = Date.now();
    setLastActivityTime(now);
    localStorage.setItem(SESSION_CONFIG.STORAGE_KEY, now.toString());
    
    // If user was previously inactive, reset session warning
    if (showSessionWarning) {
      setShowSessionWarning(false);
    }
  }, [showSessionWarning]);

  // Activity event listeners
  useEffect(() => {
    if (!user) return;

    const events = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 
      'touchstart', 'click', 'focus', 'blur'
    ];

    const throttledUpdateActivity = throttle(updateActivity, 1000);

    events.forEach(event => {
      document.addEventListener(event, throttledUpdateActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledUpdateActivity, true);
      });
    };
  }, [user, updateActivity]);

  // Session monitoring
  useEffect(() => {
    if (!user) {
      // Clear session monitoring when logged out
      if (sessionIntervalRef.current) {
        clearInterval(sessionIntervalRef.current);
        sessionIntervalRef.current = null;
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
        logoutTimeoutRef.current = null;
      }
      setSessionTimeRemaining(null);
      setShowSessionWarning(false);
      return;
    }

    // Initialize activity tracking
    const storedActivity = localStorage.getItem(SESSION_CONFIG.STORAGE_KEY);
    const initialActivity = storedActivity ? parseInt(storedActivity) : Date.now();
    setLastActivityTime(initialActivity);

    // Session check interval
    sessionIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityTime;
      const remaining = SESSION_CONFIG.TIMEOUT_TIME - timeSinceActivity;

      setSessionTimeRemaining(remaining);

      if (remaining <= 0) {
        // Session expired - force logout
        handleSessionExpiry();
      } else if (remaining <= SESSION_CONFIG.WARNING_TIME && !showSessionWarning) {
        // Show warning
        setShowSessionWarning(true);
      }
    }, SESSION_CONFIG.CHECK_INTERVAL);

    return () => {
      if (sessionIntervalRef.current) {
        clearInterval(sessionIntervalRef.current);
      }
    };
  }, [user, lastActivityTime, showSessionWarning]);

  // Handle session expiry
  const handleSessionExpiry = useCallback(async () => {
    console.log('Session expired due to inactivity');
    
    setShowSessionWarning(false);
    setSessionTimeRemaining(null);
    
    // Clear any pending timeouts
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (logoutTimeoutRef.current) clearTimeout(logoutTimeoutRef.current);
    
    // Logout user
    await logout(true); // Pass flag to indicate it's due to inactivity
  }, []);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error fetching session:', error);
          return;
        }
        
        console.log('UserAuthProvider -> getSession:', session);
        if (session?.user) {
          setUser(session.user);
          updateActivity(); // Initialize activity tracking
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('UserAuthProvider -> onAuthStateChange:', event, session);
        
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          updateActivity();
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          localStorage.removeItem(SESSION_CONFIG.STORAGE_KEY);
          setLastActivityTime(0);
          setShowSessionWarning(false);
          setSessionTimeRemaining(null);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
          updateActivity(); // Reset activity on token refresh
        }
      }
    );

    return () => {
      subscription?.subscription?.unsubscribe();
    };
  }, [updateActivity]);

  // Login function
  const login = useCallback((userData) => {
    setUser(userData);
    updateActivity();
  }, [updateActivity]);

  // Logout function
  const logout = useCallback(async (dueToInactivity = false) => {
    try {
      // Clear session monitoring
      if (sessionIntervalRef.current) {
        clearInterval(sessionIntervalRef.current);
        sessionIntervalRef.current = null;
      }

      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clear local state
      setUser(null);
      setShowSessionWarning(false);
      setSessionTimeRemaining(null);
      setLastActivityTime(0);
      localStorage.removeItem(SESSION_CONFIG.STORAGE_KEY);

      // Show notification if logout was due to inactivity
      if (dueToInactivity) {
        // You can show a toast notification here
        console.log('Logged out due to inactivity');
        // Optional: Show a temporary notification to user
        showInactivityNotification();
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }, []);

  // Extend session
  const extendSession = useCallback(() => {
    updateActivity();
    setShowSessionWarning(false);
    
    // Optionally refresh the auth token
    supabase.auth.refreshSession();
  }, [updateActivity]);

  // Dismiss session warning
  const dismissSessionWarning = useCallback(() => {
    setShowSessionWarning(false);
  }, []);

  // Show inactivity notification
  const showInactivityNotification = () => {
    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.className = 'inactivity-notification';
    notification.textContent = 'You were logged out due to inactivity';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4757;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      animation: slideInRight 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    // Remove notification after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
      }
    }, 5000);
  };

  const contextValue = {
    isLoggedIn: !!user,
    user,
    sessionTimeRemaining,
    showSessionWarning,
    login,
    logout,
    extendSession,
    dismissSessionWarning
  };

  return (
    <UserAuthContext.Provider value={contextValue}>
      {children}
      {showSessionWarning && sessionTimeRemaining && (
        <SessionWarningModal
          timeRemaining={sessionTimeRemaining}
          onExtend={extendSession}
          onLogout={() => logout(false)}
          onDismiss={dismissSessionWarning}
        />
      )}
    </UserAuthContext.Provider>
  );
}

// Utility function to throttle activity updates
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

export default UserAuthContext;