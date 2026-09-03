import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium, Page } from 'playwright';
import { ITool, ToolResult } from './tool.interface.js';
import { ApplyResult } from '../types.js';

export interface IndeedApplyInput {
  readonly jobUrl: string;
  readonly resumePath: string;
  /**
   * Optional answers for screening questions Indeed sometimes asks
   * (e.g. "Years of experience with React"). Keys are matched as a
   * case-insensitive substring against the question label on the page.
   */
  readonly answers?: Record<string, string>;
  /**
   * If false (the default and strongly recommended setting), the tool fills
   * the entire application and stops one screen before the final submit,
   * saving a screenshot for you to review. If true, it clicks submit too.
   */
  readonly autoSubmit?: boolean;
  /** Path to the saved Playwright storage state from `npm run login` */
  readonly authStatePath: string;
  /** Where to save the review screenshot. Defaults to ./applications */
  readonly outputDir?: string;
}

const APPLY_BUTTON_TEXTS = ['Apply now', 'Apply on Indeed', 'Easy Apply'];
const CONTINUE_BUTTON_TEXTS = ['Continue', 'Next', 'Review your application'];
const SUBMIT_BUTTON_TEXTS = ['Submit your application', 'Submit application'];

export class IndeedApplyTool implements ITool<IndeedApplyInput, ApplyResult> {
  public readonly id = 'indeedApply';
  public readonly description =
    'Opens a job posting in a real (logged-in) browser session, uploads your resume, ' +
    'answers screening questions where possible, and either pauses for review or submits.';

  public async execute(input: IndeedApplyInput): Promise<ToolResult<ApplyResult>> {
    if (!fs.existsSync(input.authStatePath)) {
      return {
        success: false,
        error: `No saved Indeed session found at "${input.authStatePath}". Run "npm run login" first.`,
      };
    }

    if (!fs.existsSync(input.resumePath)) {
      return { success: false, error: `Resume file not found at "${input.resumePath}".` };
    }

    const outputDir = input.outputDir ?? path.join(process.cwd(), 'applications');
    fs.mkdirSync(outputDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({ storageState: input.authStatePath });
      const page = await context.newPage();

      await page.goto(input.jobUrl, { waitUntil: 'domcontentloaded' });

      const clickedApply = await this.clickFirstMatch(page, APPLY_BUTTON_TEXTS);
      if (!clickedApply) {
        return {
          success: false,
          error: 'Could not find an "Apply" button on the page. The job may require applying on the employer\'s own site.',
        };
      }

      await this.uploadResumeIfPrompted(page, input.resumePath);
      await this.answerScreeningQuestions(page, input.answers ?? {});
      await this.advanceThroughSteps(page);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = path.join(outputDir, `${timestamp}-review.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      let submitted = false;
      if (input.autoSubmit) {
        submitted = await this.clickFirstMatch(page, SUBMIT_BUTTON_TEXTS);
      }

      return {
        success: true,
        output: { jobUrl: input.jobUrl, screenshotPath, submitted, timestamp },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      await browser.close();
    }
  }

  private async clickFirstMatch(page: Page, texts: readonly string[]): Promise<boolean> {
    for (const text of texts) {
      const locator = page.getByRole('button', { name: text, exact: false }).first();
      if (await locator.isVisible().catch(() => false)) {
        await locator.click();
        await page.waitForLoadState('domcontentloaded').catch(() => undefined);
        return true;
      }
    }
    return false;
  }

  private async uploadResumeIfPrompted(page: Page, resumePath: string): Promise<void> {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count()) {
      await fileInput.setInputFiles(resumePath);
    }
  }

  private async answerScreeningQuestions(page: Page, answers: Record<string, string>): Promise<void> {
    const entries = Object.entries(answers);
    if (entries.length === 0) return;

    for (const [labelSubstring, answer] of entries) {
      // Indeed renders each screening question as a fieldset/label pair.
      // This looks for a text input near a label containing the substring.
      const label = page.locator(`text=/${escapeRegExp(labelSubstring)}/i`).first();
      if (!(await label.isVisible().catch(() => false))) continue;

      const nearbyInput = label.locator('xpath=following::input[1]').first();
      if (await nearbyInput.isVisible().catch(() => false)) {
        await nearbyInput.fill(answer);
      }
    }
  }

  /**
   * Indeed's Easy Apply flow is multi-step (contact info -> resume ->
   * questions -> review). This clicks through "Continue"/"Next" until it
   * reaches the final review screen, without ever clicking Submit.
   */
  private async advanceThroughSteps(page: Page, maxSteps = 6): Promise<void> {
    for (let i = 0; i < maxSteps; i++) {
      const advanced = await this.clickFirstMatch(page, CONTINUE_BUTTON_TEXTS);
      if (!advanced) break;
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
