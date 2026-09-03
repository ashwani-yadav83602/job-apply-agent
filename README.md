# job-apply-agent

A small personal-automation agent that logs into **your own Indeed account**
(via a saved browser session — no password stored), opens a job posting,
uploads your resume, drafts an honest cover note, and fills out the
application form. By default it **stops one step before the final submit**
so you can review exactly what would be sent.

## Why it works this way

There is no official Indeed API for submitting applications on a candidate's
behalf, and platforms like Indeed/LinkedIn can flag or restrict accounts that
show bot-like application patterns. This project automates the tedious parts
(form filling, cover-note drafting) while keeping a human review checkpoint
before anything is actually sent — safer for your account, and it guarantees
you never submit an untailored or inaccurate application by mistake.

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env
cp candidate-summary.example.txt candidate-summary.txt
```

Fill in `.env`:
- `DEFAULT_RESUME_PATH` — path to your resume file (put it in `resumes/`)
- `ANTHROPIC_API_KEY` — optional; only needed if you want auto-drafted cover notes

Fill in `candidate-summary.txt` with your real, honest background — this is
the only source the cover-note drafting step is allowed to use, so it can
never invent skills you don't have.

## One-time login

```bash
npm run login
```

A browser window opens. Log in to Indeed manually, then press Enter in the
terminal. This saves your session cookies to `indeed-auth.json` (gitignored —
never commit this file; it's equivalent to being logged in as you).

## Applying to a job

```bash
npm run apply -- --url "https://www.indeed.com/viewjob?jk=XXXXXXX" \
  --title "Senior React Developer" \
  --desc "Job description text here, used to tailor the cover note"
```

This fills the form and saves a screenshot to `applications/` for you to
review. Nothing is submitted yet.

Once you've checked the screenshot, submit it for real:

```bash
npm run apply -- --url "https://www.indeed.com/viewjob?jk=XXXXXXX" --submit
```

## Notes and limitations

- **Selectors will need occasional maintenance.** Indeed changes its DOM
  periodically; `src/tools/indeed-apply.tool.ts` looks for buttons by visible
  text ("Apply now", "Continue", "Submit application") rather than brittle
  CSS classes, which is more resilient but not immune to redesigns.
- **Screening questions**: pass `answers` as a map of question-text
  substrings to your answer (see `JobApplicationAgent` options) for jobs that
  ask things like "Years of experience with React?".
- **This does not rewrite your resume file.** You already maintain multiple
  honestly-tailored resume versions by hand (frontend-focused, full-stack,
  etc.) — that's the right approach, and this tool doesn't try to replace it.
  It only drafts a short cover note, grounded in `candidate-summary.txt`.
- **Re-run `npm run login`** whenever your Indeed session expires.

## Project layout

```
src/
  types.ts                     shared types
  tools/
    tool.interface.ts          minimal tool contract
    indeed-apply.tool.ts       Playwright automation against Indeed
    resume-tailor.tool.ts      optional LLM cover-note drafting
  agent/
    job-application-agent.ts   orchestrates the two tools
  scripts/
    save-indeed-session.ts     one-time login helper
  index.ts                     CLI entry point
```
