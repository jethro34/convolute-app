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
      <div className={styles.topHeader}>
        <div className={styles.logoCard}>
          LOGO
        </div>
        <button 
          className={styles.leaveButton}
          onClick={handleLeave}
        >
          Leave Session
        </button>
      </div>

      <div className={styles.infoCard}>
        <div className={styles.sessionKeyword}>Keyword: {keyword}</div>
        <div className={styles.studentName}>Username: {username}</div>
        <div className={styles.connectionStatus}>
          <div className={`${styles.connectionDot} ${isConnected ? styles.connected : ''}`}></div>
          {isConnected ? 'Connected' : 'Connecting...'}
        </div>
      </div>

      <div className={styles.content}>

        {currentPhase === 'waiting' && (
          <div className={styles.roomMessage}>
            <p>
              Waiting for the pairings.
            </p>
            <p>
              Please be patient...
            </p>
          </div>
        )}

        {currentPhase === 'break' && (
          <div className={styles.roomMessage}>
            <h2 className={styles.roomMessage}>Break time!</h2>
            <p className={styles.roomMessage}>
              You're sitting out this round.
            </p>
            <p className={styles.roomMessage}>
              Relax and wait for the next round.
            </p>
          </div>
        )}

        {currentPhase === 'paired' && pairingInfo && (
          <>
            <div className={styles.roomMessage}>
              <p>
                Your partner is <strong>{pairingInfo.partner}</strong>.
              </p>
              <p>
                {role === 'Leader' ? (
                  <>You will be <strong>leading</strong> the talk.</>
                ) : (
                  <>You will be <strong>doing</strong> the talk.</>
                )}
              </p>
              <p>
                Please find <strong>{pairingInfo.partner}</strong>.
              </p>
            </div>
            <div className={styles.roomMessage}>
              <p>
                Conversation is starting soon...
              </p>
            </div>
          </>
        )}

        {currentPhase === 'discussing' && (
          <>
            <div className={styles.roomMessage}>
              <p>
                Your partner is <strong>{pairingInfo.partner}</strong>.
              </p>
              <p>
                {role === 'Leader' ? (
                  <>You are <strong>leading</strong> the talk.</>
                ) : (
                  <>You are <strong>doing</strong> the talk.</>
                )}
              </p>
            </div>
            {role === 'Leader' && prompt && (
              <div className={styles.roomMessage}>
                <p>
                  Please <strong>read</strong> the prompt to <strong>{pairingInfo.partner}</strong>:
                </p>
                <p style={{ marginTop: '1rem' }}>
                  {prompt}
                </p>
              </div>
            )}
            {role === 'Talker' && (
              <div className={styles.roomMessage}>
                <p>
                  The conversation has started.
                </p>
                <p>
                  Please <strong>answer</strong> <strong>{pairingInfo?.partner}</strong>'s prompt.
                </p>
              </div>
            )}
          </>
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