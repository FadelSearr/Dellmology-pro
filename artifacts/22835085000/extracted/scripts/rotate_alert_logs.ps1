# Simple PS1 script to rotate alert logs in-place
param(
  [string]$LogDir = "apps/streamer/logs",
  [int]$MaxMB = 5
)
if (!(Test-Path $LogDir)) { Write-Output "No log dir"; exit 0 }
$files = Get-ChildItem -Path $LogDir -Filter "telegram_alerts*.log" | Sort-Object Length -Descending
foreach($f in $files){
  if(($f.Length / 1MB) -gt $MaxMB){
    $ts = (Get-Date).ToString('yyyyMMddHHmmss')
    $new = Join-Path $f.DirectoryName ("$($f.BaseName)-$ts$($f.Extension)")
    Rename-Item $f.FullName $new
    Write-Output "Rotated $($f.Name) -> $(Split-Path $new -Leaf)"
  }
}
