# Website Machine cloud batch

This public branch contains the unchanged standalone Website Machine renderer from engine commit `7c83dadfccadf13e8af7fc7322ce45f84a48f030`, the existing capacity checker and private-CRM schema definitions. The acquisition queue migration is the version already used to seed Cambridge and Peterborough. Do not reapply it to that CRM. The Sydney audit, its drafts and rendered sites, and the Cambridge prospect list remain in the original protected working context outside Git. This branch contains no campaign prospect records.

## Prepare the worker

Use Node 22+, npm, PostgreSQL client (`psql`) and Chromium with its Linux dependencies. From the repository root run `npm ci --prefix campaigns/cloud`, then `npm exec --prefix campaigns/cloud -- playwright install chromium`. Use the official Playwright dependency instructions if the cloud environment does not already provide the browser libraries.

A CRM administrator applies the cloud batch migration once after the queue migration, then provisions an existing approved or dedicated PostgreSQL login with membership in `wm_preview_worker`. Use a direct or session-mode PostgreSQL connection with TLS and a read-only synthetic batch for the first cloud test. The role is not available to public Data API users. The runner credential has access only to approved inputs for the active territory and the generation ledger according to the migration grants. Put connection settings and secrets in the cloud runner's secret configuration, using libpq's standard environment or a `PGSERVICE` backed by a protected service file. Never use the Supabase admin database login or paste a password in chat or shell arguments. An interactive Supabase app connection does not automatically provide credentials to a shell subprocess.

The CRM operator creates a UUID batch and explicitly adds one to ten approved rows to `wm_acquisition.preview_batch_input`. Each row needs the verified company number, active territory slug, approval expiry and renderer payload. The existing renderer takes `businessName`, `industry`, `location`, `verifiedInfo` and optional newline-delimited `verifiedServices`, `websiteUrl`, `verifiedPhone`, `verifiedEmail` and `socialUrl`. Use verified public business facts and business role contacts. Check eligibility, suppressions and previous outreach against existing CRM/Gmail records before authorising rows. Keep exactly one company per input row. Revoked or expired rows are excluded. The CLI does not approve new inputs or send mail.

## Exact command

From the root of a fresh checkout, with an approved CRM batch UUID in `WM_APPROVED_BATCH_ID` and the scoped libpq configuration available:

```sh
node campaigns/cloud/batch.mjs --batch "$WM_APPROVED_BATCH_ID" --dry-run
```

Dry run reads the CRM and validates generated HTML in memory. It writes no files or CRM results. Chromium checks a single heading, unique IDs, working internal anchors, isolation, checkout and no horizontal page overflow at 320, 390 and 1440 px. External network requests are blocked during validation. External assets and public URLs need an additional post-deploy check when deployment is separately authorised.

After the capacity preflight passes and write access is explicitly requested, replace `--dry-run` with `--write-results --out /absolute/path/to/new/private-directory`. Real generation requires a new directory outside Git. A unique company key claims the entire batch atomically before rendering, including across different batch UUIDs. Prior claims block generation. An interrupted write leaves a claim for operator reconciliation rather than silently retrying. Inspect any output and the ledger before releasing a claim. Publish only when stdout shows success. This runner does not publish, email, or schedule jobs. It enforces a maximum of ten for each batch, with daily pacing governed by the existing acquisition queue.

Run renderer unit tests with `npm test --prefix campaigns/cloud`. Run the isolated, synthetic CRM integration test with `bash campaigns/cloud/test-batch.sh` on a machine with a local PostgreSQL server toolchain and installed Chromium.

## Netlify authorisation for a later test

Ask the preview team owner to verify whether its plan supports an existing identity restricted to `nonstop-previews` with permission to read that project, create a draft deploy, upload static files and read the result. Netlify documents project-scoped Developer access. Check whether a narrower supported Publisher role can perform the direct CLI upload before granting it. A person’s access token inherits the identity's access. A site ID is a routing parameter, not a permission boundary.

For automated CLI publishing, use a short-lived token from that restricted identity, enter it directly into the supported cloud environment secret store as `NETLIFY_AUTH_TOKEN`, and restrict egress to required Netlify API/upload destinations where supported. Start with a read-only project lookup from the actual Work runtime. With separate approval for the first publication, use the existing preflight and draft deploy to the fixed preview project ID. If the plan cannot provide suitable permissions without a paid seat, or Work cannot inject a secret safely into the shell, stop and retain a manual publish handoff. A signed-in Work cloud browser can support interactive access where allowed, but it does not give the CLI a token. Keep production projects, billing, access policy and deployment settings outside this test.
