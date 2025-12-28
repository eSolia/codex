---
id: m365-mfa-admins
framework: m365-security-baseline
category: identity
control_family: authentication
severity: critical
effort: low
keywords:
  - mfa
  - multi-factor authentication
  - admin
  - privileged access
  - azure ad
  - entra id
  - conditional access
related_controls:
  - m365-mfa-all-users
  - m365-block-legacy-auth
  - m365-privileged-identity-management
maps_to:
  iso27001:
    - A.5.15
    - A.5.16
    - A.8.2
  nist:
    - IA-2
    - IA-5
  cis:
    - "6.3"
    - "6.5"
  soc2:
    - CC6.1
products:
  - pulse
  - quiz
last_updated: 2025-01-15
---

# Require MFA for Admin Accounts

## Control Summary

All accounts with administrative privileges in Microsoft 365 must use multi-factor authentication (MFA) for every sign-in. This includes Global Administrators, Security Administrators, Exchange Administrators, and all other privileged roles.

## Why This Matters

Admin accounts are the keys to your kingdom. A single compromised admin credential gives attackers the ability to access all user data, modify security settings, create backdoor accounts, and potentially deploy ransomware across your entire organization.

**The threat is real:**

- Admin accounts are targeted 3x more often than standard user accounts
- 80% of breaches involve compromised privileged credentials (Verizon DBIR)
- Average cost of an admin account compromise: $4.2 million (IBM Cost of a Data Breach)

**The protection is effective:**

- MFA blocks 99.9% of automated account compromise attacks
- Organizations with MFA for admins see 50% fewer security incidents

Think of it this way: you wouldn't leave the master key to your building under the doormat. MFA ensures that even if someone steals the key (password), they still can't get in.

## What "Compliant" Looks Like

✅ **Compliant:**

- Security defaults enabled for all users, OR
- Conditional access policy requiring MFA for all admin roles
- All admin accounts successfully enrolled in MFA
- No exclusions for admin accounts (except documented break-glass accounts)
- MFA methods include phishing-resistant options (FIDO2, Windows Hello)

❌ **Non-compliant:**

- Admin accounts can sign in with password only
- MFA configured but with admin exclusions
- Legacy authentication still enabled for admin accounts
- MFA enrollment incomplete (admins haven't registered)
- Only SMS-based MFA (vulnerable to SIM swapping)

## How to Check Current Status

### Via Microsoft Entra Admin Center

1. Navigate to **Protection** → **Conditional Access** → **Policies**
2. Look for policies targeting directory roles
3. Verify the policy:
   - Targets all admin roles
   - Requires MFA
   - Has no exclusions (or only documented break-glass accounts)
   - State is **On** (not "Report-only")

### Via Microsoft Graph PowerShell

```powershell
# Connect to Microsoft Graph
Connect-MgGraph -Scopes "Policy.Read.All", "RoleManagement.Read.Directory"

# List conditional access policies targeting roles
Get-MgIdentityConditionalAccessPolicy | Where-Object {
    $_.Conditions.Users.IncludeRoles -ne $null
} | Select-Object DisplayName, State, @{
    Name = "TargetedRoles"
    Expression = { $_.Conditions.Users.IncludeRoles -join ", " }
}

# Check which admins have MFA registered
Get-MgReportAuthenticationMethodUserRegistrationDetail | Where-Object {
    $_.IsAdmin -eq $true
} | Select-Object UserPrincipalName, IsMfaRegistered, DefaultMfaMethod
```

### Via Microsoft 365 Defender

1. Go to **security.microsoft.com**
2. Navigate to **Secure Score**
3. Look for the improvement action: "Require MFA for administrative roles"
4. Check if status is "Completed"

## Implementation Steps

### Prerequisites

- Global Administrator or Security Administrator role
- Microsoft Entra ID P1 or P2 license (for Conditional Access)
- Documented break-glass account procedure

### Option A: Enable Security Defaults (Simple)

Best for smaller organizations or those without Entra ID P1/P2:

1. Sign in to **Microsoft Entra admin center**
2. Go to **Identity** → **Overview** → **Properties**
3. Select **Manage security defaults**
4. Set **Security defaults** to **Enabled**
5. Click **Save**

⚠️ **Note:** Security defaults apply MFA to all users, not just admins. This is actually a good thing for most organizations.

### Option B: Conditional Access Policy (Recommended)

For granular control and compliance reporting:

1. Go to **Protection** → **Conditional Access**
2. Click **Create new policy**
3. Configure the policy:

   **Name:** `REQUIRE: MFA for Administrators`

   **Users:**
   - Include: Select **Directory roles**
   - Select all admin roles (at minimum):
     - Global Administrator
     - Security Administrator
     - Exchange Administrator
     - SharePoint Administrator
     - User Administrator
     - Privileged Role Administrator
     - Application Administrator
     - Cloud Application Administrator
     - Conditional Access Administrator
   - Exclude: Only your documented break-glass accounts

   **Target resources:**
   - Cloud apps: **All cloud apps**

   **Grant:**
   - Select **Require multifactor authentication**

   **Session:** Leave default

4. Set **Enable policy** to **On**
5. Click **Create**

### Option C: Per-User MFA (Legacy, Not Recommended)

Only if you cannot use Conditional Access:

1. Go to **Users** → **All users**
2. Click **Per-user MFA**
3. Select admin accounts
4. Click **Enable**

⚠️ **Warning:** Per-user MFA is harder to manage and doesn't provide the same reporting and conditional controls.

## Evidence for Audit

When documenting compliance, collect:

| Evidence Type | Where to Get It | Format |
|--------------|-----------------|--------|
| Conditional Access policy screenshot | Entra admin center → CA → Policy details | PNG/PDF |
| Policy export (JSON) | CA → Policy → Export | JSON |
| Admin role membership list | Entra admin center → Roles → Export | CSV |
| MFA registration report | Authentication methods → User registration details → Export | CSV |
| Sign-in logs (filtered to admins) | Entra admin center → Sign-in logs → Filter by role | CSV |
| Secure Score status | Defender → Secure Score → Screenshot | PNG |

### Sample Audit Statement

> "All administrative accounts in Microsoft 365 are required to authenticate using multi-factor authentication, enforced via Conditional Access policy 'REQUIRE: MFA for Administrators' (Policy ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). This policy targets all directory roles with administrative privileges and has no exclusions except for two documented emergency access accounts. MFA registration is 100% complete for all 12 administrator accounts as of [date]."

## Common Questions

**Q: Do service accounts need MFA?**

A: Service accounts and application identities should NOT use interactive MFA—they can't respond to prompts. Instead, use:
- Managed identities (preferred)
- Certificate-based authentication
- Workload identity federation

Service accounts should never use password-only authentication.

**Q: What about break-glass/emergency access accounts?**

A: Break-glass accounts are an exception to MFA requirements, but must have compensating controls:
- Extremely long, complex passwords (25+ characters)
- Stored in a physical safe or secure vault
- Usage triggers immediate alerts
- Require two-person authorization to access
- Tested quarterly

Document these accounts and their controls for auditors.

**Q: Which admin roles should be covered?**

A: At minimum, cover these roles:
- Global Administrator
- Security Administrator  
- Exchange Administrator
- SharePoint Administrator
- User Administrator
- Privileged Role Administrator
- Conditional Access Administrator
- Application Administrator
- Authentication Administrator
- Billing Administrator

Best practice: Cover ALL admin roles, not just the most privileged.

**Q: Is SMS-based MFA acceptable?**

A: SMS is better than nothing but vulnerable to SIM swapping attacks. For admin accounts, require stronger methods:
- Microsoft Authenticator (push notifications)
- FIDO2 security keys
- Windows Hello for Business
- Certificate-based authentication

**Q: How do I handle contractors or vendors with admin access?**

A: External admins should:
- Use their own organization's MFA (via B2B collaboration)
- Be subject to the same Conditional Access policies
- Have time-limited access via Privileged Identity Management (PIM)
- Be reviewed quarterly

## Related Controls

- [MFA for All Users](/controls/m365-mfa-all-users) — Extend protection to everyone
- [Block Legacy Authentication](/controls/m365-block-legacy-auth) — Close the MFA bypass loophole
- [Privileged Identity Management](/controls/m365-pim) — Just-in-time admin access

## Framework Mapping

| Framework | Control ID | Control Name |
|-----------|-----------|--------------|
| ISO 27001:2022 | A.5.15 | Access control |
| ISO 27001:2022 | A.5.16 | Identity management |
| ISO 27001:2022 | A.8.2 | Privileged access rights |
| NIST 800-53 | IA-2 | Identification and Authentication |
| NIST 800-53 | IA-5 | Authenticator Management |
| CIS Controls v8 | 6.3 | Require MFA for Externally-Exposed Applications |
| CIS Controls v8 | 6.5 | Require MFA for Administrative Access |
| SOC 2 | CC6.1 | Logical and Physical Access Controls |
