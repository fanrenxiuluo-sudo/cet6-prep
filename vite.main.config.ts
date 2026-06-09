import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  // Prisma 需要外部化，不能被打包进 bundle
  // 它的 native binary 需要在运行时从 node_modules 加载
  build: {
    rollupOptions: {
      external: [
        '@prisma/client',
        '@prisma/engines',
        '@prisma/query-engine-wasm',
        '.prisma/client',
      ],
    },
  },
});
