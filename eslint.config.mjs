// ESLint 9 Flat Config
// 旧版 .eslintrc.json 已废弃，迁移到新格式 eslint.config.js
// 兼容 ESLint 9.x + typescript-eslint 8.x

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  // 基础推荐规则
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 全局忽略
  {
    ignores: [
      'dist/**',
      'release/**',
      'node_modules/**',
      'android/**',
      'functions/_schema/**',
      '.uploads/**',
      '.trae-html-share-packages/**',
      'electron/**',          // Electron 主进程是 CommonJS JS 文件，单独处理
      'build-installer.bat',
      'start.bat',
      'update.bat',
      'capacitor.config.ts',  // Capacitor 配置由框架自己保证
      '*.cjs', '*.mjs'
    ]
  },

  // TypeScript / TSX 文件
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {
      // 与原 .eslintrc.json 行为对齐
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',     // 项目里 (window as any) 等暂未清理
      // Cloudflare Pages Functions 的标准签名是 interface Env {}（占位，按需补充字段）
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-console': 'off',
      // 业务代码里大量使用未定义全局变量（window.electronAPI），暂时降级
      'no-undef': 'off',
      // catch (e) 不使用 e 是项目常见模式（仅用于吞掉错误），允许空 catch 块和未读 e
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },

  // 让 catch (e) 的 e 未使用不再触发警告
  // 这些是真实存在的代码模式（吞错），不属于 bug，避免阻塞 lint
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_(.*)$',
        caughtErrorsIgnorePattern: '^(e|err|error|_)$',
        varsIgnorePattern: '^_(.*)$'
      }]
    }
  },

  // Cloudflare Pages Functions（运行在 Workers runtime，没有浏览器/Node 全局）
  {
    files: ['functions/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        // Cloudflare Pages Functions 注入的全局对象
        'ENV': 'readonly'
      }
    }
  }
)
