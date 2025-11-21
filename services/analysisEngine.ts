import { AnalysisReport, AnalyzedIssue, ErrorSeverity, LogRule } from "../types";
import { v4 as uuidv4 } from 'uuid';

// Initial Knowledge Base (Localized & Enhanced)
export const INITIAL_RULES: LogRule[] = [
  {
    id: '1',
    name: 'Shader 编译错误',
    regex: "Shader error in '(.*?)': (.*)",
    keywords: ['Shader', 'error'],
    solution: "**检测到 Shader 错误**\n\n通常由 HLSL/CGPROGRAM 代码块中的语法错误引起。\n1. 打开日志中提到的 Shader 文件。\n2. 检查完整日志中提供的具体行号。\n3. 验证目标平台的兼容性（如 Metal vs DX11）。",
    severity: ErrorSeverity.ERROR,
    weight: 10
  },
  {
    id: '2',
    name: '脚本引用丢失 (Missing Script)',
    regex: "The referenced script on this Behaviour \\(Game Object '(.*?)'\\) is missing!",
    keywords: ['missing', 'Behaviour', 'script'],
    solution: "**脚本丢失**\n\n场景或预制体中的某个 GameObject 挂载了 'Missing Script' 组件。\n1. 根据名称定位 GameObject。\n2. 删除该丢失的组件或重新分配正确的脚本。\n3. 检查 meta 文件是否损坏。",
    severity: ErrorSeverity.WARNING,
    weight: 8
  },
  {
    id: '3',
    name: 'C# 编译失败',
    regex: "error CS\\d{4}: (.*)",
    keywords: ['error', 'CS'],
    solution: "**编译失败**\n\n修复 C# 语法错误。\n- 检查是否缺少分号。\n- 验证命名空间引用 (using)。\n- 如果刚升级了 Unity，检查 API 是否变更。",
    severity: ErrorSeverity.CRITICAL,
    weight: 100
  },
  {
    id: '4',
    name: '资源导入失败',
    regex: "Could not create asset from (.*?) file path: (.*)",
    keywords: ['Could', 'not', 'create', 'asset'],
    solution: "**资源导入错误**\n\n源文件可能已损坏，或者 meta 文件不同步。\n1. 尝试右键“Reimport”该资源。\n2. 如果问题持续，尝试删除 `Library` 文件夹重建缓存。",
    severity: ErrorSeverity.ERROR,
    weight: 5
  },
  {
    id: '5',
    name: '通用异常 (Exception)',
    regex: "(.*Exception): (.*)",
    keywords: ['Exception'],
    solution: "**检测到未处理的异常**\n\n这是一个通用的异常捕获。\n1. 查看堆栈跟踪以确定引发异常的具体代码行。\n2. 检查空引用 (NullReferenceException) 或数组越界。",
    severity: ErrorSeverity.ERROR,
    weight: 2
  },
  {
    id: '6',
    name: '构建过程失败',
    regex: "Build (failed|Failed) (.*)",
    keywords: ['Build', 'failed', 'Failed'],
    solution: "**构建失败**\n\n构建流水线报告了失败状态。请向上滚动查看具体的编译错误或资源处理错误。",
    severity: ErrorSeverity.CRITICAL,
    weight: 99
  },
  {
    id: '7',
    name: '通用失败 (Generic Failure)',
    regex: ".*(Failed|failed).*",
    keywords: ['Failed', 'failed'],
    solution: "**检测到失败操作**\n\n日志行中包含了 'Failed' 关键字，但未匹配到特定规则。请检查上下文以获取详细信息。",
    severity: ErrorSeverity.ERROR,
    weight: 1
  }
];

const STORAGE_KEY = 'unity_log_ai_rules';

// Explicitly initialize storage on load if empty
const initStorage = () => {
  try {
    // Only seed if storage is null (first run). 
    // If it is "[]" (empty array string), it means user cleared it intentionally, so we do NOT re-seed.
    if (localStorage.getItem(STORAGE_KEY) === null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_RULES));
    }
  } catch (e) {
    console.error('Failed to initialize rules storage:', e);
  }
};

// Run initialization immediately
initStorage();

export const getRules = (): LogRule[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    // Fallback only if storage is completely missing (should be covered by initStorage)
    return INITIAL_RULES;
  } catch (error) {
    console.error('Error reading rules:', error);
    return INITIAL_RULES;
  }
};

export const saveRule = (rule: LogRule): void => {
  const current = getRules();
  const index = current.findIndex(r => r.id === rule.id);
  let updated;
  if (index >= 0) {
    updated = [...current];
    updated[index] = rule;
  } else {
    updated = [...current, rule];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

export const saveRulesBulk = (rules: LogRule[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
};

export const deleteRule = (id: string): void => {
  const current = getRules();
  const updated = current.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

export const clearRules = (): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
};

export const resetRulesToDefaults = (): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_RULES));
};

/**
 * Simulates the Backend Analysis Logic
 * In a real app, this would be a Python streaming parser.
 * 
 * @param fileContent The raw log text
 * @param fileName The name of the file
 * @param customRules Optional list of rules to use. If not provided, fetches all from storage.
 */
export const analyzeLog = async (
  fileContent: string, 
  fileName: string,
  customRules?: LogRule[] 
): Promise<AnalysisReport> => {
  const startTime = performance.now();
  
  // If custom rules are provided (e.g. for testing or filtering), use them.
  // Otherwise, load from storage.
  const rules = customRules || getRules();
  
  // CRITICAL: Sort rules by weight descending.
  // This ensures that if a single line matches multiple rules,
  // the loop encounters the highest priority rule first.
  // Since the inner loop breaks on the first match, the highest weight rule "wins".
  rules.sort((a, b) => (b.weight || 0) - (a.weight || 0));

  const issues: AnalyzedIssue[] = [];
  
  const lines = fileContent.split(/\r?\n/);
  const CONTEXT_LINES = 3;

  // Simple optimization: Pre-compile regexes
  const compiledRules = rules.map(r => {
      try {
        // FIX: Sanitize Python-style named groups (?P<name>...) to standard groups (...)
        // JavaScript RegExp does not support ?P<name>, it uses ?<name> or just (...).
        // We replace (?P<name>...) with (...) to be safe and compatible.
        const safeRegex = r.regex.replace(/\(\?P<[^>]+>/g, '(');
        
        // Detect if the regex implies multiline matching (contains newline characters)
        const isMultiline = safeRegex.includes('\\n') || safeRegex.includes('\n');

        return {
            ...r,
            regExp: new RegExp(safeRegex, 'i'),
            isMultiline
        };
      } catch (e) {
        console.error(`Invalid Regex for rule ${r.name}: ${r.regex}`, e);
        return null;
      }
  }).filter(r => r !== null) as (LogRule & { regExp: RegExp, isMultiline: boolean })[];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip extremely long lines to prevent regex DoS in browser
    if (line.length > 2000) continue; 

    for (const rule of compiledRules) {
      // 1. Keyword Filter (Bloom filter simulation)
      // If the rule has keywords, at least one must be present in the CURRENT line.
      if (rule.keywords && rule.keywords.length > 0) {
          const hasKeyword = rule.keywords.some(k => line.includes(k));
          if (!hasKeyword) continue;
      }

      // 2. Regex Match
      let match: RegExpExecArray | null = null;

      if (rule.isMultiline) {
        // For multiline rules, we check a window of next 10 lines
        const contextWindow = lines.slice(i, i + 10).join('\n');
        match = rule.regExp.exec(contextWindow);
      } else {
        // Standard single-line check
        match = rule.regExp.exec(line);
      }

      if (match) {
        // 3. Extract Context
        const start = Math.max(0, i - CONTEXT_LINES);
        const end = Math.min(lines.length, i + CONTEXT_LINES + 1);
        const context = lines.slice(start, end);

        // If multiline, matchContent might be long, trim it
        const matchContent = rule.isMultiline ? match[0].split('\n')[0] + '...' : line.trim();

        issues.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          solution: rule.solution,
          matchContent: matchContent,
          lineNumber: i + 1,
          context: context
        });

        // Optimization: Break inner loop to avoid matching multiple rules on same line 
        break; 
      }
    }
  }

  const endTime = performance.now();

  return {
    fileName,
    totalLines: lines.length,
    timestamp: new Date().toISOString(),
    issues,
    durationMs: Math.round(endTime - startTime)
  };
};