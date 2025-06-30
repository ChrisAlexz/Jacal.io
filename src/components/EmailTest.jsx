// src/components/EmailTest.jsx - Component to test Hostinger email setup
import React, { useState } from 'react';
import { emailService } from '../utils/emailService';

const EmailTest = () => {
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState(null);

  const handleTestConnection = async () => {
    setLoading(true);
    setMessage('');
    setError('');
    
    try {
      const result = await emailService.checkConnection();
      setConnectionStatus(result);
      setMessage('✅ SMTP connection successful!');
    } catch (err) {
      setError(`❌ Connection failed: ${err.message}`);
      setConnectionStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestEmail = async (e) => {
    e.preventDefault();
    
    if (!testEmail) {
      setError('Please enter a test email address');
      return;
    }

    setLoading(true);
    setMessage('');
    setError('');
    
    try {
      await emailService.testEmailService(testEmail);
      setMessage('✅ Test email sent successfully! Check your inbox.');
    } catch (err) {
      setError(`❌ Failed to send test email: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '50px auto', 
      padding: '30px', 
      border: '1px solid #ddd', 
      borderRadius: '12px',
      backgroundColor: '#f9f9f9'
    }}>
      <h2 style={{ color: '#4facfe', marginBottom: '30px' }}>🧠 Jacal Email Service Test</h2>
      
      {/* Connection Test */}
      <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: 'white', borderRadius: '8px' }}>
        <h3>📡 SMTP Connection Test</h3>
        <button 
          onClick={handleTestConnection}
          disabled={loading}
          style={{
            backgroundColor: '#4facfe',
            color: 'white',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            marginBottom: '15px'
          }}
        >
          {loading ? 'Testing...' : 'Test SMTP Connection'}
        </button>
        
        {connectionStatus && (
          <div style={{ 
            backgroundColor: '#e8f5e8', 
            padding: '15px', 
            borderRadius: '6px',
            fontSize: '14px'
          }}>
            <strong>Connection Details:</strong>
            <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
              <li>Host: {connectionStatus.config?.host}</li>
              <li>Port: {connectionStatus.config?.port}</li>
              <li>User: {connectionStatus.config?.user}</li>
              <li>Status: {connectionStatus.success ? '✅ Connected' : '❌ Failed'}</li>
            </ul>
          </div>
        )}
      </div>

      {/* Test Email */}
      <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: 'white', borderRadius: '8px' }}>
        <h3>📧 Send Test Email</h3>
        <form onSubmit={handleSendTestEmail}>
          <input
            type="email"
            placeholder="Enter your email to receive test email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '16px',
              marginBottom: '15px',
              boxSizing: 'border-box'
            }}
            required
          />
          <button 
            type="submit"
            disabled={loading || !testEmail}
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '6px',
              cursor: loading || !testEmail ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              opacity: loading || !testEmail ? 0.6 : 1
            }}
          >
            {loading ? 'Sending...' : 'Send Test Email'}
          </button>
        </form>
      </div>

      {/* Messages */}
      {message && (
        <div style={{ 
          backgroundColor: '#d4edda', 
          color: '#155724',
          padding: '15px', 
          borderRadius: '6px',
          marginBottom: '15px',
          border: '1px solid #c3e6cb'
        }}>
          {message}
        </div>
      )}

      {error && (
        <div style={{ 
          backgroundColor: '#f8d7da', 
          color: '#721c24',
          padding: '15px', 
          borderRadius: '6px',
          marginBottom: '15px',
          border: '1px solid #f5c6cb'
        }}>
          {error}
        </div>
      )}

      {/* Instructions */}
      <div style={{ 
        backgroundColor: '#fff3cd', 
        padding: '20px', 
        borderRadius: '8px',
        border: '1px solid #ffeaa7'
      }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#856404' }}>📋 Setup Instructions:</h4>
        <ol style={{ color: '#856404', lineHeight: '1.6' }}>
          <li>Make sure you've installed nodemailer: <code>npm install nodemailer</code></li>
          <li>Update your <code>.env</code> file with Hostinger credentials:
            <pre style={{ 
              backgroundColor: '#f8f9fa', 
              padding: '10px', 
              borderRadius: '4px',
              fontSize: '12px',
              margin: '10px 0',
              overflow: 'auto'
            }}>
{`HOSTINGER_EMAIL_USER=support@jacal.io
HOSTINGER_EMAIL_PASSWORD=your_hostinger_password`}
            </pre>
          </li>
          <li>Start your server: <code>npm run dev</code></li>
          <li>Test the connection above</li>
          <li>Send a test email to verify everything works</li>
        </ol>
      </div>
    </div>
  );
};

export default EmailTest;