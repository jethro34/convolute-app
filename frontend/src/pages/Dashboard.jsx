import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { io } from 'socket.io-client';
import styles from './Dashboard.module.css';

export default function Dashboard({ keyword, onLogout, userEmail }) {
  const [students, setStudents] = useState([]);
  const [newStudentName, setNewStudentName] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedPromptFilter, setSelectedPromptFilter] = useState('');
  const [sessionStatus, setSessionStatus] = useState('inactive');
  const [timeRemaining, setTimeRemaining] = useState(60); // Default to 1 minute (pairingDuration)
  const [timerRunning, setTimerRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pairingDuration, setPairingDuration] = useState(1); // minutes
  const [talkingDuration, setTalkingDuration] = useState(3); // minutes
  const [instructorParticipating, setInstructorParticipating] = useState(false);
  const processedStudents = useRef(new Set());
  const [pairings, setPairings] = useState([]);
  const [currentPairingObjects, setCurrentPairingObjects] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (timerRunning && !isPaused) {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Timer reached 0, trigger automatic transition
            setTimerRunning(false);
            if (sessionStatus === 'pairing') {
              // Auto-transition from pairing to talking
              setTimeout(() => handleStatusChange(), 100);
            } else if (sessionStatus === 'talking') {
              // Auto-transition from talking to inactive (next round)
              setTimeout(() => handleStatusChange(), 100);
            }
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [timerRunning, isPaused, sessionStatus]);

  useEffect(() => {
    if (keyword && !socket) {
      fetchStudents();
      setupWebSocket();
      fetchAvailableTags();
    }
    return () => {
      if (socket && socket.cleanup) {
        socket.cleanup();
      }
    };
  }, [keyword, socket]);

  const setupWebSocket = () => {
    // Socket.IO connects to base URL, not /api endpoint
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const socketUrl = apiUrl.replace('/api', '');
    
    console.log('[DEBUG] setupWebSocket called');
    console.log('[DEBUG] API URL:', apiUrl);
    console.log('[DEBUG] Socket URL:', socketUrl);
    
    const newSocket = io(socketUrl, {
      autoConnect: true,
      transports: ['polling', 'websocket']
    });

    const handleConnect = () => {
      console.log('[DEBUG] WebSocket connected to server');
      setIsConnected(true);
      // Join the instructor room for this session
      console.log('[DEBUG] Emitting join_instructor_room with keyword:', keyword);
      newSocket.emit('join_instructor_room', { keyword });
    };

    const handleDisconnect = () => {
      console.log('[DEBUG] WebSocket disconnected from server');
      setIsConnected(false);
    };

    const handleInstructorJoined = (data) => {
      console.log('[DEBUG] Instructor joined room:', data.message);
    };

    const handleStudentJoined = (data) => {
      const studentKey = `${data.student.id}_${data.student.joined_at}`;
      
      if (processedStudents.current.has(studentKey)) {
        console.log('[DEBUG] Student event already processed, skipping:', studentKey);
        return;
      }
      
      processedStudents.current.add(studentKey);
      console.log('[DEBUG] Received student_joined event:', data);
      
      // Add the new student to the list with flushSync to prevent double execution
      flushSync(() => {
        setStudents(prev => {
          // Check if student already exists (prevent duplicates)
          const exists = prev.find(s => s.id === data.student.id);
          if (exists) {
            console.log('[DEBUG] Student already exists in list, skipping');
            return prev;
          }
          console.log('[DEBUG] Adding new student to list:', data.student);
          return [...prev, data.student];
        });
      });
    };

    const handleStudentLeft = (data) => {
      console.log('[DEBUG] Received student_left event:', data);
      // Remove the student from the list
      setStudents(prev => prev.filter(s => s.id !== data.student.id));
    };

    const handleConnectError = (error) => {
      console.error('[DEBUG] WebSocket connection error:', error);
    };
    
    newSocket.on('connect', handleConnect);
    newSocket.on('disconnect', handleDisconnect);
    newSocket.on('instructor_joined', handleInstructorJoined);
    newSocket.on('student_joined', handleStudentJoined);
    newSocket.on('student_left', handleStudentLeft);
    newSocket.on('connect_error', handleConnectError);

    // Store cleanup function
    newSocket.cleanup = () => {
      newSocket.off('connect', handleConnect);
      newSocket.off('disconnect', handleDisconnect);
      newSocket.off('instructor_joined', handleInstructorJoined);
      newSocket.off('student_joined', handleStudentJoined);
      newSocket.off('student_left', handleStudentLeft);
      newSocket.off('connect_error', handleConnectError);
      newSocket.disconnect();
    };

    setSocket(newSocket);
  };

  const fetchStudents = async () => {
    try {
      console.log('[DEBUG] fetchStudents called');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/session/${keyword}/students`);
      const data = await res.json();
      if (res.ok) {
        console.log('[DEBUG] fetched students:', data.students.map(s => s.name));
        setStudents(data.students);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchAvailableTags = async () => {
    try {
      console.log('[DEBUG] fetchAvailableTags called');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/session/tags/public`);
      const data = await res.json();
      if (res.ok) {
        console.log('[DEBUG] fetched tags:', data.tags);
        setAvailableTags(data.tags);
        // Set first tag as default if no selection exists and tags are available
        if (data.tags.length > 0 && selectedPromptFilter === '') {
          setSelectedPromptFilter(data.tags[0].value);
        }
      }
    } catch (error) {
      console.error('Error fetching available tags:', error);
      // Fallback to hardcoded options if API fails
      const fallbackTags = [
        { value: 'general', label: 'General Discussion' },
        { value: 'technical', label: 'Technical Topics' },
        { value: 'personal', label: 'Personal Development' },
        { value: 'academic', label: 'Academic Focus' }
      ];
      setAvailableTags(fallbackTags);
      if (selectedPromptFilter === '') {
        setSelectedPromptFilter('general');
      }
    }
  };


  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;

    setAddingStudent(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/session/${keyword}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newStudentName.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        // Don't manually update state - let WebSocket event handle it
        setNewStudentName('');
      } else {
        setErrorMessage(data.message || 'Error adding student');
      }
    } catch (error) {
      setErrorMessage('Network error. Please try again.');
    } finally {
      setAddingStudent(false);
    }
  };

  const handleRemoveStudent = async (studentId) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/session/${keyword}/students/${studentId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setStudents(prev => prev.filter(student => student.id !== studentId));
      } else {
        const data = await res.json();
        setErrorMessage(data.message || 'Error removing student');
      }
    } catch (error) {
      setErrorMessage('Network error. Please try again.');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndSession = async () => {
    if (!keyword) return;
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/session/${keyword}/end`, {
        method: 'POST',
      });
      
      if (res.ok) {
        // Clear all localStorage and logout
        localStorage.removeItem('session_keyword');
        localStorage.removeItem('auth_data');
        if (onLogout) {
          onLogout();
        }
      } else {
        const data = await res.json();
        setErrorMessage(data.message || 'Error ending session');
      }
    } catch (error) {
      setErrorMessage('Network error. Please try again.');
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };

  const handlePauseRound = () => {
    if (isPaused) {
      // Resume: continue timer if session was running before pause
      setIsPaused(false);
      if (sessionStatus === 'pairing' || sessionStatus === 'talking') {
        setTimerRunning(true);
      }
    } else {
      // Pause: stop timer but keep everything else frozen
      setIsPaused(true);
      setTimerRunning(false);
    }
  };

  const handleResetRound = async () => {
    setTimerRunning(false); // Stop talking timer
    try {
      // Notify students to reset their state
      const res = await fetch(`${import.meta.env.VITE_API_URL}/session/${keyword}/reset-round`, {
        method: 'POST',
      });
      
      if (res.ok) {
        setSessionStatus('inactive');
        setTimeRemaining(pairingDuration * 60);
        setIsPaused(false);
        setPairings([]); // Clear pairings display
        setCurrentPairingObjects([]); // Clear pairing objects
      } else {
        const data = await res.json();
        setErrorMessage(data.message || 'Error resetting round');
      }
    } catch (error) {
      setErrorMessage('Network error resetting round');
    }
  };


  const handleStatusChange = async () => {
    if (sessionStatus === 'inactive') {
      // Create pairings when starting
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/session/${keyword}/pairings-with-prompts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt_filter: selectedPromptFilter
          }),
        });
        
        if (res.ok) {
          const pairingData = await res.json();
          console.log('[DEBUG] Created pairings:', pairingData);
          // Convert to display format and set directly
          const displayPairings = [{
            round: pairingData.pairings[0]?.round || 1,
            pairs: pairingData.pairings.map(pairObj => {
              if (pairObj.onBreakId) {
                return {
                  students: [pairObj.onBreakName, 'On Break'],
                  prompt: 'Taking a break this round'
                };
              } else {
                return {
                  students: [pairObj.leaderName, pairObj.talkerName],
                  prompt: pairObj.prompt
                };
              }
            })
          }];
          setPairings(displayPairings);
          setCurrentPairingObjects(pairingData.pairings); // Store for discussion notification
          // Update session status to pairing
          setSessionStatus('pairing');
          setTimeRemaining(pairingDuration * 60);
          setTimerRunning(true); // Start timer for pairing
          setIsPaused(false); // Clear paused state
        } else {
          const data = await res.json();
          setErrorMessage(data.message || 'Error creating pairings');
        }
      } catch (error) {
        setErrorMessage('Network error creating pairings');
      }
    } else if (sessionStatus === 'pairing') {
      // Begin Discussion - notify students with prompts
      setTimerRunning(false); // Stop pairing timer
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/session/${keyword}/begin-discussion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pairing_objects: currentPairingObjects
          }),
        });
        
        if (res.ok) {
          setSessionStatus('talking');
          setTimeRemaining(talkingDuration * 60);
          setTimerRunning(true); // Start timer for talking
          setIsPaused(false); // Clear paused state
        } else {
          const data = await res.json();
          setErrorMessage(data.message || 'Error starting discussion');
        }
      } catch (error) {
        setErrorMessage('Network error starting discussion');
      }
    } else {
      // Next Round - cycle back
      setTimerRunning(false); // Stop talking timer
      try {
        // Notify students to reset their state
        const res = await fetch(`${import.meta.env.VITE_API_URL}/session/${keyword}/reset-round`, {
          method: 'POST',
        });
        
        if (res.ok) {
          setSessionStatus('inactive');
          setTimeRemaining(pairingDuration * 60);
          setTimerRunning(false); // Don't start timer, just set it to pairing duration
          setPairings([]); // Clear previous pairings
          setCurrentPairingObjects([]);
        } else {
          const data = await res.json();
          setErrorMessage(data.message || 'Error resetting round');
        }
      } catch (error) {
        setErrorMessage('Network error resetting round');
      }
    }
  };

  const handleParticipationToggle = async () => {
    const newValue = !instructorParticipating;
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/session/${keyword}/instructor/participating`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ participating: newValue }),
      });
      
      if (res.ok) {
        setInstructorParticipating(newValue);
      } else {
        const data = await res.json();
        setErrorMessage(data.message || 'Error updating participation');
      }
    } catch (error) {
      setErrorMessage('Network error updating participation');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainContent}>
        <div className={styles.header}>
          <div className={styles.logoPlaceholder}>
            LOGO
          </div>
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>Instructor Dashboard</h1>
          </div>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              {userEmail ? userEmail[0].toUpperCase() : 'U'}
            </div>
            <span className={styles.userName}>{userEmail || 'User'}</span>
            <button className={styles.logoutBtn} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <div className={styles.dashboardGrid}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitleCentered}>Active Session</h2>
              <button className={styles.infoButton} title="Session is running - share this keyword with students to join">
                ℹ
              </button>
            </div>
            <div>
              <p className={styles.keywordLabel}>
                Session Keyword:
              </p>
              <div className={styles.keywordDisplay}>
                {keyword}
              </div>
            </div>

            <div className={styles.sessionDivider}></div>

            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitleCentered}>Session Analytics</h2>
              <button className={styles.infoButton} title="Monitor student engagement and participation in real-time">
                ℹ
              </button>
            </div>
            <div className={styles.analyticsContainer}>
              <div className={styles.analyticsItem}>
                <div className={styles.analyticsNumber}>{students.length}</div>
                <div className={styles.analyticsLabel}>Students</div>
              </div>
              <div className={styles.analyticsItem}>
                <div className={styles.analyticsNumberRounds}>
                  {currentPairingObjects.length > 0 ? currentPairingObjects[0].round : 0}
                </div>
                <div className={styles.analyticsLabel}>Current Round</div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitleCentered}>Session Controls</h2>
              <button className={styles.infoButton} title="Manage your session and create pairings">
                ℹ
              </button>
            </div>
            
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Select the Topic to Talk About</label>
              <select 
                className={styles.filterSelect}
                value={selectedPromptFilter}
                onChange={(e) => setSelectedPromptFilter(e.target.value)}
              >
                {selectedPromptFilter === '' && (
                  <option value="">Loading tags...</option>
                )}
                {availableTags.map(tag => (
                  <option key={tag.value} value={tag.value}>
                    {tag.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.statusRow}>
              <div className={`${styles.statusBadge} ${styles[`status${sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}`]}`}>
                Status: {sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}
              </div>

              <div className={styles.participationToggle}>
                <label className={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={instructorParticipating}
                    onChange={handleParticipationToggle}
                    disabled={students.length % 2 === 0}
                    className={styles.toggleInput}
                  />
                  <span className={styles.toggleSlider}></span>
                  <span className={styles.toggleText}>
                    Instructor Participating
                  </span>
                </label>
              </div>
            </div>

            <div className={styles.timerControls}>
              <div className={styles.timerControl}>
                <label className={styles.timerLabel}>Pairing Time:</label>
                <select 
                  className={styles.timerSelect}
                  value={pairingDuration}
                  onChange={(e) => setPairingDuration(Number(e.target.value))}
                >
                  {Array.from({length: 5}, (_, i) => i + 1).map(min => (
                    <option key={min} value={min}>{min} min</option>
                  ))}
                </select>
              </div>
              <div className={styles.timerControl}>
                <label className={styles.timerLabel}>Talking Time:</label>
                <select 
                  className={styles.timerSelect}
                  value={talkingDuration}
                  onChange={(e) => setTalkingDuration(Number(e.target.value))}
                >
                  {Array.from({length: 15}, (_, i) => i + 1).map(min => (
                    <option key={min} value={min}>{min} min</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.timerDisplay}>
              <div className={styles.timerTime}>{formatTime(timeRemaining)}</div>
              <div className={styles.timerLabel}>Time Remaining</div>
            </div>

            <button className={styles.cardButton} onClick={handleStatusChange}>
              {sessionStatus === 'inactive' ? 'Start Pairing' : 
               sessionStatus === 'pairing' ? 'Begin Discussion' : 'Next Round'}
            </button>

            <div className={styles.sessionActionButtons}>
              <button className={styles.sessionActionButton} onClick={handlePauseRound}>
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button className={styles.sessionActionButton} onClick={handleResetRound}>
                Reset Round
              </button>
              <button className={styles.sessionActionButton} onClick={handleEndSession}>
                End Session
              </button>
            </div>
          </div>
          
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitleCentered}>Active Students: {students.length}</h2>
              <button className={styles.infoButton} title="Manage session participants">
                ℹ
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <div className={styles.connectionStatus}>
                <div className={`${styles.connectionDot} ${isConnected ? styles.connected : ''}`}></div>
                {isConnected ? 'Live' : 'Offline'}
              </div>
            </div>
            
            <form onSubmit={handleAddStudent} className={styles.addStudentForm}>
              <input
                type="text"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder="Enter student name..."
                className={styles.addStudentInput}
                disabled={addingStudent}
              />
              <button 
                type="submit" 
                className={styles.addStudentButton}
                disabled={addingStudent || !newStudentName.trim()}
              >
                {addingStudent ? 'Adding...' : 'Add'}
              </button>
            </form>
            
            {errorMessage && (
              <div className={styles.errorMessage}>{errorMessage}</div>
            )}
            
            {students.length > 0 ? (
              students.map(student => (
                <div key={student.id} className={styles.studentItemWithActions}>
                  <div className={styles.studentInfo}>
                    <div className={styles.studentAvatar}>
                      {student.name[0].toUpperCase()}
                    </div>
                    <span className={styles.studentName}>{student.name}</span>
                  </div>
                  <button 
                    onClick={() => handleRemoveStudent(student.id)}
                    className={styles.removeStudentButton}
                    title="Remove student"
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>No students added yet</div>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitleCentered}>Session Pairings</h2>
            <button className={styles.infoButton} title="Pairings and prompts for the current round">
              ℹ
            </button>
          </div>
          {pairings.length > 0 ? (
            pairings.map(round => (
              <div key={round.round} className={styles.roundContainer}>
                <h4 className={styles.roundTitle}>Round {round.round}</h4>
                <div className={styles.pairingsList}>
                  {round.pairs.map((pair, index) => (
                    <div key={index} className={styles.pairingItem}>
                      <div className={styles.pairingStudents}>
                        {pair.students[1] === 'On Break' ? `${pair.students[0]} is on break` : pair.students.join(' & ')}
                      </div>
                      {sessionStatus === 'talking' && (
                        <div className={styles.pairingPrompt}>
                          {pair.prompt}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>No pairings created yet</div>
          )}
        </div>
      </div>
    </div>
  );
}