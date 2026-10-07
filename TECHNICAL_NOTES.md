# Technical notes

## Why this shape

A small, complete user journey is easier to demonstrate than a broad social network. Venue selection → two-hour check-in → feed → invitation → accepted connection exercises frontend state, SQL relationships, authorization, and server mutations.

The UI uses a calm green palette, roomy cards, short messages, and responsive navigation. Venue imagery is drawn with CSS. It is decorative; venue names, categories, and locations are also presented as text.

## Why database rules rather than only React checks

A person can call APIs without the UI. Constraints and RPC checks reject invalid operations regardless of client behavior. Transactions and row locks make the rules hold when requests overlap. RLS controls reads and the small set of allowed direct writes.

## Why explicit demo mode

A useful review should work before an external account is available. Demo mode stores fictional state in localStorage. It is deliberately labeled and must not be presented as evidence of a deployed full-stack backend.

## What to learn and demonstrate yourself

1. Explain how an access token reaches the Edge Function and how `auth.uid()` identifies the caller.
2. Show why one unique check-in per user is different from a history table.
3. Explain why expired sessions remain safe even if no cleanup job runs.
4. Explain the reverse-pair unique index and the need for recipient-only acceptance.
5. Trace a post from textarea to API to RPC to RLS-protected realtime refetch.
6. Read and run the database tests; deliberately break one policy and see the test fail.
7. Make a small change yourself, commit it, and describe how you verified it.

## Honest application wording after live verification

“I developed Herefolk with AI assistance and worked through its React interface, PostgreSQL schema, authentication, and authorization workflows. I can demonstrate the implementation, explain the main tradeoffs, and show my subsequent changes.”

Only include the components you have actually run and understood. Replace this with a precise account of your own contribution before applying.

## Refinement decisions

- Keep the hosting identity and existing URL so saved links continue to work; the visible brand and page title are Herefolk.
- Larger type and single-column phone cards improve readability without adding external fonts.
- Destructive actions require confirmation. Dialogs trap focus, close with Escape, restore previous focus, and make the background inert.
- Errors persist until dismissed or retried; an API timeout avoids indefinite loading.
- Opening an active venue does not reset its two-hour expiry.
- Demo data is validated on load, with a safe fresh state if storage is corrupt. Storage failures are visible and do not crash the app.
- A refresh generation counter prevents older overlapping responses from replacing newer account or venue data.
- UI tests use JSDOM. They validate interaction behavior, not responsive rendering. Visual/device QA and live Supabase integration remain outstanding.
