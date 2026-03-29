import { useNavigate } from 'react-router-dom';
import './NoSession.css';

export default function NoSession({ message }) {
  const navigate = useNavigate();

  return (
    <div className="no-session-wrapper fade-in">
      <div className="no-session glass-card">
        <h2>No API Connected</h2>
        <p className="text-secondary">{message}</p>
        <button className="btn btn-primary" onClick={() => navigate('/connect')}>
          Connect Your API →
        </button>
      </div>
    </div>
  );
}
