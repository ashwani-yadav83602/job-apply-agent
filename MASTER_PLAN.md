# Job Apply Agent - Master Plan

## Project Overview

**job-apply-agent** is a personal automation tool that streamlines job applications on Indeed. It automates the tedious parts (form filling, cover-note drafting, resume uploading) while maintaining a human review checkpoint before final submission to ensure account safety and application quality.

**Core Philosophy:** Automate to save time, but keep humans in control to prevent costly mistakes.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Entry Point                         │
│                         (src/index.ts)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
        ┌───────▼────────┐      ┌────────▼─────────┐
        │ JobApplication │      │ Resume Tailor    │
        │ Agent          │      │ Tool             │
        │                │      │                  │
        │ Orchestrates   │      │ - LLM-powered    │
        │ flow between   │      │   cover letter   │
        │ tools          │      │ - Grounded in    │
        └────────┬───────┘      │   candidate      │
                 │              │   summary        │
        ┌────────▼──────────┐   └────────┬─────────┘
        │ IndeedApply Tool  │            │
        │                   │            │
        │ - Browser auto    │            │
        │ - Session auth    │            │
        │ - Form filling    │            │
        │ - Screenshot save │            │
        └───────────────────┘            │
              │                          │
              ├──────────────────────────┘
              │
        ┌─────▼────────────┐
        │  Outputs         │
        │  - screenshot    │
        │  - cover note    │
        │  - result status │
        └──────────────────┘
```

---

## Core Components

### 1. **Types** (`src/types.ts`)
Shared TypeScript interfaces defining the contract between components:

- `JobDetails` - Job URL, title, company, description
- `TailoredResume` - Resume path and optional cover note
- `ApplyResult` - Final application output (screenshot, submitted status, timestamp)

### 2. **JobApplicationAgent** (`src/agent/job-application-agent.ts`)
Orchestrator that coordinates the workflow:
1. Receives job details
2. Calls `ResumeTailorTool` to generate cover note (if LLM configured)
3. Calls `IndeedApplyTool` to fill form and submit (or pause for review)
4. Returns combined result

**Options:**
- `authStatePath` - Saved browser session
- `baseResumePath` - Default resume file
- `candidateSummary` - Candidate background (for LLM grounding)
- `answers` - Screening question responses (optional)
- `autoSubmit` - Skip review and submit directly (default: false)

### 3. **ResumeTailorTool** (`src/tools/resume-tailor.tool.ts`)
Generates honest, tailored cover notes using Claude LLM:

**Design Principle:** Never modifies resume file, only drafts short cover letter.

**Process:**
1. Takes job title, description, and candidate summary
2. Calls Claude to generate cover note (max 120 words, grounded in provided facts only)
3. Returns resume path + cover note for review
4. Gracefully fails if no API key (still returns base resume)

**Safety:** Only uses facts from `candidateSummary.txt` - cannot invent claims.

### 4. **IndeedApplyTool** (`src/tools/indeed-apply.tool.ts`)
Playwright-based browser automation for Indeed applications:

**Flow:**
1. Validates auth state and resume file exist
2. Launches Chromium with saved session cookies
3. Opens job URL
4. Clicks "Apply" button
5. Uploads resume
6. Fills in screening questions (if answer map provided)
7. Either pauses for review screenshot OR submits
8. Saves screenshot to `applications/` directory

**Resilience:**
- Uses button text matching instead of CSS selectors (more resilient to DOM changes)
- Looks for: "Apply now", "Apply on Indeed", "Easy Apply"
- Continuation: "Continue", "Next", "Review your application"
- Submit: "Submit your application", "Submit application"

---

## Data Flow

### Complete Application Flow

```
npm run apply -- --url "https://indeed.com/viewjob?jk=XXX" \
                 --title "Senior React Developer" \
                 --desc "Job description..." \
                 [--submit]
                 
         ↓
    
Load Config
├─ INDEED_AUTH_STATE_PATH (from .env or default)
├─ DEFAULT_RESUME_PATH (from .env or default)
├─ candidate-summary.txt (for LLM grounding)
└─ ANTHROPIC_API_KEY (optional, for cover notes)

         ↓
    
Create JobApplicationAgent with config

         ↓
    
Call agent.applyTo(jobDetails)

         ├─ ResumeTailorTool.execute()
         │  ├─ If ANTHROPIC_API_KEY configured:
         │  │  ├─ Call Claude with job title/description
         │  │  └─ Get cover note (max 120 words)
         │  ├─ Console output: Review draft cover note
         │  └─ Return: resumePath + coverNote
         │
         ├─ IndeedApplyTool.execute()
         │  ├─ Launch Chromium with saved auth
         │  ├─ Navigate to job URL
         │  ├─ Click "Apply" button
         │  ├─ Upload resume file
         │  ├─ Fill screening questions (if answers provided)
         │  ├─ If --submit flag:
         │  │  └─ Click submit button
         │  ├─ If no --submit flag (default):
         │  │  └─ Take screenshot of review screen
         │  └─ Return: ApplyResult (path, submitted status, timestamp)
         │
         └─ Console output: Done, screenshot saved, submission status

         ↓
    
User reviews screenshot (if not auto-submitted)

         ↓
    
Re-run with --submit flag if approved
```

### Login Flow

```
npm run login

        ↓

Launch Chromium in non-headless mode

        ↓

User manually logs into Indeed

        ↓

User presses Enter in terminal

        ↓

Saves session cookies to `indeed-auth.json` (gitignored)

        ↓

Future applications use saved session (no password needed)
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- npm
- Chromium (installed by Playwright)

### Installation Steps

```bash
# 1. Clone and install
git clone <repo>
cd job-apply-agent
npm install
npx playwright install chromium

# 2. Configure environment
cp .env.example .env
cp candidate-summary.example.txt candidate-summary.txt

# 3. Edit .env
#    - Set DEFAULT_RESUME_PATH (e.g., ./resumes/resume.pdf)
#    - Optionally set ANTHROPIC_API_KEY for auto cover notes

# 4. Edit candidate-summary.txt
#    - Enter your real background, skills, experience
#    - This is the ONLY source for LLM cover-note generation

# 5. One-time login
npm run login
#    - Browser opens, log in manually
#    - Press Enter when done
#    - Saves session to indeed-auth.json

# 6. Ready to apply!
npm run apply -- --url "https://indeed.com/viewjob?jk=XXXXX" \
                 --title "Job Title" \
                 --desc "Job description"
```

---

## Features

### Current Capabilities ✅

1. **Honest Credentials**
   - Saves browser session (no passwords stored)
   - Reuses existing indeed-auth.json for future applications
   - Can re-login anytime: `npm run login`

2. **Resume Upload**
   - Supports any resume format Playwright can interact with
   - Allows multiple resume versions in `resumes/` directory
   - Can specify which resume per application via env var

3. **Form Automation**
   - Automatically fills resume upload fields
   - Answers screening questions from provided map
   - Detects and clicks buttons by visible text (resilient)

4. **Cover Letter Drafting**
   - LLM-generated (Claude) short cover notes
   - Grounded strictly in candidate summary (no fabrication)
   - Skips gracefully if no API key
   - Max 120 words, honest, tailored to job description

5. **Safety Checkpoint**
   - Default behavior: fills form and saves screenshot for review
   - User must explicitly pass `--submit` to actually send
   - Prevents accidentally submitting incomplete/incorrect applications

6. **Audit Trail**
   - Screenshots saved to `applications/` with timestamp
   - Can review what would/should have been sent
   - Metadata: job URL, submitted status, timestamp

### Future Enhancement Ideas 💡

1. **Screening Question Library**
   - Store Q&A pairs from past applications
   - Auto-match future questions to library answers
   - Reduce manual answer entry

2. **Application Tracking**
   - SQLite/JSON database of submitted applications
   - Track status: submitted → applied → rejected → offer
   - Generate dashboard of pipeline

3. **Smart Resume Selection**
   - Auto-recommend which resume version based on job keywords
   - Or auto-select from multiple resumes by role type

4. **Multi-Job Batching**
   - Accept CSV/JSON list of job URLs
   - Apply to multiple jobs in batch
   - Useful during active job search

5. **Application Customization**
   - Store job-specific cover note variations
   - Override auto-generated notes per job
   - Template system for custom notes

6. **LinkedIn Integration**
   - Extend to LinkedIn Easy Apply
   - Unified dashboard for both platforms
   - Centralized application tracking

7. **Performance Improvements**
   - Cache cover notes to avoid redundant LLM calls for similar jobs
   - Parallel application submissions (multiple browser sessions)
   - Async screenshot saving for faster feedback

8. **Accessibility Enhancements**
   - Web UI dashboard (view saved screenshots, review notes)
   - API endpoint for application submission
   - Integration with job boards' official APIs (when available)

---

## Security & Safety Considerations

### ✅ What's Safe

- **Session-based auth:** Saves browser cookies, never stores passwords
- **Honest content only:** Cover notes grounded in candidate summary
- **Account safety:** Human review checkpoint prevents bot-like patterns
- **No resume modification:** Original files untouched
- **Screening question answers:** Provided by user, never fabricated

### ⚠️ What Requires Care

1. **indeed-auth.json**
   - Equivalent to being logged in as you
   - Keep in .gitignore (never commit)
   - Protect like you'd protect your password
   - Clear if account compromised

2. **Candidate Summary**
   - Be honest - don't overclaim
   - Only include real skills/experience
   - LLM will only use facts you provide
   - Auditable for accuracy

3. **Resume Files**
   - Keep multiple honestly-tailored versions
   - Don't rely on tool to rewrite resumes
   - Maintains legal/truthfulness responsibility

4. **Application Rate**
   - Applying to 10-20 jobs/day is normal
   - Applying to 100+/day may trigger Indeed bot detection
   - Use manual review checkpoint to rate-limit submissions

---

## Maintenance Notes

### Known Limitations

1. **Selector Brittleness**
   - Indeed changes DOM periodically
   - Tool uses button text (more resilient) but not immune
   - May need to update button text lists when Indeed redesigns
   - Monitor for: "Apply now", "Continue", "Submit application" text changes

2. **Screening Questions**
   - Tool can only answer questions you provide answers for
   - No AI-powered question answering by design (safety first)
   - User provides map of question substrings → answers

3. **Resume Versioning**
   - Tool doesn't auto-switch resume versions
   - User must maintain multiple resume files and choose which to use
   - This is intentional - forces honest resume management

4. **Session Expiration**
   - Indeed sessions expire periodically (days/weeks)
   - Rerun `npm run login` when you see "not logged in" errors
   - No automatic session refresh implemented

### Maintenance Checklist

- [ ] Check Indeed DOM changes monthly (especially after major Indeed updates)
- [ ] Review and update button text lists if Indeed redesigns
- [ ] Test with sample job postings quarterly
- [ ] Monitor ANTHROPIC_API_KEY usage if using Claude
- [ ] Keep dependencies updated: `npm update`
- [ ] Re-login if Indeed session errors appear

### Troubleshooting

| Problem | Solution |
|---------|----------|
| "No saved Indeed session found" | Run `npm run login` |
| "Resume file not found" | Check DEFAULT_RESUME_PATH in .env |
| "Apply button not found" | Indeed may have redesigned; check button text in tool |
| "Cover note generation failed" | Check ANTHROPIC_API_KEY validity; tool gracefully skips |
| "Form field not filled" | May be new field type; inspect page and add handling |
| "Click X button failed" | Button text may have changed; update CONTINUE_BUTTON_TEXTS list |

---

## Development Workflow

### Build & Type Check

```bash
npm run build        # Compile TypeScript to dist/
npm run typecheck    # Check types without emitting
```

### Key Files to Modify

- **New screening questions:** Update `answers` map in CLI args
- **New form fields:** Modify `IndeedApplyTool` page interaction logic
- **Button text changes:** Update `APPLY_BUTTON_TEXTS`, `CONTINUE_BUTTON_TEXTS`, `SUBMIT_BUTTON_TEXTS`
- **Custom cover notes:** Modify `ResumeTailorTool` Claude prompt
- **Session handling:** Modify `save-indeed-session.ts` or auth state path

### Testing Approach

1. Test with a real Indeed job posting (in draft/review mode first)
2. Don't pass `--submit` until confident
3. Review screenshots before any submission
4. Start with a "safe" job to validate form handling
5. Gradually test with different job posting types

---

## Project Structure

```
job-apply-agent/
├── src/
│   ├── types.ts                    # Shared interfaces
│   ├── index.ts                    # CLI entry point
│   ├── agent/
│   │   └── job-application-agent.ts # Main orchestrator
│   ├── tools/
│   │   ├── tool.interface.ts       # Tool contract
│   │   ├── indeed-apply.tool.ts    # Browser automation
│   │   └── resume-tailor.tool.ts   # LLM cover note drafting
│   └── scripts/
│       └── save-indeed-session.ts  # One-time login helper
├── dist/                           # Compiled JavaScript (gitignored)
├── applications/                   # Screenshot output directory
├── resumes/                        # Resume files directory
├── .env                            # Environment configuration
├── .env.example                    # Example env file
├── candidate-summary.txt           # Your background for LLM
├── candidate-summary.example.txt   # Example candidate summary
├── indeed-auth.json                # Saved session (gitignored)
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript config
├── README.md                       # Quick start guide
└── MASTER_PLAN.md                  # This file
```

---

## Workflow Checklist

### Before First Use
- [ ] Install dependencies: `npm install && npx playwright install chromium`
- [ ] Copy and edit `.env` with your resume path and (optionally) API key
- [ ] Copy and edit `candidate-summary.txt` with your real background
- [ ] Run `npm run login` and authenticate with Indeed

### For Each Application
- [ ] Get job URL from Indeed
- [ ] (Optional) Copy job description text
- [ ] Run: `npm run apply -- --url "..." --title "..." --desc "..."`
- [ ] Review screenshot in `applications/` directory
- [ ] If looks good, run: `npm run apply -- --url "..." --submit`
- [ ] Done! Indeed sends your application

### Ongoing Maintenance
- [ ] Check that sessions still work (rerun login if needed)
- [ ] Update resume files with new experience
- [ ] Update `candidate-summary.txt` as skills evolve
- [ ] Monitor for Indeed DOM changes (quarterly)
- [ ] Keep npm dependencies updated

---

## Decision Log

### Why No Resume Rewriting?
- Automatically modifying PDFs risks unintended claims
- You should own the resume versions you maintain
- Honest, hand-tailored resumes are more defensible
- Tool focuses on cover letters, which are more flexible

### Why Grounding in Candidate Summary?
- Prevents LLM from fabricating skills
- Creates audit trail (what facts were provided)
- Forces user to be intentional about claims
- Makes cover letters truthful and defensible

### Why Browser Session Instead of API?
- Indeed has no official candidate application API
- Session-based auth is safer for users than password sharing
- Harder to detect as bot (real browser, real cookies)
- More resilient to platform changes than API endpoints

### Why Human Review Checkpoint?
- Prevents account flags from bot-like behavior
- Catches errors before they're sent
- Guarantees you never submit untailored applications
- Maintains user control and accountability

---

## Summary

**job-apply-agent** automates job applications while keeping you in control. It fills forms, generates honest cover letters (grounded in your real background), and saves screenshots for review. You review before submitting, ensuring account safety and application quality.

Use this as your daily driver for bulk job applications — it saves hours per week while keeping you honest.
