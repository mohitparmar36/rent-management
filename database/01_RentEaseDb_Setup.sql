/* ============================================================================
   RentEase – Rental Property Management System
   Database Setup Script
   ----------------------------------------------------------------------------
   Target: Microsoft SQL Server (run in SQL Server Management Studio)
   This script is idempotent-ish: it creates the database if it does not
   already exist, and (re)creates all tables from scratch inside it.

   HOW TO RUN
   1. Open SQL Server Management Studio (SSMS)
   2. Connect to your local SQL Server instance
   3. Open this file and execute it (F5)

   This script already contains the changes from 02_RentEaseDb_Upgrade.sql
   (BillingMonth, one-active-tenant index, extra check constraints). Running
   02 afterwards is harmless: every step is skipped.
   ============================================================================ */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON; -- required for the filtered unique index below
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'RentEaseDb')
BEGIN
    CREATE DATABASE RentEaseDb;
END
GO

USE RentEaseDb;
GO

/* ============================================================================
   DROP TABLES (in dependency order) — allows this script to be re-run safely
   on a database that already has RentEase tables in it.
   ============================================================================ */
IF OBJECT_ID('dbo.Notifications', 'U') IS NOT NULL DROP TABLE dbo.Notifications;
IF OBJECT_ID('dbo.Complaints', 'U') IS NOT NULL DROP TABLE dbo.Complaints;
IF OBJECT_ID('dbo.ComplaintCategories', 'U') IS NOT NULL DROP TABLE dbo.ComplaintCategories;
IF OBJECT_ID('dbo.RentPayments', 'U') IS NOT NULL DROP TABLE dbo.RentPayments;
IF OBJECT_ID('dbo.TenantProperties', 'U') IS NOT NULL DROP TABLE dbo.TenantProperties;
IF OBJECT_ID('dbo.Properties', 'U') IS NOT NULL DROP TABLE dbo.Properties;
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL DROP TABLE dbo.Users;
IF OBJECT_ID('dbo.Roles', 'U') IS NOT NULL DROP TABLE dbo.Roles;
GO

/* ============================================================================
   1. Roles
   ============================================================================ */
CREATE TABLE dbo.Roles
(
    RoleId      INT             NOT NULL IDENTITY(1,1) CONSTRAINT PK_Roles PRIMARY KEY,
    RoleName    NVARCHAR(50)    NOT NULL,
    Description NVARCHAR(200)   NULL,
    CONSTRAINT UQ_Roles_RoleName UNIQUE (RoleName)
);
GO

/* ============================================================================
   2. Users
   ============================================================================ */
CREATE TABLE dbo.Users
(
    UserId        INT             NOT NULL IDENTITY(1,1) CONSTRAINT PK_Users PRIMARY KEY,
    RoleId        INT             NOT NULL,
    FirstName     NVARCHAR(50)    NOT NULL,
    LastName      NVARCHAR(50)    NOT NULL,
    Email         NVARCHAR(150)   NOT NULL,
    PasswordHash  NVARCHAR(500)   NOT NULL,
    PhoneNumber   NVARCHAR(20)    NULL,
    IsActive      BIT             NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT (1),
    CreatedAt     DATETIME2       NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt     DATETIME2       NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    LastLoginAt   DATETIME2       NULL,
    CONSTRAINT UQ_Users_Email UNIQUE (Email),
    CONSTRAINT FK_Users_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles (RoleId)
);
GO

CREATE INDEX IX_Users_RoleId ON dbo.Users (RoleId);
GO

/* ============================================================================
   3. Properties
   ============================================================================ */
CREATE TABLE dbo.Properties
(
    PropertyId    INT             NOT NULL IDENTITY(1,1) CONSTRAINT PK_Properties PRIMARY KEY,
    LandlordId    INT             NOT NULL,
    PropertyName  NVARCHAR(150)   NOT NULL,
    PropertyType  NVARCHAR(50)    NOT NULL,
    Address       NVARCHAR(250)   NOT NULL,
    City          NVARCHAR(100)   NOT NULL,
    State         NVARCHAR(100)   NOT NULL,
    PostalCode    NVARCHAR(10)    NULL,
    MonthlyRent   DECIMAL(18,2)   NOT NULL,
    Status        NVARCHAR(30)    NOT NULL CONSTRAINT DF_Properties_Status DEFAULT ('Available'),
    Description   NVARCHAR(500)   NULL,
    CreatedAt     DATETIME2       NOT NULL CONSTRAINT DF_Properties_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt     DATETIME2       NOT NULL CONSTRAINT DF_Properties_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Properties_Landlord FOREIGN KEY (LandlordId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Properties_Status CHECK (Status IN ('Available', 'Occupied', 'Maintenance')),
    CONSTRAINT CK_Properties_MonthlyRent CHECK (MonthlyRent > 0)
);
GO

CREATE INDEX IX_Properties_LandlordId ON dbo.Properties (LandlordId);
CREATE INDEX IX_Properties_Status ON dbo.Properties (Status);
GO

/* ============================================================================
   4. TenantProperties
   ============================================================================ */
CREATE TABLE dbo.TenantProperties
(
    TenantPropertyId INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_TenantProperties PRIMARY KEY,
    TenantId         INT           NOT NULL,
    PropertyId       INT           NOT NULL,
    StartDate        DATE          NOT NULL,
    EndDate          DATE          NULL,
    Status           NVARCHAR(30)  NOT NULL CONSTRAINT DF_TenantProperties_Status DEFAULT ('Active'),
    CreatedAt        DATETIME2     NOT NULL CONSTRAINT DF_TenantProperties_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_TenantProperties_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_TenantProperties_Property FOREIGN KEY (PropertyId) REFERENCES dbo.Properties (PropertyId),
    CONSTRAINT CK_TenantProperties_Status CHECK (Status IN ('Active', 'Completed')),
    CONSTRAINT CK_TenantProperties_Dates CHECK (EndDate IS NULL OR EndDate >= StartDate)
);
GO

CREATE INDEX IX_TenantProperties_TenantId ON dbo.TenantProperties (TenantId);
CREATE INDEX IX_TenantProperties_PropertyId ON dbo.TenantProperties (PropertyId);
-- Only one Active assignment may exist per property
CREATE UNIQUE INDEX UX_TenantProperties_ActiveProperty ON dbo.TenantProperties (PropertyId) WHERE Status = 'Active';
GO

/* ============================================================================
   5. RentPayments
   ============================================================================ */
CREATE TABLE dbo.RentPayments
(
    PaymentId         INT             NOT NULL IDENTITY(1,1) CONSTRAINT PK_RentPayments PRIMARY KEY,
    TenantPropertyId  INT             NOT NULL,
    BillingMonth      DATE            NOT NULL, -- always the 1st day of the month being billed
    Amount            DECIMAL(18,2)   NOT NULL,
    DueDate           DATE            NOT NULL,
    PaymentDate       DATE            NULL,
    Status            NVARCHAR(30)    NOT NULL CONSTRAINT DF_RentPayments_Status DEFAULT ('Pending'),
    PaymentMethod     NVARCHAR(30)    NULL,
    Notes             NVARCHAR(250)   NULL,
    CreatedAt         DATETIME2       NOT NULL CONSTRAINT DF_RentPayments_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_RentPayments_TenantProperty FOREIGN KEY (TenantPropertyId) REFERENCES dbo.TenantProperties (TenantPropertyId),
    CONSTRAINT CK_RentPayments_Status CHECK (Status IN ('Pending', 'Paid', 'Overdue')),
    CONSTRAINT CK_RentPayments_PaymentMethod CHECK (PaymentMethod IN ('Cash', 'UPI', 'Bank Transfer', 'Other') OR PaymentMethod IS NULL),
    CONSTRAINT CK_RentPayments_BillingMonth CHECK (DAY(BillingMonth) = 1),
    CONSTRAINT CK_RentPayments_Amount CHECK (Amount > 0),
    CONSTRAINT CK_RentPayments_PaidDetails CHECK (
        (Status = 'Paid' AND PaymentDate IS NOT NULL AND PaymentMethod IS NOT NULL)
        OR (Status <> 'Paid' AND PaymentDate IS NULL)),
    CONSTRAINT UQ_RentPayments_TenantProperty_BillingMonth UNIQUE (TenantPropertyId, BillingMonth)
);
GO

CREATE INDEX IX_RentPayments_TenantPropertyId ON dbo.RentPayments (TenantPropertyId);
CREATE INDEX IX_RentPayments_Status ON dbo.RentPayments (Status);
CREATE INDEX IX_RentPayments_DueDate ON dbo.RentPayments (DueDate);
GO

/* ============================================================================
   6. ComplaintCategories
   ============================================================================ */
CREATE TABLE dbo.ComplaintCategories
(
    CategoryId    INT             NOT NULL IDENTITY(1,1) CONSTRAINT PK_ComplaintCategories PRIMARY KEY,
    CategoryName  NVARCHAR(100)   NOT NULL,
    IsActive      BIT             NOT NULL CONSTRAINT DF_ComplaintCategories_IsActive DEFAULT (1),
    CONSTRAINT UQ_ComplaintCategories_Name UNIQUE (CategoryName)
);
GO

/* ============================================================================
   7. Complaints
   ============================================================================ */
CREATE TABLE dbo.Complaints
(
    ComplaintId   INT             NOT NULL IDENTITY(1,1) CONSTRAINT PK_Complaints PRIMARY KEY,
    TenantId      INT             NOT NULL,
    PropertyId    INT             NOT NULL,
    CategoryId    INT             NOT NULL,
    Title         NVARCHAR(150)   NOT NULL,
    Description   NVARCHAR(1000)  NOT NULL,
    Status        NVARCHAR(30)    NOT NULL CONSTRAINT DF_Complaints_Status DEFAULT ('Open'),
    Priority      NVARCHAR(30)    NOT NULL CONSTRAINT DF_Complaints_Priority DEFAULT ('Medium'),
    CreatedAt     DATETIME2       NOT NULL CONSTRAINT DF_Complaints_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt     DATETIME2       NOT NULL CONSTRAINT DF_Complaints_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    ResolvedAt    DATETIME2       NULL,
    CONSTRAINT FK_Complaints_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_Complaints_Property FOREIGN KEY (PropertyId) REFERENCES dbo.Properties (PropertyId),
    CONSTRAINT FK_Complaints_Category FOREIGN KEY (CategoryId) REFERENCES dbo.ComplaintCategories (CategoryId),
    CONSTRAINT CK_Complaints_Status CHECK (Status IN ('Open', 'In Progress', 'Resolved')),
    CONSTRAINT CK_Complaints_Priority CHECK (Priority IN ('Low', 'Medium', 'High'))
);
GO

CREATE INDEX IX_Complaints_TenantId ON dbo.Complaints (TenantId);
CREATE INDEX IX_Complaints_PropertyId ON dbo.Complaints (PropertyId);
CREATE INDEX IX_Complaints_CategoryId ON dbo.Complaints (CategoryId);
CREATE INDEX IX_Complaints_Status ON dbo.Complaints (Status);
GO

/* ============================================================================
   8. Notifications
   ============================================================================ */
CREATE TABLE dbo.Notifications
(
    NotificationId INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_Notifications PRIMARY KEY,
    UserId         INT            NOT NULL,
    Title          NVARCHAR(150)  NOT NULL,
    Message        NVARCHAR(500)  NOT NULL,
    IsRead         BIT            NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT (0),
    CreatedAt      DATETIME2      NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Notifications_User FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId)
);
GO

CREATE INDEX IX_Notifications_UserId ON dbo.Notifications (UserId);
GO

/* ============================================================================
   SEED DATA — Roles
   ============================================================================ */
INSERT INTO dbo.Roles (RoleName, Description) VALUES
    (N'Admin',    N'Full system oversight and user management'),
    (N'Landlord', N'Manages properties, tenants, and rent collection'),
    (N'Tenant',   N'Rents a property and can raise complaints');
GO

/* ============================================================================
   SEED DATA — Complaint Categories
   ============================================================================ */
INSERT INTO dbo.ComplaintCategories (CategoryName, IsActive) VALUES
    (N'Plumbing',   1),
    (N'Electrical', 1),
    (N'Cleaning',   1),
    (N'Appliance',  1),
    (N'Other',      1);
GO

/* ============================================================================
   DEMO DATA — Users
   Passwords below are hashed with ASP.NET Core's PBKDF2-based
   Microsoft.AspNetCore.Identity.PasswordHasher — never plaintext.

     Admin    : admin@rentease.com     / Admin@123
     Landlord : landlord@rentease.com  / Landlord@123
     Landlord : sarah.landlord@rentease.com / Landlord@123
     Tenant   : tenant@rentease.com    / Tenant@123
     Tenant   : emma.tenant@rentease.com    / Tenant@123
     Tenant   : david.tenant@rentease.com   / Tenant@123
   ============================================================================ */
DECLARE @AdminRoleId INT = (SELECT RoleId FROM dbo.Roles WHERE RoleName = N'Admin');
DECLARE @LandlordRoleId INT = (SELECT RoleId FROM dbo.Roles WHERE RoleName = N'Landlord');
DECLARE @TenantRoleId INT = (SELECT RoleId FROM dbo.Roles WHERE RoleName = N'Tenant');

INSERT INTO dbo.Users (RoleId, FirstName, LastName, Email, PasswordHash, PhoneNumber, IsActive, CreatedAt, UpdatedAt) VALUES
    (@AdminRoleId,    N'Alice', N'Johnson', N'admin@rentease.com',           N'AQAAAAIAAYagAAAAEB3eNHOQnwo4Z0NSPTr73jdS5biQhekQyw8a7+Fh1oZI8Ci+InZFGHA0LtllHUB6Vg==', N'9990001111', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    (@LandlordRoleId, N'John',  N'Smith',   N'landlord@rentease.com',        N'AQAAAAIAAYagAAAAEGHK/bcDDquLjvwWmcwflYNVBP0QDCBO3XwSWO+3ins7f6OKTboZQvkhsIL/qoU6mQ==', N'9990002222', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    (@LandlordRoleId, N'Sarah', N'Williams',N'sarah.landlord@rentease.com',  N'AQAAAAIAAYagAAAAEGHK/bcDDquLjvwWmcwflYNVBP0QDCBO3XwSWO+3ins7f6OKTboZQvkhsIL/qoU6mQ==', N'9990003333', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    (@TenantRoleId,   N'Michael', N'Brown', N'tenant@rentease.com',          N'AQAAAAIAAYagAAAAELjRZ8BsbkP7qVygmPbuUfD2gmpP79NUuvK/p1WkzoIjlURxXSraWhg7h2VLmZRFuA==', N'9990004444', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    (@TenantRoleId,   N'Emma',  N'Davis',   N'emma.tenant@rentease.com',     N'AQAAAAIAAYagAAAAELjRZ8BsbkP7qVygmPbuUfD2gmpP79NUuvK/p1WkzoIjlURxXSraWhg7h2VLmZRFuA==', N'9990005555', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    (@TenantRoleId,   N'David', N'Wilson',  N'david.tenant@rentease.com',    N'AQAAAAIAAYagAAAAELjRZ8BsbkP7qVygmPbuUfD2gmpP79NUuvK/p1WkzoIjlURxXSraWhg7h2VLmZRFuA==', N'9990006666', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
GO

/* ============================================================================
   DEMO DATA — Properties
   ============================================================================ */
DECLARE @John INT = (SELECT UserId FROM dbo.Users WHERE Email = N'landlord@rentease.com');
DECLARE @Sarah INT = (SELECT UserId FROM dbo.Users WHERE Email = N'sarah.landlord@rentease.com');

INSERT INTO dbo.Properties (LandlordId, PropertyName, PropertyType, Address, City, State, PostalCode, MonthlyRent, Status, Description, CreatedAt, UpdatedAt) VALUES
    (@John,  N'Greenwood Apartments 2B', N'Apartment', N'123 Greenwood Ave', N'Austin', N'Texas', N'78701', 1200.00, N'Occupied',  N'Cozy 2BHK apartment close to downtown.', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (@John,  N'Maple Street Duplex',     N'Duplex',    N'45 Maple Street',   N'Austin', N'Texas', N'78702', 1500.00, N'Occupied',  N'Spacious duplex with private backyard.', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (@Sarah, N'Riverside Villa',         N'House',     N'78 Riverside Drive',N'Dallas', N'Texas', N'75201', 2200.00, N'Occupied',  N'3BHK villa with river view and garage.', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (@Sarah, N'Downtown Loft 5A',        N'Apartment', N'200 Main Street',   N'Dallas', N'Texas', N'75202', 1350.00, N'Available', N'Modern loft in the heart of downtown.',  SYSUTCDATETIME(), SYSUTCDATETIME());
GO

/* ============================================================================
   DEMO DATA — TenantProperties (active leases)
   ============================================================================ */
DECLARE @Michael INT = (SELECT UserId FROM dbo.Users WHERE Email = N'tenant@rentease.com');
DECLARE @Emma INT = (SELECT UserId FROM dbo.Users WHERE Email = N'emma.tenant@rentease.com');
DECLARE @David INT = (SELECT UserId FROM dbo.Users WHERE Email = N'david.tenant@rentease.com');

DECLARE @PropGreenwood INT = (SELECT PropertyId FROM dbo.Properties WHERE PropertyName = N'Greenwood Apartments 2B');
DECLARE @PropMaple INT = (SELECT PropertyId FROM dbo.Properties WHERE PropertyName = N'Maple Street Duplex');
DECLARE @PropRiverside INT = (SELECT PropertyId FROM dbo.Properties WHERE PropertyName = N'Riverside Villa');

INSERT INTO dbo.TenantProperties (TenantId, PropertyId, StartDate, EndDate, Status, CreatedAt) VALUES
    (@Michael, @PropGreenwood, '2026-01-01', NULL, N'Active', SYSUTCDATETIME()),
    (@Emma,    @PropMaple,     '2026-03-15', NULL, N'Active', SYSUTCDATETIME()),
    (@David,   @PropRiverside, '2025-11-01', NULL, N'Active', SYSUTCDATETIME());
GO

/* ============================================================================
   DEMO DATA — RentPayments
   ============================================================================ */
DECLARE @TP_Michael INT = (SELECT TenantPropertyId FROM dbo.TenantProperties tp
                            JOIN dbo.Users u ON u.UserId = tp.TenantId WHERE u.Email = N'tenant@rentease.com');
DECLARE @TP_Emma INT = (SELECT TenantPropertyId FROM dbo.TenantProperties tp
                            JOIN dbo.Users u ON u.UserId = tp.TenantId WHERE u.Email = N'emma.tenant@rentease.com');
DECLARE @TP_David INT = (SELECT TenantPropertyId FROM dbo.TenantProperties tp
                            JOIN dbo.Users u ON u.UserId = tp.TenantId WHERE u.Email = N'david.tenant@rentease.com');

INSERT INTO dbo.RentPayments (TenantPropertyId, BillingMonth, Amount, DueDate, PaymentDate, Status, PaymentMethod, Notes, CreatedAt) VALUES
    (@TP_Michael, '2026-07-01', 1200.00, '2026-07-01', '2026-07-01', N'Paid',    N'Bank Transfer', NULL, SYSUTCDATETIME()),
    (@TP_Michael, '2026-08-01', 1200.00, '2026-08-01', '2026-08-03', N'Paid',    N'UPI',           NULL, SYSUTCDATETIME()),
    (@TP_Michael, '2026-09-01', 1200.00, '2026-09-01', NULL,         N'Overdue', NULL,             N'Reminder sent to tenant.', SYSUTCDATETIME()),

    (@TP_Emma, '2026-07-01', 1500.00, '2026-07-15', '2026-07-15', N'Paid',    N'Cash', NULL, SYSUTCDATETIME()),
    (@TP_Emma, '2026-08-01', 1500.00, '2026-08-15', '2026-08-16', N'Paid',    N'UPI',  NULL, SYSUTCDATETIME()),
    (@TP_Emma, '2026-09-01', 1500.00, '2026-09-15', NULL,         N'Pending', NULL,    NULL, SYSUTCDATETIME()),

    (@TP_David, '2026-07-01', 2200.00, '2026-07-01', '2026-07-01', N'Paid',    N'Bank Transfer', NULL, SYSUTCDATETIME()),
    (@TP_David, '2026-08-01', 2200.00, '2026-08-01', NULL,         N'Overdue', NULL,             N'Tenant informed of delay.', SYSUTCDATETIME()),
    (@TP_David, '2026-09-01', 2200.00, '2026-09-01', NULL,         N'Pending', NULL,             NULL, SYSUTCDATETIME());
GO

/* ============================================================================
   DEMO DATA — Complaints
   ============================================================================ */
DECLARE @Michael2 INT = (SELECT UserId FROM dbo.Users WHERE Email = N'tenant@rentease.com');
DECLARE @Emma2 INT = (SELECT UserId FROM dbo.Users WHERE Email = N'emma.tenant@rentease.com');
DECLARE @David2 INT = (SELECT UserId FROM dbo.Users WHERE Email = N'david.tenant@rentease.com');

DECLARE @PropGreenwood2 INT = (SELECT PropertyId FROM dbo.Properties WHERE PropertyName = N'Greenwood Apartments 2B');
DECLARE @PropMaple2 INT = (SELECT PropertyId FROM dbo.Properties WHERE PropertyName = N'Maple Street Duplex');
DECLARE @PropRiverside2 INT = (SELECT PropertyId FROM dbo.Properties WHERE PropertyName = N'Riverside Villa');

DECLARE @CatPlumbing INT = (SELECT CategoryId FROM dbo.ComplaintCategories WHERE CategoryName = N'Plumbing');
DECLARE @CatElectrical INT = (SELECT CategoryId FROM dbo.ComplaintCategories WHERE CategoryName = N'Electrical');
DECLARE @CatAppliance INT = (SELECT CategoryId FROM dbo.ComplaintCategories WHERE CategoryName = N'Appliance');

INSERT INTO dbo.Complaints (TenantId, PropertyId, CategoryId, Title, Description, Status, Priority, CreatedAt, UpdatedAt, ResolvedAt) VALUES
    (@Michael2, @PropGreenwood2, @CatPlumbing,   N'Leaking kitchen faucet',          N'The kitchen faucet has been dripping continuously for the past two days.', N'Open',        N'Medium', SYSUTCDATETIME(), SYSUTCDATETIME(), NULL),
    (@Emma2,    @PropMaple2,     @CatElectrical, N'Bedroom light flickering',        N'The main bedroom light flickers intermittently, especially in the evening.', N'In Progress', N'Medium', SYSUTCDATETIME(), SYSUTCDATETIME(), NULL),
    (@David2,   @PropRiverside2, @CatAppliance,  N'Refrigerator not cooling properly', N'The refrigerator in the kitchen has stopped cooling food properly since last week.', N'Resolved', N'High', DATEADD(DAY, -10, SYSUTCDATETIME()), SYSUTCDATETIME(), SYSUTCDATETIME());
GO

/* ============================================================================
   DEMO DATA — Notifications
   ============================================================================ */
DECLARE @John2 INT = (SELECT UserId FROM dbo.Users WHERE Email = N'landlord@rentease.com');
DECLARE @Sarah2 INT = (SELECT UserId FROM dbo.Users WHERE Email = N'sarah.landlord@rentease.com');
DECLARE @Michael3 INT = (SELECT UserId FROM dbo.Users WHERE Email = N'tenant@rentease.com');
DECLARE @David3 INT = (SELECT UserId FROM dbo.Users WHERE Email = N'david.tenant@rentease.com');

INSERT INTO dbo.Notifications (UserId, Title, Message, IsRead, CreatedAt) VALUES
    (@John2,    N'New Complaint Reported', N'Michael Brown reported a plumbing issue at Greenwood Apartments 2B.', 0, SYSUTCDATETIME()),
    (@Michael3, N'Rent Due Reminder',      N'Your rent of $1200.00 for Greenwood Apartments 2B was due on 2026-09-01.', 0, SYSUTCDATETIME()),
    (@David3,   N'Payment Overdue',        N'Your rent payment of $2200.00 for Riverside Villa is overdue.', 0, SYSUTCDATETIME()),
    (@Sarah2,   N'Complaint Resolved',     N'The refrigerator complaint at Riverside Villa has been marked resolved.', 1, DATEADD(DAY, -1, SYSUTCDATETIME()));
GO

PRINT N'RentEaseDb setup complete.';
GO
