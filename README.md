# PawCare — Dehradun Pet Care Marketplace

**"Your Pet's Happiness, Our Priority."**

PawCare is a production-ready pet care marketplace built for **Dehradun, Uttarakhand, India**, connecting busy pet parents, college students, and families with administrator-verified local caregivers for pet sitting, dog walking, pet feeding, and basic daily care.

---

## Features
- **Public Marketplace**: Home, About Us (DGU Venture Quest story & non-veterinary disclaimer), Services (Pet Sitting, Dog Walking, Pet Feeding, Basic Pet Care, Temporary Pet Care), Caregiver Directory (search & filter by locality, service, availability), Contact Us, and Policies.
- **Firebase Authentication**: Google Sign-In (`signInWithPopup`), Email/Password registration & login, persistent sessions (`browserLocalPersistence`), email verification gate, password reset, and protected routes.
- **Customer Dashboard (10 Sections)**: Overview, My Pets (create/edit/delete with photo, feeding, health, behavioral, special care), Find Caregivers, Atomic Book a Service (slot-locking transaction preventing double bookings), My Bookings, Booking History, Verified Reviews, Notifications, Profile & Emergency Contacts, and Settings.
- **Caregiver Panel**: Onboarding registration with ID verification, Admin Verification Gate (unapproved profiles are never publicly bookable), Accept/Reject requests, live session progression (`confirmed -> in_progress -> completed`), net payout earnings breakdown, and availability management.
- **Super Admin Console**: Role-protected overview KPIs, User suspension/reactivation, Caregiver ID verification & publishing, Booking & Dispute management, Financial Ledger separating Gross Value / Commission / Caregiver Payout, Venture Scenario Modeler (Conservative / Base / Ambitious vs. Actual Live Data), 30-Day Validation Experiment tracker, Content & Dehradun Localities management, Support Tickets, and CSV report export.

---

## Technology Stack (₹0 Free-Tier Compatible)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, React Router DOM, Lucide Icons, Recharts.
- **Backend**: Firebase Spark Free Plan (Authentication, Cloud Firestore, Firebase Storage, Firestore & Storage Security Rules).
- **Source Control & Hosting**: GitHub Free + Vercel Hobby (non-commercial / academic Venture Quest demo) or **Cloudflare Pages** (₹0 commercial-friendly static SPA hosting).

---

## Firebase Setup
1. Open the [Firebase Console](https://console.firebase.google.com/) and select your project (`graphical-phoenix-pxq1s` or your own project). Keep the project on the **Spark (Free)** plan.
2. Enable **Authentication**:
   - Under **Sign-in method**, enable **Google**.
   - Enable **Email/Password** to allow email registration and login alongside Google Sign-In.
   - Under **Settings → Authorized domains**, add `localhost`, your `*.vercel.app` domain, and/or `*.pages.dev` domain.
3. Ensure **Cloud Firestore** and **Firebase Storage** are enabled.
4. Deploy security rules using Firebase CLI:
   ```bash
   firebase login
   firebase use <YOUR_FIREBASE_PROJECT_ID>
   firebase deploy --only firestore:rules,storage
   ```

---

## Environment Variables
Create a local `.env` file (never committed) or configure in your hosting dashboard using `.env.example`:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_DATABASE_ID`

Obtain these values from **Firebase Console → Project Settings → General → Your apps → Web app**. Never place private Firebase Admin SDK or service account JSON files in the repository.

---

## Local Installation & Development Commands
```bash
npm install
npm run dev          # Starts Vite dev server at http://localhost:3000
npx tsc --noEmit     # Runs TypeScript typechecking
npm run build        # Builds production bundle into dist/
```

---

## GitHub Upload (`pawcare`)
Ensure `.gitignore` excludes `node_modules/`, `dist/`, `.env*`, and any `*serviceAccount*.json` files:
```bash
git init
git add .
git commit -m "Initial PawCare production build"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/pawcare.git
git push -u origin main
```

---

## Hosting Deployment Options (₹0 Budget)

### Option A: Vercel (Free Hobby Plan — Non-Commercial / Academic Venture Demo)
> **Important License Note**: Vercel's free Hobby plan is restricted to non-commercial personal or academic projects (e.g., DGU Venture Quest demos). For commercial marketplace operations, use **Cloudflare Pages** (Option B) or upgrade to Vercel Pro.

1. Go to [vercel.com](https://vercel.com) and sign in with your **GitHub** account.
2. Click **Add New → Project** and import your `pawcare` repository.
3. Verify build settings:
   - **Framework Preset**: `Vite`
   - **Install Command**: `npm install`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add all `VITE_FIREBASE_*` keys listed above.
5. Click **Deploy**. `vercel.json` handles SPA client-side routing on page refresh.
6. Copy your `https://*.vercel.app` URL and add it to **Firebase Console → Authentication → Settings → Authorized domains**.
7. Every future push to `main` on GitHub automatically triggers a Vercel redeployment.

### Option B: Cloudflare Pages (₹0 Commercial-Eligible Free Hosting)
1. Sign in to [Cloudflare Pages](https://pages.cloudflare.com/) and connect your GitHub `pawcare` repository.
2. Set **Build command** to `npm run build` and **Build output directory** to `dist`.
3. Add all `VITE_FIREBASE_*` environment variables.
4. `public/_redirects` (`/* /index.html 200`) automatically enables SPA routing on refresh.
5. Add your `https://*.pages.dev` URL to **Firebase Console → Authentication → Settings → Authorized domains**.

---

## Security Notes
- Default-deny catch-all rule in `firestore.rules`; every collection requires explicit authentication, ownership, schema validation, bounded string/array lengths, and `request.time` server timestamps.
- Caregivers cannot approve themselves; regular users cannot promote themselves to `admin`.
- PII (`phone`, `address`, `idDocNumber`, `idDocUrl`) is isolated to owner/admin reads; public browsing reads `/caregiversPublic` with zero PII.
- Review `firestore.rules`, `storage.rules`, and `security_spec.md` before sharing broadly.
