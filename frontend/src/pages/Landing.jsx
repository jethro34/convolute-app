// File: src/pages/Landing.jsx

export default function Landing({ onSelect }) {
  return (
    <div>
      <h1>Welcome to the Conversation App</h1>
      <button onClick={() => onSelect("instructor")}>I'm an Instructor</button>
      <button onClick={() => onSelect("student")}>I'm a Student</button>
    </div>
  );
}
