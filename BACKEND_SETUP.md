# Herefolk live backend

Project: Herefolk (Mumbai / ap-south-1).
Project reference: `lcrorvymyxiolyextlgn`.
API: https://lcrorvymyxiolyextlgn.supabase.co
Dashboard: https://supabase.com/dashboard/project/lcrorvymyxiolyextlgn

The database and `api` Edge Function are deployed. Browser configuration uses a public publishable key and generated database types. No service-role key is in the frontend. The main site uses the live backend; `?demo=1` opens the local interactive demo.

## One-time authentication settings

The deployed Site URL and matching allowed redirect were saved and verified in Authentication → URL Configuration on 8 October 2026:

- Site URL: `https://localloop-kartikeya.kartikeyadbuglabs.chatgpt.site`
- Add that same origin to allowed redirect URLs.
- For local development, also allow `http://localhost:5173`.

Keep email confirmation enabled. Set up a custom SMTP provider before allowing applications from people outside your Supabase team; Supabase's default email service restricts who can receive authentication emails. Until this is configured, external signup may fail even though the app and database are deployed.

## Two-account verification

Use two real accounts created through normal signup and confirm both emails. Do not share account passwords in chat.

1. Open two isolated browser sessions and sign in as different people.
2. Check both into The Reading Room.
3. Post in one session; verify it appears in the other without reloading.
4. Send a connection invitation; verify the recipient receives it and can accept. Verify the sender sees the connection.
5. Switch one account to another venue; confirm it no longer sees the old feed.
6. Reload both sessions and confirm account and check-in persistence.
7. Sign out and confirm private data is cleared.

Security advisors reported no findings after deployment. Performance warnings around repeated auth identity evaluation were fixed with a second migration. The read-only live HTTP smoke checks passed. No temporary administrative QA endpoint was deployed. Full authenticated integration tests remain pending normal confirmed test accounts.

## GitHub handoff

The repository includes `.github/workflows/checks.yml` to run API type checking, all local tests, and the frontend build on push and pull requests. Source repository: https://github.com/kartikeya-cloud/herefolk. Existing unrelated repositories have not been modified.
