# Phase C: lead classification plan (READ-ONLY analysis done; NOTHING WRITTEN)

## Measured today
- Accounts with subscriber_type NULL: 6,888 (6,777 not do-not-contact). None has ever been Companies House checked (subscriber_checked_at is NULL for all).
- With a business email: 760. Of those: 166 clean (uncontacted, not quarantined, not suppressed), 573 quarantined, 21 previously contacted.
- 815 NULL accounts were contacted by SMS (taxi/food era; 124 inbound SMS). The send-eligibility view blocks any account with prior outbound, so they cannot be emailed today.
- 6,795 have a website; ~6,017 have no email on file.
- Free tool exists: n8n credential "Companies House API" (free API, ~600 requests / 5 min).

## Rules (no automatic authorisation)
1. Match is evidence only. Classify `corporate` only if ALL: active company, type ltd/plc/llp; normalised name match >= 0.92 AND (postcode district OR registered-office town matches the Maps address); not multiple candidates.
2. No/weak match stays NULL ("unclassified"). Never inferred as sole trader, never marketed to.
3. Store CH number, score, retrieved_at in subscriber_evidence.
4. Re-run eligibility at release: DNC, suppression, opt-out token, prior contact (incl. SMS), quarantine, Hunter=valid. Classification never overrides these.
5. Free pre-send hygiene: MX/DNS check on the recipient domain (8 of the recent bounces were dead domains/addresses).

## Order of work
1. 760 with email (about 10 minutes of API time) -> expect roughly 40-60% corporate = ~300-450, of which ~70-100 from the 166 clean group.
2. 573 quarantined: review contamination cause; do not release without Hunter (paid, not approved).
3. No-email accounts: free website contact-page extraction only after the extractor contamination bug is fixed.
4. Rank by service fit: taxi/transport -> AI Receptionist; trades -> Website Machine / AI Receptionist; product brands -> Video Ads; multi-channel service firms -> Automation.

## Honest yield
Recovery gives roughly 100-450 sendable first touches, i.e. 2-9 days at 50/day. It does not reach 200/day. New lead acquisition (Apify, paid) is needed and needs approval.
