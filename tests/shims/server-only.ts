// Test shim: the `server-only` package throws outside React Server Components.
// Under vitest we execute the same code in a plain Node context, so it is
// replaced by this no-op module via vitest.config.ts resolve.alias.
export {};
