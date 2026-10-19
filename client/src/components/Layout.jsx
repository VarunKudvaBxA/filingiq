import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import MarketPanel from './MarketPanel.jsx';

export default function Layout({ children }) {
  const { user, logout, upgrade } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">FilingIQ</div>
        <nav>
          <NavLink to="/" end>Ask</NavLink>
          <NavLink to="/documents">Documents</NavLink>
          <NavLink to="/evaluation">Evaluation</NavLink>
        </nav>
        <div className="account">
          <div className="email">{user.email}</div>
          <div className="plan">{user.role === 'free' ? 'Free plan' : 'Pro plan'}</div>
          {user.role === 'free' && <button className="link" onClick={upgrade}>Switch to Pro (demo)</button>}
          <button className="link" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
      <MarketPanel />
    </div>
  );
}
