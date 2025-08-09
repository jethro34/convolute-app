import { useEffect, useState } from 'react';
import { socket } from '../socket/socket';
import styles from './Room.module.css';

export default function Room({ keyword, username, onLeave }) {
  const [role, setRole] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    socket.connect();

    const handleConnect = () => {
      setIsConnected(true);
      socket.emit("join_session", { keyword, username });
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handlePrompt = ({ role, prompt }) => {
      setRole(role);
      setPrompt(prompt);
    };

    const handleStudentRemoved = (data) => {
      console.log('[DEBUG] Student removed by instructor:', data);
      alert(`You have been ${data.reason}`);
      if (onLeave) {
        // Don't call API since student is already removed
        // Just clear the frontend state to return to Join page
        onLeave(false); // Pass false to skip API call
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('prompt', handlePrompt);
    socket.on('student_removed', handleStudentRemoved);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('prompt', handlePrompt);
      socket.off('student_removed', handleStudentRemoved);
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