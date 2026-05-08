# TODO — DND Campaign Visualizer

> 按优先级排序。勾选表示已完成。此文件用于快速接管项目后了解当前进度。

---

## Phase 1 — 基础框架（MVP）✅

- [x] 项目脚手架（Monorepo, Vite, Express, Prisma, Docker）
- [x] 用户认证（注册/登录，JWT）
- [x] 战役 CRUD（创建/编辑/删除/加入/离开）
- [x] 地图展示与网格叠加
- [x] 棋子放置与拖动
- [x] Socket.IO 实时同步基础
- [x] 基本角色卡展示（HP、属性查看）
- [x] Invite code 分享与复制

---

## Phase 2 — 核心功能完善

### 地图系统
- [x] **地图上传**：文件上传 + URL，Multer 存储
- [x] **网格设置面板**：网格宽高/像素大小/偏移/颜色/粗细，删除地图
- [x] **战争迷雾**：DM 绘制/擦除，实时同步，新地图默认透明（无雾）
- [x] **多地图切换**：标签栏切换，DM 管理
- [x] **地图缩放/平移优化**：触摸板手势支持、平滑过渡

### 棋子系统
- [x] **棋子拖动**：拖拽移动 + 实时同步
- [x] **棋子类型选择器**：PC/NPC/Monster/Object + 图标 + 颜色
- [x] **状态效果 UI**：增删状态效果（目前仅显示已有效果）
- [x] **血量条实时编辑**：一键 +/- HP
- [x] **隐藏/显示棋子**：DM 切换可见性

### 战斗追踪
- [x] **自动先攻排序**：按 initiative 降序
- [ ] **回合倒计时**：每回合可选时间限制
- [x] **战斗日志**：记录每回合操作
- [x] **DM 手动调整先攻**：点击 initiative 行内编辑

### 角色卡 ✅
- [x] **DND 5E 完整角色卡**：40+ 字段，6 标签页（Info/Stats/Combat/Skills/Spells/Equip）
- [x] **属性/技能**：6 属性 + 豁免熟练 + 18 项技能 + 熟练标记
- [x] **法术位追踪**：每环可视化圆点，点击消耗/恢复
- [x] **装备/物品**：武器/货币/装备
- [x] **视野/距离网格**：1格=5ft，darkvision 实线圈 + speed 虚线圈
- [x] **快捷投骰**：从角色卡直接投属性/技能骰

### 骰子系统
- [ ] **骰子投掷动画**：3D CSS 或 Canvas
- [x] **骰子组合**：Multi Mode（如 2d6+1d8）
- [x] **快捷预设**：localStorage 保存/加载投骰公式

### 聊天系统
- [x] **私聊 DM**：Whisper 切换按钮
- [x] **系统通知**：加入/离开/战斗事件自动消息
- [x] **消息类型区分完善**：系统/骰子/密语有独特样式和图标
- [x] **表情/快捷回复**：10 个 D&D 常用快捷回复

---

## Phase 3 — 体验完善

### 移动端适配
- [ ] **触屏拖拽**：触摸事件支持棋子拖动、地图平移
- [ ] **响应式布局**：手机端标签栏、折叠面板
- [ ] **虚拟键盘适配**：输入时视图不遮挡

### 视觉与交互
- [ ] **暗色主题优化**：统一 design tokens
- [ ] **地图标注工具**：箭头、圆圈、文字标注
- [ ] **粒子/动效**：骰子、战斗、法术效果
- [ ] **右键菜单**：棋子快捷操作

### DM 工具
- [ ] **模板系统**：预设怪物/NPC 模板
- [ ] **战役统计**：游戏时长、战斗次数、投骰统计
- [ ] **数据导出/导入**：JSON 存档
- [ ] **玩家视角预览**：DM 切换查看玩家画面（含迷雾）

### 多人体验
- [ ] **DM 相机同步**：同步玩家视角
- [ ] **在线玩家面板**：谁在线、角色对应
- [ ] **观察者模式**：只读观众

---

## 基础建设

### 测试
- [ ] **后端单元测试**：API route 测试
- [ ] **Socket 事件测试**：WebSocket 处理器测试
- [ ] **前端组件测试**：React Testing Library
- [ ] **E2E 测试**：Cypress / Playwright

### CI/CD
- [ ] **GitHub CI**：PR 自动 lint + type check + test
- [ ] **Docker 多阶段构建**：生产镜像
- [ ] **部署配置**：Vercel/Netlify + 后端部署脚本
- [ ] **环境变量治理**：dev/staging/prod 分离

### 代码质量
- [ ] **TypeScript 严格 any 消除**：API + stores 已处理，组件仍有残留
- [ ] **API 错误统一处理**：全局 error handler
- [ ] **请求验证**：Zod schema 全覆盖
- [ ] **日志系统**：pino / winston
- [ ] **Rate limiting**：API 频率限制

### 安全
- [ ] **输入消毒**：XSS 防护
- [ ] **CORS 加固**：生产环境严格配置
- [ ] **密码策略**：强度要求、重试限制
- [ ] **WebSocket 认证校验**：每个事件校验权限

---

## 已知问题

- [x] ~~创建战役时未加 DM 到 CampaignPlayer~~ → 已修复
- [x] ~~Socket token:move 跨房间广播~~ → 已修复
- [x] ~~fetchTokens 硬编码第一个地图~~ → 已修复
- [x] ~~无 loading skeleton~~ → 已修复
- [x] ~~后端无文件上传端点~~ → 已修复
- [x] ~~上传本地图片 imageUrl 校验失败~~ → z.string().url() → z.string().min(1)
- [x] ~~/uploads 未通过 Vite 代理~~ → vite.config.ts 已添加
- [x] ~~新地图迷雾默认全黑遮住图片~~ → 新地图默认透明（无雾）
- [x] ~~combat:prev_turn 缺失~~ → 已修复
- [x] ~~combat:initiative:update 缺失~~ → 已修复
- [x] ~~战斗 isActiveTurn 从未设置~~ → 已修复
- [x] ~~角色卡 UI 为空~~ → 完整 6 标签页 DND 5E 角色卡
- [x] ~~Token 隐藏按钮 display:none~~ → 已修复
- [x] ~~私聊 DM 缺 UI~~ → 已修复
- [x] ~~updateSchema 缺 width/height~~ → 已补充
- [x] Map fog/grid socket 使用 campaignId 更新（已改为单 mapId 更新）
- [x] Token delete 未校验 token 归属 campaign（已添加归属校验）
- [x] Character 模型 token 与 Map Token 关联（已添加 characterId 字段 + UI 下拉框）

---

## 开发建议

1. **接手后先读 CLAUDE.md**，包含架构、功能状态、Socket 事件映射、关键文件索引
2. **剩余工作按价值排序**：移动端适配 > 地图标注工具 > 暗色主题优化 > 模板系统 > 右键菜单
3. **每个新功能遵循模式**：shared type → Prisma → API route → Socket event → Store → Component
4. **测试和类型安全优先于新功能**
5. **Schema 变更后用 `prisma db push`（非 `migrate dev`）**，后者在非 TTY 环境会挂起
