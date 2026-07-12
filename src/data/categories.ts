interface CategoryRule {
  category: string;
  keywords: string[];
}

/** Keyword → category heuristics. Keywords match case-insensitively on word boundaries
 * against "<name> <description>". Deliberately imperfect; refine by editing this table. */
const CATEGORY_RULES: readonly CategoryRule[] = [
  { category: "Tasks", keywords: ["task", "tasks", "todo", "to-do", "kanban", "checklist", "gtd", "project management"] },
  { category: "Sync & Backup", keywords: ["sync", "syncing", "backup", "git", "version control", "s3", "webdav"] },
  { category: "AI", keywords: ["ai", "gpt", "llm", "openai", "claude", "chatgpt", "copilot", "whisper", "ollama", "embedding", "semantic search"] },
  { category: "Appearance", keywords: ["theme", "style", "styling", "css", "icon", "icons", "color", "colors", "appearance", "font", "fonts", "banner"] },
  { category: "Editor", keywords: ["editor", "editing", "autocomplete", "snippet", "snippets", "shortcut", "hotkey", "vim", "paste", "formatting", "markdown syntax", "toolbar"] },
  { category: "Export & Import", keywords: ["export", "import", "pdf", "epub", "docx", "convert", "converter"] },
  { category: "Calendar & Time", keywords: ["calendar", "daily note", "daily notes", "weekly", "journal", "diary", "pomodoro", "habit", "time tracking", "timer"] },
  { category: "Data & Queries", keywords: ["dataview", "query", "queries", "table", "tables", "database", "chart", "charts", "graph", "sql", "csv", "statistics"] },
  { category: "Files & Organization", keywords: ["file", "files", "folder", "folders", "attachment", "attachments", "tag", "tags", "organize", "explorer", "bookmark", "archive"] },
  { category: "Publishing & Sharing", keywords: ["publish", "publishing", "share", "sharing", "blog", "website", "hugo", "jekyll", "wordpress"] },
  { category: "Integrations", keywords: ["integration", "zotero", "anki", "readwise", "notion", "todoist", "spotify", "telegram", "slack", "github", "jira", "discord", "home assistant"] },
];

export const ALL_CATEGORIES: string[] = [...CATEGORY_RULES.map((r) => r.category), "Other"];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const RULE_PATTERNS: { category: string; pattern: RegExp }[] = CATEGORY_RULES.map((r) => ({
  category: r.category,
  pattern: new RegExp(`\\b(${r.keywords.map(escapeRegExp).join("|")})\\b`, "i"),
}));

export function classifyPlugin(name: string, description: string): string[] {
  const text = `${name} ${description}`;
  const cats = RULE_PATTERNS.filter((r) => r.pattern.test(text)).map((r) => r.category);
  return cats.length > 0 ? cats : ["Other"];
}
