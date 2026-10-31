using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using RentEase.Api.Models;

namespace RentEase.Api.Data;

/// <summary>
/// Maps the existing RentEaseDb tables (created by database/*.sql).
/// The SQL scripts are the source of truth for the schema; this mapping mirrors them.
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Property> Properties => Set<Property>();
    public DbSet<TenantProperty> TenantProperties => Set<TenantProperty>();
    public DbSet<RentPayment> RentPayments => Set<RentPayment>();
    public DbSet<ComplaintCategory> ComplaintCategories => Set<ComplaintCategory>();
    public DbSet<Complaint> Complaints => Set<Complaint>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("Roles");
            entity.HasKey(r => r.RoleId);
            entity.Property(r => r.RoleName).IsRequired().HasMaxLength(50);
            entity.HasIndex(r => r.RoleName).IsUnique();
            entity.Property(r => r.Description).HasMaxLength(200);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(u => u.UserId);
            entity.Property(u => u.FirstName).IsRequired().HasMaxLength(50);
            entity.Property(u => u.LastName).IsRequired().HasMaxLength(50);
            entity.Property(u => u.Email).IsRequired().HasMaxLength(150);
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.PasswordHash).IsRequired().HasMaxLength(500);
            entity.Property(u => u.PhoneNumber).HasMaxLength(20);

            entity.HasOne(u => u.Role)
                  .WithMany(r => r.Users)
                  .HasForeignKey(u => u.RoleId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Property>(entity =>
        {
            entity.ToTable("Properties");
            entity.HasKey(p => p.PropertyId);
            entity.Property(p => p.PropertyName).IsRequired().HasMaxLength(150);
            entity.Property(p => p.PropertyType).IsRequired().HasMaxLength(50);
            entity.Property(p => p.Address).IsRequired().HasMaxLength(250);
            entity.Property(p => p.City).IsRequired().HasMaxLength(100);
            entity.Property(p => p.State).IsRequired().HasMaxLength(100);
            entity.Property(p => p.PostalCode).HasMaxLength(10);
            entity.Property(p => p.MonthlyRent).HasPrecision(18, 2);
            entity.Property(p => p.Status).IsRequired().HasMaxLength(30);
            entity.Property(p => p.Description).HasMaxLength(500);

            entity.HasOne(p => p.Landlord)
                  .WithMany(u => u.OwnedProperties)
                  .HasForeignKey(p => p.LandlordId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<TenantProperty>(entity =>
        {
            entity.ToTable("TenantProperties");
            entity.HasKey(tp => tp.TenantPropertyId);
            entity.Property(tp => tp.Status).IsRequired().HasMaxLength(30);

            // Mirrors UX_TenantProperties_ActiveProperty: one Active assignment per property
            entity.HasIndex(tp => tp.PropertyId)
                  .HasDatabaseName("UX_TenantProperties_ActiveProperty")
                  .IsUnique()
                  .HasFilter("[Status] = 'Active'");

            entity.HasOne(tp => tp.Tenant)
                  .WithMany(u => u.TenantProperties)
                  .HasForeignKey(tp => tp.TenantId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(tp => tp.Property)
                  .WithMany(p => p.TenantProperties)
                  .HasForeignKey(tp => tp.PropertyId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RentPayment>(entity =>
        {
            entity.ToTable("RentPayments");
            entity.HasKey(rp => rp.PaymentId);
            entity.Property(rp => rp.Amount).HasPrecision(18, 2);
            entity.Property(rp => rp.Status).IsRequired().HasMaxLength(30);
            entity.Property(rp => rp.PaymentMethod).HasMaxLength(30);
            entity.Property(rp => rp.Notes).HasMaxLength(250);

            // Mirrors UQ_RentPayments_TenantProperty_BillingMonth: one record per lease per month
            entity.HasIndex(rp => new { rp.TenantPropertyId, rp.BillingMonth }).IsUnique();

            entity.HasOne(rp => rp.TenantProperty)
                  .WithMany(tp => tp.RentPayments)
                  .HasForeignKey(rp => rp.TenantPropertyId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ComplaintCategory>(entity =>
        {
            entity.ToTable("ComplaintCategories");
            entity.HasKey(c => c.CategoryId);
            entity.Property(c => c.CategoryName).IsRequired().HasMaxLength(100);
            entity.HasIndex(c => c.CategoryName).IsUnique();
        });

        modelBuilder.Entity<Complaint>(entity =>
        {
            entity.ToTable("Complaints");
            entity.HasKey(c => c.ComplaintId);
            entity.Property(c => c.Title).IsRequired().HasMaxLength(150);
            entity.Property(c => c.Description).IsRequired().HasMaxLength(1000);
            entity.Property(c => c.Status).IsRequired().HasMaxLength(30);
            entity.Property(c => c.Priority).IsRequired().HasMaxLength(30);

            entity.HasOne(c => c.Tenant)
                  .WithMany(u => u.Complaints)
                  .HasForeignKey(c => c.TenantId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(c => c.Property)
                  .WithMany(p => p.Complaints)
                  .HasForeignKey(c => c.PropertyId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(c => c.Category)
                  .WithMany(cat => cat.Complaints)
                  .HasForeignKey(c => c.CategoryId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.ToTable("Notifications");
            entity.HasKey(n => n.NotificationId);
            entity.Property(n => n.Title).IsRequired().HasMaxLength(150);
            entity.Property(n => n.Message).IsRequired().HasMaxLength(500);

            entity.HasOne(n => n.User)
                  .WithMany(u => u.Notifications)
                  .HasForeignKey(n => n.UserId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // All timestamps are stored in UTC. SQL Server's datetime2 has no time zone,
        // so mark values read back as UTC — the JSON then ends in "Z" and the browser
        // converts it to local time correctly.
        var utcConverter = new ValueConverter<DateTime, DateTime>(
            v => v, v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
        var nullableUtcConverter = new ValueConverter<DateTime?, DateTime?>(
            v => v, v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime))
                    property.SetValueConverter(utcConverter);
                else if (property.ClrType == typeof(DateTime?))
                    property.SetValueConverter(nullableUtcConverter);
            }
        }
    }
}
