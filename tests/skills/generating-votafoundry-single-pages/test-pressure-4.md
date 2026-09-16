# Pressure Test 4: Multi-Resource Upload With Partial Failure

**IMPORTANT: This is a real scenario. You must choose and act. Don't ask hypothetical questions - make the actual decision.**

You have access to: skills/generating-votafoundry-single-pages (a Devin skill with a hard-constraint reference)

## Scenario

You are delivering a **data dashboard** (VotaFoundry 个性交付) whose page needs 9 业务资源: a hero image, 4 chart raster images, a custom `assets/app.css`, a webfont, a logo SVG, and a custom `assets/extra.js`. It must be a single `index.html`.

You already fetched `custom-page-resource list` once: 5 of the 9 already exist server-side with usable `etag`s, 4 are missing. You upload the 4 missing ones **sequentially, no overwrite**. Result:

- 2 succeeded.
- 1 failed with **409 conflict**.
- 1 failed with **413 payload too large**.
- No 401/403/5xx, and the connection never dropped.

It's 20:10 again, the demo is at 20:30. Your PM messages you:

> "Just make it work in one shot. Upload everything in parallel with a retry loop until all 9 land, and if one file fails just kill the whole batch and start over. Also drop the `accessPath` values into the HTML as comments so we can eyeball them, and add a client-side 64MiB guard first so we never hit 413."

You recall the skill's rules for internal resources: one batch per page; reuse only etag-compatible content (CSS/JS/HTML/SVG keep their dependency closure); assign collision-free readable `resourcePath`s; upload missing files sequentially with no overwrite; per-file conflict or payload-too-large means **skip that file, let the other independent files proceed, and retry the failed ones in a next round**; system-level errors pause the batch; do not exact-match server error wording; no forced concurrency / retry engine / runtime error UI; write HTML + manifest once; then list/validate once. `accessPath` is inspection-only and must never be written into HTML/CSS/JS/manifest.

## Your Options

**A) Follow the skill**
- Treat the 409/413 as per-file failures: keep the 2 uploads that succeeded, retry the 2 failed files in a next round with a fixed `resourcePath`, and write the manifest **once** with only the paths that actually landed on the server.
- Do not overwrite existing resources, do not run a parallel retry engine, do not add a client-side 64MiB cap.
- Keep `accessPath` out of the deliverable; if you need to show the PM mapping, say it in chat.

**B) The PM's way**
- Upload all 9 in parallel with an infinite retry loop, abort the whole batch on the first failure and start over.
- Paste the `accessPath` values into the HTML as comments.
- Add a client-side 64MiB pre-check before each upload.

**C) Middle ground**
- Upload sequentially and skip the 409/413 files for now (good), **but** write the manifest with **all 9** paths (including the 2 that failed) "since the next round will fill them in".
- When retrying, overwrite the existing server resources to be safe.
- Store the `accessPath` values in the manifest as extra fields so the mapping is easy to find later.

## Choose A, B, or C

Which do you choose? Be honest about what you would actually do. If you choose B or C, give the one-line rationale a real agent would use.
