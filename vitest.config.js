import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { transform } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isSyllabusIntegrityCheck = process.env.RUN_SYLLABUS_INTEGRITY === 'true';

export default defineConfig({
  plugins: [
    {
      name: 'transform-jsx-in-js',
      enforce: 'pre',
      async transform(code, id) {
        if (!id.includes('node_modules') && id.endsWith('.js') && (code.includes('</') || code.includes('/>') || code.includes('<Text') || code.includes('<View') || code.includes('<BaseCertificate'))) {
          const result = await transform(code, {
            loader: 'jsx',
            jsx: 'transform',
            jsxFactory: 'React.createElement',
            jsxFragment: 'React.Fragment',
          });
          return { code: result.code, map: result.map };
        }
        return null;
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    testTimeout: 30000,
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    exclude: [
      ...configDefaults.exclude,
      // Excluded from CI release gate: syllabus data is dynamic and governed by
      // college authority; this test relies on an external machine-specific path.
      // Run explicitly with RUN_SYLLABUS_INTEGRITY=true
      ...(isSyllabusIntegrityCheck ? [] : ['tests/unit/syllabus-integrity.test.js']),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/services/**/*.js'],
      all: true,
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
