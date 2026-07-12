import { ItemView, WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import StoreView from "./ui/StoreView.svelte";
import type BetterStorePlugin from "./main";

export const VIEW_TYPE_BETTER_STORE = "better-store-view";

export class BetterStoreView extends ItemView {
  private component: Record<string, unknown> | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: BetterStorePlugin) {
    super(leaf);
    this.navigation = false;
  }

  getViewType(): string {
    return VIEW_TYPE_BETTER_STORE;
  }

  getDisplayText(): string {
    return "Better Store";
  }

  getIcon(): string {
    return "store";
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("better-store");
    this.component = mount(StoreView, {
      target: this.contentEl,
      props: { plugin: this.plugin, view: this },
    });
  }

  async onClose(): Promise<void> {
    if (this.component) {
      await unmount(this.component);
      this.component = null;
    }
  }
}
