export function coerceNullStrings<T>(value: T): T {
  if (value === null) {
    return '' as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => coerceNullStrings(item)) as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = coerceNullStrings(item);
    }
    return out as T;
  }
  return value;
}
