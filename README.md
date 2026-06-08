# CET6备考助手 🎓

英语六级（CET-6）备考桌面应用，基于 Electron + React + TypeScript 开发。

## ✨ 功能特性

### 📚 题库管理
- 支持6种题型：听力选择、选词填空、仔细阅读、信息匹配、写作、翻译
- JSON格式导入题目
- 题目质量检测（9条规则）
- 多维度去重（SHA-256 + SimHash + MD5）

### 🎯 练习模式
- 快速练习、专项练习、模拟考试
- 实时评分和反馈
- 详细解析展示
- 练习统计

### 📖 错题本
- FSRS v4.1 间隔重复算法
- 智能复习调度
- 错题笔记
- 批量操作

### 📊 数据统计
- 学习趋势图表（ECharts）
- 分项正确率分析
- 难度分布统计
- 学习热力图

### 🏆 成就系统
- 15个成就，5个类别
- 等级系统（10级）
- 经验值奖励

### ⚙️ 其他功能
- 深色/浅色主题
- 数据导出/导入
- 题源管理（爬虫框架）

## 🛠️ 技术栈

- **前端**: React 19 + TypeScript + Ant Design 6
- **后端**: Electron 42 + Node.js
- **数据库**: SQLite + Prisma 6
- **状态管理**: Zustand（预留）
- **图表**: ECharts
- **构建**: Vite + Electron Forge

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- npm >= 9

### 安装依赖
```bash
npm install
```

### 启动开发
```bash
npm start
```

### 打包应用
```bash
npm run make
```

## 📁 项目结构

```
cet6-prep/
├── src/
│   ├── main/              # 主进程
│   │   ├── db/            # 数据库
│   │   ├── ipc/           # IPC通信
│   │   ├── practice/      # 练习服务
│   │   ├── review/        # 复盘服务
│   │   ├── stats/         # 统计服务
│   │   ├── home/          # 首页服务
│   │   ├── settings/      # 设置服务
│   │   ├── scraper/       # 爬虫服务
│   │   ├── gamification/  # 成就系统
│   │   └── main.ts        # 入口
│   ├── preload/           # 预加载脚本
│   └── renderer/          # 渲染进程
│       └── src/
│           ├── pages/     # 页面组件
│           └── App.tsx    # 主应用
├── prisma/                # 数据库Schema
├── resources/             # 资源文件
└── package.json
```

## 📝 数据库模型

- **Question**: 题目
- **AudioFile**: 音频文件
- **StudyRecord**: 学习记录
- **WrongQuestion**: 错题
- **UserStats**: 用户统计
- **UserSetting**: 用户设置
- **ScrapingTask**: 爬虫任务
- ...

## 🤝 Contributing

欢迎提交 Issue 和 Pull Request！

## 📄 License

[MIT](LICENSE)

## 🙏 致谢

- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [Ant Design](https://ant.design/)
- [Prisma](https://www.prisma.io/)
- [FSRS](https://github.com/open-spaced-repetition/fsrs4anki)
