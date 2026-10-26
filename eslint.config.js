import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Layer boundaries from docs/decisions/0001-web-stack-and-layering.md.

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

/** Static imports: forbidden internal packages plus relative escapes out of the package. */
const forbidImports = (packages, message) => [
  'error',
  {
    patterns: [
      ...(packages.length ? [{ group: packages.map((name) => `@aiverse/${name}`), message }] : []),
      RELATIVE_ESCAPE,
    ],
  },
];

const forbidDynamicImports = (packages, message) => ({
  selector: `ImportExpression[source.value=/^@aiverse\\u002F(${packages.join('|')})/]`,
  message,
});

const RUNTIME_GLOBALS = [
  'window', 'document', 'self', 'globalThis', 'performance', 'process', 'fetch', 'crypto',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
];

const NONDETERMINISM = [
  { selector: "NewExpression[callee.name='Date']", message: '使用注入的 Scheduler.now()。' },
];

const packageLayer = (name, forbidden, message) => ({
  files: [`packages/${name}/src/**`],
  rules: {
    'no-restricted-imports': forbidImports(forbidden, message),
    'no-restricted-syntax': [
      'error',
      ...NONDETERMINISM,
      ...DYNAMIC_IMPORT_RULES,
      ...(forbidden.length ? [forbidDynamicImports(forbidden, message)] : []),
    ],
  },
});

const CLIENT_MESSAGE = '客户端只渲染服务端状态，只能依赖 @aiverse/protocol。';

export default defineConfig(
  globalIgnores(['**/dist/', '**/node_modules/', '**/coverage/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  packageLayer('protocol', ['engine', 'host', 'agents'], '协议层不依赖其他内部包。'),
  packageLayer('engine', ['host', 'agents'], '规则引擎只依赖协议。'),
  packageLayer('host', ['agents'], '宿主只依赖协议与引擎；决策者由组装方注入。'),
  packageLayer('agents', ['engine', 'host'], 'Agent 只通过协议观察世界。'),
  {
    files: ['packages/*/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...RUNTIME_GLOBALS.map((name) => ({ name, message: '共享包不直接访问运行环境，由宿主注入。' })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: '使用对局种子，保证结算可复现。' },
        { object: 'Date', property: 'now', message: '使用注入的 Scheduler.now()。' },
      ],
    },
  },
  {
    files: ['packages/*/src/**/*.test.ts'],
    // Tests may use real timers and Date via vitest's fake clock.
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['apps/web/src/**'],
    ignores: ['apps/web/src/local-server/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@aiverse/engine', '@aiverse/host', '@aiverse/agents'], message: CLIENT_MESSAGE },
            { group: ['**/local-server/**'], message: '通过 GameConnection 与服务端通信。' },
            RELATIVE_ESCAPE,
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        ...DYNAMIC_IMPORT_RULES,
        forbidDynamicImports(['engine', 'host', 'agents'], CLIENT_MESSAGE),
        { selector: 'ImportExpression[source.value=/local-server/]', message: '通过 GameConnection 与服务端通信。' },
      ],
    },
  },
  {
    files: ['apps/web/src/local-server/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['../*'], message: '本地服务端不依赖客户端界面代码。' }, RELATIVE_ESCAPE] },
      ],
      'no-restricted-syntax': [
        'error',
        ...DYNAMIC_IMPORT_RULES,
        { selector: 'ImportExpression[source.value=/^\\.\\.\\//]', message: '本地服务端不依赖客户端界面代码。' },
      ],
    },
  },
);
