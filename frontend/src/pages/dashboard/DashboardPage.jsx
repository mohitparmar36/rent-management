import { useAuth } from '../../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import LandlordDashboard from './LandlordDashboard';
import TenantDashboard from './TenantDashboard';

/** /dashboard shows the dashboard for the signed-in user's role. */
export default function DashboardPage() {
  const { user } = useAuth();
  if (user.role === 'Admin') return <AdminDashboard />;
  if (user.role === 'Landlord') return <LandlordDashboard />;
  return <TenantDashboard />;
}
