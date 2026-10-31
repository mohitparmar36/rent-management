import { lazy } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './routes/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import Login from './pages/Login';
import Register from './pages/Register';

// Pages load on demand, so the login screen doesn't download the whole app
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const UsersPage = lazy(() => import('./pages/users/UsersPage'));
const UserDetailsPage = lazy(() => import('./pages/users/UserDetailsPage'));
const PropertiesPage = lazy(() => import('./pages/properties/PropertiesPage'));
const PropertyFormPage = lazy(() => import('./pages/properties/PropertyFormPage'));
const PropertyDetailsPage = lazy(() => import('./pages/properties/PropertyDetailsPage'));
const TenantsPage = lazy(() => import('./pages/tenants/TenantsPage'));
const AddTenantPage = lazy(() => import('./pages/tenants/AddTenantPage'));
const TenantDetailsPage = lazy(() => import('./pages/tenants/TenantDetailsPage'));
const RentalsPage = lazy(() => import('./pages/rentals/RentalsPage'));
const RentalDetailsPage = lazy(() => import('./pages/rentals/RentalDetailsPage'));
const RentPage = lazy(() => import('./pages/rent/RentPage'));
const RentFormPage = lazy(() => import('./pages/rent/RentFormPage'));
const RentDetailsPage = lazy(() => import('./pages/rent/RentDetailsPage'));
const ComplaintsPage = lazy(() => import('./pages/complaints/ComplaintsPage'));
const NewComplaintPage = lazy(() => import('./pages/complaints/NewComplaintPage'));
const ComplaintDetailsPage = lazy(() => import('./pages/complaints/ComplaintDetailsPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const ADMIN = ['Admin'];
const MANAGERS = ['Admin', 'Landlord'];
const TENANT = ['Tenant'];

function RootRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Old role-prefixed URLs (bookmarks) */}
              <Route path="/admin/*" element={<Navigate to="/dashboard" replace />} />
              <Route path="/landlord/*" element={<Navigate to="/dashboard" replace />} />
              <Route path="/tenant/*" element={<Navigate to="/dashboard" replace />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  {/* Every signed-in user (the API limits what each role sees) */}
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/properties/:id" element={<PropertyDetailsPage />} />
                  <Route path="/rentals" element={<RentalsPage />} />
                  <Route path="/rentals/:id" element={<RentalDetailsPage />} />
                  <Route path="/rent" element={<RentPage />} />
                  <Route path="/rent/:id" element={<RentDetailsPage />} />
                  <Route path="/complaints" element={<ComplaintsPage />} />
                  <Route path="/complaints/:id" element={<ComplaintDetailsPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />

                  <Route element={<ProtectedRoute allowedRoles={MANAGERS} />}>
                    <Route path="/properties" element={<PropertiesPage />} />
                    <Route path="/properties/new" element={<PropertyFormPage />} />
                    <Route path="/properties/:id/edit" element={<PropertyFormPage />} />
                    <Route path="/tenants" element={<TenantsPage />} />
                    <Route path="/tenants/new" element={<AddTenantPage />} />
                    <Route path="/tenants/:id" element={<TenantDetailsPage />} />
                    <Route path="/rent/new" element={<RentFormPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={TENANT} />}>
                    <Route path="/complaints/new" element={<NewComplaintPage />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={ADMIN} />}>
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/users/:id" element={<UserDetailsPage />} />
                  </Route>

                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}
