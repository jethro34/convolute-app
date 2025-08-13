// File: src/pages/Landing.jsx
import styles from './Landing.module.css';

export default function Landing({ onSelect }) {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Welcome to the Conversation App!</h1>
      <div className={styles.buttonContainer}>
        <button className={styles.button} onClick={() => onSelect("instructor")}>
          I'm an Instructor
        </button>
        <button className={styles.button} onClick={() => onSelect("student")}>
          I'm a Student
        </button>
      </div>
    </div>
  );
}
