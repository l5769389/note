$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$resourcesDir = Join-Path $repoRoot "resources"
$sourcePath = Join-Path $resourcesDir "logo-source.png"

if (!(Test-Path -LiteralPath $sourcePath)) {
  throw "Missing logo source: $sourcePath"
}

New-Item -ItemType Directory -Force -Path $resourcesDir | Out-Null

function New-Color {
  param(
    [Parameter(Mandatory = $true)][string]$Hex,
    [int]$Alpha = 255
  )

  $value = $Hex.TrimStart("#")
  return [System.Drawing.Color]::FromArgb(
    $Alpha,
    [Convert]::ToInt32($value.Substring(0, 2), 16),
    [Convert]::ToInt32($value.Substring(2, 2), 16),
    [Convert]::ToInt32($value.Substring(4, 2), 16)
  )
}

function New-Graphics {
  param([System.Drawing.Image]$Image)

  $graphics = [System.Drawing.Graphics]::FromImage($Image)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  return $graphics
}

function Draw-FittedImage {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Image]$Image,
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height
  )

  $scale = [Math]::Min($Width / $Image.Width, $Height / $Image.Height)
  $drawWidth = $Image.Width * $scale
  $drawHeight = $Image.Height * $scale
  $drawX = $X + (($Width - $drawWidth) / 2)
  $drawY = $Y + (($Height - $drawHeight) / 2)
  $dest = [System.Drawing.RectangleF]::new($drawX, $drawY, $drawWidth, $drawHeight)
  $Graphics.DrawImage($Image, $dest)
}

function New-RoundedRectanglePath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Fill-RoundedRectangle {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Brush]$Brush,
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-RoundedRectanglePath $X $Y $Width $Height $Radius
  $Graphics.FillPath($Brush, $path)
  $path.Dispose()
}

function Draw-RoundedRectangle {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Pen]$Pen,
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-RoundedRectanglePath $X $Y $Width $Height $Radius
  $Graphics.DrawPath($Pen, $path)
  $path.Dispose()
}

function New-CroppedLogoImage {
  param([System.Drawing.Image]$Source)

  $cropSize = [int]([Math]::Min($Source.Width, $Source.Height))
  $cropX = [int](($Source.Width - $cropSize) / 2)
  $cropY = [int](($Source.Height - $cropSize) / 2)
  $bitmap = [System.Drawing.Bitmap]::new($cropSize, $cropSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = New-Graphics $bitmap
  $sourceRect = [System.Drawing.Rectangle]::new($cropX, $cropY, $cropSize, $cropSize)
  $destRect = [System.Drawing.Rectangle]::new(0, 0, $cropSize, $cropSize)
  $graphics.DrawImage($Source, $destRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.Dispose()
  return $bitmap
}

function New-IconBitmap {
  param(
    [System.Drawing.Image]$Source,
    [int]$Size
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = New-Graphics $bitmap
  $graphics.Clear((New-Color "#ffffff"))
  Draw-FittedImage $graphics $Source 0 0 $Size $Size
  $graphics.Dispose()
  return $bitmap
}

function Get-PngBytes {
  param(
    [System.Drawing.Image]$Source,
    [int]$Size
  )

  $bitmap = New-IconBitmap $Source $Size
  $stream = [System.IO.MemoryStream]::new()
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
  return [byte[]]$stream.ToArray()
}

function Save-Png {
  param(
    [System.Drawing.Image]$Source,
    [int]$Size,
    [string]$Path
  )

  $bitmap = New-IconBitmap $Source $Size
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

function Save-Ico {
  param(
    [System.Drawing.Image]$Source,
    [int[]]$Sizes,
    [string]$Path
  )

  $images = foreach ($size in $Sizes) {
    [PSCustomObject]@{
      Size = $size
      Bytes = [byte[]](Get-PngBytes $Source $size)
    }
  }

  $stream = [System.IO.File]::Create($Path)
  $writer = [System.IO.BinaryWriter]::new($stream)

  try {
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$images.Count)

    $offset = 6 + ($images.Count * 16)

    foreach ($image in $images) {
      $dimension = if ($image.Size -ge 256) { 0 } else { $image.Size }
      $writer.Write([byte]$dimension)
      $writer.Write([byte]$dimension)
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([UInt16]1)
      $writer.Write([UInt16]32)
      $writer.Write([UInt32]$image.Bytes.Length)
      $writer.Write([UInt32]$offset)
      $offset += $image.Bytes.Length
    }

    foreach ($image in $images) {
      $writer.Write($image.Bytes)
    }
  } finally {
    $writer.Dispose()
    $stream.Dispose()
  }
}

function Save-InstallerHeader {
  param(
    [System.Drawing.Image]$Source,
    [string]$Path
  )

  $bitmap = [System.Drawing.Bitmap]::new(150, 57, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = New-Graphics $bitmap
  $bounds = [System.Drawing.Rectangle]::new(0, 0, 150, 57)
  $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $bounds,
    (New-Color "#ffffff"),
    (New-Color "#eef6f6"),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
  )
  $graphics.FillRectangle($background, $bounds)
  $background.Dispose()

  $glowBrush = [System.Drawing.SolidBrush]::new((New-Color "#14b8a6" 26))
  $graphics.FillEllipse($glowBrush, 96, -24, 74, 74)
  $glowBrush.Dispose()

  $cardBrush = [System.Drawing.SolidBrush]::new((New-Color "#ffffff"))
  $cardBorder = [System.Drawing.Pen]::new((New-Color "#c7d2fe"), 1)
  Fill-RoundedRectangle $graphics $cardBrush 7 7 43 43 11
  Draw-RoundedRectangle $graphics $cardBorder 7.5 7.5 42 42 11
  Draw-FittedImage $graphics $Source 13 13 31 31

  $accentBrush = [System.Drawing.SolidBrush]::new((New-Color "#0f766e"))
  $titleBrush = [System.Drawing.SolidBrush]::new((New-Color "#111827"))
  $metaBrush = [System.Drawing.SolidBrush]::new((New-Color "#52627a"))
  $titleFont = [System.Drawing.Font]::new("Segoe UI", 12, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $metaFont = [System.Drawing.Font]::new("Segoe UI", 8, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.DrawString("noteDock", $titleFont, $titleBrush, 57, 11)
  $graphics.DrawString("Local-first notes", $metaFont, $metaBrush, 58, 29)
  Fill-RoundedRectangle $graphics $accentBrush 58 43 55 4 2

  $cardBrush.Dispose()
  $cardBorder.Dispose()
  $accentBrush.Dispose()
  $titleBrush.Dispose()
  $metaBrush.Dispose()
  $titleFont.Dispose()
  $metaFont.Dispose()

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function Save-InstallerSidebar {
  param(
    [System.Drawing.Image]$Source,
    [string]$Path,
    [string]$Subtitle
  )

  $bitmap = [System.Drawing.Bitmap]::new(164, 314, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = New-Graphics $bitmap
  $bounds = [System.Drawing.Rectangle]::new(0, 0, 164, 314)
  $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $bounds,
    (New-Color "#0f172a"),
    (New-Color "#0f766e"),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
  )
  $graphics.FillRectangle($background, $bounds)
  $background.Dispose()

  $navyOverlay = [System.Drawing.SolidBrush]::new((New-Color "#111827" 92))
  $graphics.FillRectangle($navyOverlay, 0, 0, 164, 314)
  $navyOverlay.Dispose()

  $tealGlow = [System.Drawing.SolidBrush]::new((New-Color "#14b8a6" 48))
  $indigoGlow = [System.Drawing.SolidBrush]::new((New-Color "#818cf8" 34))
  $whiteLine = [System.Drawing.Pen]::new((New-Color "#ffffff" 28), 1)
  $graphics.FillEllipse($tealGlow, 88, -34, 120, 120)
  $graphics.FillEllipse($indigoGlow, -58, 206, 164, 164)
  $graphics.DrawLine($whiteLine, 22, 26, 22, 286)
  $graphics.DrawLine($whiteLine, 142, 42, 142, 276)

  $logoCard = [System.Drawing.SolidBrush]::new((New-Color "#ffffff" 246))
  $logoBorder = [System.Drawing.Pen]::new((New-Color "#ffffff" 72), 1)
  Fill-RoundedRectangle $graphics $logoCard 36 34 92 92 18
  Draw-RoundedRectangle $graphics $logoBorder 36.5 34.5 91 91 18
  Draw-FittedImage $graphics $Source 50 48 64 64

  $titleFont = [System.Drawing.Font]::new("Segoe UI", 20, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $metaFont = [System.Drawing.Font]::new("Segoe UI", 10, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $smallFont = [System.Drawing.Font]::new("Segoe UI", 8, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $center = [System.Drawing.StringFormat]::new()
  $center.Alignment = [System.Drawing.StringAlignment]::Center
  $center.LineAlignment = [System.Drawing.StringAlignment]::Near

  $titleBrush = [System.Drawing.SolidBrush]::new((New-Color "#f8fafc"))
  $metaBrush = [System.Drawing.SolidBrush]::new((New-Color "#cbd5e1"))
  $pillBrush = [System.Drawing.SolidBrush]::new((New-Color "#ffffff" 28))
  $pillBorder = [System.Drawing.Pen]::new((New-Color "#ffffff" 44), 1)

  $graphics.DrawString("noteDock", $titleFont, $titleBrush, [System.Drawing.RectangleF]::new(16, 148, 132, 28), $center)
  $graphics.DrawString("Local-first notes`nfor focused reading", $metaFont, $metaBrush, [System.Drawing.RectangleF]::new(18, 184, 128, 46), $center)
  Fill-RoundedRectangle $graphics $pillBrush 27 245 110 30 15
  Draw-RoundedRectangle $graphics $pillBorder 27.5 245.5 109 29 15
  $graphics.DrawString($Subtitle, $smallFont, $titleBrush, [System.Drawing.RectangleF]::new(31, 254, 102, 14), $center)
  Fill-RoundedRectangle $graphics $tealGlow 56 286 52 4 2

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $tealGlow.Dispose()
  $indigoGlow.Dispose()
  $whiteLine.Dispose()
  $logoCard.Dispose()
  $logoBorder.Dispose()
  $titleFont.Dispose()
  $metaFont.Dispose()
  $smallFont.Dispose()
  $center.Dispose()
  $titleBrush.Dispose()
  $metaBrush.Dispose()
  $pillBrush.Dispose()
  $pillBorder.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

$source = [System.Drawing.Image]::FromFile($sourcePath)
$logo = New-CroppedLogoImage $source

try {
  $iconSizes = @(16, 24, 32, 48, 64, 128, 256)

  foreach ($size in $iconSizes) {
    Save-Png $logo $size (Join-Path $resourcesDir "icon-$size.png")
  }

  Save-Png $logo 512 (Join-Path $resourcesDir "icon.png")
  Save-Ico $logo $iconSizes (Join-Path $resourcesDir "icon.ico")
  Save-InstallerHeader $logo (Join-Path $resourcesDir "installer-header.bmp")
  Save-InstallerSidebar $logo (Join-Path $resourcesDir "installer-sidebar.bmp") "Install noteDock"
  Save-InstallerSidebar $logo (Join-Path $resourcesDir "uninstaller-sidebar.bmp") "Remove noteDock"
} finally {
  $logo.Dispose()
  $source.Dispose()
}

Write-Host "Generated application icon resources from $sourcePath"
