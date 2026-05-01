# bundle-analyzer/ (placeholder)

`@next/bundle-analyzer` is **not** wired into this repo as of `554873c`. Running `ANALYZE=true next build` is a no-op today.

This directory was reserved for analyzer HTML output; the audit (see `../KAN-122-perf-audit.md` §2) recommends a follow-up KAN ticket to add the devDep + `next.config.js` `ANALYZE=true` branch so future quarterly audits can drop reports here.

Today's stand-in: post-build chunk listing in §2 of the audit doc, derived from `.next/static/chunks/`.
