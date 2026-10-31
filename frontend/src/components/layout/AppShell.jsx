import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Bell, Building2, ChevronDown, ClipboardList, Home, LayoutDashboard, LogOut, Menu,
  Receipt, User, UserCog, Users, Wrench, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getNotifications, markAllNotificationsRead, markNotificationRead, NOTIFICATIONS_CHANGED_EVENT,
} from '../../services/api.service';
import { formatRelative, initials } from '../../utils/format';
import Logo from '../Logo';
import { PageSkeleton } from '../common/States';
import './AppShell.css';

const NAV = {
  Admin: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/users', icon: UserCog, label: 'Users' },
    { to: '/properties', icon: Building2, label: 'Properties' },
    { to: '/tenants', icon: Users, label: 'Tenants' },
    { to: '/rentals', icon: ClipboardList, label: 'Rentals' },
    { to: '/rent', icon: Receipt, label: 'Rent' },
    { to: '/complaints', icon: Wrench, label: 'Complaints' },
    { to: '/reports', icon: BarChart3, label: 'Reports' },
  ],
  Landlord: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/properties', icon: Building2, label: 'Properties' },
    { to: '/tenants', icon: Users, label: 'Tenants' },
    { to: '/rentals', icon: ClipboardList, label: 'Rentals' },
    { to: '/rent', icon: Receipt, label: 'Rent' },
    { to: '/complaints', icon: Wrench, label: 'Complaints' },
    { to: '/reports', icon: BarChart3, label: 'Reports' },
  ],
  Tenant: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/rentals', icon: Home, label: 'My home' },
    { to: '/rent', icon: Receipt, label: 'My rent' },
    { to: '/complaints', icon: Wrench, label: 'Complaints' },
  ],
};

const UNREAD_REFRESH_MS = 60_000;

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // The mobile drawer is "open on this page" — navigating anywhere closes it automatically
  const [drawerOpenOn, setDrawerOpenOn] = useState(null);
  const drawerOpen = drawerOpenOn === location.pathname;
  const setDrawerOpen = (open) => setDrawerOpenOn(open ? location.pathname : null);
  const navItems = NAV[user.role] ?? [];

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className={`shell${drawerOpen ? ' drawer-open' : ''}`}>
      <a href="#main" className="skip-link">Skip to content</a>

      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-top">
          <Link to="/dashboard" className="sidebar-brand" aria-label="RentEase home">
            <Logo />
          </Link>
          <button type="button" className="icon-btn sidebar-close" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-section-label">{user.role} workspace</span>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <NavLink to="/notifications" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Bell size={18} aria-hidden="true" /> <span>Notifications</span>
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <User size={18} aria-hidden="true" /> <span>Profile</span>
          </NavLink>
          <button type="button" className="nav-item" onClick={handleLogout}>
            <LogOut size={18} aria-hidden="true" /> <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />

      <div className="shell-main">
        <header className="topbar">
          <button type="button" className="icon-btn topbar-menu" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="topbar-brand-mobile"><Logo /></div>
          <div className="topbar-spacer" />
          <NotificationBell />
          <UserMenu user={user} onLogout={handleLogout} />
        </header>

        <main id="main" className="content" tabIndex={-1}>
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

/** Closes a dropdown when clicking outside it or pressing Escape. */
function useDismiss(ref, open, setOpen) {
  useEffect(() => {
    if (!open) return undefined;
    function onPointer(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open, setOpen]);
}

function NotificationBell() {
  const location = useLocation();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unreadCount: 0 });
  const [loadError, setLoadError] = useState(false);
  useDismiss(ref, open, setOpen);

  const refresh = useCallback(
    () =>
      getNotifications({ pageSize: 6 })
        .then((page) => {
          setData(page);
          setLoadError(false);
        })
        .catch(() => setLoadError(true)),
    [],
  );

  // Refresh on page changes, every minute, and when notifications are marked read
  // anywhere in the app (no real-time push by design)
  useEffect(() => {
    const timer = setInterval(refresh, UNREAD_REFRESH_MS);
    const initial = setTimeout(refresh, 0);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      clearInterval(timer);
      clearTimeout(initial);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [refresh, location.pathname]);

  async function markOne(notification) {
    if (notification.isRead) return;
    setData((d) => ({
      ...d,
      unreadCount: Math.max(0, d.unreadCount - 1),
      items: d.items.map((n) => (n.notificationId === notification.notificationId ? { ...n, isRead: true } : n)),
    }));
    try {
      await markNotificationRead(notification.notificationId);
    } catch {
      refresh();
    }
  }

  async function markAll() {
    setData((d) => ({ ...d, unreadCount: 0, items: d.items.map((n) => ({ ...n, isRead: true })) }));
    try {
      await markAllNotificationsRead();
    } catch {
      refresh();
    }
  }

  const unread = data.unreadCount;

  return (
    <div className="dropdown" ref={ref}>
      <button
        type="button"
        className="icon-btn bell"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) refresh();
        }}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={20} />
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="dropdown-panel notif-panel">
          <div className="notif-panel-header">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="btn btn-link btn-sm" onClick={markAll}>Mark all read</button>
            )}
          </div>
          <ul className="notif-panel-list">
            {loadError && <li className="notif-panel-empty">Notifications are unavailable right now.</li>}
            {!loadError && data.items.length === 0 && <li className="notif-panel-empty">You&apos;re all caught up.</li>}
            {data.items.map((n) => (
              <li key={n.notificationId}>
                <button
                  type="button"
                  className={`notif-row${n.isRead ? '' : ' unread'}`}
                  onClick={() => markOne(n)}
                  title={n.isRead ? undefined : 'Mark as read'}
                >
                  {!n.isRead && <span className="unread-dot" aria-label="Unread" />}
                  <span className="notif-row-title">{n.title}</span>
                  <span className="notif-row-message">{n.message}</span>
                  <span className="notif-row-time">{formatRelative(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Link to="/notifications" className="notif-panel-footer" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}

function UserMenu({ user, onLogout }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  useDismiss(ref, open, setOpen);

  return (
    <div className="dropdown" ref={ref}>
      <button
        type="button"
        className="user-menu-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="avatar" aria-hidden="true">{initials(user)}</span>
        <span className="user-menu-text">
          <span className="user-menu-name">{user.firstName} {user.lastName}</span>
          <span className="user-menu-role">{user.role}</span>
        </span>
        <ChevronDown size={14} className={`chevron${open ? ' open' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="dropdown-panel user-panel">
          <div className="user-panel-header">
            <strong>{user.firstName} {user.lastName}</strong>
            <span>{user.email}</span>
          </div>
          <Link to="/profile" className="menu-item" onClick={() => setOpen(false)}>
            <User size={16} /> My profile
          </Link>
          <Link to="/notifications" className="menu-item" onClick={() => setOpen(false)}>
            <Bell size={16} /> Notifications
          </Link>
          <button type="button" className="menu-item danger" onClick={onLogout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
