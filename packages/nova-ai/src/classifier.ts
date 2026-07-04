// ─── Task Classifier ───
// Lightweight task classification for AI routing

import type { TaskClassification, TaskType, Message } from "./index.js";

// Keyword-based classification with confidence scoring
const TASK_KEYWORDS: Record<TaskType, string[]> = {
  "complex-code": [
    "implement", "architecture", "design pattern", "algorithm",
    "optimize", "performance", "concurrent", "async", "distributed",
    "实现", "架构", "算法", "优化", "并发",
  ],
  "code": [
    "write", "create", "build", "code", "function", "class",
    "module", "component", "写代码", "创建", "编写", "函数",
  ],
  "debug": [
    "bug", "error", "fix", "crash", "broken", "not working",
    "issue", "problem", "why doesn", "debug", "traceback",
    "报错", "错误", "修复", "不工作", "崩溃", "问题",
  ],
  "review": [
    "review", "check", "audit", "quality", "best practice",
    "improve", "refactor suggestion", "code review",
    "审查", "检查", "质量", "最佳实践",
  ],
  "test": [
    "test", "unit test", "integration test", "coverage",
    "mock", "assert", "spec", "jest", "vitest",
    "测试", "单元测试", "覆盖率",
  ],
  "doc": [
    "document", "readme", "comment", "explain", "describe",
    "jsdoc", "tsdoc", "api doc", "documentation",
    "文档", "说明", "注释", "解释",
  ],
  "refactor": [
    "refactor", "restructure", "clean up", "rename", "extract",
    "move", "reorganize", "simplify", "deduplicate",
    "重构", "重组", "清理", "简化",
  ],
  "translate": [
    "translate", "convert", "migration", "port to",
    "翻译", "转换", "迁移",
  ],
  "simple": [
    "what is", "how to", "explain", "difference between",
    "simple", "quick", "basic",
    "什么是", "怎么", "区别", "简单",
  ],
  "autocomplete": [
    "complete", "finish", "suggest", "fill in",
    "补全", "完成", "建议",
  ],
  "arch": [
    "architecture", "system design", "high level", "infrastructure",
    "scalability", "microservice", "monolith", "trade-off",
    "系统设计", "基础设施", "可扩展", "微服务", "架构设计",
  ],
};

export function classifyTask(messages: Message[]): TaskClassification {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMessage) {
    return { type: "simple", confidence: 0.5, keywords: [] };
  }

  const text = lastUserMessage.content.toLowerCase();
  const scores = new Map<TaskType, { score: number; keywords: string[] }>();

  for (const [taskType, keywords] of Object.entries(TASK_KEYWORDS)) {
    let score = 0;
    const matched: string[] = [];

    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += 1;
        matched.push(keyword);
      }
    }

    if (score > 0) {
      scores.set(taskType as TaskType, { score, keywords: matched });
    }
  }

  // Find the best match
  let bestType: TaskType = "simple";
  let bestScore = 0;
  let bestKeywords: string[] = [];

  for (const [type, { score, keywords }] of scores) {
    if (score > bestScore) {
      bestType = type;
      bestScore = score;
      bestKeywords = keywords;
    }
  }

  // Calculate confidence (0-1)
  const totalMatches = Array.from(scores.values()).reduce((sum, s) => sum + s.score, 0);
  const confidence = totalMatches > 0 ? bestScore / totalMatches : 0.5;

  return {
    type: bestType,
    confidence: Math.min(confidence + 0.3, 1.0), // Boost base confidence
    keywords: bestKeywords,
  };
}

// ─── Context-Aware Classification ───
// Enhances basic classification with conversation context

export function classifyWithContext(
  messages: Message[],
  fileContext?: { path: string; language: string; size: number }
): TaskClassification {
  const base = classifyTask(messages);

  // Boost confidence if file context is available
  if (fileContext) {
    // Large files suggest complex work
    if (fileContext.size > 500) {
      base.confidence = Math.min(base.confidence + 0.1, 1.0);
    }
    // Certain languages suggest specific task types
    if (["test", "spec"].some((s) => fileContext.path.includes(s))) {
      if (base.type === "code") {
        base.type = "test";
        base.confidence = Math.min(base.confidence + 0.2, 1.0);
      }
    }
  }

  return base;
}
