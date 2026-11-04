import { test as base, expect } from '@playwright/test';

export interface BrowserDiagnosticEvent {
  type: 'page-error' | 'console-error' | 'request-failed' | 'http-server-error';
  detail: string;
  url?: string;
  status?: number;
}

export interface BrowserDiagnostics {
  readonly events: BrowserDiagnosticEvent[];
}

const EVENT_LIMIT = 40;
const MAX_DETAIL = 260;

function scrub(value: string): string {
  return value
    .replace(/(Bearer\s+)\S+/gi, '$1[REDACTED]')
    .replace(/((?:token|password|secret|api[-_]?key)\s*[:=]\s*)\S+/gi, '$1[REDACTED]')
    .slice(0, MAX_DETAIL);
}
function safeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    // Drop query parameters and fragments, which commonly contain secrets.
    return `${url.origin}${url.pathname}`;
  } catch {
    return '[unavailable URL]';
  }
}

/**
 * Cross-project Playwright fixture: captures bounded, redacted diagnostics.
 * It does not automatically fail tests on console messages, because applications
 * may intentionally exercise negative requests. Assertions belong in tests.
 */
export const test = base.extend<{ browserDiagnostics: BrowserDiagnostics }>({
  browserDiagnostics: [async ({ page }, use, testInfo) => {
    const events: BrowserDiagnosticEvent[] = [];
    const record = (event: BrowserDiagnosticEvent) => {
      if (events.length < EVENT_LIMIT) events.push(event);
    };
    const onPageError = (error: Error) => record({ type: 'page-error', detail: scrub(`${error.name}: ${error.message}`) });
    const onConsole = (message: import('@playwright/test').ConsoleMessage) => {
      if (message.type() === 'error') record({ type: 'console-error', detail: scrub(message.text()) });
    };
    const onRequestFailed = (request: import('@playwright/test').Request) => record({
      type: 'request-failed', detail: scrub(request.failure()?.errorText ?? 'Request failed'), url: safeUrl(request.url()),
    });
    const onResponse = (response: import('@playwright/test').Response) => {
      if (response.status() >= 500) record({
        type: 'http-server-error', detail: `HTTP ${response.status()}`, status: response.status(), url: safeUrl(response.url()),
      });
    };
    page.on('pageerror', onPageError);
    page.on('console', onConsole);
    page.on('requestfailed', onRequestFailed);
    page.on('response', onResponse);
    try {
      await use({ events });
    } finally {
      page.off('pageerror', onPageError);
      page.off('console', onConsole);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);
      if (events.length || testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('browser-diagnostics', {
          body: Buffer.from(JSON.stringify({ events, truncated: events.length === EVENT_LIMIT }, null, 2)),
          contentType: 'application/json',
        });
      }
    }
  }, { auto: true }],
});

export { expect };
