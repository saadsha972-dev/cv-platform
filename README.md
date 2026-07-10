# CV Platform — Tailor & Hunt

AI-powered CV tailoring and job hunting platform.

## Quick Deploy to Vercel

1. Upload all files to GitHub
2. Go to vercel.com → Import the repo
3. Add Environment Variables (see below)
4. Click Deploy

## Environment Variables

| Name | Value |
|------|-------|
| DATABASE_URL | file:./dev.db |
| SMTP_HOST | smtp.gmail.com |
| SMTP_PORT | 465 |
| SMTP_USER | thealibhatti@gmail.com |
| SMTP_PASS | (Gmail App Password — optional) |
| EMAIL_RECIPIENT | thealibhatti@gmail.com |

## Run Locally

```bash
npm install
npm run db:push
npm run seed
npm run dev
```

Open http://localhost:3000
