/**
 * Security Rules Verification Suite for PawCare (Phase 0 Red Team Spec)
 * Tests the "Dirty Dozen" adversarial payloads against firestore.rules.
 * Run with Firebase Emulator Suite:
 *   firebase emulators:exec --only firestore "npx vitest run firestore.rules.test.ts"
 */
export const DIRTY_DOZEN_CASES = [
  { id: 1, name: 'Self-Admin Escalation on /users/{uid}', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Role Tampering on /users/{uid} update', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Unverified Email Write Attempt', expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Email Spoofing Admin Bypass (email_verified=false)', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Caregiver Self-Verification on create/update', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'PII Scraping on /caregivers/{otherUid} or /users list', expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'Hijacked Pet Reference in Booking Creation', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'Booking Unverified Caregiver', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'Financial Price Tampering on Booking Update', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Booking State Shortcutting (pending -> completed)', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Shadow / Ghost Field Injection (isVIP: true)', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'ID Poisoning & Forged Timestamp', expected: 'PERMISSION_DENIED' },
] as const;
