/** Tactile double-pulse vibration pattern (in ms) for form errors on supported devices. */
export const ERROR_VIBRATION_PATTERN = [35, 30, 45];

const COOLDOWN_MS = 120;
const SHAKE_OFFSETS = [0, -8, 8, -6, 6, -3, 3, 0];

const activeAnimations = new WeakMap<HTMLElement, Animation>();
const lastTriggeredAt = new WeakMap<HTMLElement, number>();
let lastGlobalTriggeredAt = 0;

/** Triggers device haptic feedback using the Vibration API when available. */
export function triggerDeviceErrorVibration(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  try {
    return Boolean(navigator.vibrate(ERROR_VIBRATION_PATTERN));
  } catch {
    return false;
  }
}

/**
 * Plays a smooth horizontal shake animation on a form card and triggers device vibration.
 * Coalesces synchronous bursts (such as multiple invalid inputs on one submit) into one pulse.
 */
export function triggerCardErrorFeedback(element: HTMLElement | null): boolean {
  const now = Date.now();
  if (element) {
    const previous = lastTriggeredAt.get(element) ?? 0;
    if (now - previous < COOLDOWN_MS) return false;
    lastTriggeredAt.set(element, now);

    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reducedMotion && typeof element.animate === 'function') {
      activeAnimations.get(element)?.cancel?.();
      const animation = element.animate(
        SHAKE_OFFSETS.map((offset) => ({ transform: `translateX(${offset}px)` })),
        {
          duration: 380,
          easing: 'cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        },
      );
      if (animation) activeAnimations.set(element, animation);
    }
  } else {
    if (now - lastGlobalTriggeredAt < COOLDOWN_MS) return false;
    lastGlobalTriggeredAt = now;
  }

  triggerDeviceErrorVibration();
  return true;
}
