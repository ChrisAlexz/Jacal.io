// src/components/DropdownMenu.js - FIXED FOR NAVBAR INTEGRATION
import React, { useRef, useEffect, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserAuthContext from './context/UserAuthContext';
import { FaUser, FaCog, FaSignOutAlt, FaClock } from 'react-icons/fa';
import '../styles/DropdownMenu.css';

const DropdownMenu = () => {
  const { user, logout, sessionTimeRemaining } = useContext(UserAuthContext);
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Keep existing useEffect and handlers the same
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    await logout();
    setIsOpen(false);
    navigate('/');
  };

  const toggleDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Profile icon clicked!', isOpen); // Debug log
    setIsOpen(!isOpen);
  };

  // Format session time remaining
  const formatTimeRemaining = (timeMs) => {
    if (!timeMs || timeMs <= 0) return null;
    
    const minutes = Math.floor(timeMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    } else {
      return `${remainingMinutes}m`;
    }
  };

  // Get session status color
  const getSessionStatusColor = () => {
    if (!sessionTimeRemaining) return '#4facfe';
    
    const minutes = sessionTimeRemaining / (1000 * 60);
    if (minutes <= 5) return '#ff4757'; // Red for < 5 minutes
    if (minutes <= 15) return '#ffc107'; // Yellow for < 15 minutes
    return '#28a745'; // Green for > 15 minutes
  };

  // Updated avatar URL retrieval (keeping your existing logic)
  const googleIdentity = user?.identities?.find(
    (identity) => identity.provider === 'google'
  );
  const avatarUrl = googleIdentity?.identity_data?.avatar_url || 
                    user?.user_metadata?.picture;
  const displayName = user?.user_metadata?.name || 
                     user?.email?.split('@')[0] || 
                     'User';

  return (
    <div className="dropdown-container" ref={dropdownRef}>
      {/* Make sure this matches your Navbar expectations */}
      <button 
        className="profile-icon" 
        onClick={toggleDropdown}
        onMouseDown={(e) => e.preventDefault()} // Prevent focus issues
        type="button"
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'pointer',
          borderRadius: '50%',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt="Profile" 
            className="profile-avatar"
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              objectFit: 'cover',
              pointerEvents: 'none'
            }}
          />
        ) : (
          <div 
            className="profile-initial"
            style={{
              color: 'white',
              fontWeight: '600',
              fontSize: '1rem',
              backgroundColor: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              pointerEvents: 'none'
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        
        {/* Session indicator */}
        {sessionTimeRemaining && (
          <div 
            className="session-indicator"
            style={{ 
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              border: '2px solid #0a0a0a',
              backgroundColor: getSessionStatusColor(),
              pointerEvents: 'none'
            }}
            title={`Session expires in ${formatTimeRemaining(sessionTimeRemaining)}`}
          />
        )}
      </button>
      
      {isOpen && (
        <div className="dropdown-menu" style={{ 
          display: 'block',
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          background: 'rgba(30, 30, 30, 0.98)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
          minWidth: '280px',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          {/* User Info Header */}
          <div className="dropdown-header" style={{
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(79, 172, 254, 0.1) 0%, rgba(0, 242, 254, 0.1) 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div className="user-avatar" style={{ flexShrink: 0 }}>
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt="Profile" 
                  className="header-avatar" 
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid rgba(255, 255, 255, 0.2)'
                  }}
                />
              ) : (
                <div 
                  className="header-initial"
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '1.2rem',
                    border: '2px solid rgba(255, 255, 255, 0.2)'
                  }}
                >
                  <FaUser />
                </div>
              )}
            </div>
            <div className="user-info" style={{ flex: 1, minWidth: 0 }}>
              <p className="user-name" style={{
                color: 'white',
                fontWeight: '600',
                fontSize: '1rem',
                margin: '0 0 4px 0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {displayName}
              </p>
              <p className="user-email" style={{
                color: '#aaa',
                fontSize: '0.85rem',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {user?.email}
              </p>
            </div>
          </div>

          {/* Session Status */}
          {sessionTimeRemaining && (
            <div className="session-status" style={{
              padding: '16px 20px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div className="session-info" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px'
              }}>
                <FaClock className="session-icon" style={{ color: '#aaa', fontSize: '0.85rem' }} />
                <span className="session-text" style={{
                  color: '#ccc',
                  fontSize: '0.85rem',
                  fontWeight: '500'
                }}>
                  Session: {formatTimeRemaining(sessionTimeRemaining)} remaining
                </span>
              </div>
              <div 
                className="session-bar"
                style={{
                  width: '100%',
                  height: '4px',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  backgroundColor: getSessionStatusColor() + '20'
                }}
              >
                <div 
                  className="session-fill"
                  style={{ 
                    height: '100%',
                    borderRadius: '2px',
                    transition: 'all 0.3s ease',
                    backgroundColor: getSessionStatusColor(),
                    width: `${Math.max(0, Math.min(100, (sessionTimeRemaining / (30 * 60 * 1000)) * 100))}%`
                  }}
                />
              </div>
            </div>
          )}

          <div className="dropdown-divider" style={{
            height: '1px',
            background: 'rgba(255, 255, 255, 0.1)',
            margin: 0
          }}></div>

          {/* Menu Items */}
          <div className="dropdown-items" style={{ padding: '8px 0' }}>
            <button 
              className="dropdown-item"
              onClick={() => {
                setIsOpen(false);
                navigate('/set');
              }}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: '#ccc',
                padding: '12px 20px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '0.95rem',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                e.target.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'none';
                e.target.style.color = '#ccc';
              }}
            >
              <FaUser className="item-icon" style={{ fontSize: '1rem', width: '16px', textAlign: 'center' }} />
              <span>My Sets</span>
            </button>
            
            <button 
              className="dropdown-item"
              onClick={() => {
                setIsOpen(false);
                navigate('/about');
              }}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: '#ccc',
                padding: '12px 20px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '0.95rem',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                e.target.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'none';
                e.target.style.color = '#ccc';
              }}
            >
              <FaCog className="item-icon" style={{ fontSize: '1rem', width: '16px', textAlign: 'center' }} />
              <span>About</span>
            </button>
          </div>

          <div className="dropdown-divider" style={{
            height: '1px',
            background: 'rgba(255, 255, 255, 0.1)',
            margin: 0
          }}></div>

          {/* Sign Out */}
          <button 
            className="dropdown-item sign-out" 
            onClick={handleSignOut}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: '#ff6b6b',
              padding: '16px 20px 16px 20px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '0.95rem',
              fontWeight: '500',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              marginTop: '4px'
            }}
          >
            <FaSignOutAlt className="item-icon" style={{ fontSize: '1rem', width: '16px', textAlign: 'center' }} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;