import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import fs from 'fs';
import path from 'path';

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
    // 不使用 asar，让 Prisma native binary 直接从磁盘加载
    asar: false,
    // 覆盖 Vite 插件的默认 ignore 过滤器
    // 只包含运行时需要的文件
    ignore: (file) => {
      if (!file) return false;
      if (file === '/package.json') return false;
      if (file.startsWith('/.vite')) return false;
      if (file.startsWith('/resources')) return false;
      if (file === '/index.html') return false;
      // node_modules 中只保留 Prisma 相关
      if (file.startsWith('/node_modules/@prisma')) return false;
      if (file.startsWith('/node_modules/.prisma')) return false;
      // 排除其他所有
      return true;
    },
    name: 'CET6备考助手',
    icon: './resources/icon',
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ['win32']),
  ],
  hooks: {
    // 打包后复制 node_modules 中 Prisma 相关包到输出目录
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      const modulesToCopy = [
        '@prisma/client',
        '@prisma/engines',
        '.prisma/client',
      ];
      const srcRoot = path.join(__dirname, 'node_modules');
      const destRoot = path.join(buildPath, 'node_modules');

      for (const mod of modulesToCopy) {
        const srcDir = path.join(srcRoot, mod);
        const destDir = path.join(destRoot, mod);
        if (fs.existsSync(srcDir)) {
          try {
            copyDirSync(srcDir, destDir);
            console.log(`Copied node_modules/${mod}`);
          } catch (e) {
            console.error(`Failed to copy node_modules/${mod}:`, e);
          }
        } else {
          console.warn(`node_modules/${mod} not found, skipping`);
        }
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
      // 关闭 asar 时不能启用这些 fuse
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};

export default config;
