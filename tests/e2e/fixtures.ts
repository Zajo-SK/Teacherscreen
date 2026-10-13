import { test as base, expect } from '@playwright/test';

/** Test s vypnutou úvodnou prehliadkou (aby nezakrývala ovládacie prvky). Prehliadku testuje samostatne ux.spec.ts. */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => localStorage.setItem('ts.notour', '1'));
    await use(context);
  },
});
export { expect };
