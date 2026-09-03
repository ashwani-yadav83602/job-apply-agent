import 'dotenv/config';
import * as fs from 'node:fs';
import { JobApplicationAgent } from './agent/job-application-agent.js';

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main(): Promise<void> {
  const url = getArg('--url');
  if (!url) {
    console.error(
      'Usage: npm run apply -- --url "<job url>" [--title "<title>"] [--desc "<job description>"] [--submit]'
    );
    process.exit(1);
  }

  const title = getArg('--title') ?? '';
  const desc = getArg('--desc') ?? '';
  const autoSubmit = hasFlag('--submit');

  const authStatePath = process.env['INDEED_AUTH_STATE_PATH'] ?? './indeed-auth.json';
  const baseResumePath = process.env['DEFAULT_RESUME_PATH'] ?? './resumes/resume.pdf';

  const summaryPath = './candidate-summary.txt';
  const candidateSummary = fs.existsSync(summaryPath)
    ? fs.readFileSync(summaryPath, 'utf-8')
    : 'No candidate-summary.txt found — cover note will be generic. Create this file with your real, honest background.';

  const agent = new JobApplicationAgent({
    authStatePath,
    baseResumePath,
    candidateSummary,
    autoSubmit,
  });

  console.log(`Applying to: ${title || url}`);
  if (!autoSubmit) {
    console.log('(--submit not passed: the agent will fill the form and stop for your review)');
  }

  try {
    const result = await agent.applyTo({ url, title, description: desc });
    console.log('\nDone.');
    console.log(`Screenshot saved to: ${result.screenshotPath}`);
    console.log(`Submitted: ${result.submitted}`);
    if (!result.submitted) {
      console.log('Review the screenshot, then rerun with --submit to actually send it.');
    }
  } catch (err) {
    console.error('Application failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
