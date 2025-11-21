export enum ErrorSeverity {
  CRITICAL = 'CRITICAL',
  ERROR = 'ERROR',
  WARNING = 'WARNING',
}

export interface LogRule {
  id: string;
  name: string;
  regex: string;
  keywords: string[];
  solution: string; // Markdown supported
  severity: ErrorSeverity;
  weight: number;
}

export interface AnalyzedIssue {
  ruleId: string;
  ruleName: string;
  severity: ErrorSeverity;
  solution: string;
  matchContent: string;
  lineNumber: number;
  context: string[]; // Lines around the error
}

export interface AnalysisReport {
  fileName: string;
  totalLines: number;
  timestamp: string;
  issues: AnalyzedIssue[];
  durationMs: number;
}

export interface AIGeneratedRule {
  regex: string;
  keywords: string[];
  explanation: string;
}