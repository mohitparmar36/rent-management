// Every role lands on /dashboard, which shows that role's dashboard.
// Which pages each role may open is defined in App.jsx (and enforced again by the API).
export function getDashboardPath(role) {
  return role ? '/dashboard' : '/login';
}
