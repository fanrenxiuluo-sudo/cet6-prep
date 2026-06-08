import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import log from 'electron-log';
import { initDatabase, closeDatabase, getDb } from './db/client';
import { registerIpc } from './ipc/registerIpc';
import { seedDatabase } from './db/seed';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Configure logging
log.transports.file.level = 'info';
log.info('Application starting...');

declare module 'electron' {
  interface App {
    isQuitting: boolean;
  }
}

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'CET6备考助手',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Close to tray instead of quitting
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  return mainWindow;
};

app.on('ready', async () => {
  log.info('App ready');

  // Initialize database
  await initDatabase();
  log.info('Database initialized');

  // Seed built-in questions
  const db = getDb();
  const seedResult = await seedDatabase(db);
  log.info(`Seed complete: ${seedResult.imported} imported, ${seedResult.skipped} skipped`);

  // Register IPC handlers
  registerIpc();
  log.info('IPC handlers registered');

  // Create main window
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  app.isQuitting = true;
  await closeDatabase();
  log.info('Application quitting');
});
