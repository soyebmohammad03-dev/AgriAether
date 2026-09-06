let counter = 0;

/** A single, shared id generator so every domain module stamps ids the same way. */
export function createId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}`;
}
