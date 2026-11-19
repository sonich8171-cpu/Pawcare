# PawCare — Dehradun Pet Care Marketplace

**"Your Pet's Happiness, Our Priority."**

PawCare is a production-ready pet care marketplace built for **Dehradun, Uttarakhand, India**, connecting busy pet parents, college students, and families with administrator-verified local caregivers for pet sitting, dog walking, pet feeding, and basic daily care.

---

## Features
- **Public Marketplace**: Home, About Us (DGU Venture Quest story & non-veterinary disclaimer), Services (Pet Sitting, Dog Walking, Pet Feeding, Basic Pet Care, Temporary Pet Care), Caregiver Directory (search & filter by locality, service, availability), Contact Us, and Policies.
- **Play Zone (`/play` & `/rewards`)**: 4 free browser mini-games (*Paw Runner*, *Paw Memory Match*, *Feed the Puppy*, and *Pet Rescue Adventure*) with Firestore high scores, Paw Points, and 6 entertainment achievement badges.
- **Firebase Authentication**: Google Sign-In (`signInWithPopup` + mobile redirect fallback), Email/Password registration & login, persistent sessions, email verification gate, password reset, and strictly isolated Customer / Caregiver / Admin dashboards.
- **Customer Dashboard**: Overview, My Pets (bundled visual portraits + optional HTTPS URL — Spark ₹0 friendly), Find Caregivers, Atomic Book a Service (slot-locking preventing double bookings), My Bookings, Booking History, Play Zone & Rewards, Verified Reviews, Notifications, Profile & Emergency Contacts, and Settings.
- **Caregiver Panel**: Onboarding registration with ID verification reference, Admin Verification Gate (unapproved profiles are never publicly bookable), Accept/Reject requests, live session progression (`confirmed -> in_progress -> completed`), net payout earnings breakdown, and availability management.
- **Super Admin Console**: Role-protected overview KPIs, User suspension/reactivation, Caregiver ID verification & publishing, Booking & Dispute management, Live Customer/Caregiver Support Inbox, Immutable Admin Audit Logs, Financial Ledger, Venture Scenario Modeler, Content & Dehradun Localities management, and CSV export.
- **Floating Assistant & Live Admin Chat**: Ask PawCare AI (`POST /api/ai/assistant`, server-side Gemini) and two-way Live Support Inbox synced directly with Firestore.

---

## Technology Stack (₹0 Free-Tier Compatible)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, React Router DOM, Lucide Icons, Recharts.
- **Backend / API**: Node.js + Express (`server.ts`) & Vercel Serverless (`api/ai/assistant.ts`) + Firebase Spark Free Plan (Authentication + Cloud Firestore + Security Rules). Zero paid Firebase Storage required.
- **Source Control & Hosting**: GitHub Free + Vercel Hobby (non-commercial / academic Venture Quest demo) or compatible Node/Static host.

---

## Firebase Setup
1. Open the [Firebase Console](https://console.firebase.google.com/) and select your project (`graphical-phoenix-pxq1s`). Keep the project on the **Spark (Free)** plan.
2. Enable **Authentication**:
   - Under **Sign-in method**, enable **Google**.
   - Enable **Email/Password** to allow email registration and login alongside Google Sign-In.
   - Under **Settings → Authorized domains**, add `localhost`, your `*.vercel.app` domain, and any custom preview domains.
3. Ensure **Cloud Firestore** database `ai-studio-92294db0-8168-4098-b1ce-7401429b3ac7` is enabled and `firestore.rules` is deployed.

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
- `GEMINI_API_KEY` *(optional server-side key for `/api/ai/assistant` — never prefix with `VITE_`)*

Obtain Firebase values from **Firebase Console → Project Settings → General → Your apps → Web app**. Never place private Firebase Admin SDK or service account JSON files in the repository.

---

## Local Installation & Development Commands
```bash
npm install
npm run dev          # Starts Express + Vite dev server at http://localhost:3000
npx tsc --noEmit     # Runs TypeScript typechecking
npm run lint         # Runs ESLint + TypeScript checks
npm run build        # Builds production bundle into dist/
npm run start        # Serves production dist/ + /api/* routes via node server.ts
```

---

## Vercel Deployment (₹0 Hobby — Non-Commercial / Academic Venture Demo)
1. Go to [vercel.com](https://vercel.com) and import `sonich8171-cpu/Pawcare` (`main` branch).
2. Verify build settings:
   - **Framework Preset**: `Vite`
   - **Install Command**: `npm install`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Under **Environment Variables** (Production, Preview, Development), add the 7 `VITE_FIREBASE_*` keys and optionally `GEMINI_API_KEY` for the Ask PawCare AI endpoint.
4. Click **Deploy**. `vercel.json` routes `/api/*` to serverless functions and all SPA paths to `index.html`.
5. Copy your `https://*.vercel.app` domain and add it to **Firebase Console → Authentication → Settings → Authorized domains**.

---

## Security Notes
- Default-deny catch-all rule in `firestore.rules`; every collection requires explicit authentication, ownership, schema validation, bounded string/array lengths, and `request.time` server timestamps.
- Caregivers cannot approve themselves; regular users cannot promote themselves to `admin`.
- PII (`phone`, `address`, `idDocNumber`, `idDocUrl`) is isolated to owner/admin reads; public browsing reads `/caregiversPublic` with zero PII.
- `auditLogs` is append-only for verified administrators (`allow update, delete: if false`).
