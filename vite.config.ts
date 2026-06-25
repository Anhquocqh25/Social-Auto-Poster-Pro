import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/bootstrap.ts',
        onstart(options) {
          options.startup();
        },
        vite: {
          resolve: {
            alias: {
              '@': path.resolve(__dirname, './src')
            }
          },
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', 'better-sqlite3', '@prisma/client']
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          resolve: {
            alias: {
              '@': path.resolve(__dirname, './src')
            }
          },
          build: {
            outDir: 'dist-electron',
            lib: {
              entry: path.resolve(__dirname, 'electron/preload.ts'),
              formats: ['cjs'],
              fileName: () => 'preload.cjs'
            },
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    watch: {
      ignored: ['**/release/**']
    }
  },
  build: {
    outDir: 'dist'
  }
});
