import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline/promises';
import { JobApplicationAgent } from '../agent/job-application-agent.js';

/**
 * Batch Job Application Script
 * Reads jobs from a CSV file and applies to each one with delays
 */

interface JobRow {
  url: string;
  title: string;
  company?: string;
  description?: string;
}

async function parseJobsCSV(filePath: string): Promise<JobRow[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one job row');
  }

  const [header, ...dataLines] = lines;
  const columns = header.split(',').map((h) => h.trim().toLowerCase());

  const urlIdx = columns.indexOf('url');
  const titleIdx = columns.indexOf('title');
  const companyIdx = columns.indexOf('company');
  const descIdx = columns.indexOf('description');

  if (urlIdx === -1 || titleIdx === -1) {
    throw new Error('CSV must have "url" and "title" columns');
  }

  return dataLines
    .filter((line) => line.trim())
    .map((line) => {
      const values = line.split(',').map((v) => v.trim());
      return {
        url: values[urlIdx],
        title: values[titleIdx],
        company: companyIdx >= 0 ? values[companyIdx] : undefined,
        description: descIdx >= 0 ? values[descIdx] : undefined,
      };
    });
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const csvFile = process.argv[2] ?? './jobs.csv';
  const autoSubmit = process.argv.includes('--submit');

  if (!fs.existsSync(csvFile)) {
    console.error(`\n✗ Job CSV file not found: ${csvFile}`);
    console.error('\nUsage: npm run batch-apply -- ./jobs.csv [--submit]');
    console.error('\nExample jobs.csv format:');
    console.log(
      'url,title,company,description\n' +
        '"https://www.indeed.com/viewjob?jk=abc123","Senior React Developer","Acme Corp","React, Node.js, 5+ years"'
    );
    process.exit(1);
  }

  console.log(`\n📋 Reading jobs from: ${csvFile}`);

  let jobs: JobRow[];
  try {
    jobs = await parseJobsCSV(csvFile);
  } catch (err) {
    console.error(`\n✗ Failed to parse CSV: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  console.log(`✓ Found ${jobs.length} jobs to apply to\n`);

  if (!autoSubmit) {
    console.log('⚠️  Applications will PAUSE before submit for your review.');
    console.log('   Add --submit flag to auto-submit all applications (faster, riskier)\n');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const confirm = await rl.question('Continue? (yes/no): ');
    rl.close();

    if (!confirm.toLowerCase().startsWith('y')) {
      console.log('\nCancelled.');
      process.exit(0);
    }
  }

  const authStatePath = process.env['INDEED_AUTH_STATE_PATH'] ?? './indeed-auth.json';
  const baseResumePath = process.env['DEFAULT_RESUME_PATH'] ?? './resumes/resume.pdf';

  const summaryPath = './candidate-summary.txt';
  const candidateSummary = fs.existsSync(summaryPath)
    ? fs.readFileSync(summaryPath, 'utf-8')
    : 'No candidate-summary.txt found';

  const agent = new JobApplicationAgent({
    authStatePath,
    baseResumePath,
    candidateSummary,
    autoSubmit,
  });

  const results: Array<{
    job: JobRow;
    status: 'success' | 'failed';
    result?: string;
    error?: string;
  }> = [];

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    console.log(`\n[${i + 1}/${jobs.length}] Applying to: ${job.title} at ${job.company ?? 'Unknown'}`);
    console.log(`   URL: ${job.url}\n`);

    try {
      const result = await agent.applyTo({
        url: job.url,
        title: job.title,
        company: job.company,
        description: job.description,
      });

      console.log(`✓ Successfully applied!`);
      console.log(`   Screenshot: ${result.screenshotPath}`);
      console.log(`   Submitted: ${result.submitted ? 'Yes' : 'No (paused for review)'}\n`);

      results.push({
        job,
        status: 'success',
        result: `Screenshot: ${result.screenshotPath}`,
      });

      // Wait 3 seconds between applications to avoid rate limiting
      if (i < jobs.length - 1) {
        console.log('⏳ Waiting 3 seconds before next application...\n');
        await delay(3000);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(`✗ Failed to apply: ${errorMsg}\n`);

      results.push({
        job,
        status: 'failed',
        error: errorMsg,
      });

      // Still wait before next attempt
      if (i < jobs.length - 1) {
        console.log('⏳ Waiting 3 seconds before next application...\n');
        await delay(3000);
      }
    }
  }

  // Summary
  const successful = results.filter((r) => r.status === 'success').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  console.log('\n═══════════════════════════════════════════');
  console.log('📊 BATCH APPLICATION SUMMARY');
  console.log('═══════════════════════════════════════════');
  console.log(`Total jobs: ${jobs.length}`);
  console.log(`✓ Successful: ${successful}`);
  console.log(`✗ Failed: ${failed}`);
  console.log('═══════════════════════════════════════════\n');

  // Save results to log
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join('applications', `batch-${timestamp}.json`);
  fs.mkdirSync('applications', { recursive: true });
  fs.writeFileSync(logFile, JSON.stringify(results, null, 2));
  console.log(`📝 Detailed results saved to: ${logFile}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n✗ Batch apply failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
