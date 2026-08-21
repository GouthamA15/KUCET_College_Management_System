# 🎨 Frontend Architecture — Next.js 16 & React 19 Engine

This document details the frontend implementation architecture of the **KUCET College Management System (CMS)**, focusing on Next.js 16 App Router structures, React 19 capabilities, Tailwind CSS 4 design systems, Optimistic UI patterns, mobile drawer navigation, and Progressive Web App (PWA) offline strategies.

---

## 📌 Related Documentation
- [Master Index](../README.md)
- [System Architecture](./system-architecture.md)
- [Backend Architecture](./backend.md)
- [Storage Architecture](./storage.md)

---

## ⚡ Next.js 16 App Router Architecture

The frontend application uses **Next.js 16** with the App Router paradigm under `src/app/`. The router enforces strict directory-based role partitioning to ensure clear separation of UI concerns.

### Portal Layout Hierarchy

```
src/app/
├── layout.js                     # Root institutional layout (Fonts, Providers, Toast)
├── page.js                       # Public landing & portal gateway page
├── admission/                    # Public student online application flow
├── staff-registration/           # Public multi-step staff onboarding wizard
├── register/staff/activate/      # Token-based staff account activation & password setup
├── developers/                   # Institutional project credits & contributor page
├── admin/                        # Super Admin Infrastructure & Governance Portal
│   ├── layout.js                 # Admin sidebar, header navigation & audit context
│   ├── dashboard/                # Central system metrics & health monitor
│   ├── infrastructure/           # Database backup controls & DR status
│   ├── manage-staff/             # Unified staff credential management
│   └── staff-requests/           # Self-registration approval pipeline
├── staff/                        # Staff & Faculty Management Portal
│   ├── layout.js                 # Staff portal layout with bottom nav & drawer
│   ├── admission/                # Verification of submitted admission drafts & requests
│   ├── faculty/                  # Faculty assignment, attendance, marks & syllabus
│   ├── hod/                      # Departmental timetable, workload & condonation
│   ├── scholarship/              # Government RTF/MTF reimbursement manager
│   └── settings/                 # Profile edit & security center
├── student/                      # Student Self-Service Portal
│   ├── layout.js                 # Student layout with bottom bar & active session pill
│   ├── page.js                   # Student home dashboard (RSC shell)
│   ├── academics/                # Marks, subjects, and attendance history
│   ├── finances/                 # Fee payments & scholarship proceedings
│   ├── timetable/                # Weekly semester timetable grid
│   └── requests/                 # Digital certificate request & ID card downloads
└── api/                          # Next.js API Route Handlers
```

### Server vs. Client Component Strategy
To optimize initial page load speeds and search indexability, KUCET CMS enforces a strict component classification:

1. **React Server Components (RSC)** (Default): Used for all page layout containers (`page.js`, `layout.js`), initial data fetching, complex security checks, and static SEO content. RSC eliminates client-side JavaScript overhead for static markup.
2. **Client Components (`'use client'`)**: Isolated to interactive UI elements such as modal drawers, dynamic search tables, GPS geolocation triggers, form submitters, and `useOptimistic` hook consumers.

---

## 🚀 React 19 Engine Capabilities

KUCET CMS leverages **React 19** primitives to deliver instant user responsiveness and eliminate UI blocking:

### Key React 19 Features Used
- **Server Actions**: Native async functions called directly from Client Form handlers, removing manual `fetch('/api/...')` boilerplate.
- **`useOptimistic`**: Renders immediate state feedback for user operations prior to network completion.
- **`useTransition`**: Keeps current screens interactive while loading sub-routes or executing heavy filtering operations in the background.
- **`useActionState`**: Manages form submit states, validation error messages, and loading spinners cleanly without custom hooks.

---

## 💅 Tailwind CSS 4 Design System

The application styling is built on **Tailwind CSS 4** using `@tailwindcss/postcss` for high performance and low bundle output size.

### Institutional Theme Palette
The design system reflects Kakatiya University's official brand aesthetics:

| Theme Token | Color Hex / Value | Usage Context |
| :--- | :--- | :--- |
| **Institutional Blue** | `#1e3a8a` (`blue-900`) | Primary headers, navigation bars, official badges |
| **Kakatiya Gold** | `#d97706` (`amber-600`) | Accents, active indicators, pending status pills |
| **Emerald Green** | `#059669` (`emerald-600`)| Approved status, successful attendance mark |
| **Rose Red** | `#e11d48` (`rose-600`) | Rejections, security warnings, detention flags |
| **Glass Background** | `rgba(255,255,255,0.8)` | Dynamic frosted glass card overlays |

---

## ⚡ Optimistic UI Updates (`useOptimistic`)

To eliminate latency on mobile networks, KUCET CMS uses React 19's `useOptimistic` hook for operations like marking attendance, approving student modification requests, or updating application statuses.

### Architectural Implementation Pattern

```javascript
'use client';

import { useOptimistic, useTransition } from 'react';
import { updateStudentStatusAction } from '@/app/actions/student';

export function StudentStatusManager({ student }) {
  const [isPending, startTransition] = useTransition();

  // 1. Declare optimistic state hook
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(
    student.status,
    (currentStatus, newStatus) => newStatus
  );

  const handleStatusChange = async (newStatus) => {
    startTransition(async () => {
      // 2. Immediately update UI state optimistically
      setOptimisticStatus(newStatus);

      // 3. Perform network call via Server Action or API
      const result = await updateStudentStatusAction(student.id, newStatus);
      if (!result.success) {
        // React automatically rolls back optimistic status on state update failure
        alert('Status update failed: ' + result.error);
      }
    });
  };

  return (
    <div className="flex items-center space-x-2">
      <span className={`badge ${optimisticStatus === 'APPROVED' ? 'bg-emerald-600' : 'bg-amber-600'}`}>
        {optimisticStatus} {isPending && '...'}
      </span>
      <button 
        disabled={isPending}
        onClick={() => handleStatusChange('APPROVED')}
        className="px-3 py-1 bg-blue-900 text-white rounded-md text-sm"
      >
        Approve Student
      </button>
    </div>
  );
}
```

---

## 📱 Universal Mobile Navigation & Drawer Architecture

Given that over 80% of student and faculty interactions occur on smartphones, KUCET CMS provides a dedicated mobile navigation layout:

```
+-------------------------------------------------------------+
| [≡] KUCET CMS             [Notification Bell]  [Profile]    |  <-- Mobile Top Header
+-------------------------------------------------------------+
|                                                             |
|                   MAIN PORTAL CONTENT                       |
|                                                             |
+-------------------------------------------------------------+
| [🏠 Home]  [📅 Attendance]  [💰 Fees]  [📄 Certificates] |  <-- Fixed Bottom Navigation Bar
+-------------------------------------------------------------+
```

### Drawer & Navigation Features
- **Dynamic Slide-Over Drawer**: Uses Tailwind CSS transforms and touch-swipe gestures to reveal role-specific navigation links without screen reloads.
- **Focus Trapping & Accessibility**: Prevents background scrolling when drawers are open (`overflow-hidden` on `body`) and handles `Escape` key close events.
- **Active Session Bar**: Persistent mobile status bar alerting students of active attendance sessions nearby.

---

## 📲 Progressive Web App (PWA) & Offline Support

KUCET CMS is built as an installable Progressive Web App meeting web PWA standards:

### 1. Web App Manifest (`public/manifest.json`)
Defines application branding, theme colors (`#1e3a8a`), offline display modes (`standalone`), and high-resolution institutional launcher icons (`192x192`, `512x512`).

### 2. Service Worker Architecture (`public/sw.js`)
- **Stale-While-Revalidate**: Serves cached UI shells instantly while fetching updated assets in the background.
- **Offline Asset Pre-caching**: Caches core CSS, JavaScript bundles, fonts, and static logos (`ku-logo.png`, `kakatiya-kala-thoranam.png`).

### 3. Offline Attendance Queuing (`src/lib/idb-attendance.js`)
When faculty or students lose connectivity inside campus areas with weak cellular coverage, attendance records are stored locally in browser **IndexedDB**. Once network connectivity is restored, the PWA background sync manager flushes queued records to `/api/staff/faculty/attendance`.

```javascript
// Example IndexedDB Offline Attendance Queueing Flow
import { openDB } from 'idb';

const DB_NAME = 'kucet_offline_store';

export async function queueOfflineAttendance(attendanceRecord) {
  const db = await openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore('attendance_queue', { keyPath: 'id', autoIncrement: true });
    },
  });
  await db.add('attendance_queue', {
    ...attendanceRecord,
    timestamp: Date.now(),
  });
  console.info('[PWA] Attendance record queued offline in IndexedDB');
}
```

---

> 💡 **Next Steps**: View API endpoint validation and server logic in [Backend Architecture](./backend.md) or explore database entity relationships in [Database Architecture](./database.md).
