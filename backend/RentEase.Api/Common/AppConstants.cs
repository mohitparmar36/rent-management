namespace RentEase.Api.Common;

// Every allowed value for the status/type text columns lives here, so the
// API, validation and database CHECK constraints all agree on one list.

public static class AppRoles
{
    public const string Admin = "Admin";
    public const string Landlord = "Landlord";
    public const string Tenant = "Tenant";

    // For [Authorize(Roles = ...)] — a comma means "any of these roles"
    public const string AdminOrLandlord = "Admin,Landlord";

    public static readonly string[] All = { Admin, Landlord, Tenant };
}

public static class PropertyStatuses
{
    public const string Available = "Available";
    public const string Occupied = "Occupied";
    public const string Maintenance = "Maintenance";

    public static readonly string[] All = { Available, Occupied, Maintenance };
}

public static class PropertyTypes
{
    public static readonly string[] All = { "Apartment", "House", "Duplex", "Villa", "Studio", "Commercial", "Other" };
}

public static class AssignmentStatuses
{
    public const string Active = "Active";
    public const string Completed = "Completed";

    public static readonly string[] All = { Active, Completed };
}

public static class RentStatuses
{
    public const string Pending = "Pending";
    public const string Paid = "Paid";
    public const string Overdue = "Overdue";

    public static readonly string[] All = { Pending, Paid, Overdue };
}

public static class PaymentMethods
{
    public static readonly string[] All = { "Cash", "UPI", "Bank Transfer", "Other" };
}

public static class ComplaintStatuses
{
    public const string Open = "Open";
    public const string InProgress = "In Progress";
    public const string Resolved = "Resolved";

    public static readonly string[] All = { Open, InProgress, Resolved };
}

public static class ComplaintPriorities
{
    public static readonly string[] All = { "Low", "Medium", "High" };
}

public static class PasswordRules
{
    // At least 8 characters with at least one letter and one digit
    public const string Pattern = @"^(?=.*[A-Za-z])(?=.*\d).{8,100}$";
    public const string Message = "Password must be at least 8 characters and contain a letter and a number.";
}

public static class ValidationPatterns
{
    public const string Phone = @"^[0-9+\-() ]{7,20}$";
    public const string PhoneMessage = "Enter a valid phone number (7 to 20 digits, spaces, +, - or brackets).";
}
