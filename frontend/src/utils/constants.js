// Allowed values — these mirror backend/RentEase.Api/Common/AppConstants.cs
// and the database CHECK constraints.

export const ROLES = ['Admin', 'Landlord', 'Tenant'];

export const PROPERTY_TYPES = ['Apartment', 'House', 'Duplex', 'Villa', 'Studio', 'Commercial', 'Other'];
export const PROPERTY_STATUSES = ['Available', 'Occupied', 'Maintenance'];

export const ASSIGNMENT_STATUSES = ['Active', 'Completed'];

export const RENT_STATUSES = ['Pending', 'Overdue', 'Paid'];
export const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Other'];

export const COMPLAINT_STATUSES = ['Open', 'In Progress', 'Resolved'];
export const COMPLAINT_PRIORITIES = ['High', 'Medium', 'Low'];

// Same rule as the API's PasswordRules
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/;
export const PASSWORD_HINT = 'At least 8 characters, with a letter and a number.';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_PATTERN = /^[0-9+\-() ]{7,20}$/;
