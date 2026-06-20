import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'types/index': 'src/types/index.ts',
    'auth/index': 'src/auth/index.ts',
    'ai/index': 'src/ai/index.ts',
    'agent/index': 'src/agent/index.ts',
    'search/index': 'src/search/index.ts',
    'validators/index': 'src/validators/index.ts',
    'client/index': 'src/client/index.ts',
    'oss/index': 'src/oss/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  outDir: 'dist',
})
