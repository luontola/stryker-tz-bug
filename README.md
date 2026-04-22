# Bug report: Vitest runner ignores `env.TZ` config because it forces `pool: 'threads'`

## Summary

The Stryker vitest runner hardcodes `pool: 'threads'` ([vitest-test-runner.ts L103](https://github.com/stryker-mutator/stryker-js/blob/master/packages/vitest-runner/src/vitest-test-runner.ts#L103)), overriding the project's configured pool. This causes vitest's `env: { TZ: '...' }` setting to have no effect, because in Node.js worker threads the `Intl.DateTimeFormat` timezone is locked at thread creation and cannot be changed by setting `process.env.TZ` afterwards.

Any test that relies on `env.TZ` to get a deterministic timezone will pass with `vitest run` but fail in Stryker's dry run.

## Environment

- @stryker-mutator/core: 9.6.0
- @stryker-mutator/vitest-runner: 9.6.0
- vitest: 4.1.x
- Node.js: 23.10.0 / 24.14.1
- OS: macOS (Europe/Helsinki system timezone)

## Steps to reproduce

Minimal repro: files in this directory, or inline below.

```bash
npm install
npx vitest run       # passes
npx stryker run      # fails: "There were failed tests in the initial test run"
```

### `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      TZ: 'UTC',
    },
  },
});
```

### `src/formatDate.ts`

```ts
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString('en-GB', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}
```

### `src/formatDate.test.ts`

```ts
import { expect, test } from 'vitest';
import { formatDate } from './formatDate';

test('formats a date in UTC', () => {
  expect(formatDate('2025-01-03T12:00:00.000Z')).toContain('12:00:00');
});
```

### `stryker.config.mjs`

```js
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  mutate: ['src/**/*.ts', '!src/**/*.test.ts'],
  reporters: ['clear-text'],
  coverageAnalysis: 'perTest',
  plugins: ['@stryker-mutator/vitest-runner'],
};

export default config;
```

## Expected behavior

The test passes in Stryker's dry run, same as with `vitest run`. The `env.TZ` setting from the vitest config should be respected.

## Actual behavior

```
ERROR DryRunExecutor One or more tests failed in the initial test run:
    formats a date in UTC
        expected '03/01/2025, 14:00:00' to contain '12:00:00'
```

The time `14:00:00` is Europe/Helsinki (UTC+2) instead of the expected `12:00:00` (UTC).

## Root cause

The vitest runner hardcodes `pool: 'threads'`:

```ts
// vitest-test-runner.ts
this.ctx = await vitestWrapper.createVitest('test', {
  // ...
  pool: 'threads',
  poolOptions: {
    threads: {
      maxThreads: 1,
      minThreads: 1,
    },
  },
  // ...
});
```

This overrides whatever pool the project configures (e.g. `vmForks`, `forks`).

With `pool: 'threads'`, vitest runs tests inside Node.js worker threads. In worker threads, the ICU timezone is determined at thread creation time. Setting `process.env.TZ` inside the thread (which is what vitest's `env` config does) has no effect on `Intl.DateTimeFormat`:

```js
// Demonstration in plain Node.js:
const { Worker, isMainThread, parentPort } = require('worker_threads');
if (isMainThread) {
  new Worker(__filename).on('message', msg => console.log(msg));
} else {
  process.env.TZ = 'UTC';
  parentPort.postMessage({
    envTZ: process.env.TZ,                                    // 'UTC'
    intlTZ: Intl.DateTimeFormat().resolvedOptions().timeZone,  // 'Europe/Helsinki' (unchanged!)
  });
}
```

This is a Node.js limitation, not a Stryker bug per se, but the forced `pool: 'threads'` override makes it impossible to work around.

## Possible fixes

1. **Respect the project's configured pool** instead of hardcoding `pool: 'threads'`.
2. **Set `TZ` in the environment before spawning worker threads**, e.g. by reading the vitest config's `env.TZ` and applying it to `process.env.TZ` in the parent process before creating workers.
3. **Allow users to override the pool** in Stryker's vitest runner config.
