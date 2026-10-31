/* ============================================================================
   RentEase – Upgrade Script 02
   ----------------------------------------------------------------------------
   Run this ONCE against an existing RentEaseDb that was created with
   01_RentEaseDb_Setup.sql (before BillingMonth existed). It is safe to re-run:
   every step checks whether it has already been applied.

   What it changes (no tables are added or dropped, no data is deleted):

   1. RentPayments.BillingMonth (DATE, always the 1st of the month)
      - Identifies which month a rent record is for, so the same lease cannot
        be billed twice for the same month.
      - Existing rows are back-filled from the month of their DueDate.
        This is correct for the RentEase demo data, where every rent record
        is due inside the month it bills. If you have imported other data
        where rent is billed in advance (e.g. due 25 Aug for September),
        review the rows printed in step 1b and correct them BEFORE the
        unique constraint is added.
      - Unique constraint (TenantPropertyId, BillingMonth).

   2. TenantProperties: at most one Active assignment per property
      (filtered unique index) and EndDate >= StartDate.

   3. Check constraints for positive money amounts and for keeping
      PaymentDate consistent with the Paid status.

   HOW TO RUN
   1. Open SQL Server Management Studio (SSMS) and connect to your server.
   2. File > Open > this file.
   3. Press F5 (Execute). Read the Messages tab — each step prints its result.
   ============================================================================ */

USE RentEaseDb;
GO

SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ----------------------------------------------------------------------------
   1a. Add BillingMonth column (nullable first, so existing rows are allowed)
   ---------------------------------------------------------------------------- */
IF COL_LENGTH('dbo.RentPayments', 'BillingMonth') IS NULL
BEGIN
    ALTER TABLE dbo.RentPayments ADD BillingMonth DATE NULL;
    PRINT '1a. Added RentPayments.BillingMonth.';
END
ELSE
    PRINT '1a. RentPayments.BillingMonth already exists - skipped.';
GO

/* ----------------------------------------------------------------------------
   1b. Back-fill BillingMonth from the month of DueDate
   ---------------------------------------------------------------------------- */
UPDATE dbo.RentPayments
SET BillingMonth = DATEFROMPARTS(YEAR(DueDate), MONTH(DueDate), 1)
WHERE BillingMonth IS NULL;

PRINT CONCAT('1b. Back-filled BillingMonth on ', @@ROWCOUNT, ' row(s).');

SELECT PaymentId, TenantPropertyId, DueDate, BillingMonth, Amount, Status
FROM dbo.RentPayments
ORDER BY TenantPropertyId, BillingMonth;
GO

/* ----------------------------------------------------------------------------
   1c. Stop if two rent records now share a lease + month
   ---------------------------------------------------------------------------- */
IF EXISTS (
    SELECT 1 FROM dbo.RentPayments
    GROUP BY TenantPropertyId, BillingMonth
    HAVING COUNT(*) > 1)
BEGIN
    SELECT TenantPropertyId, BillingMonth, COUNT(*) AS RecordCount
    FROM dbo.RentPayments
    GROUP BY TenantPropertyId, BillingMonth
    HAVING COUNT(*) > 1;

    RAISERROR('1c. Duplicate rent records exist for the same lease and month (listed above). Fix BillingMonth on those rows, then re-run this script.', 16, 1);
    SET NOEXEC ON; -- skip the rest of the script
END
ELSE
    PRINT '1c. No duplicate billing months found.';
GO

/* ----------------------------------------------------------------------------
   1d. Make BillingMonth required and unique per lease
   ---------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('dbo.RentPayments') AND name = 'BillingMonth' AND is_nullable = 1)
BEGIN
    ALTER TABLE dbo.RentPayments ALTER COLUMN BillingMonth DATE NOT NULL;
    PRINT '1d. BillingMonth is now NOT NULL.';
END
GO

IF OBJECT_ID('dbo.CK_RentPayments_BillingMonth', 'C') IS NULL
BEGIN
    ALTER TABLE dbo.RentPayments
        ADD CONSTRAINT CK_RentPayments_BillingMonth CHECK (DAY(BillingMonth) = 1);
    PRINT '1d. Added CK_RentPayments_BillingMonth (must be the 1st of a month).';
END
GO

IF OBJECT_ID('dbo.UQ_RentPayments_TenantProperty_BillingMonth', 'UQ') IS NULL
BEGIN
    ALTER TABLE dbo.RentPayments
        ADD CONSTRAINT UQ_RentPayments_TenantProperty_BillingMonth UNIQUE (TenantPropertyId, BillingMonth);
    PRINT '1d. Added UQ_RentPayments_TenantProperty_BillingMonth.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RentPayments_DueDate')
BEGIN
    CREATE INDEX IX_RentPayments_DueDate ON dbo.RentPayments (DueDate);
    PRINT '1d. Added IX_RentPayments_DueDate.';
END
GO

/* ----------------------------------------------------------------------------
   2. TenantProperties integrity
   ---------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM dbo.TenantProperties WHERE Status = 'Active'
           GROUP BY PropertyId HAVING COUNT(*) > 1)
BEGIN
    SELECT PropertyId, COUNT(*) AS ActiveAssignments
    FROM dbo.TenantProperties WHERE Status = 'Active'
    GROUP BY PropertyId HAVING COUNT(*) > 1;

    RAISERROR('2. Some properties have more than one Active assignment (listed above). Complete the extra ones, then re-run this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_TenantProperties_ActiveProperty')
BEGIN
    CREATE UNIQUE INDEX UX_TenantProperties_ActiveProperty
        ON dbo.TenantProperties (PropertyId)
        WHERE Status = 'Active';
    PRINT '2. Added UX_TenantProperties_ActiveProperty (one active tenant per property).';
END
GO

IF OBJECT_ID('dbo.CK_TenantProperties_Dates', 'C') IS NULL
BEGIN
    ALTER TABLE dbo.TenantProperties
        ADD CONSTRAINT CK_TenantProperties_Dates CHECK (EndDate IS NULL OR EndDate >= StartDate);
    PRINT '2. Added CK_TenantProperties_Dates.';
END
GO

/* ----------------------------------------------------------------------------
   3. Money and payment consistency
   ---------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.CK_Properties_MonthlyRent', 'C') IS NULL
BEGIN
    ALTER TABLE dbo.Properties
        ADD CONSTRAINT CK_Properties_MonthlyRent CHECK (MonthlyRent > 0);
    PRINT '3. Added CK_Properties_MonthlyRent.';
END
GO

IF OBJECT_ID('dbo.CK_RentPayments_Amount', 'C') IS NULL
BEGIN
    ALTER TABLE dbo.RentPayments
        ADD CONSTRAINT CK_RentPayments_Amount CHECK (Amount > 0);
    PRINT '3. Added CK_RentPayments_Amount.';
END
GO

IF OBJECT_ID('dbo.CK_RentPayments_PaidDetails', 'C') IS NULL
BEGIN
    ALTER TABLE dbo.RentPayments
        ADD CONSTRAINT CK_RentPayments_PaidDetails CHECK (
            (Status = 'Paid' AND PaymentDate IS NOT NULL AND PaymentMethod IS NOT NULL)
            OR (Status <> 'Paid' AND PaymentDate IS NULL));
    PRINT '3. Added CK_RentPayments_PaidDetails.';
END
GO

SET NOEXEC OFF;
GO

PRINT 'Upgrade 02 finished.';
GO
