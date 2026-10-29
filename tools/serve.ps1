# Minimal static file server for local previews (no Python/Node on this machine).
param([int]$Port = 8765, [string]$Root = (Split-Path -Parent $PSScriptRoot))
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript'; '.css'='text/css'; '.json'='application/json'; '.png'='image/png'; '.jpg'='image/jpeg'; '.webp'='image/webp'; '.svg'='image/svg+xml'; '.pdf'='application/pdf' }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root on http://localhost:$Port/"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  # Build helper: PUT /__save/<relative path> writes the request body to disk (localhost only)
  if ($ctx.Request.HttpMethod -eq 'PUT' -and $path.StartsWith('__save/')) {
    $dest = Join-Path $Root $path.Substring(7)
    New-Item -ItemType Directory -Force (Split-Path -Parent $dest) | Out-Null
    $fs = [IO.File]::Create($dest); $ctx.Request.InputStream.CopyTo($fs); $fs.Close()
    $ctx.Response.StatusCode = 204; $ctx.Response.Close(); continue
  }
  if ($path -eq '') { $path = 'index.html' }
  $file = Join-Path $Root $path
  if ((Test-Path $file -PathType Container)) { $file = Join-Path $file 'index.html' }
  if (Test-Path $file -PathType Leaf) {
    $bytes = [IO.File]::ReadAllBytes($file)
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $ctx.Response.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' })
    $ctx.Response.Headers.Add('Cache-Control', 'no-store')
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else { $ctx.Response.StatusCode = 404 }
  $ctx.Response.Close()
}
