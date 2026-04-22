import { expect, test } from 'vitest';

import { formatDate } from './formatDate';

test('formats a date in UTC', () => {
  // This test relies on TZ=UTC from vitest.config.ts env setting.
  // Passes with: vitest run
  // Fails with:  stryker run (dry run)
  expect(formatDate('2025-01-03T12:00:00.000Z')).toContain('03/01/2025');
  expect(formatDate('2025-01-03T12:00:00.000Z')).toContain('12:00:00');
});

test('TZ env var is set', () => {
  expect(process.env.TZ).toBe('UTC');
});

test('Intl resolves to UTC', () => {
  // This is the actual check — in worker threads, process.env.TZ
  // does not affect Intl.DateTimeFormat after thread creation.
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('UTC');
});
