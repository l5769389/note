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

function New-CroppedLogoImage {
  param([System.Drawing.Image]$Source)

  $cropSize = [int]([Math]::Min($Source.Width, $Source.Height) * 0.78)
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
  $graphics.Clear([System.Drawing.Color]::Transparent)
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
  $graphics.Clear((New-Color "#ffffff"))
  Draw-FittedImage $graphics $Source 4 4 48 48

  $titleFont = [System.Drawing.Font]::new("Segoe UI", 10, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $metaFont = [System.Drawing.Font]::new("Segoe UI", 7, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.DrawString("Markdown Studio", $titleFont, [System.Drawing.SolidBrush]::new((New-Color "#111827")), 56, 13)
  $graphics.DrawString("Clean Markdown writing", $metaFont, [System.Drawing.SolidBrush]::new((New-Color "#5f6b7a")), 57, 30)

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
  $graphics.Clear((New-Color "#ffffff"))
  Draw-FittedImage $graphics $Source 21 28 122 122

  $titleFont = [System.Drawing.Font]::new("Segoe UI", 14, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $metaFont = [System.Drawing.Font]::new("Segoe UI", 9, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $center = [System.Drawing.StringFormat]::new()
  $center.Alignment = [System.Drawing.StringAlignment]::Center
  $graphics.DrawString("Markdown", $titleFont, [System.Drawing.SolidBrush]::new((New-Color "#111827")), [System.Drawing.RectangleF]::new(12, 171, 140, 24), $center)
  $graphics.DrawString("Studio", $titleFont, [System.Drawing.SolidBrush]::new((New-Color "#111827")), [System.Drawing.RectangleF]::new(12, 193, 140, 24), $center)
  $graphics.DrawString($Subtitle, $metaFont, [System.Drawing.SolidBrush]::new((New-Color "#5f6b7a")), [System.Drawing.RectangleF]::new(14, 228, 136, 34), $center)

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
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
  Save-InstallerSidebar $logo (Join-Path $resourcesDir "installer-sidebar.bmp") "Setup wizard"
  Save-InstallerSidebar $logo (Join-Path $resourcesDir "uninstaller-sidebar.bmp") "Uninstall wizard"
} finally {
  $logo.Dispose()
  $source.Dispose()
}

Write-Host "Generated application icon resources from $sourcePath"
