export interface RegistryPlugin {
  id: string;
  name: string;
  author: string;
  description: string;
  repo: string;
}

/** A registry plugin merged with stats and heuristic categories. `updated` is ms epoch, 0 if unknown. */
export interface PluginEntry extends RegistryPlugin {
  downloads: number;
  updated: number;
  categories: string[];
}
