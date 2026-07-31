# AGENTS.md

This file provides guidelines for AI agents and coding assistants when working with code in this repository

## Project overview

Tijaratk is a **bootstrapped, operations-first SaaS** that enables local merchants to receive **structured orders** from customers via WhatsApp links and manage those orders through a seller dashboard.

## Project structure

- `app` contains pages and specific pages components
- `(pages)` protected routes are accessible only by authenticated users
- `auth` contains authentication pages and components
- `components` contains shared components
- `styles` contains global styles
- `utilities` contains shared utility functions
- `app/actions` contains server actions
- `middlewares` contains middlewares to be stacked on top of the Next.js middleware stack
- `types` contains types and global models definitions
- `services` contains API services and utilities logic
  - `services/api` contains API services (server-only — never import one from a
  client component; add a server action instead)
  - `services/base` contains main HTTPService logic
  - `services/bff` contains BFF services (composed API services in a single service)

## Commands

- `npm run dev`: starts the development server
- `npm run build`: builds the production version
- `npm run start`: starts the production server
- `pnpm run lint`: runs eslint, `tsc --noEmit`, and the Next 16 request-API check
- `pnpm run type-check`: runs `tsc --noEmit` only
- `npx eslint path/to/file.tsx` to lint a single file instead of linting the whole project

Prettier is not installed; formatting is whatever eslint enforces.

## Key technologies

- Next.js v16
- TypeScript
- React 19
- TailwindCSS v4
- Zod
- `pnpm` for package management

## Testing

- After any changes, do not run frontend verification commands. Prompt the user to run the relevant command themselves and share the output.
- Unit tests are not allowed in the codebase. Do not write spec/unit test files.

## Command execution restrictions for AI agents

AI agents must not run verification, migration, package-manager, dependency, lint, typecheck, test, build, or dev-server commands in this repository.

Do not run commands including, but not limited to:

- `pnpm`, `npm`, `yarn`, or `bun`
- `prisma migrate`, `prisma generate`, `prisma db`, or `prisma studio`
- lint, typecheck, test, build, start, or dev commands
- any command that can create, remove, repair, or reinstall `node_modules`

When verification is needed, do not execute it. Tell the user exactly which command they should run themselves and wait for their output.

## Before any changes

- Propose a plan for the changes and get approval
- Ensure that the changes don't break existing functionality and logic
- Ensure that the changes don't introduce new bugs

## Patterns and best practices

### Building React components

- Use the same as `auth/login/components/LoginForm`
- Never use `React.FC` for functional components instead use `const MyComponent = ({ props }: MyComponentProps) => <div>...</div>` and for combined types use `type MyComponentProps = { props: string } & ComponentProps<'div'>`
- Shared components between pages should be defined in `components` directory
- Use `clsx` for combining string `classNames` with conditional ones

### Building pages

- Use server-side components for page components
- NEVER USE CLIENT SIDE PAGES AT ALL.
- Use latest practices for page architecture from Next.js v16 Example:
- Always fetch data on page level then pass it down to client components as props if needed
- Always fetch data on try-catch block and use `notFound()` if fetch fails, If error error instanceof AuthenticationError then redirect to login page

```javascript
export const metadata: Metadata = {
	title: 'NafeesWeb App',
	description: 'NafeesWeb Application',
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<GetAllInvoicesParams>;
}) {
	const queryParams = await searchParams;

	return <div>...</div>
}
```

### Styling

- Use TailwindCSS for styling
- Do not use inline styles you can use `clsx` for combining string `classNames` with conditional ones
- All dynamic classes to follow this lint rule: The class bg-[color:var(--store-surface-muted)] can be written as bg-(--store-surface-muted)

### Typing

- Wherever is possible use object defined as const instead of enums
- Use type aliases not interfaces

### State Management

- Keep state local to the component that owns it, and lift it only as far as it
  needs to go. Prefer server components and URL state over client state.
- No global state library is installed. Do not add one without discussion.
- React Context is acceptable for a genuinely cross-cutting client concern
  (`CustomerPwaEngagement`, `PushNotificationsControl` both use it); it is not a
  substitute for passing props one or two levels.

### Forms

- Use Server Actions for form submissions and Zod schema for validations along with CSRF token for security as hidden input

### Data Fetching

- Do not fetch data on client side
- Build a dedicated service as in `services/api/example.service.ts` and always use it to fetch data
- All API services should be defined in `services/api` directory
- All API services should be inherited from `services/base/HTTPService`
- `access_token` and `refresh_token` stored in Cookies can be read in server-side only
- Cookie *reads* live in `lib/server/cookies.ts` (`server-only`, not actions).
  Never expose a cookie reader as a `"use server"` action — an action is a
  callable endpoint, and returning the cookie string would hand httpOnly session
  tokens to the browser. Cookie *writes* are actions in `actions/cookie-actions.ts`.
- Only pass `authRequired: true` on service calls that genuinely need the
  session. It gates cookie access, and reading cookies opts the route out of
  static rendering and poisons the fetch cache key with per-visitor data.
- Define models for API responses
- For complex and composed queries use (BFF) the same as `services/bff/example.service.ts`
- Cache API responses on the server side for better performance

### Auth

- Credentials stored in Cookies
- Cookies available in server-side only
- Use httpOnly, secure, and sameSite flags for cookies

## Security considerations

- Never store sensitive data in client-side storage
- Store session data server-side
- Use secure session cookies with httpOnly, secure, and sameSite flags
- Validate all user inputs on both client and server side
- Sanitize file uploads and implement size/type restrictions
- Encrypt sensitive data at rest (PII, financial data, credentials)
- Use environment variables for encryption keys
- Do not expose sensitive data in error messages

## Global Guidelines

- Wherever is possible use object defined as const instead of enums Example:

```javascript
// Payment Types
export const PAYMENT_TYPES = {
  GOLD: 1,
  WAGE: 2,
  BOTH: 3,
} as const;
```

- For repeated & reusable strings store as constants Example:

```javascript
export const STORAGE_KEYS = {
  ACCESS_TOKEN: process.env.NEXT_PUBLIC_ACCESS_TOKEN || "",
  REFRESH_TOKEN: process.env.NEXT_PUBLIC_REFRESH_TOKEN || "",
  CSRF_TOKEN: process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME || "",
  SESSION: "session",
  USER_DATA: "user_data",
  THEME: "theme",
} as const;
```

- Use as const for static maps
- Check existing utilities before re-implementing
- Don’t import React just import what you need from its named exports
- Check already built components inside project before building / using external one
- The app is intended for Arabic language users
- Make sure to use context7 mcp if it’s present to get latest documentations for a new feature, page or component
- For any feature that requires using 3rd party code or building a custom one check React available ready-to-use code first. For example instead of building a custom useDebounce hook you can use `useDeferredValue` React hook.
- The dashboards (`/admin`, `/merchant`) are ERP surfaces and are `noindex`;
  do not spend effort on SEO there beyond a specific page `title`.
- The public surfaces (`/`, `/stores/*`, storefront `/[slug]`, and the marketing
  pages) ARE SEO targets: keep `createPublicMetadata`, JSON-LD, and the sitemap
  in sync when adding a public route.
- Shared types, global models (`User`, `Invoice`, `Customer`, etc…) should be defined in types die
- Use PascalCase for all React component file and component names (e.g., InvoiceForm.tsx, Sidebar.tsx).
- Prefer to read and summarize before editing.
- Never overwrite or remove large files without explicit user approval.

## Allowed Without Prompt

- read and list files
- read and list directories

## Ask Before

- package installs and dependencies updates
- git push, pull, merge
- deleting files, chmod
- running full build

**Always read & summarize before proposing a clear plan and write your plan in a markdown file and then ask before implementation / committing.**

**Write your plan in a markdown file in `.docs/plans` directory in this format `resource_name-action-description.md` and then ask before implementation / committing.**
