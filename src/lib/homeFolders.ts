import type { AppDefinition } from '../types';

export const PROJECT_FOLDER_ID = 'folder-projects' as const;
export type AppFolderId = typeof PROJECT_FOLDER_ID;
export const PROJECT_APP_IDS = ['project-a', 'project-b', 'project-c'] as const;
const PROJECT_APP_ID_SET = new Set<string>(PROJECT_APP_IDS);

export interface AppFolderDefinition {
  id: typeof PROJECT_FOLDER_ID;
  label: string;
  kind: 'folder';
  appIds: readonly string[];
}

export const projectsFolder: AppFolderDefinition = {
  id: PROJECT_FOLDER_ID,
  label: 'Projects',
  kind: 'folder',
  appIds: PROJECT_APP_IDS,
};

export type HomeGridItem = AppDefinition | AppFolderDefinition;

export function isAppFolder(item: HomeGridItem): item is AppFolderDefinition {
  return 'kind' in item && item.kind === 'folder';
}

/** Collapse project apps into one iOS-style folder on the home grid. */
export function resolveHomeDisplayApps(apps: AppDefinition[]): HomeGridItem[] {
  const out: HomeGridItem[] = [];
  let folderPlaced = false;
  for (const app of apps) {
    if (PROJECT_APP_ID_SET.has(app.id)) {
      if (!folderPlaced) {
        out.push(projectsFolder);
        folderPlaced = true;
      }
      continue;
    }
    out.push(app.id === 'legal' ? { ...app, homePage: 2 as const } : app);
  }
  return out;
}

const PAGE_SIZE = 20;

export function buildHomePages(items: HomeGridItem[]): HomeGridItem[][] {
  const pinned: HomeGridItem[] = [];
  const regular: HomeGridItem[] = [];
  for (const item of items) {
    if ('homePage' in item && item.homePage === 2) pinned.push(item);
    else regular.push(item);
  }
  const pages: HomeGridItem[][] = [];
  const pageCount = Math.max(1, Math.ceil(regular.length / PAGE_SIZE));
  for (let i = 0; i < pageCount; i++) {
    pages.push(regular.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE));
  }
  if (pinned.length) pages.push(pinned);
  return pages;
}

export function folderChildApps(
  folder: AppFolderDefinition,
  getApp: (id: string) => AppDefinition | undefined,
): AppDefinition[] {
  return folder.appIds.map((id) => getApp(id)).filter((a): a is AppDefinition => !!a);
}
