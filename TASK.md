# 龙虾王国 - 像素游戏

## 概述
一个像素风格的龙虾王国可视化游戏，展示 OpenClaw AI 助手的各个 Discord 频道/子区的活跃状态。每个频道/子区对应一只龙虾，根据 token 消耗量决定等级和外观。

## 技术栈
- 后端: Node.js + Express
- 前端: 纯 HTML5 Canvas 像素游戏
- 端口: 3995
- 部署路径: /lobster-kingdom/

## 三个区域
1. **工作区** (左侧) - 当前正在运行的 session（有活跃的 AI 对话）
2. **休息区** (中间) - 今日活跃但当前不在运行的
3. **躺平区** (右侧) - 今日没有活跃的

## 龙虾等级系统 (根据累计 token 消耗)
| 等级 | Token 范围 | 大小 | 皮肤颜色 |
|------|-----------|------|---------|
| 1 虾米 | 0 - 1M | 16px | 灰色 |
| 2 小虾 | 1M - 10M | 20px | 绿色 |
| 3 中虾 | 10M - 50M | 26px | 蓝色 |
| 4 大虾 | 50M - 100M | 32px | 紫色 |
| 5 虾王 | 100M - 200M | 40px | 红色+金边 |
| 6 虾皇 | 200M+ | 48px | 金色+光环 |

## 数据来源
后端 API `/api/lobsters` 返回所有龙虾数据。数据从 OpenClaw session 文件解析。

### API 响应格式
```json
{
  "lobsters": [
    {
      "id": "1479839818190950555",
      "name": "频道名称",
      "tokens": 372051690,
      "messages": 195,
      "level": 6,
      "zone": "rest",
      "lastActive": "2026-03-10T05:09:16.230Z"
    }
  ],
  "stats": {
    "total": 116,
    "working": 3,
    "resting": 25,
    "idle": 88
  }
}
```

## 前端要求

### 像素风格
- 8-bit 像素艺术风格
- 像素字体 (用 CSS pixel font 或 canvas 像素渲染)
- 复古配色方案
- 龙虾用像素精灵图绘制（不用图片，纯 canvas 绘制像素龙虾）

### 交互
- 龙虾在各自区域内随机游走（像素级移动）
- 鼠标悬停显示龙虾信息（频道名、等级、token数）
- 点击龙虾弹出详情卡片
- 区域之间有像素风格的分隔线和标牌
- 龙虾偶尔做小动作（挥钳子、吐泡泡）

### 布局
- 全屏 Canvas
- 顶部: "🦞 龙虾王国" 标题 + 统计信息
- 三个区域从左到右排列，每个区域有像素风格的标牌
- 底部: 图例（各等级龙虾示意）

### 动画
- 龙虾缓慢随机游走
- 工作区龙虾头顶有旋转的齿轮/闪烁的星星表示正在工作
- 休息区龙虾偶尔打哈欠(zzz气泡)
- 躺平区龙虾趴着不动或偶尔翻身
- 高等级龙虾有光环/粒子效果

## 项目结构
```
lobster-kingdom/
  server.js          ← Express 入口 (<100行)
  routes/
    api.js           ← /api/lobsters 数据接口
  services/
    session-parser.js ← 解析 OpenClaw session 数据
  config.json        ← 配置（端口、session路径、等级阈值等）
  public/
    index.html       ← HTML 骨架
    css/style.css    ← 像素风格样式
    js/
      game.js        ← 游戏主循环
      lobster.js     ← 龙虾类（绘制、动画、行为）
      renderer.js    ← Canvas 渲染器
      ui.js          ← UI 层（信息面板、图例）
      api.js         ← 前端 API 调用
```

## 注意事项
- basePath 设为 `/lobster-kingdom`，所有静态资源和 API 都在这个路径下
- 前端每 30 秒刷新一次数据
- session 文件路径通过 config.json 配置，本地开发用本地路径，部署后用服务器路径
- 不需要数据库，直接读 session 文件
