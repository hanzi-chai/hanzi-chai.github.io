# 汉字自动拆分系统

汉字自动拆分系统是用 [React](https://react.dev), [React Router](https://reactrouter.com) 以及 [Ant Design](https://ant.design) 实现的网页应用程序，能够根据您设计的汉字编码输入方案自动拆分并编码汉字，快速制作出一个属于您自己的输入方案。

目前，本系统的开发和使用主要在 QQ 群中讨论，欢迎点击[本链接](https://qm.qq.com/q/dcBbtQqLFC)加入，或搜索群号码 627379895 加入。

# 使用

汉字自动拆分系统的使用教程可以在[腾讯文档](https://docs.qq.com/doc/DZXZ2bXhISmh3dk1E)上查看。如您在使用过程中遇到任何问题，欢迎在 QQ 群中提出。

# 开发

仓库克隆到本地后，首先运行 `npm i` 安装依赖，然后运行 `npm run fetch` 来下载方案所需要的汉字数据。本项目使用 Vite 作为打包工具。

- `npm run dev` 在本地运行开发服务器，可以访问 <http://localhost:5173> 来查看；
- `npm run format` 使用 Prettier 格式化代码（无需手动运行，在每次提交代码前自动运行）；

代码推送至仓库时会自动构建并部署到 <https://chaifen.app>。
