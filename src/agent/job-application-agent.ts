import { IndeedApplyTool } from '../tools/indeed-apply.tool.js';
import { ResumeTailorTool } from '../tools/resume-tailor.tool.js';
import { ApplyResult, JobDetails } from '../types.js';

export interface JobApplicationAgentOptions {
  readonly authStatePath: string;
  readonly baseResumePath: string;
  readonly candidateSummary: string;
  readonly answers?: Record<string, string>;
  readonly autoSubmit?: boolean;
}

export class JobApplicationAgent {
  private readonly resumeTailor = new ResumeTailorTool();
  private readonly indeedApply = new IndeedApplyTool();

  constructor(private readonly options: JobApplicationAgentOptions) {}

  public async applyTo(job: JobDetails): Promise<ApplyResult> {
    const tailored = await this.resumeTailor.execute({
      jobTitle: job.title ?? 'Unknown role',
      jobDescription: job.description ?? '',
      baseResumePath: this.options.baseResumePath,
      candidateSummary: this.options.candidateSummary,
    });

    if (!tailored.success || !tailored.output) {
      throw new Error(`Resume tailoring failed: ${tailored.error ?? 'unknown error'}`);
    }

    if (tailored.output.coverNote) {
      console.log('\n--- Draft cover note (review before it is used) ---');
      console.log(tailored.output.coverNote);
      console.log('----------------------------------------------------\n');
    }

    const result = await this.indeedApply.execute({
      jobUrl: job.url,
      resumePath: tailored.output.resumePath,
      answers: this.options.answers,
      authStatePath: this.options.authStatePath,
      autoSubmit: this.options.autoSubmit ?? false,
    });

    if (!result.success || !result.output) {
      throw new Error(`Application failed: ${result.error ?? 'unknown error'}`);
    }

    return result.output;
  }
}
