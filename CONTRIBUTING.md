# Contributing to Reporium

Thank you for your interest in contributing!

## Development Setup

1. Fork and clone the repo
2. `npm install`
3. Copy `.env.example` to `.env.local` and set `GITHUB_USERNAME`
4. `npm run dev`

## Branch Flow

`dev` → PR → `staging` → PR → `main`

All work should be done on a feature branch off `dev`.

## Testing

Run all tests: `npm test`
Run unit tests only: `npm test -- --testPathPattern=tests/unit`

## Code Standards

- TypeScript strict mode
- JSDoc on all exported functions
- No secrets in committed files
- Update CHANGELOG.md for user-facing changes

## Pull Request

Use the PR template. Ensure CI passes before requesting review.
