环境变量说明

在 Vercel 项目 Settings → Environment Variables 里配置：

LINEAR_API_KEY（必需）
Linear 个人 API Key，权限选择 read+write。

CRON_SECRET（强烈推荐）
任意一串随机字符串。Vercel Cron 会在调用你这个 API 时自动带上 Authorization: Bearer <CRON_SECRET>，API 里会校验。

ARCHIVE_AFTER_DAYS（可选，默认 30）
例如设为 14，表示「完成超过 14 天的 issue 会被归档」。

LINEAR_TEAM_KEY（可选）
比如你 Linear 里工程 team 的 key 是 ENG，就写 ENG，这样只归档这一个 team 的 issue。否则会扫整个 workspace。

DRY_RUN（可选）
设为 "true"：只打印要归档哪些 issue，不实际归档（非常适合先试一试）。
不设置 / 设为其它：真实归档。
