# CULT Finance

Greek-language small-business finance app (React, Vite, Supabase).

## Development and checks

Use Node.js 22+ and pnpm 11. Install with `pnpm install --frozen-lockfile`.
Run `pnpm test`, `pnpm build`, and `pnpm dev`.
On restricted Windows installations, Vite accepts `--configLoader native`.

The deployed app continues to use its existing Supabase project. Optional build settings are `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Only publishable keys belong in client builds. No service-role or myDATA credentials belong here.

## Isolated UI verification

`pnpm exec vite build --config tests/vite.config.js --outDir qa-dist`

`pnpm exec vite preview --config tests/vite.config.js --outDir qa-dist --port 4175`

The explicit test config replaces the Supabase client with in-memory, synthetic data. It makes no database requests. Visiting `/?fail=1` simulates a failed income read. Normal production builds do not use the test config.

## Reliability changes

- Athens calendar dates and complete month boundaries.
- Paginated financial reads instead of silently truncated totals.
- Visible loading and error states; duplicate-click guards on writes.
- Date filters and search for income and expenses.
- Non-recoverable VAT included in expenses, zero tax settings preserved.
- Closing balance validation and preserved saved opening cash.
- Quoted UTF-8 CSV with spreadsheet formula neutralization.
- Mobile navigation selector and sign-out; static-only PWA cache fallback.

## Remaining integrations

myDATA, POS and bank sync are not implemented. The production Supabase project is different from the newer project named Cult Finance in the connected account. This update does not migrate data or alter database policies. Production authorization must still be enforced by the database's RLS policies.

## Starting over

Owners can open Settings → New start to preview all financial records for their business, download a JSON snapshot and explicitly confirm a reset. The reset deletes only the previewed IDs from income, expenses, obligations, cash closings and recurring expenses, then resets opening cash and goal amounts. Identity, business details, tax settings and categories remain. Every table is read again to detect denied deletes or new records. The client cannot provide an atomic transaction: errors list completed steps and stop further work. Existing database RLS remains authoritative.

Monthly recurring expenses and goals can be entered again through their respective pages. Run `pnpm test` for both finance and reset coverage. Production reset must be explicitly approved; adding the feature does not itself erase any data.
