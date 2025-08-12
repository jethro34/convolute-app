import { useEffect, useState } from 'react';
import { socket } from '../socket/socket';
import styles from './Room.module.css';

export default function Room({ keyword, username, onLeave }) {
  const [role, setRole] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pairingInfo, setPairingInfo] = useState(null);
  const [currentPhase, setCurrentPhase] = useState('waiting'); // 'waiting', 'paired', 'discussing', 'break'

  useEffect(() => {
    socket.connect();

    const handleConnect = () => {
      setIsConnected(true);
      console.log('[DEBUG] Emitting join_session:', { keyword, username });
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

    const handleSessionEnded = (data) => {
      console.log('[DEBUG] Session ended by instructor:', data);
      alert('Session has been ended by the instructor');
      if (onLeave) {
        // Don't call API since session is already ended
        onLeave(false); // Pass false to skip API call
      }
    };

    const handlePairingAssignment = (data) => {
      console.log('[DEBUG] Pairing assignment received:', data);
      setPairingInfo(data);
      
      if (data.type === 'break') {
        setCurrentPhase('break');
        setRole(null);
        setPrompt(null);
      } else {
        setCurrentPhase('paired');
        setRole(data.role);
        setPrompt(null); // Clear previous prompt
      }
    };

    const handleDiscussionPrompt = (data) => {
      console.log('[DEBUG] Discussion prompt received:', data);
      setCurrentPhase('discussing');
      setPrompt(data.prompt);
    };

    const handleDiscussionStarted = (data) => {
      console.log('[DEBUG] Discussion started notification received:', data);
      setCurrentPhase('discussing');
      // Talkers don't get prompts, just the start notification
    };

    const handleRoundReset = (data) => {
      console.log('[DEBUG] Round reset notification received:', data);
      // Reset to initial state
      setCurrentPhase('waiting');
      setRole(null);
      setPrompt(null);
      setPairingInfo(null);
    };

    // Debug: Log all incoming events
    const originalOnevent = socket.onevent;
    socket.onevent = function (packet) {
      console.log('[DEBUG] WebSocket event received:', packet.data);
      originalOnevent.call(this, packet);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('prompt', handlePrompt);
    socket.on('student_removed', handleStudentRemoved);
    socket.on('session_ended', handleSessionEnded);
    socket.on('pairing_assignment', handlePairingAssignment);
    socket.on('discussion_prompt', handleDiscussionPrompt);
    socket.on('discussion_started', handleDiscussionStarted);
    socket.on('round_reset', handleRoundReset);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('prompt', handlePrompt);
      socket.off('student_removed', handleStudentRemoved);
      socket.off('session_ended', handleSessionEnded);
      socket.off('pairing_assignment', handlePairingAssignment);
      socket.off('discussion_prompt', handleDiscussionPrompt);
      socket.off('discussion_started', handleDiscussionStarted);
      socket.off('round_reset', handleRoundReset);
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

        {currentPhase === 'waiting' && (
          <div className={styles.roomMessage}>
            Waiting for instructor to start pairings...
          </div>
        )}

        {currentPhase === 'break' && (
          <div className={styles.roomMessage}>
            <h2 className={styles.roomMessage}>Taking a Break</h2>
            <p className={styles.roomMessage}>
              You're sitting out this round. Relax and wait for the next round!
            </p>
          </div>
        )}

        {currentPhase === 'paired' && pairingInfo && (
          <div className={styles.roomMessage}>
            <h2 className={styles.roomMessage}>
              You are the {role}
            </h2>
            <p>
              Paired with: <strong>{pairingInfo.partner}</strong>
            </p>
            <p>
              Waiting for instructor to begin discussion...
            </p>
          </div>
        )}

        {currentPhase === 'discussing' && (
          <div className={styles.roomMessage}>
            <h2 className={styles.roomMessage}>
              Your Role: {role}
            </h2>
            {pairingInfo && (
              <p className={styles.roomMessage}>
                Partner: <strong>{pairingInfo.partner}</strong>
              </p>
            )}
            {role === 'Leader' && prompt && (
              <div>
                <h3 className={styles.roomMessage}>
                  Please read the discussion prompt to <strong>{pairingInfo.partner}</strong>:
                </h3>
                <p className={styles.roomMessage}>{prompt}</p>
              </div>
            )}
            {role === 'Talker' && (
              <p className={styles.roomMessage}>
                Discussion has started. Please answer {pairingInfo?.partner}'s prompt.
              </p>
            )}
          </div>
        )}

        {/* Legacy support for old prompt system */}
        {role && prompt && currentPhase === 'waiting' && (
          <>
            <h2 className={styles.roomMessage}>
              Your Role: {role.charAt(0).toUpperCase() + role.slice(1)}
            </h2>
            <p className={styles.roomMessage}>{prompt}</p>
          </>
        )}
      </div>
    </div>
  );
}