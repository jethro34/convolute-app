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

  const handleInstructorLogin = async (authToken, email) => {
    setToken(authToken);
    setUserEmail(email);
    
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
    // Clear localStorage when logging out
    localStorage.removeItem('session_keyword');
    setToken(null);
    setUserEmail(null);
    setKeyword(null);
    setRole(null);
  };

  if (!role) return <Landing onSelect={setRole} />;

  if (role === 'instructor') {
    if (!token) return <Login onLogin={handleInstructorLogin} />;
    return <Dashboard 
      token={token} 
      keyword={keyword} 
      setKeyword={setKeyword}
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
