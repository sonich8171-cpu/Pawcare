# PawCare Security Specification & Red Team Audit

## 1. Core Data Invariants
1. **Strict RBAC & Zero Self-Promotion**: No user can assign themselves `role: "admin"`, set `verificationStatus: "verified"` on a caregiver profile, or mark a payment `"paid"` from the client SDK.
2. **PII Isolation**: Private contact details (`phone`, `address`, `email`, `idDocNumber`, `idDocUrl`) live in `/users/{userId}` and `/caregivers/{caregiverId}` which are readable strictly by the document owner or verified administrators (`request.auth.token.email_verified == true`). Public browsing uses `/caregiversPublic/{caregiverId}` which contains zero PII.
3. **Verified Caregiver Gate**: Bookings can only be created against a caregiver whose `/caregiversPublic/{caregiverId}` document exists with `verificationStatus == "verified"` and `accountStatus == "active"`.
4. **Atomic Anti-Double-Booking**: Creating a booking requires an atomic `/bookingLocks/{lockId}` document (`existsAfter` check) for `(caregiverId, bookingDate, timeSlot)` so concurrent requests cannot double-book a caregiver.
5. **Terminal State Locking**: Once a booking reaches `completed`, `cancelled`, or `rejected`, status transitions are locked against non-admin mutation (except customer submitting one review or opening a dispute on a completed booking).
6. **Temporal & Financial Integrity**: All `createdAt` and `updatedAt` fields must equal `request.time`. Booking financial amounts (`grossAmount`, `caregiverPayout`, `platformCommission`) are immutable after creation.

## 2. The "Dirty Dozen" Adversarial Payloads
All 12 payloads below MUST fail with `PERMISSION_DENIED`:
1. **Self-Admin Escalation**: Creating `/users/{uid}` with `role: "admin"`.
2. **Role Tampering on Update**: Updating own `/users/{uid}` with `affectedKeys` containing `role` or `accountStatus`.
3. **Unverified Email Write**: Attempting any `create`/`update` when `request.auth.token.email_verified == false`.
4. **Email Spoofing Admin Bypass**: Authenticating with admin email string where `email_verified == false` and attempting admin write on `/services/dog-walking`.
5. **Caregiver Self-Verification**: Creating `/caregivers/{uid}` with `verificationStatus: "verified"` or updating `verificationStatus` from `"pending"` to `"verified"`.
6. **PII Scraping**: Reading `/caregivers/{otherUid}` or listing `/users` as a regular customer.
7. **Orphaned / Hijacked Pet Booking**: Creating `/bookings/{id}` referencing a `petId` owned by another user.
8. **Unverified Caregiver Booking**: Creating `/bookings/{id}` targeting an unapproved caregiver.
9. **Price Tampering on Booking Update**: Caregiver or customer modifying `grossAmount`, `caregiverPayout`, or `platformCommission` during a booking status update.
10. **Booking State Shortcutting**: Caregiver jumping directly from `pending` to `completed`, or customer setting booking status to `completed`.
11. **Shadow / Ghost Field Injection**: Sending an extra unknown field (e.g., `isVIP: true` or `bypassFee: true`) on `/pets/{petId}` or `/bookings/{bookingId}`.
12. **ID Poisoning / Resource Exhaustion**: Writing a 500-char invalid `petId` (`../bad-id!`) or >1000-char string into bounded fields, or forging a past/future `createdAt` timestamp instead of `request.time`.
