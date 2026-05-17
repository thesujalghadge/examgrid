# ExamGrid

Operational CBT platform for JEE / NEET / CET institutes. It includes student CBT delivery, institute operations, Supabase-backed persistence for operational data, schedule-based access, and audit logging for pilot demos.

## Features

### Student CBT runtime

- Mock login and exam listing
- Full exam flow: instructions → declaration → CBT → submit → results
- MCQ and numerical question types with on-screen numerical keypad
- Question palette (5 states), section tabs, scientific calculator
- Wall-clock timer with refresh recovery and `localStorage` autosave
- Exam integrity: fullscreen warnings, tab/blur detection, browser back protection

### Admin module

- Mock admin authentication (`/admin/login`)
- Student, batch, schedule, and audit-log workflows
- Question bank with filters, search, and JSON import
- Create exam workflow: dynamic sections (Physics, Chemistry, Mathematics, Biology, custom)
- Publish exams to the student portal (`localStorage` catalog)
- System status page for Supabase connectivity check

### Built-in demo

- Apex JEE Academy demo data with realistic students, batches, exams, schedules, and question bank
- Admin overview includes **Reset & Seed Demo**

## Tech stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **UI:** Tailwind CSS v4, ShadCN UI
- **State:** Zustand
- **Persistence (current):** `localStorage` / `sessionStorage`
- **Backend (prepared):** Supabase client (`@supabase/supabase-js`)

## Project structure

```
src/
  app/              # Routes (student + admin)
  components/       # UI (exam CBT, admin)
  stores/           # Zustand (auth, questions, timer, session)
  repositories/     # local/Supabase repository adapters
  services/         # Import, exam builder, question bank
  lib/              # Exam catalog, scoring, Supabase client
  types/            # Shared TypeScript types
public/samples/     # Sample JSON for question import
```

## Local development

### Prerequisites

- Node.js 20+ recommended
- npm

### Install and run

```bash
npm install
cp .env.example .env.local   # optional: Supabase status page
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Area | URL |
|------|-----|
| Student login | `/login` |
| Student exams | `/exams` |
| Admin login | `/admin/login` |
| Admin overview | `/admin` |
| Audit logs | `/admin/audit-logs` |
| System status | `/admin/system/status` |

### Admin mock login

- Demo: `admin@apexjee.demo` / `admin123`

### Student mock login

- Demo: `APX-JEE-26001`

### Environment variables

Copy `.env.example` to `.env.local` (never commit `.env.local`):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `NEXT_PUBLIC_DEFAULT_INSTITUTE_ID` | Institute UUID |

Attempts remain localStorage by design for this phase.

### Deployment

See `docs/DEPLOYMENT.md`.

### Question import sample

`public/samples/question-import-sample.json` — upload via **Admin → Question Bank**.

## Repository mode

| Data | Storage |
|------|---------|
| Question bank | localStorage or Supabase |
| Published exams | localStorage or Supabase |
| Students/batches/schedules/audit | localStorage or Supabase |
| Exam attempts | `localStorage` (`examgrid:attempt:*`) |
| Admin session | `sessionStorage` |

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
npm run deploy:check # Deployment env validation
```

## License

Private — institute use. All rights reserved unless otherwise specified.
