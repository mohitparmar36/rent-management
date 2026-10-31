// Every status/priority value in the app maps to one colour tone, so a word
// always looks the same wherever it appears.
const TONES = {
  // Property
  Available: 'success',
  Occupied: 'info',
  Maintenance: 'warning',
  // Rental assignment
  Active: 'success',
  Completed: 'neutral',
  // Rent
  Paid: 'success',
  Pending: 'warning',
  Overdue: 'danger',
  // Complaint status
  Open: 'danger',
  'In Progress': 'warning',
  Resolved: 'success',
  // Complaint priority
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
  // Account
  Inactive: 'neutral',
  // Roles
  Admin: 'accent',
  Landlord: 'info',
  Tenant: 'neutral',
};

export default function StatusBadge({ status, label }) {
  if (!status) return null;
  const tone = TONES[status] ?? 'neutral';
  return <span className={`badge badge-${tone}`}>{label ?? status}</span>;
}
