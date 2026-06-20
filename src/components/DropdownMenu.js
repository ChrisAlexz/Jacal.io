// src/components/DropdownMenu.js - Cleaned up: inline styles moved to CSS
import React, { useRef, useEffect, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import UserAuthContext from './context/UserAuthContext';
import { FaUser, FaCog, FaSignOutAlt, FaClock } from 'react-icons/fa';
import '../styles/DropdownMenu.css';

const DropdownMenu = () => {
  const { user, logout, sessionTimeRemaining } = useContext(UserAuthContext);
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await logout();
    setIsOpen(false);
    router.push('/');
  };

  const toggleDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const formatTimeRemaining = (timeMs) => {
    if (!timeMs || timeMs <= 0) return null;
    const minutes = Math.floor(timeMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
  };

  const getSessionStatusColor = () => {
    if (!sessionTimeRemaining) return '#4facfe';
    const minutes = sessionTimeRemaining / (1000 * 60);
    if (minutes <= 5) return '#ff4757';
    if (minutes <= 15) return '#ffc107';
    return '#28a745';
  };

  const googleIdentity = user?.identities?.find((identity) => identity.provider === 'google');
  const avatarUrl = googleIdentity?.identity_data?.avatar_url || user?.user_metadata?.picture;
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

  return (
    <div className="dropdown-container" ref={dropdownRef}>
      <button
        className="profile-icon"
        onClick={toggleDropdown}
        onMouseDown={(e) => e.preventDefault()}
        type="button"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Profile" className="profile-avatar" />
        ) : (
          <div className="profile-initial">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}

        {sessionTimeRemaining && (
          <div
            className="session-indicator"
            style={{ backgroundColor: getSessionStatusColor() }}
            title={`Session expires in ${formatTimeRemaining(sessionTimeRemaining)}`}
          />
        )}
      </button>

      {isOpen && (
        <div className="dropdown-menu">
          {/* User Info Header */}
          <div className="dropdown-header">
            <div className="user-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="header-avatar" />
              ) : (
                <div className="header-initial">
                  <FaUser />
                </div>
              )}
            </div>
            <div className="user-info">
              <p className="user-name">{displayName}</p>
              <p className="user-email">{user?.email}</p>
            </div>
          </div>

          {/* Session Status */}
          {sessionTimeRemaining && (
            <div className="session-status">
              <div className="session-info">
                <FaClock className="session-icon" />
                <span className="session-text">
                  Session: {formatTimeRemaining(sessionTimeRemaining)} remaining
                </span>
              </div>
              <div className="session-bar" style={{ backgroundColor: getSessionStatusColor() + '20' }}>
                <div
                  className="session-fill"
                  style={{
                    backgroundColor: getSessionStatusColor(),
                    width: `${Math.max(0, Math.min(100, (sessionTimeRemaining / (30 * 60 * 1000)) * 100))}%`
                  }}
                />
              </div>
            </div>
          )}

          <div className="dropdown-divider"></div>

          {/* Menu Items */}
          <div className="dropdown-items">
            <button
              className="dropdown-item"
              onClick={() => { setIsOpen(false); router.push('/set'); }}
            >
              <FaUser className="item-icon" />
              <span>My Sets</span>
            </button>

            <button
              className="dropdown-item"
              onClick={() => { setIsOpen(false); router.push('/about'); }}
            >
              <FaCog className="item-icon" />
              <span>About</span>
            </button>
          </div>

          <div className="dropdown-divider"></div>

          {/* Sign Out */}
          <button className="dropdown-item sign-out" onClick={handleSignOut}>
            <FaSignOutAlt className="item-icon" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;
