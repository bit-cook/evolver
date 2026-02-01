---
name: weather
description: Get current weather and forecasts (Robust with Fallback).
homepage: https://wttr.in/:help
metadata: {"clawdbot":{"emoji":"🌤️","requires":{"bins":["node"]}}}
---

# Weather Skill

Robust weather checking with automatic fallback (`wttr.in` -> `Open-Meteo`).

## Features
- **Multi-Provider**: Tries `wttr.in` first, falls back to `Open-Meteo`.
- **Geocoding**: Auto-resolves city names to coordinates (with caching).
- **Rich Data**: Returns Temp, Condition, Humidity, Wind.
- **JSON Mode**: Output raw JSON for programmatic use.

## Usage

```bash
# Human-readable output
node skills/weather/index.js "New York"

# JSON output
node skills/weather/index.js "Tokyo" --json
```

## Legacy (Manual Curl)

If the script fails, you can try manually:
```bash
curl -s "wttr.in/London?format=3"
```
