import * as Sentry from '@sentry/nextjs';

// Guard: inert if DSN unset. No init logs, no network calls.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    // Tracing disabled — bundle size optimization.
    tracesSampleRate: 0,

    // Session replay disabled — privacy posture.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // PII collection off — privacy posture.
    sendDefaultPii: false,

    // Disable unused integrations — further bundle reduction.
    integrations: (integrations) => {
      return integrations.filter(
        (integration) =>
          !['BrowserTracing', 'Replay'].includes(integration.name)
      );
    },
  });
}
