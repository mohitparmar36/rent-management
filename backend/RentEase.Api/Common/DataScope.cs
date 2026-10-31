using RentEase.Api.Data;
using RentEase.Api.Models;

namespace RentEase.Api.Common;

/// <summary>
/// The single place that decides which rows the signed-in user is allowed to see.
///   Admin    — everything
///   Landlord — only rows connected to properties they own
///   Tenant   — only rows connected to their own rental assignments
/// Services start every query from one of these methods, so an id typed into the
/// URL for someone else's record simply isn't found (404).
/// </summary>
public class DataScope
{
    private readonly AppDbContext _db;
    private readonly CurrentUser _user;

    public DataScope(AppDbContext db, CurrentUser user)
    {
        _db = db;
        _user = user;
    }

    public IQueryable<Property> Properties()
    {
        var query = _db.Properties.AsQueryable();
        if (_user.IsLandlord)
            query = query.Where(p => p.LandlordId == _user.UserId);
        else if (_user.IsTenant)
            query = query.Where(p => p.TenantProperties.Any(tp => tp.TenantId == _user.UserId));
        return query;
    }

    public IQueryable<TenantProperty> Assignments()
    {
        var query = _db.TenantProperties.AsQueryable();
        if (_user.IsLandlord)
            query = query.Where(tp => tp.Property.LandlordId == _user.UserId);
        else if (_user.IsTenant)
            query = query.Where(tp => tp.TenantId == _user.UserId);
        return query;
    }

    public IQueryable<RentPayment> RentPayments()
    {
        var query = _db.RentPayments.AsQueryable();
        if (_user.IsLandlord)
            query = query.Where(rp => rp.TenantProperty.Property.LandlordId == _user.UserId);
        else if (_user.IsTenant)
            query = query.Where(rp => rp.TenantProperty.TenantId == _user.UserId);
        return query;
    }

    public IQueryable<Complaint> Complaints()
    {
        var query = _db.Complaints.AsQueryable();
        if (_user.IsLandlord)
            query = query.Where(c => c.Property.LandlordId == _user.UserId);
        else if (_user.IsTenant)
            query = query.Where(c => c.TenantId == _user.UserId);
        return query;
    }

    /// <summary>Tenant accounts: all for Admin, those who have rented from the landlord for a Landlord.</summary>
    public IQueryable<User> Tenants()
    {
        var query = _db.Users.Where(u => u.Role.RoleName == AppRoles.Tenant);
        if (_user.IsLandlord)
            query = query.Where(u => u.TenantProperties.Any(tp => tp.Property.LandlordId == _user.UserId));
        else if (_user.IsTenant)
            query = query.Where(u => u.UserId == _user.UserId);
        return query;
    }
}
