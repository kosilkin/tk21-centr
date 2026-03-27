# Career Center site for GitHub Pages + Supabase

## Files
- `index.html` — public site and admin modal
- `styles.css` — styles
- `app.js` — public rendering, auth, admin CRUD, month switching
- `config.example.js` — copy to `config.js` and fill your Supabase values
- `supabase-schema.sql` — tables, policies, and seed data

## Setup
1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase-schema.sql`.
3. In Supabase Auth, create one admin user with email + password.
4. Copy `config.example.js` to `config.js` and fill:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
5. Upload all files to a public GitHub repository.
6. Enable GitHub Pages from the repository root.

## Troubleshooting
- If login still does not switch to admin view, open the status banner at the top of the page and check the exact error text.
- If you see connection errors, verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `config.js`.
- If wrong credentials are entered, the login form now shows a localized error message.

## Security note
This uses the public anon key in the browser. That is normal for Supabase frontend apps.
Never put the `service_role` key in `config.js`.
