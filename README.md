# Embeat UI

Embeat 本地网页界面。前端提供搜索、按流派/每周发现浏览、多曲电台、历史记录，并可将推荐结果保存到网易云或酷狗歌单。推荐逻辑调用 [Embeat ML 后端](https://github.com/gdstudio-org/Embeat)（需自行准备）和 Qdrant 向量数据库。

> **FastAPI + React 重构版本**：https://github.com/lkwodp/embeat-ui-refactor

## 目录结构

```text
embeat-ui/
├── server.py          # 主服务（HTTP API + 静态页面）
├── config.py          # 运行时配置（环境变量 / .env）
├── artist_aliases.py  # 中英文艺人别名映射（含 MusicBrainz 数据加载）
├── kugou_client.py    # 酷狗兼容 API 客户端
├── app_database.py    # SQLite 用户 / 凭据 / 历史 / 偏好存储
├── music_metadata.py  # Apple 元数据解析
├── music_matching.py  # 曲名 / 艺人相似度匹配
├── export_manager.py  # 网易云 / 酷狗歌单导出
├── static/            # 前端页面
├── tests/             # 单元测试
└── data/              # 运行时数据（勿提交到 Git）
```

## 依赖

- Python 3.10+，`pip install -r requirements.txt`（`cryptography` 为必需依赖）。
- Embeat ML 后端：包含 `infer/` 目录的仓库（提供 `EmbeatDatabase` 与 `qdrant_models`）。
- Qdrant 向量数据库，含 `spotify_tracks` 集合。
- （可选）网易云 / 酷狗兼容 API 服务，用于登录与歌单写入。

## 配置

复制 `.env.example` 为 `.env`，按需修改；也可直接使用同名环境变量（环境变量优先级更高）。

| 变量                  | 默认值                    | 说明                                                                                                                        |
| --------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `EMBEAT_ROOT`       | `../Embeat`             | Embeat ML 后端仓库路径（含`infer`）                                                                                       |
| `QDRANT_URL`        | `http://127.0.0.1:6333` | Qdrant 地址（远程部署可改为服务器地址）                                                                                     |
| `QDRANT_API_KEY`    | 空                        | Qdrant API Key（如启用）                                                                                                    |
| `QDRANT_COLLECTION` | `spotify_tracks`        | 使用的集合名                                                                                                                |
| `QDRANT_TIMEOUT`    | `30`                    | Qdrant 请求超时（秒）                                                                                                       |
| `NETEASE_API_URL`   | 空                        | 界面默认填写的网易云兼容 API 地址                                                                                           |
| `KUGOU_API_URL`     | 空                        | 界面默认填写的酷狗兼容 API 地址                                                                                             |
| `PROXY_URL`         | 空                        | 界面默认填写的 HTTP 代理（本机直连被拦截时使用）                                                                            |
| `MB_LOOKUP_PATH`    | 空                        | MusicBrainz 别名数据库（`mb_lookup.db`）路径；留空时自动使用 `data/mb_lookup.db`                                         |
| `UI_HOST`           | `0.0.0.0`               | 网页服务监听地址                                                                                                            |
| `UI_PORT`           | `8765`                  | 网页服务端口                                                                                                                |
| `INVITE_CODE`       | 空                        | 注册邀请码，留空允许开放注册                                                                                                |
| `AUTH_ENABLED`      | `true`                  | 是否启用账号登录/注册；`false` 时访问级别由 `PAIRING_CODE` 决定                                                         |
| `PAIRING_CODE`      | 空                        | `AUTH_ENABLED=false` 时的访问控制：留空为开放模式（任何人直接可用），设为固定码则为配对模式（浏览器首次访问需输入配对码） |

## 启动

```powershell
# 启动 Qdrant 后运行 UI
.\start.ps1

# 或一键启动 Qdrant + UI
.\start-all.ps1
```

浏览器打开：

```text
http://127.0.0.1:8765
```

平台账号配置页面：

```text
http://127.0.0.1:8765/settings
```

`start-all.ps1` 的行为由环境变量控制：

- `QDRANT_DIR`：含 `qdrant.exe` 的目录。未设置时若本地没有运行中的 Qdrant，脚本会报错并提示改用远程 Qdrant。
- `QDRANT_HEALTH_URL`：Qdrant 健康检查地址，默认 `http://127.0.0.1:6333/collections/spotify_tracks`。远程部署可改为服务器地址。
- `UI_URL`：UI 健康检查地址，默认 `http://127.0.0.1:8765`。
- `EMBEAT_CONDA_ENV`（`start.ps1` 使用）：conda 环境名，默认 `embeat`。

Qdrant 未启动时，脚本会以 `QDRANT_DIR` 下的 `embeat_qdrant_db` 作为存储目录在后台启动，并等待集合加载完成后再启动 UI。

## 搜索策略

- 主页支持“歌曲”“歌手”“歌曲+歌手”三种查询方式。
- 曲名搜索会自动尝试简体和繁体，并先展示 Qdrant 中的候选版本和实际艺人名。
- 歌手推荐支持中英文艺人名；后端会先解析为 Qdrant 中的标准艺人和 `artist_idx`，然后基于该歌手曲目的整体声学特征生成推荐。
- “歌曲+歌手”会使用艺人别名缩小候选范围；唯一候选直接推荐，存在录音室、Live 或翻唱等多版本时由用户确认。
- 选择候选后使用 Spotify Track ID 精确执行推荐。
- Track2Vec 未开源时，歌单关联召回自动跳过，其余召回正常工作。

## 保存到网易云或酷狗歌单

推荐结果支持逐首勾选，然后点击“保存到歌单”，可选择“网易云”“酷狗”或“两个都保存”。双平台模式下两边分别匹配和写入，一边失败时仍保留另一边的成功结果。

网易云需要准备：

- 一个兼容 NeteaseCloudMusicApi 的服务地址；
- 如果本机直连被防火墙拦截，填写本机 HTTP 代理；
- 当前网易云登录 Cookie；
- 有权编辑的目标歌单，或者直接创建新歌单。

首次访问会显示注册/登录门禁。登录使用 PBKDF2-SHA256 密码哈希和 HttpOnly 会话 Cookie；可通过 `.env` 的 `INVITE_CODE` 开启邀请码注册。网易云 Cookie 和酷狗 Token 只提交到后端，使用 Fernet 加密后写入 `data/embeat.db`，密钥单独保存在 `data/secret.key`，前端和 `localStorage` 均不会保存或回显敏感值。建议仅在可信 LAN 使用，或通过 Tailscale/WireGuard 暴露服务。

设置 `AUTH_ENABLED=false` 可关闭账号登录/注册，此时访问级别由 `PAIRING_CODE` 决定：

- **开放模式**（`PAIRING_CODE` 留空）：无需任何认证，访客打开页面即可使用，适合公开公益部署。所有访客共享本地 `local` 用户的凭据与记录。
- **配对模式**（`PAIRING_CODE` 设为固定码）：浏览器首次访问时需输入配对码，成功后获得长期有效的 HttpOnly 设备 Cookie；未完成配对的访客无法读写平台凭据，配对码不随页面下发。

界面提供 9 种主题模式：跟随系统、录音室浅色、海风蓝调、林间唱片、石墨工作台、日光放映室、深夜黑胶、莓果夜色和高对比。主题及自定义强调色色相会写入当前用户的 SQLite 偏好，同时保留浏览器本地缓存用于首屏无闪烁，并通过 `storage` 事件在同一浏览器的多个标签页间同步。主题菜单内置 WCAG AA 核心文字对比度检查；`auto` 模式会随系统深浅色实时切换。

匹配会尝试原始名称、简体名称和去除括号后缀的曲名，并对网易云搜索候选按曲名与艺人相似度评分。导入窗口会显示逐首匹配和写入进度。

酷狗凭据与网易云凭据一样，按当前 Embeat 用户加密保存在 `data/embeat.db`。页面只显示登录状态，不回显 Cookie、Token、userid、dfid 或 mid；凭据失效后需在页面重新连接。

`/settings` 同时支持直接填写 Cookie 和手机号验证码登录。验证码由配置的网易云或酷狗兼容 API 发送；登录成功后，后端会提取并校验 Cookie/Token，再使用 Fernet 加密写入当前用户的数据库记录。验证码不会写入数据库，手机号会随平台凭据保存以便下次使用。

酷狗匹配会尝试原名、简体名、艺人中英文别名和去除括号后缀的曲名。写入前会读取目标歌单已有歌曲哈希，准确跳过重复歌曲。同时保存到两个平台时，网易云和酷狗分别显示独立进度条，完成后分别列出新增、已有和匹配失败明细。

## 电台、筛选和历史

- 搜索结果可勾选多首歌曲，点击“用选中歌曲生成电台”。
- 网易云窗口可选择整张歌单作为电台来源；系统会在歌单中均匀抽取最多 30 首并映射为 Embeat 种子。
- 多种子推荐按各自得分、候选排名和种子覆盖数融合，并排除所有种子歌曲。
- 推荐结果可请求 20 或 50 条；搜索候选和推荐结果均可选择每页显示 5、10 或 20 条，切换候选页时已勾选的多曲种子不会丢失。
- 可按召回来源、流派、最低热度过滤，并按匹配度、热度或种子覆盖排序。
- 最近搜索、推荐、电台和导出记录按用户写入 SQLite，可在登录后的页面查看和导出；旧版本浏览器历史会在首次登录后自动迁移并清理。
- 后端启动时加载 `data/chinese_singers_extended.json`、`data/chinese_singers_generated.json` 与 MusicBrainz 别名库（`MB_LOOKUP_PATH`），合并为中英文艺人别名映射，用于歌手搜索、歌手推荐和网易云/酷狗匹配；JSON 条目优先级高于 MusicBrainz。

## 移动端与发现入口

- 屏幕宽度不超过 840px 时，推荐结果自动切换为卡片布局；卡片支持勾选、查看双语名称、热度、流派、来源以及继续推荐。
- 桌面端左侧操作栏固定在视口中并独立滚动；移动端恢复普通上下布局。
- “按流派找歌”根据 Qdrant 中的艺人流派索引和热度浏览歌曲。
- “每周新发现”按 ISO 周生成稳定轮换结果，并限制同艺人和同流派的集中度。数据库没有发行日期字段，因此它是每周轮换发现榜，不代表歌曲在本周发行。

## Qdrant 断线恢复

后端会识别 Qdrant 连接中断和超时，重建数据库客户端并自动重试一次当前请求。网页也会持续检查服务状态，因此 Qdrant 重启完成后无需重启 UI 服务；普通的“歌曲不存在”等业务错误不会触发重连。

## 数据备份与依赖

认证数据库和加密密钥位于 `data/embeat.db`、`data/secret.key`，两者必须一起备份，且不要提交到 Git。`cryptography` 是必需依赖，启动前可执行：

```powershell
conda run -n embeat python -m pip install -r requirements.txt
```

停止控制台中的“备份并退出”会把数据库、密钥和元数据复制到 `data/backups/<时间戳>`。

## 开发与测试

```powershell
conda run -n embeat python -m unittest discover -s tests -q
```

## 致谢

本项目感谢以下开源项目的支持：

- [gdstudio-org/Embeat](https://github.com/gdstudio-org/Embeat) — 原始 Embeat 项目，本界面调用了其 ML 推荐逻辑与数据库结构。
- [NeteaseCloudMusicApiEnhanced/api-enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced) — 网易云兼容 API 服务，用于登录与歌单写入。
- [MakcRe/KuGouMusicApi](https://github.com/MakcRe/KuGouMusicApi) — 酷狗兼容 API 服务，用于登录与歌单写入。
