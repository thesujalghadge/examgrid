/**
 * Virtual numerical input settings.
 * `allowPhysicalKeyboard: false` → strict CBT mode (on-screen keypad only).
 */
export const numericalInputConfig = {
  allowPhysicalKeyboard: true,
} as const;

export type NumericalInputConfig = typeof numericalInputConfig;
