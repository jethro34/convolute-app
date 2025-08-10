// File: src/App.jsx

import { useState } from 'react';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Join from './pages/Join';
import Room from './pages/Room';

export default function App() {
  const [role, setRole] = useState(null);
  const [token, setToken] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [keyword, setKeyword] = useState(null);
  const [username, setUsername] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Restore auth state from localStorage on app load
  useState(() => {
    const initializeApp = async () => {
      const savedAuth = localStorage.getItem('auth_data');
      if (savedAuth) {
        try {
          const authData = JSON.parse(savedAuth);
          // Check if auth data hasn't expired
          if (authData.expiresAt && Date.now() < authData.expiresAt) {
            setToken(authData.token);
            setUserEmail(authData.userEmail);
            setRole(authData.role);
            // Also restore session keyword
            const savedKeyword = localStorage.getItem('session_keyword');
            if (savedKeyword) {
              setKeyword(savedKeyword);
            }
          } else {
            // Auth data expired, need to clean up session
            const savedKeyword = localStorage.getItem('session_keyword');
            if (savedKeyword) {
              try {
                // End the session in the database
                await fetch(`${import.meta.env.VITE_API_URL}/session/${savedKeyword}/end`, {
                  method: 'POST',
                });
                console.log('[DEBUG] Session ended due to auth expiration');
              } catch (error) {
                console.error('Error ending expired session:', error);
              }
            }
            // Clear localStorage
            localStorage.removeItem('auth_data');
            localStorage.removeItem('session_keyword');
          }
        } catch (error) {
          console.error('Error parsing stored auth data:', error);
          localStorage.removeItem('auth_data');
          localStorage.removeItem('session_keyword');
        }
      }
      setIsInitialized(true);
    };
    
    initializeApp();
  });

  const handleInstructorLogin = async (authToken, email) => {
    setToken(authToken);
    setUserEmail(email);
    setRole('instructor');
    
    // Store auth data in localStorage with 24 hour expiration
    const authData = {
      token: authToken,
      userEmail: email,
      role: 'instructor',
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    localStorage.setItem('auth_data', JSON.stringify(authData));
    
    // Check for existing session in localStorage first
    const savedKeyword = localStorage.getItem('session_keyword');
    if (savedKeyword) {
      setKeyword(savedKeyword);
      return;
    }
    
    // Auto-create session after login
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/session/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setKeyword(data.keyword);
      // Save to localStorage for recovery
      localStorage.setItem('session_keyword', data.keyword);
    } catch (error) {
      // For guest mode or if session creation fails, generate a simple keyword
      const demoKeyword = 'DEMO' + Math.random().toString(36).substring(2, 6).toUpperCase();
      setKeyword(demoKeyword);
      localStorage.setItem('session_keyword', demoKeyword);
    }
  };

  const handleLogout = () => {
    // Clear all localStorage when logging out
    localStorage.removeItem('session_keyword');
    localStorage.removeItem('auth_data');
    setToken(null);
    setUserEmail(null);
    setKeyword(null);
    setRole(null);
  };

  // Show loading while initializing to prevent flash
  if (!isInitialized) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  if (!role) return <Landing onSelect={setRole} />;

  if (role === 'instructor') {
    if (!token) return <Login onLogin={handleInstructorLogin} />;
    return <Dashboard 
      keyword={keyword}
      onLogout={handleLogout}
      userEmail={userEmail}
    />;
  }

  const handleStudentLogout = async (callAPI = true) => {
    if (keyword && username && callAPI) {
      try {
        // Call API to remove student from session
        await fetch(`${import.meta.env.VITE_API_URL}/session/${keyword}/students/${encodeURIComponent(username)}/leave`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('Error leaving session:', error);
      }
    }
    
    // Clear student data to return to Join page
    setKeyword(null);
    setUsername(null);
  };

  if (role === 'student') {
    if (!keyword || !username)
      return <Join onJoin={(k, u) => {
        setKeyword(k);
        setUsername(u);
      }} />;
    return <Room 
      keyword={keyword} 
      username={username} 
      onLeave={handleStudentLogout}
    />;
  }

  return <div>Unknown role.</div>;
}
