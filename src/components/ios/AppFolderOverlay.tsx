import { AnimatePresence, motion } from 'framer-motion';
import { useDevice } from '../../context/DeviceContext';
import {
  PROJECT_FOLDER_ID,
  folderChildApps,
  projectsFolder,
} from '../../lib/homeFolders';
import { getAppById } from '../../data/apps';
import { AppIcon } from './AppIcon';

export function AppFolderOverlay() {
  const { openFolderId, closeFolder, openApp } = useDevice();
  const folder = openFolderId === PROJECT_FOLDER_ID ? projectsFolder : null;
  const apps = folder ? folderChildApps(folder, getAppById) : [];

  return (
    <AnimatePresence>
      {openFolderId && folder && (
        <div key="folder-overlay" className="absolute inset-0 z-[35]">
          <motion.button
            type="button"
            aria-label="Close folder"
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={closeFolder}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8">
            <motion.div
              role="dialog"
              aria-label={folder.label}
              className="frosted-panel pointer-events-auto relative z-10 w-full max-w-[320px] rounded-[32px] px-7 pb-7 pt-5"
              initial={{ scale: 0.94 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-6 text-center text-[17px] font-semibold tracking-tight text-white">
                {folder.label}
              </p>
              <div className="grid grid-cols-3 justify-items-center gap-x-6 gap-y-6">
                {apps.map((app) => (
                  <AppIcon
                    key={app.id}
                    app={app}
                    onTap={(a) => {
                      closeFolder();
                      openApp(a.id);
                    }}
                    size={64}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
