import { useDevice } from '../../context/DeviceContext';
import { homeApps, getAppById } from '../../data/apps';
import {
  buildHomePages,
  folderChildApps,
  isAppFolder,
  resolveHomeDisplayApps,
} from '../../lib/homeFolders';
import { AppIcon } from './AppIcon';
import { FolderIcon } from './FolderIcon';

export function HomeGrid() {
  const { openApp, openFolder } = useDevice();
  const pages = buildHomePages(resolveHomeDisplayApps(homeApps));

  return (
    <div className="mx-auto h-full max-w-md px-6 pt-4">
      {pages.map((pageItems, pageIdx) => (
        <div key={pageIdx} className={pageIdx === 0 ? '' : 'mt-8'}>
          <div className="grid grid-cols-4 gap-x-4 gap-y-6">
            {pageItems.map((item) => (
              <div key={item.id} className="flex justify-center">
                {isAppFolder(item) ? (
                  <FolderIcon
                    folder={item}
                    apps={folderChildApps(item, getAppById)}
                    onOpen={(f) => openFolder(f.id)}
                  />
                ) : (
                  <AppIcon app={item} onTap={(a) => openApp(a.id)} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {pages.length > 1 && (
        <div className="mt-6 flex items-center justify-center gap-1.5">
          {pages.map((_, i) => (
            <span key={i} className={`page-dot${i === 0 ? ' active' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}
