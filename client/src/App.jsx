import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Ask from './pages/Ask.jsx';
import Documents from './pages/Documents.jsx';
import Evaluation from './pages/Evaluation.jsx';
import Login from './pages/Login.jsx';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="splash">Loading…</div>;
  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Ask />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/evaluation" element={<Evaluation />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}
