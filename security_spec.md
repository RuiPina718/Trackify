# Security Specification - Trackify

## 1. Data Invariants
- A subscription must belong to exactly one user (`userId` must match `request.auth.uid`).
- Subscriptions cannot have negative amounts.
- Billing daily must be between 1 and 31.
- `userId` and `createdAt` are immutable after creation.
- A user can only see and manage their own subscriptions and profile.
- Categories can be system-wide (no `userId`) or user-specific.

## 2. The "Dirty Dozen" Payloads (Denial Expected)
1. **Identity Spoofing**: Creating a subscription with another user's `userId`.
2. **Access Violation**: Reading a subscription document belonging to another user.
3. **Malicious Update**: Changing the `userId` of an existing subscription.
4. **Data Corruption**: Setting `amount` to a negative value.
5. **ID Poisoning**: Creating a subscription with a 2MB string as its ID.
6. **Bypassing Validation**: Creating a subscription missing the `billingCycle` field.
7. **Privilege Escalation**: Attempting to update the `createdAt` field on a subscription.
8. **Resource Exhaustion**: Setting a `name` field to a 1MB string.
9. **Orphaned Records**: Creating a subscription for a non-existent user profile (using `exists`).
10. **Shadow Field Injection**: Adding an `isAdmin: true` field to a user profile update.
11. **Terminal State Bypass**: Attempting to reactivate a subscription through a shortcut if terminal logic is applied (though here we allow active/cancelled toggle).
12. **Query Scraping**: Attempting to list all subscriptions without a `userId` filter.

## 3. Test Runner (Mock Logic)
The `firestore.rules.test.ts` (if we had a runner environment) would enforce that all the above result in `PERMISSION_DENIED`.
