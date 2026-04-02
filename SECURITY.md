# Security Policy — Reporium

## Responsible Disclosure

If you discover a security vulnerability, please report it privately:

1. **Do NOT open a public GitHub issue.**
2. Email **security@perditio.io** with a description of the vulnerability, steps to reproduce, and any relevant logs or screenshots.
3. You will receive an acknowledgment within 48 hours and a resolution timeline within 5 business days.

We appreciate responsible disclosure and will credit reporters (with permission) once the issue is resolved.

## Current Security Posture

- **No user authentication** — Reporium is a public, read-only repository discovery site. There are no user accounts, sessions, or privileged actions.
- **API is read-only** — The FastAPI backend (`reporium-api`) serves data from Neon PostgreSQL. There are no write endpoints exposed to the frontend.
- **AskBar SSE endpoint** — The conversational search endpoint uses an `INJECTION_RE` pattern guard to block prompt injection and malicious input before forwarding to the LLM.

## Security Checklist

### Cross-Site Scripting (XSS)
- All user-facing content is rendered through React, which escapes output by default.
- Avoid `dangerouslySetInnerHTML` unless content is sanitized.
- CSP headers should be configured in `next.config.ts` to restrict inline scripts.

### Cross-Site Request Forgery (CSRF)
- Not currently applicable (no authenticated sessions or state-changing actions).
- If auth is added in the future, implement CSRF tokens on all mutating endpoints.

### Injection Patterns
- API uses `INJECTION_RE` regex guard on the AskBar SSE endpoint to detect and reject injection attempts.
- All database queries use parameterized statements (SQLAlchemy ORM).
- No raw SQL or string interpolation in query construction.

### Content Security Policy (CSP)
- Configure CSP headers to restrict script sources, frame ancestors, and object sources.
- Disallow `unsafe-inline` and `unsafe-eval` in production where possible.

### Secrets Management
- No secrets should be committed to the repository.
- All API keys and credentials are managed via environment variables (Vercel for frontend, GCP Secret Manager for API).
- CI workflow includes a secret-pattern scan on every PR.

## Dependency Audit Schedule

- **Monthly**: Run `npm audit` and address all high/critical vulnerabilities.
- **On every PR**: CI workflow runs `npm audit --audit-level=high` (non-blocking, for visibility).
- **Quarterly**: Review and update major dependencies (Next.js, React, Tailwind).

## Reporting a Vulnerability

See the Responsible Disclosure section above. For non-security bugs, please open a GitHub issue.
