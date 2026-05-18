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

### 前置要求

- [Node.js](https://nodejs.org) >= 18（建议 LTS v20.x）
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)（用于启动 PostgreSQL + Redis + 服务端容器）
- npm >= 9

### 首次安装

#### 1. 克隆项目

```bash
git clone <repo-url>
cd DND5E_Tracker
```

#### 2. 配置 Docker 镜像加速（国内用户必做）

Docker Hub 在国内访问受限，首次拉取镜像需要配置镜像加速器：

编辑 `C:\Users\<用户名>\.docker\daemon.json`，添加 `registry-mirrors`：

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://mirror.baidubce.com"
  ]
}
```

保存后**重启 Docker Desktop**（右键系统托盘图标 → Restart）。

#### 3. 启动 Docker 服务

```bash
docker compose up -d
```

首次运行会自动拉取镜像并构建项目，等待几分钟直到所有容器就绪。

> **如果镜像拉取仍然失败**，可通过镜像站手动拉取后打 tag：
> ```bash
> docker pull docker.m.daocloud.io/library/node:20-alpine
> docker tag docker.m.daocloud.io/library/node:20-alpine node:20-alpine
> docker pull docker.m.daocloud.io/library/postgres:16-alpine
> docker tag docker.m.daocloud.io/library/postgres:16-alpine postgres:16-alpine
> docker pull docker.m.daocloud.io/library/redis:7-alpine
> docker tag docker.m.daocloud.io/library/redis:7-alpine redis:7-alpine
> docker compose up -d
> ```

#### 4. 安装依赖 + 初始化数据库

```bash
npm install
npm run db:push -w server    # 同步数据库表结构（非交互式）
npm run db:seed -w server    # 填充种子数据
```

> `prisma migrate dev` 在非 TTY 环境下无法使用，统一用 `db push`。

#### 5. 启动开发环境

```bash
npm run dev
```

这会同时启动：
- **前端** → http://127.0.0.1:15173
- **后端 API** → http://localhost:3001

#### 6. 测试账号

打开浏览器访问 http://127.0.0.1:15173，登录页包含快捷测试按钮：

| 角色 | 邮箱 | 密码 |
|---|---|---|
| **DM** | `dm@example.com` | `password123` |
| **Player** | `player@example.com` | `password123` |

> 种子数据还包含两个测试角色（Ragnar Stoneheart、Vaelira）和一个测试战役（邀请码：`DND2024`）。

### 日常启动（已安装后）

```bash
# 1. 启动 Docker 容器（如果未运行）
docker compose up -d

# 2. 启动开发服务器
npm run dev
```

验证容器状态：

```bash
docker compose ps
# 应看到三个容器均在 Up 状态：app、postgres、redis
```

停止项目（保留数据）：

```bash
docker compose down     # 停止所有容器
```

停止项目并清除数据库数据：

```bash
docker compose down -v  # 删除容器 + 数据卷
```

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
| 启动所有 Docker 服务 | `docker compose up -d` |
| 停止所有 Docker 服务 | `docker compose down` |
| 停止并清除数据 | `docker compose down -v` |
| 同步数据库表结构 | `npm run db:push -w server` |
| 填充种子数据 | `npm run db:seed -w server` |
| 启动开发环境 | `npm run dev` |
| 仅启动后端 | `npm run dev:server` |
| 仅启动前端 | `npm run dev:client` |
| 生产构建 | `npm run build` |
| 运行后端测试 | `npm run test -w server` |

---

## 无 Docker 环境

如果没有 Docker Desktop，可以手动安装 PostgreSQL 和 Redis：

1. 安装 [PostgreSQL](https://www.postgresql.org/download/) 并创建数据库 `dnd_visualizer`
2. 安装 [Redis](https://redis.io/download/)
3. 在 `server/.env` 中配置连接信息（参考 `.env.example`）
