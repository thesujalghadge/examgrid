import type { RepositoryBundle } from "./provider";

/**
 * Validates that the provided bundle satisfies all repository contracts.
 * Throws an error in development if any repository method is missing.
 */
export function validateRepositoryContracts(bundle: RepositoryBundle): void {
  const required = [
    "questions",
    "exams",
    "students",
    "batches",
    "schedules",
    "audit",
  ] as const;

  for (const key of required) {
    if (!bundle[key]) {
      throw new Error(`Repository bundle missing required key: ${key}`);
    }
  }
}
