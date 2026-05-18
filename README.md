# DND5E Tracker

一款基于 Web 的 D&D 5E 实时跑团工具。支持 DM 与多名玩家通过浏览器协作，提供地图绘制、棋子操控、战斗追踪、角色管理、骰子投掷与聊天等完整功能，所有操作通过 WebSocket 实时同步。

---

## 特色功能

### 地图系统
- **多地图管理**：上传、切换、删除战役地图，支持本地文件与 URL 加载
- **网格叠加**：可调节网格尺寸、偏移、颜色与线宽（标准 1 格 = 5 英尺）
- **缩放/平移**：鼠标滚轮 + 触控板手势，平滑 CSS 过渡，光标位置定点缩放
- **迷雾系统**：DM 涂抹 / 擦除迷雾区域，实时同步给玩家，新地图默认全透明可见
- **标注画笔**：DM 自由绘制标注图层，带颜色选择器，实时同步
- **玩家视角预览**：DM 可一键切换至玩家视角（含迷雾效果）

### 棋子与战斗
- **棋子 CRUD**：创建 PC/NPC/Monster/Object 棋子，自定义图标与颜色，拖拽定位
- **右键菜单**：HP ±5，隐藏/显示，删除棋子
- **角色绑定**：棋子可关联角色卡，自动同步姓名、HP、AC、头像、视野与速度
- **视野/移动范围**：选中棋子显示黑暗视觉圈（蓝色实线）与速度圈（橙色虚线）
- **战斗追踪器**：三阶段生命周期（筹备 → 进行中 → 结束），多源自动导入棋子
  - 回合管理：上一回合 / 下一回合切换，当前行动棋子高亮 + 地图自动居中
  - 进度保存：每轮记录战斗日志，战斗结束后存档至地图历史

### D&D 5E 角色卡
- **六标签完整角色表**：信息 / 属性 / 战斗 / 技能 / 法术 / 装备
- **法术系统**：职业法术位自动计算（DC / 攻击加值），按职业筛选法术，记忆/准备法术管理
- **属性与技能**：6 大属性 + 18 项技能，熟练项开关，自动计算调整值
- **装备管理**：武器（攻击/伤害/属性）、护甲（AC/隐匿/力量要求）、货币（CP/SP/EP/GP/PP）
- **IME 安全输入**：本地状态 + 失焦提交，避免中文输入法合成问题
- **快速掷骰**：属性 / 豁免 / 技能旁一键 d20 投掷

### 实时协作
- **WebSocket 同步**：所有地图、棋子、战斗、聊天操作实时广播至同战役玩家
- **在线玩家面板**：显示在线人数与角色名
- **DM 权限控制**：玩家仅可操作自己的棋子，服务端校验所有权
- **邀请码系统**：战役邀请码加入，支持 DM 踢人

### 骰子与聊天
- **骰子投掷**：单骰 + 多骰组合（如 `2d20+1d8`），支持暗骰（仅自己与 DM 可见）
- **预设保存**：常用投骰组合存储在 localStorage 中
- **聊天系统**：公开消息 / 悄悄话，D&D 主题快捷回复按钮
- **消息样式**：系统通知 / 骰子结果 / 悄悄话 各有独特视觉风格

### 其他
- **角色数据库**：法术库 + 装备库（D&D 5E SRD 数据）
- **战役数据导出**：JSON 格式备份战役数据
- **移动端适配**：触屏拖拽 / 捏合缩放，小屏自动切换图标标签
- **会话统计**：骰子次数、消息条数、地图/棋子数量统计

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
git clone https://github.com/Voidspike/DND5E_Tracker.git
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

## 使用指南

### DM 流程

1. 以 DM 账号登录，进入战役页面
2. **上传地图**：点击地图面板中的上传按钮，选择本地图片或输入 URL
3. **调整网格**：设置网格大小、偏移、颜色，使其与地图匹配
4. **创建棋子**：使用工具栏创建 PC/NPC/Monster 棋子，拖拽到地图对应位置
5. **开启战斗**：点击战斗按钮，系统自动导入地图上所有棋子，调整先攻值后开始
6. **管理回合**：使用上一回合 / 下一回合按钮推进战斗，骰子投掷与聊天辅助 RP

### 玩家流程

1. 以玩家账号登录，通过邀请码加入战役
2. **创建角色**：在角色列表点击「创建角色」，填写 D&D 5E 标准角色卡
3. **放置棋子**：创建棋子时会自动绑定为当前玩家所有
4. **操作棋子**：拖拽移动、修改 HP、投掷骰子、发送聊天消息
5. **战斗参与**：战斗开始后可在战斗面板查看回合进度

---

## 项目结构

```
DND5E_Tracker/
├── client/                     # 前端（React + Vite）
│   ├── public/
│   └── src/
│       ├── components/         # 通用组件
│       │   ├── map/            # 地图相关
│       │   ├── token/          # 棋子相关
│       │   ├── combat/         # 战斗追踪
│       │   ├── dice/           # 骰子系统
│       │   ├── chat/           # 聊天系统
│       │   └── character/      # 角色卡组件
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
│   ├── prisma/                 # Prisma Schema + 种子数据
│   └── tests/
├── shared/                     # 前后端共享类型
│   └── types/
├── docker-compose.yml          # Docker 编排（PostgreSQL + Redis + App）
├── Dockerfile                  # 生产构建镜像
└── docker-entrypoint.sh        # 容器启动脚本
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

## 未来开发方向

### 1. 战斗记录存档与文字可视化

将战斗追踪器的完整过程（每轮行动、投骰结果、HP 变化、状态效果等）导出为结构化数据，并渲染为可视化的文字战报。战报文本可作为输入，交由 AI 大语言模型润色，生成连贯、沉浸式的叙事性战斗描写，用于战报分享、Replay 回顾或创作灵感。

### 2. AI 模型接入

项目将引入多种 AI 大语言模型的 API 接口，实现两个核心功能场景：

- **对话辅助模式**：DM 与玩家可在侧边栏与 AI 对话，快速查询规则、生成 NPC 对话、即兴创作场景描述、获取剧情灵感。AI 作为副 DM 辅助跑团流程。
- **单人 DM 接管模式**：当没有 DM 时，AI 自动接管 DM 职责——管理剧情推进、控制怪物行动、裁决投骰结果、描述场景变化，实现真正的单人跑团体验。玩家只需创建角色即可开始冒险。

---

## 无 Docker 环境

如果没有 Docker Desktop，可以手动安装 PostgreSQL 和 Redis：

1. 安装 [PostgreSQL](https://www.postgresql.org/download/) 并创建数据库 `dnd_visualizer`
2. 安装 [Redis](https://redis.io/download/)
3. 在 `server/.env` 中配置连接信息（参考 `.env.example`）
