export interface JobDetails {
  readonly url: string;
  readonly title?: string;
  readonly company?: string;
  readonly description?: string;
}

export interface TailoredResume {
  /** Path to the resume file to actually upload (same as base if tailoring was skipped) */
  readonly resumePath: string;
  /** Short cover-letter / "why I'm a fit" text, if the application form has such a field */
  readonly coverNote?: string;
}

export interface ApplyResult {
  readonly jobUrl: string;
  readonly screenshotPath: string;
  readonly submitted: boolean;
  readonly timestamp: string;
}
