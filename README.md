# 校园墙 Campus Wall

> **当前版本：V1.1.0.1**
>
> 一个面向校园的信息交流动态网站，全栈单服务架构，支持信息流、评论点赞、内容审核、用户角色权限、注册登录、第三方 OAuth 登录、支付、AI 视觉实名认证等完整功能。

![首页预览](docs/homepage.png)

**技术栈**: Next.js 14 (App Router) + Prisma ORM + PostgreSQL (Neon) + TailwindCSS。前后端同源，一键部署到 Vercel。

## 📌 版本说明

| 版本 | 状态 | 说明 |
|---|---|---|
| **V1.1.0.1** | ✅ 最新 | 角色管理批量删除、细节优化与稳定性提升 |
| V1.1.0 | ⏹️ 上一版 | 核心功能集成熟可用 |

## ✨ 功能特性

### 核心功能
- 📝 **帖子发布**: 标题、内容、分类、匿名发布、图片支持
- 🔍 **内容搜索**: 按标题/内容搜索，分类筛选
- 💬 **评论系统**: 楼中楼回复、点赞互动
- 🔥 **今日热榜**: 基于点赞数的热门帖子排行
- 📢 **滚动公告**: 首页顶部可配置的滚动公告栏

### 用户系统
- 🔐 **注册/登录**: 邮箱密码 + JWT 认证
- 🌐 **第三方登录**: GitHub / Google / 微信 / QQ / 微博 OAuth
- 👤 **个人中心**: 资料编辑、头像上传、统计数据
- ⭐ **诚信分系统**: 违规扣分、加分规则、分数趋势图
- 🔔 **消息通知**: 站内铃铛通知 + 可选邮件通知

### 管理后台
- 📊 **数据概览**: 用户数、帖子数、待审核、评论数
- 📋 **内容审核**: 帖子审核通过/拒绝、置顶管理
- 👥 **用户管理**: 搜索、封禁/解封、角色分配
- 🚫 **封禁系统**: 预设违规类型 + 自定义类型、自定义扣分、自定义封禁时长
- 📢 **通知发布**: 全站通知、按角色发送、强调通知、邮件通知
- 📜 **通知历史**: 已发通知的查看、编辑、删除
- ⚙️ **站点设置**: 站点信息、SMTP 邮件、内容设置、分类配置
- 📄 **协议管理**: 关于我们、用户协议、隐私政策在线编辑
- 📝 **申诉审核**: 用户封禁申诉的审核处理

### 支付系统
- 💳 **置顶推广**: 付费置顶帖子
- 💰 **打赏作者**: 给帖子作者打赏
- 🎫 **会员订阅**: 会员功能（预留）
- 🔌 **支付抽象层**: Mock 实现 + 支付宝/微信支付接入点

### 安全与权限
- 🛡️ **角色权限**: USER / ADMIN / SUPER_ADMIN 三级权限
- 🚫 **敏感词过滤**: 可配置的敏感词列表
- 📝 **审计日志**: 管理员操作记录
- 🔒 **JWT 鉴权**: 接口权限守卫

## 📱 响应式设计

完美适配移动端与桌面端：
- **移动端**: 640px 宽度居中布局，底部导航栏，触摸友好
- **桌面端**: 最大 1024px 宽度，管理后台采用侧边栏 + 内容区布局

## 🗂️ 目录结构

```
campus-wall/
├── prisma/
│   ├── schema.prisma       # User/Account/Post/Comment/Like/Order/AuditLog
│   └── seed.ts             # 初始化超级管理员 + 示例数据
├── src/
│   ├── app/
│   │   ├── api/            # 所有后端接口 (Next.js Route Handlers)
│   │   │   ├── auth/       # 注册/登录/me + OAuth 入口与回调
│   │   │   ├── posts/ comments/ users/
│   │   │   ├── payment/    # 订单 + Mock 支付 + 支付异步通知
│   │   │   └── admin/      # 管理后台 (角色守卫)
│   │   ├── (页面)           # 首页/登录/注册/帖子/发布/个人/管理/OAuth/支付
│   │   └── layout.tsx globals.css
│   ├── components/         # Header, PostCard, BottomNav, AdminPanel
│   └── lib/
│       ├── prisma.ts       # Prisma 单例 (serverless 友好)
│       ├── server-auth.ts  # JWT 签发/校验 + requireUser/requireRole
│       ├── oauth.ts        # 5 个 OAuth 提供方对接
│       ├── payment/        # 支付抽象层 + Mock/Alipay/WechatPay
│       ├── payment-service.ts  # 订单业务逻辑
│       ├── admin-service.ts    # 管理后台业务逻辑
│       ├── notification-service.ts # 通知服务
│       ├── credibility-service.ts  # 诚信分服务
│       ├── api-response.ts # 错误响应 + requestOrigin 辅助
│       ├── api.ts          # 前端 fetch 客户端 (带 JWT)
│       └── auth-context.tsx # 前端登录态上下文
├── docs/                   # 截图与文档
├── vercel.json             # Vercel 部署配置
└── package.json
```

## 🚀 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env.local
# 在 .env.local 填入 DATABASE_URL (Neon 连接串) 和 JWT_SECRET

# 3. 生成 Prisma Client + 推送表结构 + 初始化数据
npm run prisma:generate
npm run prisma:db:push
npm run prisma:db:seed
#   seed 会创建超级管理员 (admin@campus.edu / Admin@12345)
#   以及示例用户 (demo@campus.edu / Demo@12345)

# 4. 启动开发服务器
npm run dev
# → http://localhost:3000 (前后端同源, API 在 /api/*)
```

## 部署到 Vercel + Neon (推荐路径)

### 1. 准备 Neon 数据库

1. 访问 https://neon.tech 注册并登录
2. 新建一个 Project, 区域选离 Vercel 近的 (如 `AWS Asia Pacific (Singapore)`)
3. 在 Connection Details 拿到连接串 (勾选 "Pooled connection" 更适合 serverless)
   - 形如 `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`
4. 复制保存

### 2. 推送代码到 GitHub

```bash
# 在项目根目录
git init
git add .
git commit -m "校园墙初始化"
# 在 GitHub 网页新建一个空仓库 campus-wall (不要勾 README/gitignore)
git remote add origin https://github.com/<你的用户名>/campus-wall.git
git branch -M main
git push -u origin main
```

或者用 `gh` CLI:

```bash
gh auth login
gh repo create campus-wall --public --source=. --push
```

### 3. 初始化数据库表结构

Prisma 表结构需要在 Neon 上初始化。两种方式二选一:

**方式 A (本地连库)**: 把 Neon 连接串填到 `.env.local`, 运行 `npm run prisma:db:push && npm run prisma:db:seed`。

**方式 B (用 Prisma 数据浏览器)**: Neon 控制台自带 SQL Editor, 也可手动跑 schema.prisma 转换出的 SQL (但 seed 推荐用方式 A 跑)。

### 4. 在 Vercel 导入项目

1. 访问 https://vercel.com 用 GitHub 账号登录
2. 点击 "Add New Project" → 选刚才的 `campus-wall` 仓库
3. Vercel 会自动识别为 Next.js 项目, **直接点 Deploy 即可先跑通构建** (此时代码会拉起, 但因没配 DATABASE_URL 接口会报错, 这是正常的, 下一步补环境变量)

### 5. 在 Vercel 配置环境变量

进入 Vercel 项目 → Settings → Environment Variables, 添加以下变量 (Production + Preview + 全选):

| Key | Value | 说明 |
|---|---|---|
| `DATABASE_URL` | Neon 连接串 | 必填 |
| `JWT_SECRET` | 32+ 字符随机串 | 必填, 可用 `openssl rand -hex 32` 生成 |
| `JWT_EXPIRES_IN` | `7d` | |
| `SEED_SUPER_ADMIN_EMAIL` | `admin@campus.edu` | |
| `SEED_SUPER_ADMIN_PASSWORD` | `Admin@12345` | 部署后请改 |
| `PAYMENT_PROVIDER` | `mock` | 默认模拟支付 |
| `NEXT_PUBLIC_API_BASE` | (空) | 留空, 同源 |

可选 (按需配置才会启用):

| Key | 说明 |
|---|---|
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth: https://github.com/settings/developers |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth: https://console.cloud.google.com/apis/credentials |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | 微信开放平台网站应用 |
| `QQ_APP_ID` / `QQ_APP_KEY` | QQ 互联 |
| `WEIBO_APP_KEY` / `WEIBO_APP_SECRET` | 微博开放平台 |
| `ALIPAY_APP_ID` / `ALIPAY_PRIVATE_KEY` / `ALIPAY_PUBLIC_KEY` | 支付宝 (需企业资质 + 装 alipay-sdk) |
| `WECHATPAY_MCH_ID` / `WECHATPAY_API_V3_KEY` 等 | 微信支付 V3 (需企业商户号 + 装 wechatpay-node-v3) |

> 第三方 OAuth 回调地址填 Vercel 部署后的域名, 例: `https://campus-wall.vercel.app/api/auth/callback/github`

### 6. 重新部署

环境变量配完后, 回到 Vercel Deployments, 点最近一次部署的 "Redeploy"。等 1~2 分钟构建完成, 打开 Production 域名即可访问。

### 7. 创建超级管理员

如果第 3 步用的是方式 A (本地 seed), 超级管理员已经创建好了, 直接用 `admin@campus.edu / Admin@12345` 登录。

如果没 seed, Vercel 上没法直接跑 `tsx prisma/seed.ts` (serverless 没常驻命令), 推荐做法: **本地用 Neon 连接串跑一次 `npm run prisma:db:seed`** (Neon 是公网可达的, 本地连过去 seed 即可), 完成后生产环境就有这个管理员了。

## 主要 API 速览 (同源 /api/*)

- `POST /api/auth/register` `POST /api/auth/login` `GET /api/auth/me`
- `GET /api/auth/oauth/:provider` `GET /api/auth/callback/:provider`
- `GET /api/posts` (公开信息流) `GET /api/posts/:id` `POST /api/posts` `POST /api/posts/:id/like`
- `POST /api/comments` `DELETE /api/comments/:id`
- `POST /api/payment/orders` `POST /api/payment/mock/pay/:id` `POST /api/payment/notify/:provider`
- `GET /api/admin/stats` `GET /api/admin/moderation` `POST /api/admin/posts/:id/approve` ... (`ADMIN+`)
- `PATCH /api/admin/users/:id/role` (`SUPER_ADMIN`)

除标记公开的接口外, 均需 `Authorization: Bearer <token>`。

## 说明

- 帖子默认对 `USER` 走审核流, 管理员发帖直接通过; 可在 `src/app/api/posts/route.ts` 调整。
- 图片上传用 URL 形式 (本仓库不含对象存储), 可自行接 S3/OSS 后把链接贴到发布框。
- Vercel serverless 函数有冷启动 (~1s), 偶发首次访问延迟属正常。

## 📋 更新日志 (Changelog)

### V1.1.0.1 (2026-09-26)

本次版本在 V1.1.0 基础上进行了功能增强与细节优化，重点完善了管理后台的角色管理能力，并对整体体验做了打磨。

#### 🆕 新增功能

- **角色管理批量删除**：管理后台「角色管理」模块新增批量选择 + 批量删除能力，支持一次选中多个角色并统一删除，大幅提升管理员清理冗余角色的效率。
- **版本号可视化**：站点页脚统一展示当前版本号（自动读取 `package.json`），便于线上版本追溯。

#### ✨ 功能特性全景

本版本包含的完整功能模块如下：

**核心内容**
- 📝 帖子发布：标题、内容、分类、匿名发布、图片支持
- 🔍 内容搜索：按标题/内容搜索，分类筛选
- 💬 评论系统：楼中楼回复、点赞互动
- 🔥 今日热榜：基于点赞数的热门帖子排行
- 📢 滚动公告：首页顶部可配置的滚动公告栏
- ⭐ 收藏功能：帖子收藏 / 取消收藏

**用户系统**
- 🔐 注册/登录：邮箱密码 + JWT 认证，邮箱验证码注册
- 🔑 忘记密码：邮箱验证码找回密码
- 🌐 第三方登录：GitHub / Google / 微信 / QQ / 微博 / 华为 / 支付宝 / 百度 / 抖音 OAuth 聚合登录
- 👤 个人中心：资料编辑、头像上传、统计数据
- ⭐ 诚信分系统：违规扣分、加分规则、分数趋势图
- 🔔 消息通知：站内铃铛通知 + 可选邮件通知
- 📛 实名认证：AI 视觉初审（支持 OpenAI / DeepSeek / 豆包 / 通义千问）+ 人工复核，自定义认证模板与字段框选

**管理后台**
- 📊 数据概览：用户数、帖子数、待审核、评论数
- 📋 内容审核：帖子审核通过/拒绝、置顶管理
- 🗑️ 帖子管理：搜索、编辑、删除、状态筛选、分页
- 💬 评论管理：评论审核与删除
- 👥 用户管理：搜索、封禁/解封、角色分配、批量操作、Excel 导入用户
- 🎭 角色管理：角色增删改查、**批量删除**、权限组配置
- 🚫 封禁系统：预设违规类型 + 自定义类型、自定义扣分、自定义封禁时长
- 📢 通知发布：全站通知、按角色发送、强调通知、邮件通知
- 📜 通知历史：已发通知的查看、编辑、删除
- ⚙️ 站点设置：站点信息、SMTP 邮件、内容设置、分类配置、连接测试、邮件测试
- 📧 邮件模板：自定义邮件模板，支持变量替换
- 📄 协议管理：关于我们、用户协议、隐私政策在线编辑
- 📝 申诉审核：用户封禁申诉的审核处理
- 🖼️ 认证模板管理：上传认证样图、框选识别字段、模板激活切换

**支付系统**
- 💳 置顶推广：付费置顶帖子
- 💰 打赏作者：给帖子作者打赏
- 🎫 会员订阅：会员功能（预留）
- 🔌 支付抽象层：Mock 实现 + 支付宝/微信支付接入点

**安全与权限**
- 🛡️ 角色权限：USER / STUDENT / TEACHER / ADMIN / SUPER_ADMIN 五级权限，细粒度权限组
- 🚫 敏感词过滤：可配置的敏感词列表
- 📝 审计日志：管理员操作记录
- 🔒 JWT 鉴权：接口权限守卫

**体验优化**
- 📱 响应式设计：移动端 640px 居中布局 + 底部导航，桌面端最大 1024px + 侧边栏管理后台
- 🖼️ 图片压缩：前端 Canvas 压缩（最大宽度 1024px，质量 0.7），减少上传体积
- 📧 邮件服务：SMTP 发送，兼容国内服务商 TLS 配置
- 🛡️ 强制联系弹窗：封禁用户触发联系管理员弹窗

#### 🐛 修复与优化

- 优化角色管理交互，新增批量删除后即时刷新列表
- 页脚版本号与 `package.json` 保持同步
- 整体细节打磨与稳定性提升

#### 📦 技术栈

- Next.js 14 (App Router)
- Prisma ORM + PostgreSQL (Neon)
- TailwindCSS
- JWT 认证 + bcryptjs 密码哈希
- Nodemailer 邮件服务
- Zod 参数校验
- xlsx 用户导入

---

### V1.1.0

- 核心功能集首次完整发布：信息流、评论、点赞、用户系统、OAuth 登录、管理后台、支付系统、诚信分、通知、内容审核、角色权限等。
