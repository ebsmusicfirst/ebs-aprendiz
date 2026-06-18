$projectPath = "F:\AIOX PROJECTS\EBS APRENDIZ"
$batFile     = Join-Path $projectPath "start-dashboard.bat"
$desktop     = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "EBS Aprendiz Dashboard.lnk"

# Tentar converter logo PNG em ICO para usar como ícone
$icoPath = Join-Path $projectPath "ASSETS\dashboard.ico"
$pngPath = Join-Path $projectPath "ASSETS\logo-ebs-aprendiz.png"
$iconLocation = "$env:SystemRoot\system32\shell32.dll,14"  # fallback

if (Test-Path $pngPath) {
  try {
    Add-Type -AssemblyName System.Drawing
    $src = [System.Drawing.Image]::FromFile($pngPath)
    $bmp = New-Object System.Drawing.Bitmap(32, 32)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($src, 0, 0, 32, 32)
    $g.Dispose(); $src.Dispose()

    $hIcon = $bmp.GetHicon()
    $ico   = [System.Drawing.Icon]::FromHandle($hIcon)
    $stream = [System.IO.FileStream]::new($icoPath, [System.IO.FileMode]::Create)
    $ico.Save($stream)
    $stream.Close(); $ico.Dispose(); $bmp.Dispose()

    $iconLocation = $icoPath
    Write-Host "  ✅ Ícone criado a partir do logo EBS"
  } catch {
    Write-Host "  ⚠️  Não foi possível converter o logo — usando ícone padrão"
  }
}

$WScript = New-Object -ComObject WScript.Shell
$shortcut = $WScript.CreateShortcut($shortcutPath)
$shortcut.TargetPath      = $batFile
$shortcut.WorkingDirectory = $projectPath
$shortcut.Description     = "EBS Aprendiz — Dashboard de Conteúdo Instagram"
$shortcut.WindowStyle     = 1
$shortcut.IconLocation    = $iconLocation
$shortcut.Save()

Write-Host ""
Write-Host "  ✅ Atalho criado: $shortcutPath"
Write-Host "  Clique duas vezes no ícone da área de trabalho para abrir o dashboard."
Write-Host ""
