# DND Campaign Visualizer — 设计文档

## 1. 项目概述

一款基于 Web 的实时多人协作工具，用于可视化和管理 DND（龙与地下城）跑团战役。DM 可以完整操控地图、棋子、战斗和游戏状态，玩家可以实时同步操作自己的角色。

### 目标平台
- 桌面浏览器（Chrome / Firefox / Edge）
- 移动端浏览器（响应式布局，触屏适配）

### 核心原则
- **实时同步**：所有操作通过 WebSocket 实时广播
- **角色权限**：DM 拥有全部权限，玩家只能操作自身相关的内容
- **开箱即用**：无需安装，打开浏览器即可加入

---

## 2. 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| **前端框架** | React 18 + TypeScript | 组件化 UI |
| **构建工具** | Vite | 快速 Dev / 构建 |
| **样式** | Tailwind CSS | 响应式、手机/桌面适配 |
| **状态管理** | Zustand | 轻量、适合实时状态 |
| **实时通信** | Socket.IO (WebSocket) | 双向实时同步 |
| **后端** | Node.js + Express | REST API + Socket.IO 服务 |
| **数据库** | PostgreSQL | 持久化数据 |
| **缓存** | Redis | 实时状态缓存、房间管理 |
| **ORM** | Prisma | 类型安全的数据库操作 |
| **认证** | JWT | 无状态认证 |

---

## 3. 架构概览

```
┌─────────────────┐       ┌─────────────────────────────────┐
│   Browser A     │       │          Server                  │
│  (DM - Chrome)  │──────▶│  ┌───────────┐  ┌──────────┐   │
└─────────────────┘       │  │  Express   │  │ Socket.IO│   │
                          │  │  REST API  │  │  Server  │   │
┌─────────────────┐       │  └─────┬─────┘  └────┬─────┘   │
│   Browser B     │       │        │              │         │
│ (Player - Phone)│──────▶│  ┌─────┴──────────────┴─────┐   │
└─────────────────┘       │  │       Room Manager       │   │
                          │  │    ┌────────────────┐    │   │
                          │  │    │  Game State    │    │   │
                          │  │    │  (In-Memory)   │    │   │
                          │  │    └───────┬────────┘    │   │
                          │  └────────────┼─────────────┘   │
                          │               │                 │
                          │  ┌────────────┴─────────────┐   │
                          │  │   PostgreSQL / Redis      │   │
                          │  └──────────────────────────┘   │
                          └─────────────────────────────────┘
```

### 通信模型
- **REST API**：认证、房间管理、地图/角色/模板等 CRUD 操作
- **WebSocket (Socket.IO)**：游戏内实时操作 — 棋子移动、战斗回合、骰子投掷、聊天
- **同步策略**：DM 操作 → 服务端校验 → 广播到所有客户端（乐观更新 + 服务端确认）

---

## 4. 用户角色与权限

### 4.1 DM（地下城主）
- 创建/删除/管理战役
- 上传和管理地图
- 放置、移动、编辑所有棋子（PC / NPC / 怪物 / 物体）
- 控制战争迷雾（Fog of War）
- 管理战斗（先攻排序、回合推进）
- 添加/移除战役中的玩家
- 查看所有隐藏信息

### 4.2 Player（玩家）
- 加入/离开战役
- 查看地图（受战争迷雾限制）
- 移动属于自己的棋子
- 管理自己的角色卡（HP、法术位、属性等）
- 投骰子（公开 / 私密 DM）
- 与队伍聊天

### 4.3 Observer（旁观者）
- 只读查看地图和公开信息
- 无法交互

---

## 5. 功能模块

> 各模块详细功能按角色分开列举，后续逐步细化。

### 5.1 战役管理（Campaign）
| 功能 | DM | Player |
|---|---|---|
| 创建/删除战役 | ✅ | — |
| 编辑战役信息 | ✅ | — |
| 邀请玩家（链接 / 码） | ✅ | — |
| 加入战役 | — | ✅ |
| 离开战役 | — | ✅ |
| 设置默认地图 | ✅ | — |

### 5.2 地图系统（Map）
| 功能 | DM | Player |
|---|---|---|
| 上传地图图片 | ✅ | — |
| 删除/替换地图 | ✅ | — |
| 多地图切换 | ✅ | ✅（查看） |
| 网格叠加（可调大小/偏移） | ✅ | — |
| 战争迷雾（Fog of War） | ✅ | — |
| 地图标注（绘制/文字） | ✅ | ✅（仅查看） |
| 地图缩放/平移 | ✅ | ✅ |

### 5.3 棋子系统（Token）
| 功能 | DM | Player |
|---|---|---|
| 放置棋子 | ✅ | — |
| 拖动棋子 | ✅ | ✅（仅自己的） |
| 编辑棋子属性 | ✅ | ✅（仅自己的） |
| 删除棋子 | ✅ | — |
| 血量条显示 | ✅ | ✅ |
| 状态效果标识 | ✅ | ✅（仅自己的） |
| 隐藏/显示棋子 | ✅ | — |
| 选中高亮 | ✅ | ✅（仅自己的） |

### 5.4 角色卡（Character Sheet）
| 功能 | DM | Player |
|---|---|---|
| 查看角色卡 | ✅（所有） | ✅（自己的） |
| 编辑角色卡 | ✅（所有） | ✅（仅自己的） |
| 属性/技能调整 | ✅（所有） | ✅（仅自己的） |
| HP/临时HP 管理 | ✅ | ✅ |
| 法术位追踪 | ✅ | ✅ |
| 装备/物品管理 | ✅ | ✅ |
| 状态效果（中毒、麻痹等） | ✅ | ✅（仅自己的） |

### 5.5 战斗追踪（Combat Tracker）
| 功能 | DM | Player |
|---|---|---|
| 开启/结束战斗 | ✅ | — |
| 添加参战单位 | ✅ | — |
| 编辑先攻值 | ✅ | — |
| 自动排序 | ✅ | ✅（查看） |
| 推进回合 | ✅ | — |
| 查看回合顺序 | ✅ | ✅ |
| 当前回合高亮 | ✅ | ✅ |

### 5.6 骰子系统（Dice Rolling）
| 功能 | DM | Player |
|---|---|---|
| 投掷各类骰子（d4/d6/d8/d10/d12/d20/d100） | ✅ | ✅ |
| 添加加值/减值 | ✅ | ✅ |
| 公开投掷（全员可见） | ✅ | ✅ |
| 私密投掷（仅 DM 可见） | ✅ | ✅ |
| 投骰历史 | ✅ | ✅ |
| 快捷投骰（从角色卡直接投） | ✅ | ✅ |

### 5.7 实时通信
| 功能 | DM | Player |
|---|---|---|
| 文字聊天（战役频道） | ✅ | ✅ |
| 私聊 DM | — | ✅ |
| 系统通知（战斗开始、回合变更等） | ✅ | ✅ |
| 投骰结果广播 | ✅ | ✅ |

---

## 6. 数据结构

### 6.1 User（用户）
```prisma
model User {
  id        String   @id @default(uuid())
  username  String   @unique
  email     String   @unique
  avatarUrl String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  campaigns Campaign[] @relation("DMCampaigns")
  players   CampaignPlayer[]
  characters Character[]
  diceRolls DiceRoll[]
}
```

### 6.2 Campaign（战役）
```prisma
model Campaign {
  id        String   @id @default(uuid())
  name      String
  description String?
  inviteCode String   @unique
  dmId      String
  dm        User     @relation("DMCampaigns", fields: [dmId], references: [id])
  settings  Json     @default("{}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  maps       Map[]
  players    CampaignPlayer[]
  characters Character[]
  combatTrackers CombatTracker[]
  diceRolls  DiceRoll[]
  messages   ChatMessage[]
}
```

### 6.3 CampaignPlayer（战役玩家关联）
```prisma
model CampaignPlayer {
  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id])
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  role       String   @default("player") // "player" | "observer"

  @@id([campaignId, userId])
}
```

### 6.4 Map（地图）
```prisma
model Map {
  id          String   @id @default(uuid())
  campaignId  String
  campaign    Campaign @relation(fields: [campaignId], references: [id])
  name        String
  imageUrl    String
  width       Int      @default(0)
  height      Int      @default(0)
  gridSize    Int      @default(50)   // px per cell
  gridOffsetX Int      @default(0)
  gridOffsetY Int      @default(0)
  fogData     Json?    // 战争迷雾数据 (base64 encoded PNG overlay)
  createdAt   DateTime @default(now())

  tokens Token[]
}
```

### 6.5 Token（棋子）
```prisma
model Token {
  id            String   @id @default(uuid())
  mapId         String
  map           Map      @relation(fields: [mapId], references: [id])
  campaignId    String
  type          String   @default("character") // "character" | "npc" | "monster" | "object"
  name          String
  x             Float    @default(0)
  y             Float    @default(0)
  width         Int      @default(1)  // grid cells
  height        Int      @default(1)
  ownerId       String?  // 玩家ID (null = DM controlled)
  imageUrl      String?
  color         String   @default("#ffffff")
  hpCurrent     Int?
  hpMax         Int?
  ac            Int?
  darkvision    Int?
  speed         Int?
  isHidden      Boolean  @default(false) // 对玩家隐藏
  statusEffects Json?    @default("[]")
  characterId   String?  // 关联角色卡 ID
  createdAt     DateTime @default(now())
}
```

### 6.6 Character（角色卡）
```prisma
model Character {
  id                String   @id @default(uuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  campaignId        String
  campaign          Campaign @relation(fields: [campaignId], references: [id])
  name              String
  class             String
  level             Int      @default(1)
  race              String
  subrace           String?
  gender            String?
  age               Int?
  height            String?
  weight            String?
  alignment         String?
  faith             String?
  xp                Int      @default(0)
  proficiency       Int      @default(2)
  hpCurrent         Int
  hpMax             Int
  tempHp            Int      @default(0)
  ac                Int
  initiative        Int      @default(0)
  speed             Int      @default(30)
  darkvision        Int      @default(0)
  passivePerception Int      @default(10)
  spellcastingClass    String?
  spellcastingAbility  String?
  spellSaveDc       Int?
  spellAttackBonus  Int?
  hitDice           String?
  stats             Json     // {str, dex, con, int, wis, cha}
  statSaveProficiencies Json?
  skills            Json?
  skillProficiencies    Json?
  spells            Json?    // { _prepared: [...], Cantrip: [...], Lv1: [...], ... }
  spellSlots        Json?    // { "1": { max: 4, used: 0 }, ... }
  weapons           Json?
  armor             Json?
  currency          Json?
  equipment         Json?    // [{ name, qty, spell?, charges? }, ...]
  inventory         Json?    // legacy
  resistances       String?
  immunities        String?
  languages         String?
  toolProficiencies String?
  notes             String?
  imageUrl          String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### 6.7 CombatTracker / CombatParticipant（战斗追踪）
```prisma
model CombatTracker {
  id         String   @id @default(uuid())
  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id])
  mapId      String?
  isActive   Boolean  @default(true)
  round      Int      @default(1)
  currentTurnIndex Int @default(0)
  createdAt  DateTime @default(now())

  participants CombatParticipant[]
}

model CombatParticipant {
  id         String @id @default(uuid())
  combatId   String
  combat     CombatTracker @relation(fields: [combatId], references: [id])
  tokenId    String
  label      String?  // 自定义显示名
  initiative Int
  isActiveTurn Boolean @default(false)

  @@index([combatId])
}
```

### 6.8 DiceRoll（骰子记录）
```prisma
model DiceRoll {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  campaignId String
  campaign  Campaign @relation(fields: [campaignId], references: [id])
  diceType  String   // "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100"
  modifier  Int      @default(0)
  result    Int
  isPrivate Boolean  @default(false)
  label     String?  // 投骰原因/标签
  rolledAt  DateTime @default(now())
}
```

### 6.9 ChatMessage（聊天消息）
```prisma
model ChatMessage {
  id         String   @id @default(uuid())
  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id])
  userId     String
  username   String
  content    String
  type       String   @default("text") // "text" | "system" | "dice"
  isPrivate  Boolean  @default(false)
  createdAt  DateTime @default(now())
}
```

---

## 7. WebSocket 事件协议

### 7.1 房间管理
| 事件 | 方向 | 说明 |
|---|---|---|
| `room:join` | Client → Server | 加入战役房间 |
| `room:leave` | Client → Server | 离开战役房间 |
| `room:players` | Server → Client | 在线玩家列表更新 |

### 7.2 地图操作
| 事件 | 方向 | 说明 |
|---|---|---|
| `map:load` | Server → Client | 加载/切换地图 |
| `map:fog:update` | Client → Server → Broadcast | 战争迷雾更新（仅 DM） |
| `map:grid:update` | Client → Server → Broadcast | 网格设置更新（仅 DM） |

### 7.3 棋子操作
| 事件 | 方向 | 说明 |
|---|---|---|
| `token:create` | Client → Server → Broadcast | 放置棋子 |
| `token:move` | Client → Server → Broadcast | 拖动棋子位置 |
| `token:update` | Client → Server → Broadcast | 编辑棋子属性 |
| `token:delete` | Client → Server → Broadcast | 删除棋子 |
| `token:select` | Client → Server → Broadcast | 选中高亮 |

### 7.4 战斗操作
| 事件 | 方向 | 说明 |
|---|---|---|
| `combat:start` | Client → Server → Broadcast | 开启战斗（仅 DM） |
| `combat:end` | Client → Server → Broadcast | 结束战斗（仅 DM） |
| `combat:next_turn` | Client → Server → Broadcast | 下一回合（仅 DM） |
| `combat:prev_turn` | Client → Server → Broadcast | 上一回合（仅 DM） |
| `combat:add` | Client → Server → Broadcast | 添加参战单位（仅 DM） |
| `combat:remove` | Client → Server → Broadcast | 移除参战单位（仅 DM） |
| `combat:initiative:update` | Client → Server → Broadcast | 更新先攻值（仅 DM） |

### 7.5 骰子
| 事件 | 方向 | 说明 |
|---|---|---|
| `dice:roll` | Client → Server → Broadcast | 投骰并广播结果 |
| `dice:roll_private` | Client → Server | 私密投骰（仅发回投骰者 + DM） |

### 7.6 聊天
| 事件 | 方向 | 说明 |
|---|---|---|
| `chat:message` | Client → Server → Broadcast | 发送聊天消息 |
| `chat:whisper` | Client → Server → DM | 私聊 DM |

---

## 8. 目录结构

```
dnd-visualizer/
├── client/                     # 前端（React + Vite）
│   ├── public/
│   └── src/
│       ├── components/         # 通用组件
│       │   ├── map/            # 地图相关组件
│       │   ├── token/          # 棋子相关组件
│       │   ├── combat/         # 战斗追踪组件
│       │   ├── character/      # 角色卡组件
│       │   ├── dice/           # 骰子组件
│       │   └── chat/           # 聊天组件
│       ├── pages/              # 页面
│       │   ├── Dashboard/      # 战役列表首页
│       │   ├── Campaign/       # 战役主界面
│       │   └── Auth/           # 登录/注册
│       ├── stores/             # Zustand 状态
│       ├── hooks/              # 自定义 Hooks
│       ├── services/           # API 调用 + Socket 封装
│       ├── types/              # TypeScript 类型定义
│       └── utils/              # 工具函数
├── server/                     # 后端（Node.js + Express）
│   ├── src/
│   │   ├── routes/             # REST API 路由
│   │   ├── controllers/        # 控制器
│   │   ├── middleware/         # 中间件（认证、权限）
│   │   ├── socket/             # Socket.IO 事件处理
│   │   ├── services/           # 业务逻辑
│   │   └── utils/              # 工具函数
│   ├── prisma/                 # Prisma schema + migrations
│   └── tests/
├── shared/                     # 前后端共享类型
│   └── types/
├── docs/                       # 文档
├── docker-compose.yml          # PostgreSQL + Redis
├── package.json                # 根 package.json (workspace)
└── DESIGN.md                   # 本文件
```

---

## 9. 开发路线图

### Phase 1 — 基础框架（MVP）
- [ ] 项目脚手架（Monorepo, Vite, Express, Prisma, Docker）
- [ ] 用户认证（注册/登录，JWT）
- [ ] 战役 CRUD
- [ ] 地图上传与网格叠加
- [ ] 棋子放置与拖动
- [ ] Socket.IO 实时同步基础
- [ ] 基本角色卡（HP、属性查看）

### Phase 2 — 核心功能
- [ ] 战争迷雾
- [ ] 战斗追踪器
- [ ] 骰子系统
- [ ] 角色卡完整编辑
- [ ] 状态效果
- [ ] 聊天系统

### Phase 3 — 体验完善
- [ ] 移动端触屏适配
- [ ] 多地图支持
- [ ] 地图绘制工具
- [ ] 模板系统（预设怪物、NPC）
- [ ] 历史回放
- [ ] 数据导出/导入

---

## 10. 部署方案

```
前端 (Vite build) ───▶ Vercel / Netlify（静态托管）
后端 (Node.js)    ───▶ Railway / Render / 云服务器
PostgreSQL        ───▶ Supabase / RDS / Docker 自建
Redis             ───▶ Upstash / Docker 自建
```

---

*本文档将持续更新，各模块的具体功能细节在实现前进一步细化。*
