# inn-welcome 客栈迎新活动插件

> 活动名称：**客栈迎新，试玩领宝石**
> 活动时间：6月26日 15:00 — 6月29日 23:59

## 功能

玩家输入昵称 + 游戏标签（`#` 开头大写字母数字），调用 5 款游戏的排行榜成绩并提交；管理员通过隐藏 URL 查看提交、按权重计算权重分、按权重分加权抽奖。

## 架构

- **活动内容**：`activities/inn-welcome/`（config.json + 页面），被活动中心自动发现
- **后端逻辑**：本插件（feature 类型），独立 storage 分区 `inn-welcome:`
- **跨插件取数**：由前端 fetch `/api/leaderboard/:game/user/:nickname` 完成，后端只存成绩快照，不直接访问排行榜插件（符合插件隔离铁律）

## 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/activities/inn-welcome/adminoline` | 隐藏管理员入口（无入口按钮，仅 URL 可达） |
| POST | `/api/inn-welcome/submit` | 玩家提交成绩 `{nickname, tag, scores}` |
| GET | `/api/inn-welcome/submissions` | 查看全部提交 |
| GET | `/api/inn-welcome/weights` | 读取游戏权重 |
| POST | `/api/inn-welcome/weights` | 设置权重并重算权重分 `{gameId: weight}` |
| POST | `/api/inn-welcome/lottery` | 加权抽奖 `{count}` |
| GET | `/api/inn-welcome/lottery/result` | 读取抽奖结果 |

## 权重分算法

每游戏归一化到 0–1（以所有提交者中最佳成绩为基准）：
- `desc` / `sum`：玩家分 ÷ 最佳分
- `asc`（如扫雷用时）：最佳分 ÷ 玩家分
- 无成绩 → 0；最佳者 = 1

**权重分 = Σ(游戏权重 × 归一化分)**，游戏权重默认均 0.2，管理员可调。

## 抽奖

按权重分加权、无放回抽样 N 人（管理员设置中奖人数），`crypto` 随机保证公平。

## 数据键

- `submission:{nickname}` — 单条提交快照（同昵称覆盖）
- `weights` — `{ gameId: weight }`
- `lottery:result` — 上次抽奖结果

## 安全说明

管理员页面无鉴权（与现有活动管理端点一致），仅靠 URL 隐藏。如需鉴权可后续在路由加 token 校验。
