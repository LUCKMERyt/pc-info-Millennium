# pc-info.ps1 - helper for the "pc-info" Millennium plugin.
# Detects PC hardware. Prints the result as one JSON line (read by main.lua) and writes
# steamui\pc-info\pc-info.js (webkit module + inline data) and steamui\pc-info\data.js (data only).
# ASCII-only on purpose (Windows PowerShell 5.1 misreads UTF-8 without BOM).
param(
    [string]$SteamPath = "",
    [string]$Template = "",
    [string]$OutFile = ""
)
$ErrorActionPreference = "Continue"
$LogFile = Join-Path $PSScriptRoot "pc-info.log"
function Log([string]$m) {
    try { Add-Content -Path $LogFile -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m) -Encoding UTF8 } catch { }
}
try {
    if (Test-Path $LogFile) { if ((Get-Item $LogFile).Length -gt 100KB) { Remove-Item $LogFile -Force } }
    if ($SteamPath -eq "") { $SteamPath = ((Get-ItemProperty "HKCU:\Software\Valve\Steam").SteamPath -replace '/', '\') }
    if ($Template -eq "") { $Template = Join-Path (Split-Path $PSScriptRoot) ".millennium\Dist\webkit.js" }
    if ($OutFile -eq "") { $OutFile = Join-Path $SteamPath "steamui\pc-info\pc-info.js" }

    if (-not ('DefaultAudio' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class DefaultAudio {
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator {
        int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
    }
    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice {
        int Activate(ref Guid iid, int clsCtx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o);
        int OpenPropertyStore(int access, out IPropertyStore props);
    }
    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore {
        int GetCount(out int c);
        int GetAt(int i, out PropertyKey k);
        int GetValue(ref PropertyKey k, out PropVariant v);
    }
    [StructLayout(LayoutKind.Sequential)] struct PropertyKey { public Guid fmtid; public int pid; }
    [StructLayout(LayoutKind.Explicit, Size = 24)] struct PropVariant { [FieldOffset(0)] public ushort vt; [FieldOffset(8)] public IntPtr ptr; }
    [DllImport("ole32.dll")] static extern int PropVariantClear(ref PropVariant pv);
    public static string GetDefaultName() {
        try {
            IMMDeviceEnumerator en = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
            IMMDevice dev; if (en.GetDefaultAudioEndpoint(0, 0, out dev) != 0) return null;
            IPropertyStore ps; if (dev.OpenPropertyStore(0, out ps) != 0) return null;
            PropertyKey key = new PropertyKey(); key.fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"); key.pid = 14;
            PropVariant v; if (ps.GetValue(ref key, out v) != 0) return null;
            string n = (v.vt == 31) ? Marshal.PtrToStringUni(v.ptr) : null;
            PropVariantClear(ref v); return n;
        } catch { return null; }
    }
}
'@
    }

    $os = Get-CimInstance Win32_OperatingSystem
    $osName = (($os.Caption -replace 'Microsoft ', '').Trim()) + " " + $(if ($os.OSArchitecture -match '64') { "64-bit" } else { "32-bit" })
    $cpuO = Get-CimInstance Win32_Processor | Select-Object -First 1
    $cpu = ("{0} ({1}C/{2}T)" -f ($cpuO.Name -replace '\s+', ' ').Trim(), $cpuO.NumberOfCores, $cpuO.NumberOfLogicalProcessors)
    $ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)

    # GPU: real VRAM. WMI AdapterRAM is capped at 4 GB, so use nvidia-smi (NVIDIA) or the registry (qword value)
    $gpuName = ""; $gpuBest = [int64]-1; $gpuMem = [int64]0; $gpuAll = @()
    $classKey = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11cd-bfc1-08002be10318}"
    foreach ($k in (Get-ChildItem $classKey -ErrorAction SilentlyContinue)) {
        $p = Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue
        if (-not $p -or -not $p.DriverDesc) { continue }
        if ($p.DriverDesc -match 'Basic|Remote|Virtual|Mirror') { continue }
        if ($gpuAll -notcontains $p.DriverDesc) { $gpuAll += $p.DriverDesc }
        $mem = [int64]0
        $q = $p.'HardwareInformation.qwMemorySize'
        if ($q -is [byte[]]) { $mem = [BitConverter]::ToInt64($q, 0) } elseif ($q) { $mem = [int64]$q }
        if ($mem -eq 0) {
            $q2 = $p.'HardwareInformation.MemorySize'
            if ($q2 -is [byte[]]) { $mem = [int64][BitConverter]::ToUInt32($q2, 0) } elseif ($q2) { $mem = [int64]$q2 }
        }
        if ($mem -gt $gpuBest) { $gpuBest = $mem; $gpuName = $p.DriverDesc; $gpuMem = $mem }
    }
    $vc = Get-CimInstance Win32_VideoController | Where-Object { $_.Name -notmatch 'Basic|Remote|Virtual' } | Select-Object -First 1
    if ($gpuName -eq "" -and $vc) { $gpuName = $vc.Name; $gpuMem = $vc.AdapterRAM }
    # NVIDIA: nvidia-smi reports the exact amount (MiB)
    if ($gpuName -match 'NVIDIA|GeForce') {
        foreach ($exe in @("nvidia-smi", (Join-Path $env:SystemRoot "System32\nvidia-smi.exe"), (Join-Path $env:ProgramFiles "NVIDIA Corporation\NVSMI\nvidia-smi.exe"))) {
            try {
                $o = & $exe --query-gpu=memory.total --format=csv,noheader,nounits 2>$null
                if ($o) {
                    $mib = 0.0
                    if ([double]::TryParse((@($o)[0]).ToString().Trim(), [ref]$mib) -and $mib -gt 0) { $gpuMem = [int64]($mib * 1MB); break }
                }
            } catch { }
        }
    }
    $gpuOthers = @($gpuAll | Where-Object { $_ -ne $gpuName })
    $gpu = $gpuName
    if ($gpuMem -gt 0) { $gpu = "{0} {1} GB" -f $gpuName, [math]::Round($gpuMem / 1GB) }

    $dx = "12"
    if ([int]$os.BuildNumber -lt 10240) { $dx = "11" }

    $bb = Get-CimInstance Win32_BaseBoard | Select-Object -First 1
    $board = ((("{0} {1}" -f $bb.Manufacturer, $bb.Product) -replace '\s+', ' ')).Trim()

    $display = ""
    if ($vc -and $vc.CurrentHorizontalResolution) {
        $display = "{0}x{1} @ {2} Hz" -f $vc.CurrentHorizontalResolution, $vc.CurrentVerticalResolution, $vc.CurrentRefreshRate
    }

    $phys = @{}
    $ptype = @{}
    try {
        Get-PhysicalDisk | ForEach-Object {
            $phys[[string]$_.DeviceId] = $_.FriendlyName
            $bus = [string]$_.BusType; $mt = [string]$_.MediaType
            $t = ""
            if ($bus -eq "NVMe" -or $bus -eq "17") { $t = "NVMe" }
            elseif ($mt -eq "SSD" -or $mt -eq "4") { $t = "SSD" }
            elseif ($mt -eq "HDD" -or $mt -eq "3") { $t = "HDD" }
            $ptype[[string]$_.DeviceId] = $t
        }
    } catch { }
    $disks = @()
    foreach ($d in (Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Sort-Object DeviceID)) {
        $model = ""; $dtype = ""
        try {
            $part = Get-Partition -DriveLetter $d.DeviceID.Substring(0, 1) -ErrorAction Stop
            $model = $phys[[string]$part.DiskNumber]
            $dtype = $ptype[[string]$part.DiskNumber]
        } catch { }
        $disks += @{ id = $d.DeviceID; free = [math]::Round($d.FreeSpace / 1GB); total = [math]::Round($d.Size / 1GB); model = $model; type = $dtype }
    }

    $audio = [DefaultAudio]::GetDefaultName()
    if (-not $audio) { $audio = "n/a" }

    $data = @{ os = $osName; cpu = $cpu; ramGB = $ramGB; gpu = $gpu; directx = $dx; board = $board; display = $display; disks = $disks; gpus = @($gpuOthers); audio = $audio; updated = (Get-Date -Format "yyyy-MM-dd HH:mm:ss") }
    $json = $data | ConvertTo-Json -Compress -Depth 5
    # escape non-ASCII so the file encoding never matters
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $json.ToCharArray()) {
        if ([int]$ch -gt 126) { [void]$sb.AppendFormat('\u{0:x4}', [int]$ch) } else { [void]$sb.Append($ch) }
    }
    $json = $sb.ToString()

    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $outDir = Split-Path $OutFile
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    if (Test-Path $Template) {
        $tpl = [System.IO.File]::ReadAllText($Template, $utf8)
        [System.IO.File]::WriteAllText($OutFile, $tpl.Replace('/*__DATA__*/null', $json), $utf8)
    }
    $dataJs = "(function(){var d=" + $json + ";if(window.__pcInfo){window.__pcInfo.setData(d);}else{window.__pcInfoPending=d;}})();"
    [System.IO.File]::WriteAllText((Join-Path $outDir "data.js"), $dataJs, $utf8)
    Log ("ok -> " + $outDir + " | " + $json)
    Write-Output $json
} catch {
    Log ("ERROR: " + $_.Exception.Message)
    Write-Output ("error: " + $_.Exception.Message)
}
