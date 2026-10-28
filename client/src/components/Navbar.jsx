import React from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getToken, getUser, setToken } from '../api';
import Icon from './Icon';

function ThemeToggle() {
  const [theme, setTheme] = React.useState(() => document.documentElement.dataset.theme || 'dark');
  React.useEffect(() => {
    const syncTheme = (event) => setTheme(event.detail || document.documentElement.dataset.theme || 'dark');
    window.addEventListener('ventepilot:theme-change', syncTheme);
    return () => window.removeEventListener('ventepilot:theme-change', syncTheme);
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('ventepilot-theme', next);
    window.dispatchEvent(new CustomEvent('ventepilot:theme-change', { detail: next }));
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = next === 'dark' ? '#101820' : '#f4f7f8';
  };
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={`Activer le thème ${theme === 'dark' ? 'clair' : 'sombre'}`} title={`Thème ${theme === 'dark' ? 'clair' : 'sombre'}`}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /><span>{theme === 'dark' ? 'Thème clair' : 'Thème sombre'}</span></button>;
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [sidebarCompact, setSidebarCompact] = React.useState(() => localStorage.getItem('ventepilot-sidebar-compact') === 'true');
  const logged = !!getToken() && !!getUser();
  const user = logged ? getUser() : null;
  const isAdminArea = user && user.role === 'admin' && (
    location.pathname.startsWith('/admin') || location.pathname === '/settings'
  );
  const isWorkspaceArea = logged && (
    isAdminArea
    || location.pathname === '/workspace'
    || location.pathname.startsWith('/bi')
    || ['/client', '/annulations', '/commandes', '/methodologie', '/dax', '/settings'].includes(location.pathname)
  );
  const initials = String(user?.name || user?.email || 'VP')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('fr-FR'))
    .join('');
  const logout = () => {
    setToken(null);
    navigate('/', { replace: true });
  };
  const sidebarClass = `workspace-sidebar${isAdminArea ? ' workspace-sidebar-admin' : ''}${mobileOpen ? ' sidebar-open' : ''}${sidebarCompact ? ' sidebar-compact' : ''}`;
  React.useEffect(() => {
    if (!mobileOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    if (isWorkspaceArea) document.body.classList.add('navigation-open');
    return () => { window.removeEventListener('keydown', closeOnEscape); document.body.classList.remove('navigation-open'); };
  }, [mobileOpen, isWorkspaceArea]);
  React.useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  if (isWorkspaceArea) {
    const links = isAdminArea
      ? [
          { to: '/admin', label: 'Administration', icon: 'admin', end: true },
        ]
      : [
          { to: '/workspace', label: 'Mon espace BI', icon: 'dashboard' },
          { to: '/bi', label: 'Mon tableau de bord', icon: 'chart', end: true },
          { to: '/bi/annulations', label: 'Annulations', icon: 'cancel' },
          { to: '/bi/commandes', label: 'Mes données', icon: 'orders' },
          { to: '/bi/methodologie', label: 'Méthodologie', icon: 'method' },
          { to: '/bi/dax', label: 'Mesures DAX', icon: 'formula' },
        ];

    return (
      <>
      <button type="button" className="sidebar-mobile-toggle" aria-label={mobileOpen ? 'Fermer la navigation' : 'Ouvrir la navigation'} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}><Icon name={mobileOpen ? 'close' : 'menu'} /></button>
      {mobileOpen ? <button type="button" className="sidebar-scrim" aria-label="Fermer la navigation" onClick={() => setMobileOpen(false)} /> : null}
      <aside className={sidebarClass} aria-label="Navigation principale">
        <Link className="workspace-brand" to="/" aria-label="VentePilot — Accueil">
          <img className="workspace-brand-logo" src="/ventepilot-logo.png" alt="VentePilot" />
        </Link>
        <NavLink className="sidebar-profile" to="/settings" aria-label="Profil et paramètres du compte">
          <span className="sidebar-avatar" aria-hidden="true">{initials}</span>
          <span className="sidebar-profile-copy">
            <strong>{user.name || user.email}</strong>
            <small>{isAdminArea ? 'Administrateur' : 'Espace personnel'}</small>
          </span>
          <span className="sidebar-profile-more" aria-hidden="true">···</span>
        </NavLink>
        <span className="sidebar-section-label">{isAdminArea ? 'GESTION' : 'ESPACE BI'}</span>
        <nav className="sidebar-nav">
          {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} title={sidebarCompact ? link.label : undefined} onClick={() => setMobileOpen(false)} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <span className="sidebar-link-icon"><Icon name={link.icon} /></span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/settings" title={sidebarCompact ? 'Paramètres' : undefined} onClick={() => setMobileOpen(false)} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <span className="sidebar-link-icon"><Icon name="settings" /></span>
            <span>Paramètres</span>
          </NavLink>
          <button type="button" className="sidebar-link sidebar-logout" onClick={logout}>
            <span className="sidebar-link-icon"><Icon name="logout" /></span>
            <span>Déconnexion</span>
          </button>
          <div className="sidebar-version">VentePilot <span>•</span> Espace sécurisé</div>
          <ThemeToggle />
          <button type="button" className="sidebar-compact-toggle" onClick={() => { const next = !sidebarCompact; setSidebarCompact(next); localStorage.setItem('ventepilot-sidebar-compact', String(next)); }} aria-label={sidebarCompact ? 'Développer la navigation' : 'Réduire la navigation'}>{sidebarCompact ? '›' : '‹'}<span>{sidebarCompact ? 'Développer' : 'Réduire'}</span></button>
        </div>
      </aside>
      </>
    );
  }

  return (
    <header className={`navbar${isAdminArea ? ' navbar-admin' : ''}`}>
      <Link className="brand" to="/" aria-label="VentePilot — Accueil">
        <img className="brand-logo" src="/ventepilot-logo.png" alt="VentePilot" />
      </Link>
      {isAdminArea ? (
        <>
      <button type="button" className="mobile-menu-toggle" aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}><Icon name={mobileOpen ? 'close' : 'menu'} /></button>
      <nav className={mobileOpen ? 'mobile-nav-open' : ''}>
            <NavLink to="/admin">Administration</NavLink>
          </nav>
          <div className="nav-account">
            <span className="nav-user">{user.name}<small>Administrateur</small></span>
            <button type="button" className="btn-admin" onClick={logout}>Déconnexion</button>
            <ThemeToggle />
          </div>
        </>
      ) : logged ? (
        <>
      <button type="button" className="mobile-menu-toggle" aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}><Icon name={mobileOpen ? 'close' : 'menu'} /></button>
      <nav className={mobileOpen ? 'mobile-nav-open' : ''}>
            <NavLink to="/workspace">Mon espace BI</NavLink>
            <NavLink to="/bi">Mon tableau de bord</NavLink>
            <NavLink to="/bi/annulations">Annulations</NavLink>
            <NavLink to="/bi/commandes">Mes données</NavLink>
            <NavLink to="/bi/methodologie">Méthodologie</NavLink>
            <NavLink to="/bi/dax">Mesures DAX</NavLink>
            <NavLink to="/demo">Démo publique</NavLink>
          </nav>
          {user.role === 'admin' ? <Link className="btn-admin" to="/admin">Administration</Link> : null}
          <button type="button" className="btn-admin" onClick={logout}>Déconnexion</button>
          <ThemeToggle />
        </>
      ) : (
        <>
      <button type="button" className="mobile-menu-toggle" aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}><Icon name={mobileOpen ? 'close' : 'menu'} /></button>
      <nav className={mobileOpen ? 'mobile-nav-open' : ''}>
          <NavLink onClick={() => setMobileOpen(false)} to="/" end>Accueil</NavLink>
          <NavLink onClick={() => setMobileOpen(false)} to="/demo">Dashboard démo</NavLink>
          <NavLink onClick={() => setMobileOpen(false)} to="/demo/annulations">Annulations démo</NavLink>
          <NavLink onClick={() => setMobileOpen(false)} to="/demo/commandes">Commandes démo</NavLink>
          <NavLink onClick={() => setMobileOpen(false)} to="/demo/methodologie">Méthodologie démo</NavLink>
          <NavLink onClick={() => setMobileOpen(false)} to="/demo/dax">Mesures DAX démo</NavLink>
          <NavLink onClick={() => setMobileOpen(false)} to="/contact">Contact</NavLink>
          </nav>
          <div className="nav-actions">
            <Link className="nav-login" to="/login">Connexion</Link>
            <Link className="btn-admin" to="/register">Demander un accès</Link>
            <ThemeToggle />
          </div>
        </>
      )}
    </header>
  );
}
