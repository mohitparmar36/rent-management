# RentEase — Entity Relationship Diagram

Eight tables. Created by `01_RentEaseDb_Setup.sql`; existing databases are brought up to date by
`02_RentEaseDb_Upgrade.sql`.

```mermaid
erDiagram
    ROLES ||--o{ USERS : "has"
    USERS ||--o{ PROPERTIES : "owns (landlord)"
    USERS ||--o{ TENANTPROPERTIES : "rents (tenant)"
    PROPERTIES ||--o{ TENANTPROPERTIES : "leased as"
    TENANTPROPERTIES ||--o{ RENTPAYMENTS : "billed as"
    USERS ||--o{ COMPLAINTS : "raises (tenant)"
    PROPERTIES ||--o{ COMPLAINTS : "concerns"
    COMPLAINTCATEGORIES ||--o{ COMPLAINTS : "categorizes"
    USERS ||--o{ NOTIFICATIONS : "receives"

    ROLES {
        int RoleId PK
        nvarchar RoleName UK "Admin | Landlord | Tenant"
        nvarchar Description
    }

    USERS {
        int UserId PK
        int RoleId FK
        nvarchar FirstName
        nvarchar LastName
        nvarchar Email UK
        nvarchar PasswordHash "PBKDF2 (ASP.NET Core Identity hasher)"
        nvarchar PhoneNumber
        bit IsActive
        datetime2 CreatedAt "UTC"
        datetime2 UpdatedAt "UTC"
        datetime2 LastLoginAt "UTC"
    }

    PROPERTIES {
        int PropertyId PK
        int LandlordId FK
        nvarchar PropertyName
        nvarchar PropertyType
        nvarchar Address
        nvarchar City
        nvarchar State
        nvarchar PostalCode
        decimal MonthlyRent "DECIMAL(18,2), > 0"
        nvarchar Status "Available | Occupied | Maintenance"
        nvarchar Description
        datetime2 CreatedAt
        datetime2 UpdatedAt
    }

    TENANTPROPERTIES {
        int TenantPropertyId PK
        int TenantId FK
        int PropertyId FK "unique where Status = Active"
        date StartDate
        date EndDate "NULL or >= StartDate"
        nvarchar Status "Active | Completed"
        datetime2 CreatedAt
    }

    RENTPAYMENTS {
        int PaymentId PK
        int TenantPropertyId FK
        date BillingMonth "1st of month; unique per TenantPropertyId"
        decimal Amount "DECIMAL(18,2), > 0"
        date DueDate
        date PaymentDate "set only when Paid"
        nvarchar Status "Pending | Paid | Overdue"
        nvarchar PaymentMethod "Cash | UPI | Bank Transfer | Other"
        nvarchar Notes
        datetime2 CreatedAt
    }

    COMPLAINTCATEGORIES {
        int CategoryId PK
        nvarchar CategoryName UK
        bit IsActive
    }

    COMPLAINTS {
        int ComplaintId PK
        int TenantId FK
        int PropertyId FK
        int CategoryId FK
        nvarchar Title
        nvarchar Description
        nvarchar Status "Open | In Progress | Resolved"
        nvarchar Priority "Low | Medium | High"
        datetime2 CreatedAt
        datetime2 UpdatedAt
        datetime2 ResolvedAt "set when Resolved, cleared on reopen"
    }

    NOTIFICATIONS {
        int NotificationId PK
        int UserId FK
        nvarchar Title
        nvarchar Message
        bit IsRead
        datetime2 CreatedAt
    }
```

## Integrity rules enforced by the database

| Rule | Constraint |
|---|---|
| Email is unique | `UQ_Users_Email` |
| One active tenant per property | `UX_TenantProperties_ActiveProperty` (filtered unique index) |
| Rental end date not before start date | `CK_TenantProperties_Dates` |
| One rent record per rental per month | `UQ_RentPayments_TenantProperty_BillingMonth` |
| Billing month is the 1st of a month | `CK_RentPayments_BillingMonth` |
| Money is positive | `CK_Properties_MonthlyRent`, `CK_RentPayments_Amount` |
| Paid records have a payment date and method; unpaid ones have no payment date | `CK_RentPayments_PaidDetails` |
| Allowed status / priority / method values | `CK_*_Status`, `CK_Complaints_Priority`, `CK_RentPayments_PaymentMethod` |
| No cascading deletes | every foreign key is `NO ACTION`; history can't be removed by deleting a parent |

## Rules enforced by the API (not expressible as constraints)

- A property is `Occupied` exactly while it has an `Active` rental (assigning/ending a rental updates both in one transaction).
- A tenant has at most one active rental.
- An unpaid rent record whose due date has passed is `Overdue`; paid records are never overdue.
- Complaints can only be raised by the tenant currently renting the property.
