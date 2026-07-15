# Routsify quality and automation tooling

This repository uses a free-first quality toolchain to reduce regressions and manual maintenance.

## Active after merge

- **Routsify CI**: TypeScript, platform validation, ESLint and production build on pull requests and `main`.
- **CodeQL**: JavaScript/TypeScript security scanning on pull requests, `main` and weekly.
- **Dependabot**: weekly npm minor/patch updates and GitHub Actions updates. Major npm updates stay manual.
- **Playwright Smoke**: health, login and anonymous-route protection on pull requests, `main` and daily. Authenticated core-route smoke tests activate automatically when `E2E_EMAIL` and `E2E_PASSWORD` repository secrets exist.
- **Knip**: dead-code and unused-dependency reporting on pull requests and weekly. It is advisory until the historical backlog is cleaned.
- **Next.js Bundle Analysis**: weekly/manual Turbopack bundle report uploaded as a GitHub Actions artifact.
- **Supabase Type Synchronization**: weekly/manual live-schema type generation and automatic pull request creation when `SUPABASE_ACCESS_TOKEN` is configured as a repository secret.
- **Supabase Advisors**: security and performance advisors are reviewed after schema changes and on the recurring project health check.

## Local commands

```bash
npm run typecheck
npm run lint
npm run validate:platform
npm run test:e2e
npm run quality:dead-code
npm run analyze:bundle
npm run db:types
```

## Required repository secrets for the optional authenticated automations

- `E2E_EMAIL`: dedicated non-production test user email. Do not use a personal administrator password in CI.
- `E2E_PASSWORD`: password for the dedicated test user.
- `SUPABASE_ACCESS_TOKEN`: Supabase personal access token used only by the scheduled type-generation workflow.

The workflows remain safe when these secrets are absent: public smoke tests still run, authenticated smoke tests are skipped, and type synchronization reports that it is paused.

## Security note

Never commit credentials, service-role keys, access tokens, passwords or provider secrets to the repository. Use encrypted repository or platform secrets.
