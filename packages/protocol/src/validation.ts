import type { SubmitCommandInput } from "./types.js";

export const DEFAULT_MAX_COMMAND_LENGTH = 1200;

export interface CommandValidationOptions {
  maxLength?: number;
}

export interface CommandValidationResult {
  accepted: boolean;
  command: string;
  warnings: string[];
  rejectedReason?: string;
}

const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/i;
const CODE_PATTERN = /```|<script\b|<\/script>/i;
const SECRET_PATTERN = /\b(?:api[_-]?key|private[_-]?key|seed phrase|mnemonic|password|bearer token)\b/i;

export function normalizeGameCommand(
  commandText: string,
  options: CommandValidationOptions = {}
): CommandValidationResult {
  const maxLength = options.maxLength ?? DEFAULT_MAX_COMMAND_LENGTH;
  const command = commandText.trim().replace(/\s+/g, " ");
  const warnings: string[] = [];

  if (!command) {
    return {
      accepted: false,
      command,
      warnings,
      rejectedReason: "Command must not be empty."
    };
  }

  if (command.length > maxLength) {
    return {
      accepted: false,
      command,
      warnings,
      rejectedReason: `Command exceeds ${maxLength} characters.`
    };
  }

  if (URL_PATTERN.test(command)) {
    warnings.push("Links are inert command text; adapters must not fetch them.");
  }
  if (CODE_PATTERN.test(command)) {
    warnings.push("Code-like text is inert command text; adapters must not execute it.");
  }
  if (SECRET_PATTERN.test(command)) {
    warnings.push("Potential secret wording detected; do not submit secrets.");
  }

  return {
    accepted: true,
    command,
    warnings
  };
}

export function assertValidGameCommand(input: SubmitCommandInput): SubmitCommandInput {
  const result = normalizeGameCommand(input.command);
  if (!result.accepted) {
    throw new Error(result.rejectedReason ?? "Invalid IOCALC game command.");
  }
  return {
    ...input,
    command: result.command
  };
}
