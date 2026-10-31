using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace RentEase.Api.Common;

public static class DbErrors
{
    // SQL Server error numbers for "duplicate key" (unique index / unique constraint)
    private const int UniqueIndexViolation = 2601;
    private const int UniqueConstraintViolation = 2627;

    public static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is SqlException sql &&
        (sql.Number == UniqueIndexViolation || sql.Number == UniqueConstraintViolation);
}
