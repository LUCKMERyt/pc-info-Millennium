# PC Info (Night Neon) — Millennium plugin

Adds a **«🖥️ PC configuration»** block under *System requirements* on every game page of the Steam store.
The block shows your CPU, GPU, RAM, motherboard, OS, DirectX, disks (free / total), audio device and monitor,
and marks RAM and free disk space with ✓ / ✗ against the game's minimum requirements.

Добавляет на страницы игр в магазине Steam, под «Системными требованиями», блок **«🖥️ Конфигурация ПК»**:
процессор, видеокарта, ОЗУ, материнская плата, ОС, DirectX, диски (свободно / всего), звук и монитор.
Память и место на диске сверяются с минимальными требованиями игры (✓ / ✗).

## How it works / Как это работает

* The block appears instantly with built-in default specs (`DEFAULT_DATA` at the top of `.millennium/Dist/webkit.js` — edit it for your PC).
  Блок появляется сразу со встроенными данными по умолчанию.
* In parallel the Lua backend runs a small PowerShell script that detects the real hardware and the block is updated.
  Параллельно бэкенд определяет железо через PowerShell и обновляет блок.
* A gear button (⚙) on the block opens settings: title, colors, opacity, font size, width, radius, show/hide rows,
  your own values for any row, 4 extra rows. Saved in the browser storage of the store.
  Шестерёнка ⚙ на блоке: заголовок, цвета, прозрачность, размер, ширина, строки, свои значения, 4 дополнительные строки.

## Install / Установка

1. Close Steam / Закройте Steam.
2. Copy this folder to `<Steam>\millennium\plugins\pc-info` (older Millennium: `<Steam>\plugins\pc-info`) /
   Скопируйте папку в `<Steam>\millennium\plugins\pc-info`.
3. Steam → Millennium → Plugins → enable **PC Info (Night Neon)** → Save → restart Steam.
4. Open any game page in the store, press Ctrl+R.

Requires a Millennium version with Lua plugins (3.x) and Windows (hardware detection uses PowerShell).
Нужен Millennium с поддержкой Lua-плагинов (3.x) и Windows.

## Structure / Структура

| Path | Purpose |
|---|---|
| `plugin.json` | plugin manifest |
| `backend/main.lua` | Lua backend: runs detection, serves `GetPcInfo()` |
| `backend/pc-info.ps1` | hardware detection (PowerShell) |
| `.millennium/Dist/webkit.js` | webkit module injected into store pages |
| `.millennium/Dist/index.js` | empty frontend module |

## Troubleshooting / Если блока нет

* Millennium → Logs: look for `pc-info: detected: {...}`.
* `backend/pc-info.log` — helper log; `<Steam>\steamui\pc-info\data.js` must exist.
* In the store page console (`http://localhost:8080`): `document.documentElement.dataset.pcinfo` →
  `init` = the module runs; `undefined` = not injected.

## Privacy / Приватность

The plugin only reads hardware information locally and never sends it anywhere. Settings stay in your browser storage.
Плагин читает данные о железе локально и никуда их не отправляет.

## License

GPL-3.0 — see [LICENSE.txt](LICENSE.txt).
