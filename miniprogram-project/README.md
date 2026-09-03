# 小毛毛微信小程序

原生微信小程序客户端，复用仓库中的 Express API，与现有 Web 端共享账号、帖子、评论、分类和媒体数据。

## 本地打开

1. 用微信开发者工具导入 `miniprogram-project/`。
2. 将 `project.config.json` 中的 `appid` 改成实际小程序 AppID。
3. 将 `config.js` 的 `apiBaseUrl` 改成生产 API 地址，例如 `https://example.com/api`。
4. 在微信公众平台为该 HTTPS 域名配置 request / uploadFile / downloadFile 合法域名。
5. 开发阶段如需临时跳过域名校验，可在开发者工具本地设置中关闭合法域名检查；正式上传前必须恢复真实域名配置。

## 审核模式

后台“系统设置 → 小程序审核模式”开启后：

- 小程序首页和笔记详情仍可浏览已发布内容。
- 登录、个人页、发帖、评论等入口不显示。
- 每个小程序 API 请求都携带 `X-Client-Platform: wechat-miniapp`。
- 后端会再次执行只读校验，不能仅通过修改前端绕过。

## 媒体上传

- 图片：`wx.chooseMedia` → `/api/upload/single`。
- 视频：`wx.chooseMedia` → `/api/upload/video`。
- 视频封面优先使用微信返回的 `thumbTempFilePath`，先作为图片上传，再随帖子 `video.coverUrl` 一起提交。

## 当前首版范围

- 首页分类 + 两列瀑布流
- 笔记图文 / 视频详情
- 现有毛毛号密码登录
- 原生图片 / 视频选择上传与发布
- 评论浏览与发布
- 个人页 / 退出登录
- 小程序审核只读模式
