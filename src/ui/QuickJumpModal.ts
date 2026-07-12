import { FuzzySuggestModal, type App } from "obsidian";
import type { PluginEntry } from "../data/types";

/** Fuzzy quick-jump over the community plugin catalog. */
export class QuickJumpModal extends FuzzySuggestModal<PluginEntry> {
  constructor(
    app: App,
    private entries: PluginEntry[],
    private onChoose: (entry: PluginEntry) => void
  ) {
    super(app);
    this.setPlaceholder("Search community plugins…");
    this.setInstructions([
      { command: "↑↓", purpose: "navigate" },
      { command: "↵", purpose: "open in Better Store" },
      { command: "esc", purpose: "dismiss" },
    ]);
    this.limit = 30;
  }

  getItems(): PluginEntry[] {
    return this.entries;
  }

  getItemText(entry: PluginEntry): string {
    return `${entry.name} — ${entry.author}`;
  }

  onChooseItem(entry: PluginEntry): void {
    this.onChoose(entry);
  }
}
