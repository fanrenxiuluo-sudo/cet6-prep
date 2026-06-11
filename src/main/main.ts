import { app, BrowserWindow, Menu, dialog } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import log from 'electron-log';
import { initDatabase, closeDatabase, getDb } from './db/client';
import { registerIpc } from './ipc/registerIpc';
import { seedDatabase } from './db/seed';

if (started) {
  app.quit();
}

// 防止 GPU 进程崩溃导致应用闪退
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('in-process-gpu');

log.transports.file.level = 'info';
log.info('Application starting...');

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'CET6备考助手',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error('Renderer process gone:', details.reason, details.exitCode);
  });

  return mainWindow;
};

app.on('ready', async () => {
  log.info('App ready');

  try {
    await initDatabase();
    log.info('Database initialized');

    const db = getDb();
    const seedResult = await seedDatabase(db);
    log.info(`Seed complete: ${seedResult.imported} imported, ${seedResult.skipped} skipped`);

    registerIpc();
    log.info('IPC handlers registered');
  } catch (err) {
    log.error('Startup initialization failed:', err);
    dialog.showErrorBox(
      '启动失败',
      `数据库初始化出错：${err instanceof Error ? err.message : String(err)}\n\n请联系开发者或查看日志文件。`,
    );
  }

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

app.on('before-quit', () => {
  closeDatabase().catch((err) => log.error('Error closing database:', err));
  log.info('Application quitting');
});

process.on('uncaughtException', (err) => {
  log.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason);
});
