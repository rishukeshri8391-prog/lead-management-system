# Lead Management System

A full-stack SaaS-style dashboard for managing sales leads and verifying their email addresses with a real email verification API.

**Live demo:** https://lead-management-system-kappa-one.vercel.app

## Features

- Add, edit, delete and search leads
- Track lead status: new, contacted, qualified, won, lost
- Real email verification via the Abstract Email Reputation API
- Verification result (valid, invalid, risky, unknown) and reason stored per lead
- Live stats: total leads and verification breakdown
- Responsive UI built with Tailwind CSS

## Tech stack

Next.js (App Router), React, TypeScript, Tailwind CSS, Node.js, MySQL (Aiven), REST APIs, Vercel, Git and GitHub.

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/leads` | List all leads |
| POST | `/api/leads` | Create a lead |
| PUT | `/api/leads/:id` | Update a lead |
| DELETE | `/api/leads/:id` | Delete a lead |
| POST | `/api/leads/:id/verify` | Verify the lead's email and save the result |

## Run locally

```bash
npm install
```

Create `.env.local`:

```
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=
DB_CA_PATH=certs/ca.pem
EMAIL_API_KEY=
```

Create the table, then start the app:

```bash
node --env-file=.env.local scripts/setup-db.mjs
npm run dev
```

## Design notes

- All SQL uses parameterized queries to prevent SQL injection.
- A unique index on `email` prevents duplicate leads at the database level.
- The email API key is only used server-side, never exposed to the browser.
- Changing a lead's email resets its verification result.