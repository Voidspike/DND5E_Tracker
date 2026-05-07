# DND Campaign Visualizer

一款基于 Web 的实时多人协作工具，用于可视化和管理 DND（龙与地下城）跑团战役。DM 可以完整操控地图、棋子、战斗和游戏状态，玩家可以通过邀请码加入并实时同步操作自己的角色。

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 状态管理 | Zustand |
| 实时通信 | Socket.IO (WebSocket) |
| 后端 | Node.js + Express |
| 数据库 | PostgreSQL （ORM: Prisma） |
| 缓存 | Redis |
| 认证 | JWT |

---

## 快速启动

### 1. 前置要求

- [Node.js](https://nodejs.org) >= 18（建议 LTS v20.x）
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)（用于启动 PostgreSQL + Redis）
- npm >= 9

### 2. 启动数据库

```bash
docker compose up -d
```

### 3. 安装依赖

```bash
npm install
```

### 4. 初始化数据库

```bash
# 运行数据库迁移（创建所有表）
npm run db:migrate -w server

# 填充种子数据（创建测试账号和战役）
npm run db:seed -w server
```

### 5. 启动开发环境

```bash
npm run dev
```

这会同时启动：
- **前端** → http://localhost:5173
- **后端 API** → http://localhost:3001

### 6. 使用测试账号登录

打开浏览器访问 http://localhost:5173，登录页包含快捷测试按钮：

| 角色 | 邮箱 | 密码 |
|---|---|---|
| **DM** | `dm@example.com` | `password123` |
| **Player** | `player@example.com` | `password123` |

> 种子数据还包含一个测试战役（邀请码：`DND2024`）和测试角色。

---

## 项目结构

```
dnd-visualizer/
├── client/                     # 前端（React + Vite）
│   ├── public/
│   └── src/
│       ├── components/         # 通用组件
│       │   ├── map/            # 地图相关
│       │   ├── token/          # 棋子相关
│       │   ├── combat/         # 战斗追踪
│       │   ├── dice/           # 骰子系统
│       │   └── chat/           # 聊天系统
│       ├── pages/              # 页面
│       │   ├── Dashboard/
│       │   ├── Campaign/
│       │   └── Auth/
│       ├── stores/             # Zustand 状态管理
│       ├── hooks/              # 自定义 Hooks
│       ├── services/           # API + Socket 封装
│       └── utils/
├── server/                     # 后端（Node.js + Express）
│   ├── src/
│   │   ├── routes/             # REST API 路由
│   │   ├── middleware/         # 中间件
│   │   ├── socket/             # Socket.IO 事件处理
│   │   └── utils/
│   ├── prisma/                 # Prisma Schema + 迁移
│   └── tests/
├── shared/                     # 前后端共享类型
│   └── types/
├── docker-compose.yml          # PostgreSQL + Redis
├── DESIGN.md                   # 详细设计文档
└── TODO.md                     # 开发计划
```

---

## 常用命令速查

| 用途 | 命令 |
|---|---|
| 启动数据库 | `docker compose up -d` |
| 停止数据库 | `docker compose down` |
| 运行迁移 | `npm run db:migrate -w server` |
| 填充种子数据 | `npm run db:seed -w server` |
| 启动开发环境 | `npm run dev` |
| 仅启动后端 | `npm run dev:server` |
| 仅启动前端 | `npm run dev:client` |
| 生产构建 | `npm run build` |

---

## 无 Docker 环境

如果没有 Docker Desktop，可以手动安装 PostgreSQL 和 Redis：

1. 安装 [PostgreSQL](https://www.postgresql.org/download/) 并创建数据库 `dnd_visualizer`
2. 安装 [Redis](https://redis.io/download/)
3. 在 `server/.env` 中配置连接信息（参考 `.env.example`）
