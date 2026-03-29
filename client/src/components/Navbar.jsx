import { NavLink } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import './Navbar.css';

export default function Navbar() {
  const { session } = useSession();

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <NavLink to="/" className="navbar-brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-text">API Gateway</span>
        </NavLink>
        <div className="navbar-links">
          <NavLink to="/connect" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Connect
          </NavLink>
          <NavLink to="/tester" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Tester
          </NavLink>
          <NavLink to="/traffic" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Traffic
          </NavLink>
          <NavLink to="/metrics" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Metrics
          </NavLink>
        </div>
        <div className="navbar-status">
          {session ? (
            <span className="badge badge-success">● Connected</span>
          ) : (
            <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
              ○ Disconnected
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}
