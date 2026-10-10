# Outreach email templates (not published)

This folder sits outside `public/`, so Vite never copies it into `dist/` and it is
never served by the website. The postal address lives only here, in Supabase, and in
emails actually sent to prospects.

## ai-receptionist-v1 (Supabase template key `air_ft_v1`)

| File | Supabase column | Part |
|---|---|---|
| `ai-receptionist-v1.html` | `re_email_templates.body_html` | text/html |
| `ai-receptionist-v1.txt` | `re_email_templates.body_template` | text/plain (same words as the HTML) |

The repo files and the Supabase row must stay byte-identical (check with `md5`).

Status: **loaded, inactive, not approved** (`active=false`, `approved_by=NULL`).
Nothing can send it until both are set.

### How it is sent

`RE - Email Sender` (n8n) reads `v_re_email_candidates`. An outbox row whose
`template_variant = 'air_ft_v1'` gets `body_html` from the template and takes the
HTML branch:

1. `claim_re_email` claims the message and returns `optout_token`
   (from `re_issue_optout_token`) and `unsubscribe_url`.
2. `Build HTML Email` fills `{{OPTOUT_TOKEN}}` in both parts and refuses (recorded as
   failed, nothing sent) if the token is malformed, the re-unsubscribe link is missing
   from either part, or any `{{`/`}}` remains.
3. `Gmail API Send (HTML)` sends multipart/alternative with
   `List-Unsubscribe: <https://lqywsbqctoydtdqvjzzw.supabase.co/functions/v1/re-unsubscribe?t=TOKEN>`
   and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
4. `record_re_email_result` records the outcome (unchanged).

Plain-text rows (all Website Machine templates) still go through the original
`Gmail Send` node, unchanged.

Fail-closed gates in `v_re_email_candidates`:
- rows using an HTML template are hidden unless it is `active` and `approved_by` is set;
- rows whose text contains `{{OPTOUT_TOKEN}}` but have no live HTML template are hidden,
  so they can never reach the plain-text path.

### Before the first send

- Approve the subject line and the plain-text part, then set `active=true`, `approved_by`.
- Add an approved follow-up template `air_ft_v1_fu`. Without it, `record_re_email_result`
  schedules the default Website Machine follow-up copy 4 working days later.
- The final-email step (`email_final` is on) uses `wm_final_v1` Website Machine copy;
  decide whether AI receptionist sequences should get a final email.
- Recipients must exist in `re_accounts` (`re_optout_tokens.account_id` is a foreign key).
- Queue rows with `template_variant='air_ft_v1'`, subject and `body_text` copied from
  the template. Send the first one to an address on `re_email_test_allowlist` with
  `email_test` enabled.

This email uses the Supabase `re-unsubscribe` endpoint, not the separate
`/api/unsubscribe` Netlify function.
