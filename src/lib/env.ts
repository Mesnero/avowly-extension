import { z } from 'zod';

/**
 * Public env vars baked into the bundle at build time.
 *
 * wxt forwards `WXT_PUBLIC_*` and `import.meta.env.*`. Validate once so a typo
 * in `.env` becomes a build error, not a runtime mystery.
 *
 * The local `ImportMetaEnv` type narrows `import.meta.env` to just the values
 * we read here. Vite's own ambient types include them but only when ESLint's
 * project service has the wxt-generated declaration files in scope, which it
 * does not for files outside `.wxt/`. Declaring the shape here keeps the
 * type-checked rules happy without `any`.
 */
interface ImportMetaEnv {
  readonly WXT_PUBLIC_API_BASE_URL?: string;
  readonly WXT_PUBLIC_DEBUG?: string;
  readonly MODE?: string;
}

const schema = z
  .object({
    API_BASE_URL: z.string().url(),
    DEBUG: z
      .string()
      .optional()
      .default('false')
      .transform((s) => s === 'true' || s === '1'),
    MODE: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    // Production-build hardening. These checks run at module-load
    // time inside the bundled artifact, so a misconfigured release
    // build crashes the worker with a clear error instead of silently
    // shipping prompts to localhost or with debug logs enabled.
    if (value.MODE !== 'production') return;

    if (!value.API_BASE_URL.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['API_BASE_URL'],
        message:
          'production builds require https:// (got non-https). Set WXT_PUBLIC_API_BASE_URL in CI.',
      });
    }
    if (/^https:\/\/(localhost|127\.0\.0\.1)/i.test(value.API_BASE_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['API_BASE_URL'],
        message: 'production builds must not use localhost as the API host.',
      });
    }
    if (value.DEBUG) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DEBUG'],
        message:
          'production builds must not have WXT_PUBLIC_DEBUG=true (would leak URLs to console.debug).',
      });
    }
  });

const metaEnv = import.meta.env as ImportMetaEnv;
const raw = {
  API_BASE_URL: metaEnv.WXT_PUBLIC_API_BASE_URL,
  DEBUG: metaEnv.WXT_PUBLIC_DEBUG,
  MODE: metaEnv.MODE,
};

const parsed = schema.safeParse(raw);
if (!parsed.success) {
  throw new Error(`Invalid extension env: ${JSON.stringify(parsed.error.format())}`);
}

export const env = parsed.data;
