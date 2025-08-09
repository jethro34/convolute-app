import { useState } from 'react';
import styles from './Join.module.css';

export default function Join({ onJoin }) {
  const [keyword, setKeyword] = useState('');
  const [username, setUsername] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e) => {
    e.preventDefault();
    
    if (!keyword.trim() || !username.trim()) {
      setError('Please enter both keyword and username');
      return;
    }

    setJoining(true);
    setError('');

    try {
      const trimmedKeyword = keyword.trim().toUpperCase();
      const trimmedUsername = username.trim();

      // Try to join the session
      const res = await fetch(`${import.meta.env.VITE_API_URL}/session/${trimmedKeyword}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: trimmedUsername }),
      });

      const data = await res.json();

      if (res.ok) {
        // Successfully joined - call the parent callback
        onJoin(trimmedKeyword, trimmedUsername);
      } else {
        // Show specific error from server
        setError(data.message || 'Failed to join session');
      }
    } catch (error) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleBack = () => {
    window.location.reload(); // Simple way to go back to role selection
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Join Session</h1>
        <p className={styles.subtitle}>
          Enter the session keyword provided by your instructor and choose your name
        </p>
        
        <form onSubmit={handleJoin} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Session Keyword</label>
            <input 
              className={`${styles.input} ${styles.keywordInput}`}
              value={keyword} 
              onChange={e => setKeyword(e.target.value)} 
              placeholder="Enter session keyword..." 
              disabled={joining}
              maxLength={20}
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label className={styles.label}>Your Name</label>
            <input 
              className={styles.input}
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              placeholder="Enter your name..." 
              disabled={joining}
              maxLength={50}
            />
          </div>

          <button 
            type="submit"
            className={styles.button}
            disabled={joining || !keyword.trim() || !username.trim()}
          >
            {joining ? 'Joining...' : 'Join Session'}
          </button>

          {error && (
            <div className={styles.error}>{error}</div>
          )}

          <div className={styles.backLink}>
            <a href="#" onClick={(e) => { e.preventDefault(); handleBack(); }}>
              ← Back to home
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
