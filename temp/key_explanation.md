**故障分析报告 (Incident Analysis)**

**现象**: 提示 Key 未找到。
**原因**: `VECTOR_ENGINE_KEY` 已存在于持久化配置 (`.env`) 中，但 `suno-music` 脚本缺少 `dotenv` 预加载模块，导致运行时无法读取环境变量。
**修正**: 已修补脚本，增加自动环境加载逻辑。

Key 未丢失，任务正在后台执行中。