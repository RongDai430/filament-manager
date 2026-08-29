# Filament Manager

个人使用的 3D 打印耗材管理网页。

当前版本：**V1 / v1.0.0**

## 核心功能

- 耗材录入
- 耗材挂载 / 卸载
- 未用完耗材可收纳并再次挂载
- 多色 / 多耗材打印
- 打印开始录入预计耗材
- 打印结束录入实际耗材
- 根据实际耗材自动计算剩余重量
- 耗材成本计算
- 打印历史记录
- localStorage 本地持久化

## 技术栈

- React 19
- TypeScript
- Vite
- Vitest
- localStorage

## 安装

```bash
npm install
```

## 开发运行

```bash
npm run dev
```

启动后访问终端输出的本地地址，通常为 `http://localhost:5173/`。

## 测试

```bash
npm run test
```

## Build

```bash
npm run build
```

## 数据说明

当前 V1 数据保存在浏览器的 `localStorage` 中。清除浏览器数据可能导致本地记录丢失。
