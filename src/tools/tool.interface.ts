export interface ToolResult<T = unknown> {
  readonly success: boolean;
  readonly output?: T;
  readonly error?: string;
}

export interface ITool<TInput, TOutput = unknown> {
  readonly id: string;
  readonly description: string;
  execute(input: TInput): Promise<ToolResult<TOutput>>;
}
