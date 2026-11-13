# PC Info (Night Neon) — Millennium plugin

Adds a **«🖥️ PC configuration»** block under *System requirements* on every game page of the Steam store.
The block shows your CPU, GPU, RAM, motherboard, OS, DirectX, disks (free / total), audio device and monitor,
and marks RAM and free disk space with ✓ / ✗ against the game's minimum requirements.
**v2.1:** it also compares your **CPU and GPU** with the minimum / recommended requirements of the game and shows an
**approximate FPS table** (1080p / 1440p / 4K × Low / Medium / High / Ultra).

Добавляет на страницы игр в магазине Steam, под «Системными требованиями», блок **«🖥️ Конфигурация ПК»**:
процессор, видеокарта, ОЗУ, материнская плата, ОС, DirectX, диски (свободно / всего), звук и монитор.
Память и место на диске сверяются с минимальными требованиями игры (✓ / ✗).
**v2.1:** процессор и видеокарта сравниваются с минимальными и рекомендуемыми требованиями игры, ниже — таблица
**примерного FPS** (1080p / 1440p / 4K × низкие / средние / высокие / ультра).

## How it works / Как это работает

* The block appears instantly with built-in default specs (`DEFAULT_DATA` at the top of `.millennium/Dist/webkit.js` — edit it for your PC).
  Блок появляется сразу со встроенными данными по умолчанию.
* In parallel the Lua backend runs a small PowerShell script that detects the real hardware and the block is updated.
  Параллельно бэкенд определяет железо через PowerShell и обновляет блок.
* A gear button (⚙) on the block opens settings: title, colors, opacity, font size, width, radius, show/hide rows,
  your own values for any row, 4 extra rows. Saved in the browser storage of the store.
  Шестерёнка ⚙ на блоке: заголовок, цвета, прозрачность, размер, ширина, строки, свои значения, 4 дополнительные строки.

## CPU/GPU check and FPS / Проверка железа и FPS

* The requirement lines ("Processor", "Graphics") are parsed; each CPU/GPU name is looked up in a built-in table of
  **approximate** relative performance scores (hand-written, PassMark-like). You get `Мин ✓ ×2.3 · Рек ✓ ×1.3`:
  ✓ = at or above the requirement, ≈ = within 15 %, ✗ = weaker. Unknown models give `?` — no guess is made.
  If a requirement lists several alternatives ("i5-8600K or Ryzen 5 3500") the weakest one is the threshold.
* **FPS table.** First the plugin asks the FPS-estimate sites `fpsbench.com`, `chipversus.com`, `checkfps.io`
  (through the Lua backend, `FetchPage`, allow-list of these three hosts only). The request URL contains only the game name
  and your CPU / GPU model. If none of them knows the game, a **local estimate** is shown, computed from the game's own
  requirements (min ≈ 30 FPS at 1080p low, recommended ≈ 60 FPS at 1080p high), accuracy about ±30 %.
  Site values are the sites' own estimates, not measurements of your PC. Results are cached 7 days.
* Gear → "Показывать примерный FPS" / "Искать FPS на сайтах" switch these off; "Обновить FPS" clears the cache.
* Debug: `document.documentElement.dataset.pcinfoFps` in the store page console lists what each site answered.

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
| `backend/main.lua` | Lua backend: runs detection, serves `GetPcInfo()` and `FetchPage(url)` |
| `backend/pc-info.ps1` | hardware detection (PowerShell) |
| `.millennium/Dist/webkit.js` | webkit module injected into store pages |
| `.millennium/Dist/index.js` | empty frontend module |
| `src/` | readable sources of `webkit.js` (`pcinfo-core.js`, `pcinfo-hw.js`) and `build.py` that produces it |

## Troubleshooting / Если блока нет

* Millennium → Logs: look for `pc-info: detected: {...}`.
* `backend/pc-info.log` — helper log; `<Steam>\steamui\pc-info\data.js` must exist.
* In the store page console (`http://localhost:8080`): `document.documentElement.dataset.pcinfo` →
  `init` = the module runs; `undefined` = not injected.

## Privacy / Приватность

Hardware information is read locally. With "Искать FPS на сайтах" enabled the plugin requests pages from
`fpsbench.com`, `chipversus.com` and `checkfps.io`; the URL contains the game name and your CPU/GPU model name, nothing else
(no account, no Steam ID, no other hardware data). Turn it off in the gear panel to stay fully offline.
Settings stay in your browser storage.
Железо читается локально. При включённом «Искать FPS на сайтах» плагин запрашивает страницы трёх сайтов; в адресе — только
название игры и модели вашего процессора/видеокарты. Отключается в настройках (⚙).

## License

GPL-3.0 — see [LICENSE.txt](LICENSE.txt).
