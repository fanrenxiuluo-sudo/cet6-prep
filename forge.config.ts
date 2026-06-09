import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import fs from 'fs';
import path from 'path';

/**
 * 将 Prisma engine 复制到打包后的 resources 目录
 * 确保 native binary 在打包后可用
 */
function copyPrismaEngines(): void {
  const srcDir = path.join(__dirname, 'node_modules', '@prisma', 'engines');
  const destDir = path.join(__dirname, 'out', 'CET6备考助手-win32-x64', 'resources', 'prisma-engines');

  if (!fs.existsSync(srcDir)) {
    console.warn('Prisma engines source not found:', srcDir);
    return;
  }

  fs.mkdirSync(destDir, { recursive: true });

  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    const src = path.join(srcDir, file);
    const dest = path.join(destDir, file);
    fs.copyFileSync(src, dest);
    console.log(`Copied Prisma engine: ${file}`);
  }
}

/**
 * 递归复制目录
 */
function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    // 关闭 asar，让 Prisma native binary 可以直接从磁盘加载
    asar: false,
    name: 'CET6备考助手',
    icon: './resources/icon',
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'CET6Prep',
    }),
    new MakerZIP({}, ['win32']),
  ],
  hooks: {
    // 打包后复制 Prisma engine 到 resources 目录
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      const srcDir = path.join(__dirname, 'node_modules', '@prisma', 'engines');
      const destDir = path.join(buildPath, 'resources', 'prisma-engines');

      if (!fs.existsSync(srcDir)) {
        console.warn('Prisma engines source not found:', srcDir);
        return;
      }

      try {
        copyDirSync(srcDir, destDir);
        console.log('Prisma engines copied successfully');
      } catch (e) {
        console.error('Failed to copy Prisma engines:', e);
      }
    },
  },
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
