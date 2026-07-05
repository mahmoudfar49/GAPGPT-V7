/**
 * Recursively freezes an object and all nested objects.
 * Used to make configuration objects fully immutable.
 */
export function deepFreeze<T extends object>(object: T): Readonly<T> {
  Object.freeze(object);

  for (const key of Object.getOwnPropertyNames(object)) {
    const value = (object as Record<string, unknown>)[key];

    if (
      value !== null &&
      (typeof value === "object" || typeof value === "function") &&
      !Object.isFrozen(value)
    ) {
      deepFreeze(value as object);
    }
  }

  return object;
}