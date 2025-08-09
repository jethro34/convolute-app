import { useState } from 'react';
import styles from './Login.module.css';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');

  const handleAuth = async () => {
    setError('');
    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok) {
      if (isLogin) {
        onLogin(data.access_token, email);
      } else {
        setError('Registration successful! Please login.');
        setIsLogin(true);
      }
    } else {
      setError(data.msg || 'Authentication failed');
    }
  };

  const handleSkipLogin = () => {
    onLogin('guest_token', 'Guest Instructor');
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>
          Instructor {isLogin ? 'Login' : 'Signup'}
        </h2>
        
        <div className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Email</label>
            <input 
              className={styles.input}
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="Enter your email" 
              type="email"
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label className={styles.label}>Password</label>
            <input 
              className={styles.input}
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Enter your password" 
              type="password"
            />
          </div>

          <button 
            className={styles.button}
            onClick={handleAuth}
          >
            {isLogin ? 'Login' : 'Sign Up'}
          </button>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.link}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                setIsLogin(!isLogin);
                setError('');
              }}
            >
              {isLogin ? 'Sign up' : 'Login'}
            </a>
          </div>

          <div className={styles.divider}>
            OR
          </div>

          <button 
            className={styles.skipButton}
            onClick={handleSkipLogin}
          >
            Skip Login & Start Session
          </button>
        </div>
      </div>
    </div>
  );
}
