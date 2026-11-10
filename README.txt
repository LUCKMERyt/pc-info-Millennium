pc-info 2.0 - Millennium plugin (Night Neon theme)

STRUCTURE (standard Millennium plugin)
  plugin.json                    plugin manifest
  backend/main.lua               Lua backend: runs detection, serves GetPcInfo()
  backend/pc-info.ps1            hardware detection (PowerShell, Windows)
  .millennium/Dist/webkit.js     webkit module, injected into Steam store pages
  .millennium/Dist/index.js      (empty) frontend module

WHAT IT DOES
  Under "System requirements" on every game page a block appears:
      Configuration of the PC: CPU, GPU, RAM, motherboard, OS, DirectX, disks, audio, monitor.
  It shows instantly with the built-in default specs and, in parallel, the plugin detects the
  real ones and replaces them (a line under the title says which data is shown).
  RAM and free disk space are marked with a check/cross against the game's minimum.

SETTINGS
  Gear button on the block: title, colors, opacity, font size, width, radius, show/hide each row,
  your own text for any row (empty = auto), 4 extra rows, reset. Saved in browser storage.
  Built-in defaults (your hardware) are at the top of .millennium\Dist\webkit.js (DEFAULT_DATA).

INSTALL
  1. Close Steam. Copy folder "pc-info" to <Steam>\millennium\plugins\  (older: <Steam>\plugins\).
  2. Steam -> Millennium -> Plugins -> enable "PC Info (Night Neon)" -> Save -> restart Steam.
  3. Open a game page in the store, Ctrl+R.

TROUBLESHOOTING
  * Millennium Logs: "pc-info: detected: {...}" = detection works.
  * backend\pc-info.log - helper log.  <Steam>\steamui\pc-info\data.js must exist.
  * Store page console (http://localhost:8080): document.documentElement.dataset.pcinfo
      "init" = module runs;  undefined = module is not injected.
