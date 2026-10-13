# Mini Program Naming Map

`miniprogram-project/services/api.js` 使用以下内部简称：

| Short name | Meaning |
| --- | --- |
| `posts` | `getPosts` |
| `detail` | `getPostDetail` |
| `categories` | `getCategories` |
| `msgs` | `getComments` |
| `msg` | `createComment` |
| `post` | `createPost` |
| `image` | `uploadImage` |
| `video` | `uploadVideo` |

未列出的 API 名称保持原样。

## 登录与注册

小程序页面地址保持 `/pages/login/index`，页面内切换登录和注册模式，不新增注册页面路由。上表记录 JavaScript API 函数命名；HTTP 地址固定由后端路由提供，不通过后台文案设置修改。

| API function | HTTP request (default `/api` prefix) | Purpose |
| --- | --- | --- |
| `login` | `POST /api/auth/login` | 登录 |
| `register` | `POST /api/auth/register` | 邮箱验证码及图形验证码校验后注册 |
| `emailConfig` | `GET /api/auth/email-config` | 查询邮件功能是否启用 |
| `sendEmailCode` | `POST /api/auth/send-email-code` | 发送邮箱验证码 |
| `captcha` | `GET /api/auth/captcha?format=png` | 获取适用于小程序的图形验证码 |

新增注册文案使用后台小程序界面映射的 `labels`、`placeholders`、`messages` 分组，键为 `register*` 及 `labels.loginSwitch`。服务端返回的具体错误消息沿用接口响应；请求层通用错误沿用现有处理。
