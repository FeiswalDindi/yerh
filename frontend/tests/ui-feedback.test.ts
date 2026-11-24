import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ERROR_VIBRATION_PATTERN, triggerCardErrorFeedback } from '../src/shared/error-feedback.ts';

function withGlobals(
  overrides: { window?: unknown; navigator?: unknown },
  fn: () => Promise<void> | void,
) {
  const saved = {
    window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
  };
  if ('window' in overrides) {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: overrides.window,
    });
  }
  if ('navigator' in overrides) {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: overrides.navigator,
    });
  }

  return Promise.resolve(fn()).finally(() => {
    for (const key of ['window', 'navigator'] as const) {
      const descriptor = saved[key];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  });
}

test('triggerCardErrorFeedback runs horizontal shake keyframes and device haptic vibration', async () => {
  const animations: { frames: unknown; options: unknown }[] = [];
  const vibrations: unknown[] = [];

  const mockCard = {
    animate(frames: unknown, options: unknown) {
      animations.push({ frames, options });
      return { cancel() {} };
    },
  } as unknown as HTMLElement;

  await withGlobals(
    {
      window: { matchMedia: () => ({ matches: false }) },
      navigator: {
        vibrate: (pattern: unknown) => {
          vibrations.push(pattern);
          return true;
        },
      },
    },
    () => {
      const triggered = triggerCardErrorFeedback(mockCard);
      assert.equal(triggered, true);
      assert.equal(animations.length, 1);
      const frames = animations[0]!.frames as Array<{ transform: string }>;
      assert.ok(frames.length >= 4);
      assert.ok(frames.some((frame) => frame.transform.includes('translateX(-8px)')));
      assert.ok(frames.some((frame) => frame.transform.includes('translateX(8px)')));
      assert.equal(frames.at(-1)?.transform, 'translateX(0px)');
      assert.deepEqual(vibrations, [ERROR_VIBRATION_PATTERN]);
    },
  );
});

test('triggerCardErrorFeedback coalesces synchronous bursts and cancels prior animation after cooldown', async () => {
  let animateCalls = 0;
  let cancelCalls = 0;
  let vibrateCalls = 0;

  const mockCard = {
    animate() {
      animateCalls += 1;
      return {
        cancel() {
          cancelCalls += 1;
        },
      };
    },
  } as unknown as HTMLElement;

  await withGlobals(
    {
      window: { matchMedia: () => ({ matches: false }) },
      navigator: {
        vibrate: () => {
          vibrateCalls += 1;
          return true;
        },
      },
    },
    async () => {
      assert.equal(triggerCardErrorFeedback(mockCard), true);
      assert.equal(triggerCardErrorFeedback(mockCard), false);
      assert.equal(triggerCardErrorFeedback(mockCard), false);
      assert.equal(animateCalls, 1);
      assert.equal(vibrateCalls, 1);
      assert.equal(cancelCalls, 0);

      await new Promise((resolve) => setTimeout(resolve, 140));
      assert.equal(triggerCardErrorFeedback(mockCard), true);
      assert.equal(cancelCalls, 1);
      assert.equal(animateCalls, 2);
      assert.equal(vibrateCalls, 2);
    },
  );
});

test('triggerCardErrorFeedback respects reduced motion and ignores missing or throwing navigator.vibrate', async () => {
  let animateCalls = 0;
  const mockCard = {
    animate() {
      animateCalls += 1;
      return { cancel() {} };
    },
  } as unknown as HTMLElement;

  await withGlobals(
    {
      window: { matchMedia: () => ({ matches: true }) },
      navigator: {
        vibrate() {
          throw new Error('blocked');
        },
      },
    },
    () => {
      assert.equal(triggerCardErrorFeedback(mockCard), true);
      assert.equal(animateCalls, 0);
    },
  );

  await withGlobals(
    {
      window: { matchMedia: () => ({ matches: false }) },
      navigator: {},
    },
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 140));
      assert.equal(triggerCardErrorFeedback(null), true);
    },
  );
});
