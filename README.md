# 汉字自动拆分系统

汉字自动拆分系统是用 [React](https://react.dev)、[React Router](https://reactrouter.com) 以及 [Ant Design](https://ant.design) 实现的网页应用程序，能够根据您设计的汉字编码输入方案自动拆分并编码汉字，快速制作出一个属于您自己的输入方案。

目前，本系统的开发和使用主要在 QQ 群中讨论，欢迎点击[本链接](https://qm.qq.com/q/dcBbtQqLFC)加入，或搜索群号码 627379895 加入。

## 使用

汉字自动拆分系统的使用教程可以在[文档](https://docs.chaifen.app)上查看。如您在使用过程中遇到任何问题，欢迎在 QQ 群中提出。

## 开发

汉字自动拆分系统的开发文档位于 [docs.chaifen.app](https://docs.chaifen.app)，建议您在参与开发之前查看。

### 环境要求

- [Bun](https://bun.sh) 1.0+

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/hanzi-chai/hanzi-chai.github.io.git
cd hanzi-chai.github.io

# 安装依赖并下载汉字数据
bun install && bun run fetch

# 启动开发服务器
bun run dev
```

开发服务器启动后，访问 [localhost:5173](http://localhost:5173) 即可查看。

### 项目结构

本项目采用 monorepo 结构：

- **`packages/hanzi-chai/`** — 核心算法库，负责汉字拆分与编码，可独立发布到 npm
- **`src/`** — 基于算法库构建的 React 网页应用

### 常用命令

```bash
# 代码格式化（每次提交前自动运行，通常无需手动执行）
bun run format

# Biome 代码检查
bun run lint

# 运行算法库测试
bun run --filter hanzi-chai test
```

### 构建

```bash
bun run build:PAGES   # GitHub Pages 静态站点（部署到 chaifen.app）
bun run build:CF      # Cloudflare Workers
bun run build:BEX     # 浏览器扩展
bun run build:CLIENT  # 纯客户端静态站
```

代码推送至 `main` 分支时，会自动构建并部署到 [chaifen.app](https://chaifen.app)。
