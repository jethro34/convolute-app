import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import styles from './Dashboard.module.css';

export default function Dashboard({ token, keyword, setKeyword, onLogout, userEmail }) {
  const [students, setStudents] = useState([]);
  const [newStudentName, setNewStudentName] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedPromptFilter, setSelectedPromptFilter] = useState('general');
  const [sessionStatus, setSessionStatus] = useState('inactive');
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [pairings, setPairings] = useState([
    {
      round: 1,
      pairs: [
        { students: ['Alice Johnson', 'Bob Smith'], prompt: 'Discuss your favorite programming language and why.' },
        { students: ['Carol Davis', 'David Wilson'], prompt: 'Share your experience with teamwork in projects.' }
      ]
    },
    {
      round: 2,
      pairs: [
        { students: ['Alice Johnson', 'Carol Davis'], prompt: 'What motivates you in your studies?' },
        { students: ['Bob Smith', 'David Wilson'], prompt: 'Describe a challenging problem you solved recently.' }
      ]
    }
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (keyword) {
      fetchStudents();
      setupWebSocket();
    }
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [keyword]);

  const setupWebSocket = () => {
    // Socket.IO connects to base URL, not /api endpoint
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const socketUrl = apiUrl.replace('/api', '');
    
    console.log('[DEBUG] API URL:', apiUrl);
    console.log('[DEBUG] Socket URL:', socketUrl);
    
    const newSocket = io(socketUrl, {
      autoConnect: true,
      transports: ['polling', 'websocket']
    });
    
    newSocket.on('connect', () => {
      console.log('[DEBUG] WebSocket connected to server');
      setIsConnected(true);
      // Join the instructor room for this session
      console.log('[DEBUG] Emitting join_instructor_room with keyword:', keyword);
      newSocket.emit('join_instructor_room', { keyword });
    });

    newSocket.on('disconnect', () => {
      console.log('[DEBUG] WebSocket disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('instructor_joined', (data) => {
      console.log('[DEBUG] Instructor joined room:', data.message);
    });

    newSocket.on('student_joined', (data) => {
      console.log('[DEBUG] Received student_joined event:', data);
      // Add the new student to the list
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

    newSocket.on('student_left', (data) => {
      console.log('[DEBUG] Received student_left event:', data);
      // Remove the student from the list
      setStudents(prev => prev.filter(s => s.id !== data.student.id));
    });

    newSocket.on('connect_error', (error) => {
      console.error('[DEBUG] WebSocket connection error:', error);
    });

    setSocket(newSocket);
  };

  const fetchStudents = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/session/${keyword}/students`);
      const data = await res.json();
      if (res.ok) {
        setStudents(data.students);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
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
        setStudents(prev => [...prev, {
          id: data.id,
          name: data.name,
          joined_at: data.joined_at
        }]);
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

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };

  const promptFilters = [
    { value: 'general', label: 'General Discussion' },
    { value: 'technical', label: 'Technical Topics' },
    { value: 'personal', label: 'Personal Development' },
    { value: 'academic', label: 'Academic Focus' }
  ];

  const handleStatusChange = () => {
    const statuses = ['inactive', 'pairing', 'talking'];
    const currentIndex = statuses.indexOf(sessionStatus);
    const nextIndex = (currentIndex + 1) % statuses.length;
    setSessionStatus(statuses[nextIndex]);
    setTimeRemaining(300);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Instructor Dashboard</h1>
          <p className={styles.subtitle}>Manage your teaching sessions</p>
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

      <div className={styles.content}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Active Session</h2>
          <p className={styles.cardDescription}>
            Session is running - share this keyword with students to join.
          </p>
          <div>
            <p className={styles.keywordLabel}>
              Session Keyword:
            </p>
            <div className={styles.keywordDisplay}>
              {keyword}
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Session Analytics</h2>
          <p className={styles.cardDescription}>
            Monitor student engagement and participation in real-time.
          </p>
          <div className={styles.analyticsContainer}>
            <div className={styles.analyticsItem}>
              <div className={styles.analyticsNumber}>{students.length}</div>
              <div className={styles.analyticsLabel}>Students</div>
            </div>
            <div className={styles.analyticsItem}>
              <div className={styles.analyticsNumberRounds}>{pairings.length}</div>
              <div className={styles.analyticsLabel}>Rounds</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.sessionInfo}>
        <div className={styles.studentsList}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className={styles.studentsTitle}>Students ({students.length})</h3>
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

        <div className={styles.sessionControls}>
          <h3 className={styles.controlsTitle}>Session Controls</h3>
          
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Prompt Filter</label>
            <select 
              className={styles.filterSelect}
              value={selectedPromptFilter}
              onChange={(e) => setSelectedPromptFilter(e.target.value)}
            >
              {promptFilters.map(filter => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>

          <div className={`${styles.statusBadge} ${styles[`status${sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}`]}`}>
            Status: {sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}
          </div>

          <div className={styles.timerDisplay}>
            <div className={styles.timerTime}>{formatTime(timeRemaining)}</div>
            <div className={styles.timerLabel}>Time Remaining</div>
          </div>

          <button className={styles.cardButton} onClick={handleStatusChange}>
            {sessionStatus === 'inactive' ? 'Start Pairing' : 
             sessionStatus === 'pairing' ? 'Begin Discussion' : 'Next Round'}
          </button>
        </div>
      </div>

      <div className={styles.pairingsSection}>
        <h3 className={styles.pairingsTitle}>Session Pairings</h3>
        {pairings.length > 0 ? (
          pairings.map(round => (
            <div key={round.round}>
              <h4 className={styles.roundTitle}>Round {round.round}</h4>
              <div className={styles.pairingsList}>
                {round.pairs.map((pair, index) => (
                  <div key={index} className={styles.pairingItem}>
                    <div className={styles.pairingStudents}>
                      {pair.students.join(' & ')}
                    </div>
                    <div className={styles.pairingPrompt}>
                      {pair.prompt}
                    </div>
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
  );
}