import Anthropic from '@anthropic-ai/sdk';
import { ITool, ToolResult } from './tool.interface.js';
import { TailoredResume } from '../types.js';

export interface ResumeTailorInput {
  readonly jobTitle: string;
  readonly jobDescription: string;
  readonly baseResumePath: string;
  /** Plain-text summary of your real, verifiable skills/experience — do not overclaim here */
  readonly candidateSummary: string;
}

/**
 * This tool does NOT rewrite your resume file. Rewriting a PDF/DOCX
 * automatically risks introducing skills or claims you didn't actually
 * make — you already maintain multiple honestly-tailored resume versions
 * by hand, which is the right instinct. What this tool DOES do is draft a
 * short, honest "cover note" / screening-question answer grounded only in
 * the candidateSummary you provide, for you to review before it's used.
 */
export class ResumeTailorTool implements ITool<ResumeTailorInput, TailoredResume> {
  public readonly id = 'resumeTailor';
  public readonly description =
    'Drafts a short cover note tailored to a job description, grounded strictly in facts you provide.';

  public async execute(input: ResumeTailorInput): Promise<ToolResult<TailoredResume>> {
    const apiKey = process.env['ANTHROPIC_API_KEY'];

    if (!apiKey) {
      // No LLM configured — pass the resume through untouched, no cover note.
      return { success: true, output: { resumePath: input.baseResumePath } };
    }

    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content:
              `Write a short (max 120 words), honest, non-generic cover note for this job application.\n\n` +
              `Job title: ${input.jobTitle}\n` +
              `Job description: ${input.jobDescription}\n\n` +
              `Candidate's real background (do not add anything beyond this):\n${input.candidateSummary}\n\n` +
              `Only mention skills/experience that appear in the candidate background above. ` +
              `Return only the note text, no preamble.`,
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      const coverNote = textBlock && 'text' in textBlock ? textBlock.text.trim() : undefined;

      return { success: true, output: { resumePath: input.baseResumePath, coverNote } };
    } catch (err) {
      // Tailoring is a nice-to-have — never block the application on it.
      return { success: true, output: { resumePath: input.baseResumePath } };
    }
  }
}
