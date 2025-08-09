import { useEffect, useState } from 'react';
import { socket } from '../socket/socket';
import styles from './Room.module.css';

export default function Room({ keyword, username, onLeave }) {
  const [role, setRole] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit("join_session", { keyword, username });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on("prompt", ({ role, prompt }) => {
      setRole(role);
      setPrompt(prompt);
    });

    socket.on("student_removed", (data) => {
      console.log('[DEBUG] Student removed by instructor:', data);
      alert(`You have been ${data.reason}`);
      if (onLeave) {
        // Don't call API since student is already removed
        // Just clear the frontend state to return to Join page
        onLeave(false); // Pass false to skip API call
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [keyword, username]);

  const handleLeave = async () => {
    if (onLeave) {
      await onLeave();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.sessionInfo}>
          <div className={styles.sessionKeyword}>Session: {keyword}</div>
          <div className={styles.studentName}>Student: {username}</div>
        </div>
        <button 
          className={styles.leaveButton}
          onClick={handleLeave}
        >
          Leave Session
        </button>
      </div>

      <div className={styles.content}>
        <div className={`${styles.statusBadge} ${isConnected ? styles.statusConnected : styles.statusWaiting}`}>
          {isConnected ? 'Connected' : 'Connecting...'}
        </div>

        {role && prompt ? (
          <>
            <h2 className={styles.roleTitle}>
              Your Role: {role.charAt(0).toUpperCase() + role.slice(1)}
            </h2>
            <p className={styles.prompt}>{prompt}</p>
          </>
        ) : (
          <div className={styles.waitingMessage}>
            Waiting for session to start...
          </div>
        )}
      </div>
    </div>
  );
}