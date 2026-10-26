import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Layer boundaries from docs/decisions/0002-python-server-and-coordinate-map.md.

// Every package exports its src, so a path through another `src/`, `packages/` or
// `apps/` means reaching across packages. Plain depth (`../../x`) inside src is fine.
const RELATIVE_ESCAPE = {
  group: ['**/src/**', '**/packages/**', '**/apps/**'],
  message: '不要用相对路径跨包导入，使用 @aiverse/* 包名。',
};

// `no-restricted-imports` ignores `import()`, so dynamic imports get matching selectors.
const DYNAMIC_IMPORT_RULES = [
  { selector: "ImportExpression[source.type!='Literal']", message: '动态导入只能使用字面量路径，便于检查分层。' },
  { selector: 'ImportExpression[source.value=/\\/(src|packages|apps)\\//]', message: RELATIVE_ESCAPE.message },
];

const restrictImports = (group, message) => [
  'error',
  { patterns: [{ group, message }, RELATIVE_ESCAPE] },
];

const restrictDynamicImports = (pattern, message) => [
  'error',
  ...DYNAMIC_IMPORT_RULES,
  { selector: `ImportExpression[source.value=${pattern}]`, message },
];

const PROTOCOL_MESSAGE = '协议层不依赖其他内部包。';
const CLIENT_MESSAGE = '客户端只渲染服务端状态，只能依赖 @aiverse/protocol。';

const RUNTIME_GLOBALS = [
  'window', 'document', 'self', 'globalThis', 'performance', 'process', 'fetch', 'crypto',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'WebSocket',
];

export default defineConfig(
  globalIgnores(['**/dist/', '**/node_modules/', '**/coverage/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['packages/protocol/src/**'],
    rules: {
      'no-restricted-imports': restrictImports(['@aiverse/*'], PROTOCOL_MESSAGE),
      'no-restricted-syntax': restrictDynamicImports('/^@aiverse\\u002F/', PROTOCOL_MESSAGE),
    },
  },
  {
    files: ['packages/*/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...RUNTIME_GLOBALS.map((name) => ({ name, message: '共享包不直接访问运行环境。' })),
      ],
    },
  },
  {
    files: ['apps/web/src/**'],
    rules: {
      'no-restricted-imports': restrictImports(['@aiverse/*', '!@aiverse/protocol'], CLIENT_MESSAGE),
      'no-restricted-syntax': restrictDynamicImports('/^@aiverse\\u002F(?!protocol$)/', CLIENT_MESSAGE),
    },
  },
);
