# Herefolk

Meet here. Connect for real.

Herefolk is a mobile-first venue-based social app. Users select a venue, check in for two hours, post to its shared feed, and send connection invitations to other people there. There is no in-app chat. Accepted invitations encourage an in-person hello.

## Current status

Herefolk now has a hosted Supabase project, a deployed PostgreSQL schema with RLS, and an active Deno/Hono `api` Edge Function. The main website connects to this backend. Add `?demo=1` to the website URL to explore the fictional browser-local demo without creating an account.

Twenty-four local tests cover UI behavior, database authorization, and API contracts. API type checking and the production frontend build pass. Live checks confirm table/RPC permissions, Realtime publication, and rejection of unauthenticated API requests. Four live HTTP smoke checks also verify Auth health, anonymous feed denial, missing-session denial, and CORS. Full real-account login and two-user realtime testing remain pending normally created, email-confirmed accounts. Visual browser/device QA is also pending.

The deployed Auth Site URL and redirect are configured. Custom SMTP and confirmed test accounts remain required for external sign-up and full integration testing. See `BACKEND_SETUP.md` for email configuration. Sample venues are fictional and their addresses illustrative; GPS presence is not verified.

This project was implemented with Codex assistance. For an application, describe your actual work and the parts you can explain.

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4, Supabase Auth, PostgreSQL, Supabase Realtime, Deno, Hono. CSS illustrations keep the app fast and avoid external image dependencies.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
npm test
npm run build
```

The committed public backend configuration connects to Herefolk. Environment variables override it for your own deployment. Open `/?demo=1` for local demo mode; demo data is not shared between accounts.

## Deploy your own backend

1. Create a Supabase project in your own account.
2. Apply both SQL files in `supabase/migrations/` in filename order in the SQL Editor, or link your Supabase CLI project and run `supabase db push`. Apply migrations once against a fresh project.
3. Deploy the API with `supabase functions deploy api`. The platform checks JWTs; the handler also validates the caller with `auth.getUser`. It forwards the user token and uses the anonymous/publishable client key, never a service-role key.
4. Enable email/password authentication. Set your application URL and allowed local/deployed redirect URLs in Auth URL Configuration. Keep email confirmation enabled and confirm each test account.
5. Copy `.env.example` to `.env`, fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and restart Vite. These are public client configuration values. Never put a service-role key in a `VITE_` variable.
6. Rebuild and deploy the frontend using the new public configuration. Vite embeds these values at build time; changing runtime hosting variables alone will not configure an already-built static bundle.
7. Create two accounts and follow the manual verification steps below.

## Architecture

Browser → Supabase Auth → authenticated Deno/Hono API → PostgreSQL RPCs.

Reads and permitted profile edits/deletes use the Supabase client under RLS. PostgreSQL RPCs perform sensitive mutations in transactions. Realtime subscriptions trigger authorized refetches; they do not bypass RLS.

### Data model

- `profiles`: one per Auth user; display name and short bio.
- `venues`: seeded venue catalog.
- `check_ins`: one row per user, unique `user_id`; switching venues replaces the session.
- `posts`: belongs to author and venue; trimmed content is 1–500 characters.
- `connection_requests`: one unordered user pair, with pending/accepted/declined status. An accepted row is the connection, avoiding duplicated state in a separate connections table. Declined invitations cannot currently be resent.

### Security decisions

RLS limits feeds to the caller's active venue and invitations to their participants. Profile visibility is limited to self, shared venue, connections/invitations, and authors of accessible feed posts. Own profile updates are restricted to name and bio columns. Only the author can delete a post.

Sensitive writes are denied directly and performed through scoped RPCs. Public RPCs use security-invoker wrappers; privileged implementation functions stay in the unexposed private schema, have a pinned search path, and require `auth.uid()`. Check-in and posting lock the user's profile row. Invitations lock both profile rows in sorted order to serialize against venue changes and prevent reversed duplicate invitations. A unique pair index is a second guard. Post creation has a five-second cooldown.

Expiry is enforced against database time in authorization, so it needs no scheduled task. Expired rows may remain stored, but confer no venue permissions. Client clocks only drive UI countdowns. The database is authoritative.

### API

| Method | Path (after `/functions/v1/api`) | Behavior                                                   |
| ------ | -------------------------------- | ---------------------------------------------------------- |
| POST   | `/check-in`                      | Atomically replace session; body `venue_id`                |
| POST   | `/check-out`                     | End current session                                        |
| POST   | `/posts`                         | Validate and create post; body `venue_id`, `content`       |
| POST   | `/requests`                      | Invite a co-located member; body `receiver_id`, `venue_id` |
| POST   | `/requests/:id`                  | Recipient response; body `status`: accepted/declined       |

Reads use the Supabase REST API under RLS. Edge Function CORS accepts all origins because authorization uses explicit Bearer tokens rather than browser cookies. Tighten origins for a production deployment if appropriate.

## Verification

`npm test` runs nine API contract tests, seven React interaction tests in JSDOM, and eight database tests. API tests verify session rejection, CORS, body limits, validation, database error handling, and RPC argument mappings. The UI tests cover filtering, keyboard dialog behavior, posting/deleting/leaving, unchanged expiry on reopening, invitations, profile editing/reset, and recovery from corrupt or expired saved data. JSDOM does not validate visual layout or real browser rendering.

The database suite runs the migration in PGlite, a local PostgreSQL-compatible runtime, with simulated Supabase Auth roles. It tests unauthenticated access, venue switching, self/duplicate invitations, recipient-only acceptance, shared-venue requirements, private feeds, post limits, own-post deletion, expiration, and profile ownership. It excludes the Supabase publication statement because hosted Realtime is unavailable locally.

`npm run check:api` checks the API source with minimal Deno runtime declarations. `npm run build` checks frontend TypeScript and generates the Vite production bundle. These checks do not replace live Supabase integration or browser/device testing.

### Manual live checks still required

- Confirm signup, login, reload/session persistence, and signout for two accounts.
- Check both users into the same venue; create a post and verify the other account sees it without reloading.
- Switch one user to a different venue; confirm the old feed is inaccessible via both UI and direct API calls.
- Send/accept an invitation and verify both accounts show the connection even after leaving the venue.
- Verify expired check-ins cannot post, invite, or read a feed.
- Test 360px, 768px, and desktop layouts, keyboard navigation, loading and failure states.

## Refinement update

The app is now named Herefolk. This update improves readable typography, venue cards, mobile branding/navigation, touch targets, reduced-motion support, modal focus handling, destructive-action confirmations, persistent retryable errors, offline feedback, relative post times, and recovery from invalid or unavailable browser storage. Existing LocalLoop demo data migrates automatically to the Herefolk storage key. Opening the current venue keeps the original expiry instead of silently extending it. Live refresh responses are committed together and stale overlapping refreshes are discarded. The live feed currently fetches the newest 50 posts.

## Next month of work

Priorities: live integration and mobile QA, better request limits and abuse reporting/blocking, feed pagination beyond the newest 50 posts, verified venue management, geolocation validation with privacy review, push notifications, and operational logging. Twilio phone verification and native shells are intentionally future work.

## Engineering notes

See `TECHNICAL_NOTES.md` for a concise explanation of key tradeoffs and interview study questions.

`npm run test:live` runs read-only HTTP smoke checks against the configured backend. It does not create test users or prove authenticated realtime delivery.
