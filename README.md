# ExamGrid

NTA-style computer-based test (CBT) platform for JEE / NEET / CET institutes. Phase 3 provides a stable **student CBT runtime** and a **local-first admin foundation** for question banks and exam creation. Backend migration to Supabase is prepared but not yet wired to persistence.

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
- Question bank with filters, search, and JSON import
- Create exam workflow: dynamic sections (Physics, Chemistry, Mathematics, Biology, custom)
- Publish exams to the student portal (`localStorage` catalog)
- System status page for Supabase connectivity check

### Built-in demo

- JEE Main mock exam (30 mixed MCQ + numerical questions) always available

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
  repositories/     # localStorage adapters (swappable)
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
| System status | `/admin/system/status` |

### Admin mock login

- Any email, password at least 4 characters (e.g. `admin@examgrid.local` / `admin123`)

### Student mock login

- Prefilled demo credentials on `/login`; any valid form submission works

### Environment variables

Copy `.env.example` to `.env.local` (never commit `.env.local`):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |

The CBT engine does **not** depend on Supabase yet. Missing env vars only affect the admin system status page.

### Question import sample

`public/samples/question-import-sample.json` — upload via **Admin → Question Bank**.

## Repository mode

| Data | Storage |
|------|---------|
| Question bank | `localStorage` (`examgrid:question-bank`) |
| Published exams | `localStorage` (`examgrid:exam-catalog`) |
| Exam attempts | `localStorage` (`examgrid:attempt:*`) |
| Admin session | `sessionStorage` |

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

## License

Private — institute use. All rights reserved unless otherwise specified.
