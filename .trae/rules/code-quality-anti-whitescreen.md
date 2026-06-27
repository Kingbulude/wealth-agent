---
alwaysApply: true
---
# 代码质量与白屏防护规则

## 核心原则：绝不允许未定义变量上线

未定义变量（如 `ReferenceError: XXX is not defined`）是导致 React 应用白屏的首要原因。必须在构建前拦截此类问题。

## 强制检查步骤

每次修改代码后、推送 main 分支前，必须执行：

```bash
npx tsc --noEmit
```

如果类型检查不通过，**不得推送代码**，必须先修复所有类型错误。

## 常见白屏原因与预防

| 问题类型 | 后果 | 预防方法 |
|---------|------|---------|
| 未导入的变量直接使用 | ReferenceError 白屏 | `tsc --noEmit` 类型检查 |
| 拼写错误的变量名 | ReferenceError 白屏 | `tsc --noEmit` 类型检查 |
| 删除了导入但代码还在使用 | ReferenceError 白屏 | `tsc --noEmit` 类型检查 |
| 重构时漏掉某些文件 | 运行时报错 | `tsc --noEmit` 全量检查 |

## 组件开发规范

1. **使用的变量必须导入**：在组件中使用任何外部变量前，确认文件顶部已有对应的 import 语句
2. **不要依赖全局变量**：所有依赖都应通过 import 显式引入
3. **类型必须完整**：TypeScript 项目中，禁止使用 `any` 绕过类型检查

## CI/CD 建议（可选）

如果配置了 CI/CD 流水线，必须在构建阶段加入类型检查步骤：

```yaml
- name: Type Check
  run: npx tsc --noEmit
```

确保只有类型检查通过的代码才能进入部署阶段。
