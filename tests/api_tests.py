"""
RentEase API end-to-end tests.

Runs real HTTP requests against a running API that is connected to a DISPOSABLE
test database (never your demo database — the tests create and change records).
See tests/README.md for the exact setup (it takes two commands).

    python tests/api_tests.py [base_url]

Default base_url: https://localhost:7190/api
Requires only the Python 3 standard library.
"""
import json
import ssl
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://localhost:7190/api"
CTX = ssl._create_unverified_context()  # local dev certificate

TODAY = date.today()
results = []


# ---------------------------------------------------------------- helpers
def call(method, path, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, context=CTX) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, (json.loads(raw) if raw else None)
        except ValueError:
            return e.code, raw.decode(errors="replace")


def check(name, condition, detail=""):
    results.append((name, bool(condition), detail))
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {name}" + (f"  -- {detail}" if detail and not condition else ""))


def expect(name, response, status, predicate=None):
    code, body = response
    ok = code == status and (predicate is None or predicate(body))
    check(name, ok, f"got {code}: {str(body)[:200]}")
    return body


def login(email, password):
    code, body = call("POST", "/auth/login", body={"email": email, "password": password})
    assert code == 200, f"login failed for {email}: {code} {body}"
    return body["token"]


def section(title):
    print(f"\n== {title}")


def iso(d):
    return d.isoformat()


def month_str(d):
    return d.strftime("%Y-%m")


# ---------------------------------------------------------------- tests
section("Authentication")
admin = login("admin@rentease.com", "Admin@123")
john = login("landlord@rentease.com", "Landlord@123")      # owns Greenwood (P1), Maple (P2)
sarah = login("sarah.landlord@rentease.com", "Landlord@123")  # owns Riverside (P3), Downtown Loft (P4)
michael = login("tenant@rentease.com", "Tenant@123")       # rents P1
emma = login("emma.tenant@rentease.com", "Tenant@123")     # rents P2
check("all demo accounts can sign in", True)

expect("wrong password rejected with generic message",
       call("POST", "/auth/login", body={"email": "admin@rentease.com", "password": "nope"}), 401,
       lambda b: b["message"] == "Invalid email or password.")
expect("unknown email gets the same generic message",
       call("POST", "/auth/login", body={"email": "ghost@rentease.com", "password": "Whatever1"}), 401,
       lambda b: b["message"] == "Invalid email or password.")
expect("login response never contains a password hash",
       call("POST", "/auth/login", body={"email": "admin@rentease.com", "password": "Admin@123"}), 200,
       lambda b: "passwordHash" not in json.dumps(b).lower().replace("_", ""))
expect("invalid login body -> 400 with message + errors",
       call("POST", "/auth/login", body={"email": "not-an-email", "password": ""}), 400,
       lambda b: "message" in b and "errors" in b)
expect("GET /auth/me returns the token's user", call("GET", "/auth/me", michael), 200,
       lambda b: b["email"] == "tenant@rentease.com" and b["role"] == "Tenant")
expect("no token -> 401 JSON", call("GET", "/properties"), 401, lambda b: "message" in b)
expect("tampered token -> 401", call("GET", "/properties", michael[:-4] + "abcd"), 401)

section("Role restrictions")
expect("tenant cannot list users", call("GET", "/users", michael), 403, lambda b: "message" in b)
expect("landlord cannot list users", call("GET", "/users", john), 403)
expect("tenant cannot open admin dashboard", call("GET", "/dashboard/admin", michael), 403)
expect("landlord cannot open tenant dashboard", call("GET", "/dashboard/tenant", john), 403)
expect("tenant cannot create a property",
       call("POST", "/properties", michael, {"propertyName": "X", "propertyType": "House", "address": "1 A St",
                                             "city": "C", "state": "S", "monthlyRent": 100, "status": "Available"}), 403)
expect("tenant cannot view occupancy report", call("GET", "/reports/occupancy", michael), 403)

section("User management (admin)")
users = expect("admin lists users", call("GET", "/users?pageSize=50", admin), 200, lambda b: b["totalCount"] >= 6)
check("user list exposes no password hashes", "passwordhash" not in json.dumps(users).lower())
expect("search by name", call("GET", "/users?search=emma", admin), 200,
       lambda b: b["totalCount"] == 1 and b["items"][0]["firstName"] == "Emma")
expect("filter by role", call("GET", "/users?role=Landlord", admin), 200, lambda b: b["totalCount"] == 2)
expect("sort by name asc", call("GET", "/users?sortBy=name&sortDir=asc&pageSize=50", admin), 200,
       lambda b: [u["firstName"] for u in b["items"]] == sorted(u["firstName"] for u in b["items"]))
expect("duplicate email rejected",
       call("POST", "/users", admin, {"firstName": "A", "lastName": "B", "email": "ADMIN@rentease.com",
                                      "role": "Tenant", "password": "Password1"}), 409)
expect("weak password rejected",
       call("POST", "/users", admin, {"firstName": "A", "lastName": "B", "email": "weak@test.com",
                                      "role": "Tenant", "password": "short"}), 400)
expect("invalid role rejected",
       call("POST", "/users", admin, {"firstName": "A", "lastName": "B", "email": "role@test.com",
                                      "role": "SuperAdmin", "password": "Password1"}), 400)
zoe_id = expect("admin creates a tenant account",
                call("POST", "/users", admin, {"firstName": "Zoe", "lastName": "Test", "email": "zoe@test.com",
                                               "role": "Tenant", "password": "Password1"}), 201)["userId"]
expect("admin edits user", call("PUT", f"/users/{zoe_id}", admin,
                                {"firstName": "Zoe", "lastName": "Tester", "email": "zoe@test.com"}), 200)
expect("user details", call("GET", f"/users/{zoe_id}", admin), 200, lambda b: b["lastName"] == "Tester")
expect("admin cannot deactivate own account",
       call("PATCH", "/users/1/status", admin, {"isActive": False}), 400)

expect("admin deactivates Emma", call("PATCH", "/users/5/status", admin, {"isActive": False}), 200)
expect("inactive user cannot log in (clear message)",
       call("POST", "/auth/login", body={"email": "emma.tenant@rentease.com", "password": "Tenant@123"}), 401,
       lambda b: "deactivated" in b["message"])
expect("inactive user's existing token stops working immediately", call("GET", "/auth/me", emma), 401)
expect("admin reactivates Emma", call("PATCH", "/users/5/status", admin, {"isActive": True}), 200)
emma = login("emma.tenant@rentease.com", "Tenant@123")

section("Properties")
new_prop = {"propertyName": "Test Cottage", "propertyType": "House", "address": "9 Test Lane", "city": "Austin",
            "state": "Texas", "postalCode": "78703", "monthlyRent": 999.5, "status": "Available",
            "description": "Created by api_tests", "landlordId": 3}
p_new = expect("landlord creates property (landlordId in body ignored)",
               call("POST", "/properties", john, new_prop), 201)["propertyId"]
expect("new property belongs to the caller", call("GET", f"/properties/{p_new}", john), 200,
       lambda b: b["landlordId"] == 2 and b["monthlyRent"] == 999.5)
expect("landlord edits own property",
       call("PUT", f"/properties/{p_new}", john, {**new_prop, "monthlyRent": 1050}), 200)
expect("landlord cannot view another landlord's property", call("GET", "/properties/4", john), 404)
expect("landlord cannot edit another landlord's property", call("PUT", "/properties/4", john, new_prop), 404)
expect("landlord cannot delete another landlord's property", call("DELETE", "/properties/4", john), 404)
expect("landlord only lists own properties", call("GET", "/properties?pageSize=50", john), 200,
       lambda b: all(p["landlordId"] == 2 for p in b["items"]) and b["totalCount"] == 3)
expect("tenant only sees the property they rent", call("GET", "/properties", michael), 200,
       lambda b: [p["propertyId"] for p in b["items"]] == [1])
expect("tenant cannot open someone else's property", call("GET", "/properties/2", michael), 404)
expect("rent must be positive", call("POST", "/properties", john, {**new_prop, "monthlyRent": 0}), 400)
expect("missing name rejected", call("POST", "/properties", john, {**new_prop, "propertyName": ""}), 400)
expect("cannot create as Occupied", call("POST", "/properties", john, {**new_prop, "status": "Occupied"}), 400)
expect("cannot mark vacant property Occupied by hand",
       call("PUT", f"/properties/{p_new}", john, {**new_prop, "status": "Occupied"}), 400)
expect("cannot make a let property Available while rented",
       call("PUT", "/properties/1", john, {**new_prop, "propertyName": "Greenwood Apartments 2B",
                                           "status": "Available"}), 409)
expect("admin must name the landlord", call("POST", "/properties", admin, {**new_prop, "landlordId": None}), 400)
p_admin = expect("admin creates property for Sarah", call("POST", "/properties", admin, new_prop), 201)["propertyId"]
expect("filter by status", call("GET", "/properties?status=Occupied", admin), 200,
       lambda b: all(p["status"] == "Occupied" for p in b["items"]))
expect("search by city", call("GET", "/properties?search=dallas", admin), 200,
       lambda b: b["totalCount"] >= 2 and all(p["city"] == "Dallas" for p in b["items"]))
expect("sort by rent desc", call("GET", "/properties?sortBy=rent&sortDir=desc&pageSize=50", admin), 200,
       lambda b: [p["monthlyRent"] for p in b["items"]] == sorted((p["monthlyRent"] for p in b["items"]), reverse=True))
expect("pagination works", call("GET", "/properties?page=2&pageSize=2", admin), 200,
       lambda b: b["page"] == 2 and len(b["items"]) <= 2 and b["totalPages"] >= 3)
expect("property with history cannot be deleted", call("DELETE", "/properties/1", john), 409)
expect("admin deletes unused property", call("DELETE", f"/properties/{p_admin}", admin), 200)

section("Tenants & rental assignments")
expect("landlord sees only own tenants", call("GET", "/tenants?pageSize=50", john), 200,
       lambda b: sorted(t["userId"] for t in b["items"]) == [4, 5])
expect("landlord cannot open another landlord's tenant", call("GET", "/tenants/6", john), 404)
expect("available tenants are unassigned only", call("GET", "/tenants/available", john), 200,
       lambda b: [t["userId"] for t in b] == [zoe_id])
expect("tenant cannot create assignments",
       call("POST", "/tenantproperties", michael, {"tenantId": 4, "propertyId": p_new, "startDate": iso(TODAY)}), 403)
expect("cannot assign to another landlord's property",
       call("POST", "/tenantproperties", john, {"tenantId": zoe_id, "propertyId": 4, "startDate": iso(TODAY)}), 404)
expect("end date before start rejected",
       call("POST", "/tenantproperties", john, {"tenantId": zoe_id, "propertyId": p_new, "startDate": iso(TODAY),
                                                "endDate": iso(TODAY - timedelta(days=1))}), 400)
expect("cannot assign to an occupied property",
       call("POST", "/tenantproperties", john, {"tenantId": zoe_id, "propertyId": 1, "startDate": iso(TODAY)}), 409)
start = TODAY.replace(day=1)
tp_zoe = expect("landlord assigns Zoe to the new property",
                call("POST", "/tenantproperties", john, {"tenantId": zoe_id, "propertyId": p_new,
                                                         "startDate": iso(start)}), 201)["assignmentId"]
expect("property became Occupied", call("GET", f"/properties/{p_new}", john), 200,
       lambda b: b["status"] == "Occupied" and b["currentAssignment"]["tenantId"] == zoe_id)
expect("tenant with an active rental cannot be assigned again",
       call("POST", "/tenantproperties", sarah, {"tenantId": zoe_id, "propertyId": 4, "startDate": iso(TODAY)}), 409)
expect("landlord cannot create a tenant without assigning them",
       call("POST", "/tenants", john, {"firstName": "No", "lastName": "Home", "email": "nohome@test.com",
                                       "password": "Password1"}), 400)
created = expect("landlord creates tenant + assignment in one step",
                 call("POST", "/tenants", sarah, {"firstName": "Liam", "lastName": "Test", "email": "liam@test.com",
                                                  "password": "Password1", "propertyId": 4,
                                                  "startDate": iso(start)}), 201)
expect("...and P4 is now Occupied", call("GET", "/properties/4", sarah), 200, lambda b: b["status"] == "Occupied")
liam = login("liam@test.com", "Password1")

section("Rent")
expect("tenant cannot create rent",
       call("POST", "/rentpayments", michael, {"tenantPropertyId": 1, "billingMonth": month_str(TODAY),
                                               "amount": 1200, "dueDate": iso(TODAY)}), 403)
expect("landlord cannot bill another landlord's rental",
       call("POST", "/rentpayments", john, {"tenantPropertyId": 3, "billingMonth": month_str(TODAY),
                                            "amount": 2200, "dueDate": iso(TODAY)}), 404)
expect("amount must be positive",
       call("POST", "/rentpayments", john, {"tenantPropertyId": tp_zoe, "billingMonth": month_str(TODAY),
                                            "amount": 0, "dueDate": iso(TODAY)}), 400)
expect("bad billing month format",
       call("POST", "/rentpayments", john, {"tenantPropertyId": tp_zoe, "billingMonth": "2026/13",
                                            "amount": 100, "dueDate": iso(TODAY)}), 400)
expect("cannot bill a month before the rental started",
       call("POST", "/rentpayments", john, {"tenantPropertyId": tp_zoe,
                                            "billingMonth": month_str(start - timedelta(days=1)),
                                            "amount": 100, "dueDate": iso(start - timedelta(days=1))}), 400)
expect("due date far from billing month rejected",
       call("POST", "/rentpayments", john, {"tenantPropertyId": tp_zoe, "billingMonth": month_str(TODAY),
                                            "amount": 100, "dueDate": iso(TODAY + timedelta(days=120))}), 400)
rp = expect("landlord creates rent record",
            call("POST", "/rentpayments", john, {"tenantPropertyId": tp_zoe, "billingMonth": month_str(TODAY),
                                                 "amount": 1050, "dueDate": iso(start)}), 201)["paymentId"]
expect("duplicate month rejected",
       call("POST", "/rentpayments", john, {"tenantPropertyId": tp_zoe, "billingMonth": month_str(TODAY),
                                            "amount": 1050, "dueDate": iso(start)}), 409)
expect("past due date -> record is Overdue", call("GET", f"/rentpayments/{rp}", john), 200,
       lambda b: b["status"] == ("Overdue" if start < TODAY else "Pending"))
expect("seeded pending rent past its due date is now Overdue", call("GET", "/rentpayments/6", john), 200,
       lambda b: b["status"] == "Overdue")
expect("tenant cannot mark rent paid",
       call("POST", f"/rentpayments/{rp}/mark-paid", liam, {"paymentDate": iso(TODAY), "paymentMethod": "Cash"}), 403)
expect("future payment date rejected",
       call("POST", f"/rentpayments/{rp}/mark-paid", john,
            {"paymentDate": iso(TODAY + timedelta(days=1)), "paymentMethod": "Cash"}), 400)
expect("invalid payment method rejected",
       call("POST", f"/rentpayments/{rp}/mark-paid", john, {"paymentDate": iso(TODAY), "paymentMethod": "Bitcoin"}), 400)
expect("landlord cannot record payment on another landlord's rent",
       call("POST", "/rentpayments/9/mark-paid", john, {"paymentDate": iso(TODAY), "paymentMethod": "Cash"}), 404)
expect("landlord records payment",
       call("POST", f"/rentpayments/{rp}/mark-paid", john,
            {"paymentDate": iso(TODAY), "paymentMethod": "UPI", "notes": "Paid in full"}), 200)
expect("second payment on the same record rejected",
       call("POST", f"/rentpayments/{rp}/mark-paid", john, {"paymentDate": iso(TODAY), "paymentMethod": "UPI"}), 409)
expect("paid record has date, method, status Paid", call("GET", f"/rentpayments/{rp}", john), 200,
       lambda b: b["status"] == "Paid" and b["paymentMethod"] == "UPI" and b["paymentDate"] == iso(TODAY))
expect("tenant sees only own rent records", call("GET", "/rentpayments?pageSize=100", michael), 200,
       lambda b: b["totalCount"] > 0 and all(r["tenantId"] == 4 for r in b["items"]))
expect("tenant cannot open another tenant's rent record", call("GET", "/rentpayments/4", michael), 404)
summary = expect("summary endpoint", call("GET", "/rentpayments/summary", john), 200)
listing = call("GET", "/rentpayments?pageSize=100", john)[1]["items"]
check("summary totals match the records",
      summary["totalCollected"] == sum(r["amount"] for r in listing if r["status"] == "Paid")
      and summary["overdueAmount"] == sum(r["amount"] for r in listing if r["status"] == "Overdue")
      and summary["pendingAmount"] == sum(r["amount"] for r in listing if r["status"] == "Pending"))
check("paid rent is never counted as overdue", all(r["paymentDate"] for r in listing if r["status"] == "Paid"))
expect("filter by status", call("GET", "/rentpayments?status=Paid", john), 200,
       lambda b: all(r["status"] == "Paid" for r in b["items"]))
expect("filter by property", call("GET", "/rentpayments?propertyId=2", john), 200,
       lambda b: b["totalCount"] > 0 and all(r["propertyId"] == 2 for r in b["items"]))

section("Ending a rental")
expect("end date in the future rejected",
       call("POST", f"/tenantproperties/{tp_zoe}/complete", john, {"endDate": iso(TODAY + timedelta(days=5))}), 400)
expect("landlord ends Zoe's rental", call("POST", f"/tenantproperties/{tp_zoe}/complete", john, {"endDate": iso(TODAY)}), 200)
expect("ending twice rejected", call("POST", f"/tenantproperties/{tp_zoe}/complete", john, {"endDate": iso(TODAY)}), 409)
expect("history kept: assignment Completed, rent still there", call("GET", f"/tenantproperties/{tp_zoe}", john), 200,
       lambda b: b["status"] == "Completed" and len(b["rentRecords"]) == 1)
expect("property is Available again", call("GET", f"/properties/{p_new}", john), 200, lambda b: b["status"] == "Available")
expect("cannot bill a completed rental",
       call("POST", "/rentpayments", john, {"tenantPropertyId": tp_zoe,
                                            "billingMonth": month_str(TODAY.replace(day=28) + timedelta(days=5)),
                                            "amount": 100, "dueDate": iso(TODAY)}), 400)
# Zoe now rents from Sarah: John must not see that rental
sarah_p = expect("Sarah adds a property", call("POST", "/properties", sarah, {**new_prop, "propertyName": "Sarah Flat"}), 201)["propertyId"]
expect("Sarah assigns Zoe", call("POST", "/tenantproperties", sarah,
                                 {"tenantId": zoe_id, "propertyId": sarah_p, "startDate": iso(TODAY)}), 201)
expect("John sees only HIS rental with Zoe (no cross-landlord leak)", call("GET", f"/tenants/{zoe_id}", john), 200,
       lambda b: [a["landlordName"] for a in b["assignments"]] == ["John Smith"])

section("Complaints")
cats = expect("categories", call("GET", "/complaintcategories", michael), 200, lambda b: len(b) == 5)
plumbing = next(c["categoryId"] for c in cats if c["categoryName"] == "Plumbing")
complaint = {"propertyId": 1, "categoryId": plumbing, "title": "Bathroom tap leaking",
             "description": "The bathroom tap has been dripping since Monday.", "priority": "High"}
expect("landlord cannot create complaints", call("POST", "/complaints", john, complaint), 403)
expect("tenant cannot complain about a property they don't rent",
       call("POST", "/complaints", michael, {**complaint, "propertyId": 2}), 400)
expect("invalid category rejected", call("POST", "/complaints", michael, {**complaint, "categoryId": 999}), 400)
expect("invalid priority rejected", call("POST", "/complaints", michael, {**complaint, "priority": "Urgent"}), 400)
cid = expect("tenant submits complaint", call("POST", "/complaints", michael, complaint), 201)["complaintId"]
expect("tenant sees only own complaints", call("GET", "/complaints", michael), 200,
       lambda b: all(c["tenantId"] == 4 for c in b["items"]))
expect("landlord sees only complaints on own properties", call("GET", "/complaints?pageSize=50", john), 200,
       lambda b: all(c["propertyId"] in (1, 2, p_new) for c in b["items"]))
expect("other landlord cannot open it", call("GET", f"/complaints/{cid}", sarah), 404)
expect("tenant cannot change status", call("PATCH", f"/complaints/{cid}/status", michael, {"status": "Resolved"}), 403)
expect("other landlord cannot change status", call("PATCH", f"/complaints/{cid}/status", sarah, {"status": "Resolved"}), 404)
expect("invalid status rejected", call("PATCH", f"/complaints/{cid}/status", john, {"status": "Closed"}), 400)
expect("landlord sets In Progress", call("PATCH", f"/complaints/{cid}/status", john, {"status": "In Progress"}), 200)
expect("same status again rejected", call("PATCH", f"/complaints/{cid}/status", john, {"status": "In Progress"}), 400)
expect("landlord resolves", call("PATCH", f"/complaints/{cid}/status", john, {"status": "Resolved"}), 200)
expect("ResolvedAt set", call("GET", f"/complaints/{cid}", michael), 200, lambda b: b["resolvedAt"] is not None)
expect("admin reopens", call("PATCH", f"/complaints/{cid}/status", admin, {"status": "Open"}), 200)
expect("ResolvedAt cleared on reopen", call("GET", f"/complaints/{cid}", michael), 200,
       lambda b: b["resolvedAt"] is None and b["status"] == "Open")
expect("filter by priority", call("GET", "/complaints?priority=High", john), 200,
       lambda b: all(c["priority"] == "High" for c in b["items"]))

section("Notifications")
mine = expect("tenant has notifications", call("GET", "/notifications", michael), 200,
              lambda b: b["totalCount"] > 0 and b["unreadCount"] > 0)
titles = [n["title"] for n in mine["items"]]
check("complaint status changes notified the tenant", titles.count("Complaint update") >= 3, str(titles))
john_n = call("GET", "/notifications", john)[1]
check("landlord was notified of the new complaint", any(n["title"] == "New complaint" for n in john_n["items"]))
zoe = login("zoe@test.com", "Password1")
zoe_n = call("GET", "/notifications?pageSize=50", zoe)[1]["items"]
check("rent created / payment recorded / rental ended notified the tenant",
      {"New rent due", "Payment received", "Rental ended"} <= {n["title"] for n in zoe_n}, str([n["title"] for n in zoe_n]))
other_id = john_n["items"][0]["notificationId"]
expect("cannot mark another user's notification", call("PATCH", f"/notifications/{other_id}/read", michael), 404)
expect("mark own notification read", call("PATCH", f"/notifications/{mine['items'][0]['notificationId']}/read", michael), 200)
expect("mark all read", call("PATCH", "/notifications/read-all", michael), 200)
expect("unread count is now 0", call("GET", "/notifications/unread-count", michael), 200, lambda b: b["count"] == 0)
expect("John's notifications untouched", call("GET", "/notifications/unread-count", john), 200, lambda b: b["count"] > 0)

section("Dashboards & reports")
ad = expect("admin dashboard", call("GET", "/dashboard/admin", admin), 200)
all_props = call("GET", "/properties?pageSize=100", admin)[1]
all_users = call("GET", "/users?pageSize=100", admin)[1]
check("admin totals match the database",
      ad["totalProperties"] == all_props["totalCount"] and ad["totalUsers"] == all_users["totalCount"]
      and ad["occupiedProperties"] == sum(p["status"] == "Occupied" for p in all_props["items"]))
check("admin chart has 6 months, no gaps", len(ad["monthlyCollection"]) == 6)
check("admin recent activity present", len(ad["recentActivity"]) > 0)
ld = expect("landlord dashboard", call("GET", "/dashboard/landlord", john), 200)
john_props = call("GET", "/properties?pageSize=100", john)[1]
check("landlord figures scoped to own properties",
      ld["totalProperties"] == john_props["totalCount"]
      and ld["rent"]["totalCollected"] == call("GET", "/rentpayments/summary", john)[1]["totalCollected"])
td = expect("tenant dashboard", call("GET", "/dashboard/tenant", michael), 200,
            lambda b: b["currentLease"]["propertyId"] == 1 and b["nextDue"] is not None)
check("tenant dashboard shows only own data", td["latestRent"]["tenantId"] == 4)
newbie_id = call("POST", "/users", admin, {"firstName": "New", "lastName": "Person", "email": "newbie@test.com",
                                           "role": "Tenant", "password": "Password1"})[1]["userId"]
newbie = login("newbie@test.com", "Password1")
expect("tenant without a rental gets an empty dashboard (no fake data)", call("GET", "/dashboard/tenant", newbie), 200,
       lambda b: b["currentLease"] is None and b["nextDue"] is None and b["rent"]["paidCount"] == 0)
expect("rent collection report (landlord)", call("GET", "/reports/rent-collection?months=12", john), 200,
       lambda b: len(b["months"]) == 12 and all(r["status"] != "Paid" for r in b["outstanding"]))
expect("occupancy report scoped", call("GET", "/reports/occupancy", john), 200,
       lambda b: b["totalProperties"] == john_props["totalCount"])
expect("complaint report", call("GET", "/reports/complaints", admin), 200,
       lambda b: b["total"] >= 4 and len(b["byStatus"]) == 3)
expect("tenant complaint report is personal", call("GET", "/reports/complaints", newbie), 200, lambda b: b["total"] == 0)

section("Profile")
expect("profile", call("GET", "/profile", michael), 200, lambda b: b["role"] == "Tenant")
expect("update name/phone; email & role in body are ignored",
       call("PUT", "/profile", michael, {"firstName": "Mike", "lastName": "Brown", "phoneNumber": "999 000 4444",
                                         "email": "hacker@x.com", "role": "Admin", "roleId": 1, "isActive": False}), 200,
       lambda b: b["firstName"] == "Mike" and b["email"] == "tenant@rentease.com" and b["role"] == "Tenant" and b["isActive"])
expect("invalid phone rejected", call("PUT", "/profile", michael, {"firstName": "M", "lastName": "B", "phoneNumber": "abc"}), 400)
expect("wrong current password rejected",
       call("POST", "/profile/change-password", michael, {"currentPassword": "nope", "newPassword": "NewPass123"}), 400)
expect("change password", call("POST", "/profile/change-password", michael,
                               {"currentPassword": "Tenant@123", "newPassword": "NewPass123"}), 200)
check("old password no longer works",
      call("POST", "/auth/login", body={"email": "tenant@rentease.com", "password": "Tenant@123"})[0] == 401)
michael = login("tenant@rentease.com", "NewPass123")
expect("change password back (auth route)", call("POST", "/auth/change-password", michael,
                                                 {"currentPassword": "NewPass123", "newPassword": "Tenant@123"}), 200)

section("Login rate limiting")
# The test API runs with RateLimiting__LoginsPerMinute=40 (see tests/README.md)
codes = [call("POST", "/auth/login", body={"email": "x@y.com", "password": "bad"})[0] for _ in range(45)]
check("too many attempts -> 429", 429 in codes, str(codes))

# ---------------------------------------------------------------- summary
passed = sum(1 for _, ok, _ in results if ok)
print(f"\n{passed}/{len(results)} checks passed")
for name, ok, detail in results:
    if not ok:
        print(f"  FAILED: {name}  -- {detail}")
sys.exit(0 if passed == len(results) else 1)
