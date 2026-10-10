# Outreach email templates (not published)

This folder sits outside `public/`, so Vite never copies it into `dist/` and it is
never served by the website. The postal address lives only here and in emails
actually sent to prospects.

## ai-receptionist-v1.html

Send-ready version of the HTML email shown at `/ai-receptionist/email-preview/`.
Design, video thumbnail, pricing, CTAs and branding are identical to the preview.

Filled in:
- Sender: Sando Aleksanders, trading as NONSTOP AI
- Postal address: in the footer (this file only; the public preview withholds it)
- Unsubscribe: existing Supabase endpoint
  `https://lqywsbqctoydtdqvjzzw.supabase.co/functions/v1/re-unsubscribe?t={{OPTOUT_TOKEN}}`

### Merge contract (one field, per recipient)

| Field | Source |
|---|---|
| `{{OPTOUT_TOKEN}}` | `public.re_issue_optout_token(account_id, email)`, already returned as `optout_token` by `claim_re_email()` (which also returns the full `unsubscribe_url`) |

Rules for the sender:
- Substitute `{{OPTOUT_TOKEN}}` and refuse to send if any `{{` remains in the body.
- The recipient must exist in `re_accounts` (`re_optout_tokens.account_id` is a foreign key).
- Set `List-Unsubscribe: <same URL>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`;
  the endpoint already accepts RFC 8058 one-click POSTs.
- GET on the endpoint only shows a confirm page (safe against link scanners); the
  POST runs `re_process_optout`, which suppresses the address and halts the sequence.

This email uses the Supabase `re-unsubscribe` endpoint, not the separate
`/api/unsubscribe` Netlify function.
