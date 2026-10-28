import React, { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Register from './pages/Register';
import ProfileSettings from './pages/ProfileSettings';
import NotFound from './pages/NotFound';
import Breadcrumbs from './components/Breadcrumbs';
import { getToken, getUser } from './api';

const Ventes = lazy(() => import('./pages/Ventes'));
const Annulations = lazy(() => import('./pages/Annulations'));
const Commandes = lazy(() => import('./pages/Commandes'));
const Methodologie = lazy(() => import('./pages/Methodologie'));
const Dax = lazy(() => import('./pages/Dax'));
const Dashboard = lazy(() => import('./pages/Admin/Dashboard'));
const Workspace = lazy(() => import('./pages/Workspace'));
const PersonalBI = lazy(() => import('./pages/PersonalBI'));

function PersonalOrDemo({ page, DemoPage }) {
  return getToken() && getUser() ? <PersonalBI page={page} /> : <DemoPage />;
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const hasWorkspaceSidebar = !!getToken() && !!user && (
    (user.role === 'admin' && location.pathname.startsWith('/admin'))
    || location.pathname === '/workspace'
    || location.pathname.startsWith('/bi')
    || ['/client', '/annulations', '/commandes', '/methodologie', '/dax', '/settings'].includes(location.pathname)
  );
  useEffect(() => {
    const handleInvalidSession = () => navigate('/login', { replace: true });
    window.addEventListener('ventesdb:session-invalid', handleInvalidSession);
    return () => window.removeEventListener('ventesdb:session-invalid', handleInvalidSession);
  }, [navigate]);

  return (
    <div className={`app-frame${hasWorkspaceSidebar ? ' app-frame-workspace' : ''}`}>
      <a className="skip-link" href="#main-content">Aller au contenu</a>
      <Navbar />
      <div className="app-content">
        <main id="main-content" className={hasWorkspaceSidebar ? 'workspace-main' : ''}>
          <Breadcrumbs />
          <Suspense fallback={<div className="route-loading" role="status"><span className="loader-spinner" />Chargement de la page…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin/login" element={<Navigate to="/login" replace />} />
            <Route path="/demo" element={<Ventes />} />
            <Route path="/demo/annulations" element={<Annulations />} />
            <Route path="/demo/commandes" element={<Commandes />} />
            <Route path="/demo/methodologie" element={<Methodologie />} />
            <Route path="/demo/dax" element={<Dax />} />
            <Route path="/client" element={<PersonalOrDemo page="overview" DemoPage={Ventes} />} />
            <Route path="/workspace" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
            <Route path="/bi" element={<ProtectedRoute><PersonalBI /></ProtectedRoute>} />
            <Route path="/bi/annulations" element={<ProtectedRoute><PersonalBI page="cancellations" /></ProtectedRoute>} />
            <Route path="/bi/commandes" element={<ProtectedRoute><PersonalBI page="orders" /></ProtectedRoute>} />
            <Route path="/bi/methodologie" element={<ProtectedRoute><PersonalBI page="methodology" /></ProtectedRoute>} />
            <Route path="/bi/dax" element={<ProtectedRoute><PersonalBI page="dax" /></ProtectedRoute>} />
            <Route path="/annulations" element={<PersonalOrDemo page="cancellations" DemoPage={Annulations} />} />
            <Route path="/commandes" element={<PersonalOrDemo page="orders" DemoPage={Commandes} />} />
            <Route path="/methodologie" element={<PersonalOrDemo page="methodology" DemoPage={Methodologie} />} />
            <Route path="/dax" element={<PersonalOrDemo page="dax" DemoPage={Dax} />} />
            <Route path="/contact" element={<Contact />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </main>
        <Footer />
      </div>
    </div>
  );
}
