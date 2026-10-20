# Phase A: proposed corrections (NOTHING APPLIED)

## 1. Plain-text footer (all wm_* plain-text sends, appended by the `Gmail Send` node)
Current (verified on a real sent email, 20 Oct 09:30Z):
```
--
NONSTOP AI
Don't want these emails? Unsubscribe here: <personalised re-unsubscribe URL>
Or just reply with the word UNSUBSCRIBE and we will remove you.
```
Proposed (adds controller identity, address, contact, privacy link):
```
--
Sando Aleksanders, trading as NONSTOP AI, 5 Saint Peters Road, Wisbech, Cambridgeshire, PE13 2NB, United Kingdom. Tel 07360 266496.
We contact UK businesses about our services using published business contact details. Privacy policy: https://nonstopai.netlify.app/privacy/
Unsubscribe: <personalised re-unsubscribe URL>
Or reply with the word UNSUBSCRIBE.
```
Change point: one expression in n8n `RE - Email Sender` > `Gmail Send` > message. Applies to new sends only.
Gap that remains: Gmail node cannot add a List-Unsubscribe header. Moving plain-text rows onto the existing multipart Gmail API path would fix that.

## 2. AI Receptionist follow-ups (123 pending, 22 failed)
Defect: rows with `template_variant='air_ft_v1'` carry the generic website follow-up text
("I emailed last week with an idea for your website...") under subject "Re: Never miss another business call".
The text part has no `{{OPTOUT_TOKEN}}`, so `html_render_guard` fails every one (fail-closed, nothing sent).
Proposed replacement follow-up (plain + HTML to share the v2 shell):
> Hi, I emailed last week about answering missed calls at {{BUSINESS_NAME}} with an AI receptionist. If now is not the right time, no problem. If it is useful, there is a short overview and a live demo line here: <ai-receptionist URL>. Alex, NONSTOP AI
Action: cancel the 123 pending + re-queue with the corrected copy (needs approval).

## 3. Final email `wm_final_v1` (130 pending, 104 due before noon tomorrow)
Current text includes: "someone from our team may also follow up by phone ..."
Calling is not live (call channel not enabled, NOVA PECR/TPS status unresolved), so the line promises something that is not happening.
Proposed: delete that one sentence. Everything else unchanged.
Mechanism: UPDATE on 130 pending outbox rows (body_text), backup first; also edit template body.

## 4. Negative replies not flagged do-not-contact
University Area Properties, London Electricians, Stay Dry Roofing (SW) Ltd. Pending sends: 0 for all three, so no immediate send risk.
Proposed: set do_not_contact + suppression for these three so they cannot re-enter any sequence.

## 5. Enquiry notifier independence
Notifier workflow TxI9pQKVspUWUHXP uses the SAME Gmail credential (9AbUA6zgrHMCEQa2) as outreach and mails the same inbox.
Enquiries are always kept in Netlify Forms, so nothing is lost, but a Gmail throttle/suspension would silence alerts.
Proposed (free): switch on Netlify's own form-notification email to a second address as a fallback. No workflow change.
