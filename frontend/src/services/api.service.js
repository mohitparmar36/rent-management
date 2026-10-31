// One function per API endpoint (see README → API endpoints).
// Each returns the response body; errors are left for the page to handle
// with utils/errors.js.
import api from './api';

const get = (url, params) => api.get(url, { params }).then((r) => r.data);
const post = (url, body) => api.post(url, body).then((r) => r.data);
const put = (url, body) => api.put(url, body).then((r) => r.data);
const patch = (url, body) => api.patch(url, body).then((r) => r.data);
const del = (url) => api.delete(url).then((r) => r.data);

// ── Users (Admin) ─────────────────────────────────────────────────────────────
export const getUsers = (params) => get('/users', params);
export const getUser = (id) => get(`/users/${id}`);
export const createUser = (body) => post('/users', body);
export const updateUser = (id, body) => put(`/users/${id}`, body);
export const setUserActive = (id, isActive) => patch(`/users/${id}/status`, { isActive });

// ── Properties ────────────────────────────────────────────────────────────────
export const getProperties = (params) => get('/properties', params);
export const getProperty = (id) => get(`/properties/${id}`);
export const createProperty = (body) => post('/properties', body);
export const updateProperty = (id, body) => put(`/properties/${id}`, body);
export const deleteProperty = (id) => del(`/properties/${id}`);

// ── Tenants (Admin, Landlord) ─────────────────────────────────────────────────
export const getTenants = (params) => get('/tenants', params);
export const getAvailableTenants = (search) => get('/tenants/available', { search });
export const getTenant = (id) => get(`/tenants/${id}`);
export const createTenant = (body) => post('/tenants', body);

// ── Rental assignments ────────────────────────────────────────────────────────
export const getRentals = (params) => get('/tenantproperties', params);
export const getRental = (id) => get(`/tenantproperties/${id}`);
export const createRental = (body) => post('/tenantproperties', body);
export const endRental = (id, endDate) => post(`/tenantproperties/${id}/complete`, { endDate });

// ── Rent ──────────────────────────────────────────────────────────────────────
export const getRentPayments = (params) => get('/rentpayments', params);
export const getRentSummary = (params) => get('/rentpayments/summary', params);
export const getRentPayment = (id) => get(`/rentpayments/${id}`);
export const createRentPayment = (body) => post('/rentpayments', body);
export const markRentPaid = (id, body) => post(`/rentpayments/${id}/mark-paid`, body);

// ── Complaints ────────────────────────────────────────────────────────────────
export const getComplaints = (params) => get('/complaints', params);
export const getComplaint = (id) => get(`/complaints/${id}`);
export const createComplaint = (body) => post('/complaints', body);
export const updateComplaintStatus = (id, status) => patch(`/complaints/${id}/status`, { status });
export const getComplaintCategories = () => get('/complaintcategories');

// ── Notifications ─────────────────────────────────────────────────────────────
/** Fired after notifications are marked read, so the header bell can refresh its count. */
export const NOTIFICATIONS_CHANGED_EVENT = 'rentease:notifications-changed';
const announceNotificationsChanged = (result) => {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  return result;
};

export const getNotifications = (params) => get('/notifications', params);
export const getUnreadCount = () => get('/notifications/unread-count').then((d) => d.count);
export const markNotificationRead = (id) => patch(`/notifications/${id}/read`).then(announceNotificationsChanged);
export const markAllNotificationsRead = () => patch('/notifications/read-all').then(announceNotificationsChanged);

// ── Dashboards ────────────────────────────────────────────────────────────────
export const getAdminDashboard = () => get('/dashboard/admin');
export const getLandlordDashboard = () => get('/dashboard/landlord');
export const getTenantDashboard = () => get('/dashboard/tenant');

// ── Reports ───────────────────────────────────────────────────────────────────
export const getRentCollectionReport = (months = 12) => get('/reports/rent-collection', { months });
export const getOccupancyReport = () => get('/reports/occupancy');
export const getComplaintReport = () => get('/reports/complaints');

// ── Profile ───────────────────────────────────────────────────────────────────
export const getProfile = () => get('/profile');
export const updateProfile = (body) => put('/profile', body);
export const changePassword = (currentPassword, newPassword) =>
  post('/profile/change-password', { currentPassword, newPassword });
