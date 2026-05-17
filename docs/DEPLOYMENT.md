# ExamGrid Deployment Checklist

## Vercel

1. Connect the GitHub repository to Vercel.
2. Set Node.js 20+.
3. Add environment variables:
   - `NEXT_PUBLIC_REPOSITORY_MODE=supabase`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_DEFAULT_INSTITUTE_ID`
4. Run migrations before demo/pilot:
   - `npm run db:bootstrap`
   - `npm run db:verify`
5. Validate deployment config:
   - `npm run deploy:check`
6. Build:
   - `npm run build`

## Demo Preparation

1. Login at `/admin/login`.
2. Open `/admin`.
3. Click **Reset & Seed Demo**.
4. Verify:
   - `/admin/students`
   - `/admin/batches`
   - `/admin/schedules`
   - `/admin/audit-logs`
5. Student demo:
   - `/login`
   - Roll `APX-JEE-26001`

## Known Pilot Limits

- Attempts remain browser localStorage.
- Admin auth is mock credential validation.
- Realtime monitoring is not enabled.
- Analytics/SGIS/AI features are intentionally out of scope.
