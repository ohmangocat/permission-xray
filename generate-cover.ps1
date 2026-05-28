Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

function From-Base64Utf8([string] $Value) {
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Value))
}

function New-Cover {
    param(
        [string] $Repo,
        [string] $Title,
        [string] $Subtitle,
        [string] $Description,
        [string] $Symbol,
        [string] $OutputPath,
        [Drawing.Color] $Background,
        [Drawing.Color] $Accent,
        [Drawing.Color] $Accent2
    )

    $width = 800
    $height = 600
    $bitmap = [Drawing.Bitmap]::new($width, $height)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::ClearTypeGridFit

    $brushes = @()
    $pens = @()
    $fonts = @()

    try {
        $graphics.Clear($Background)

        $accentBrush = [Drawing.SolidBrush]::new($Accent)
        $accent2Brush = [Drawing.SolidBrush]::new($Accent2)
        $cardBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(247, 255, 255, 255))
        $panelBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(246, 248, 252))
        $textBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(27, 35, 47))
        $mutedBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(83, 94, 110))
        $whiteBrush = [Drawing.SolidBrush]::new([Drawing.Color]::White)
        $symbolBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(38, $Accent))
        $brushes += @($accentBrush, $accent2Brush, $cardBrush, $panelBrush, $textBrush, $mutedBrush, $whiteBrush, $symbolBrush)

        $borderPen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(220, 228, 238), 2)
        $accentPen = [Drawing.Pen]::new($Accent, 7)
        $symbolPen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(45, $Accent), 2)
        $pens += @($borderPen, $accentPen, $symbolPen)

        $titleFont = [Drawing.Font]::new('Microsoft YaHei UI', 56, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
        $subtitleFont = [Drawing.Font]::new('Microsoft YaHei UI', 26, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
        $descFont = [Drawing.Font]::new('Microsoft YaHei UI', 23, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
        $badgeFont = [Drawing.Font]::new('Segoe UI', 16, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
        $tagFont = [Drawing.Font]::new('Segoe UI', 15, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
        $symbolFont = [Drawing.Font]::new('Microsoft YaHei UI', 54, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
        $fonts += @($titleFont, $subtitleFont, $descFont, $badgeFont, $tagFont, $symbolFont)

        $graphics.FillEllipse($accentBrush, 590, -80, 280, 280)
        $graphics.FillEllipse($accent2Brush, -88, 450, 230, 230)
        $graphics.FillRectangle($cardBrush, 58, 70, 684, 460)
        $graphics.DrawRectangle($borderPen, 58, 70, 684, 460)
        $graphics.DrawLine($accentPen, 58, 70, 742, 70)

        $graphics.FillRectangle($panelBrush, 94, 112, 274, 42)
        $graphics.FillRectangle($accentBrush, 112, 124, 18, 18)
        $graphics.DrawString($Repo, $badgeFont, $mutedBrush, 144, 119)

        $graphics.DrawRectangle($symbolPen, 550, 190, 128, 94)
        $symbolFormat = [Drawing.StringFormat]::new()
        $symbolFormat.Alignment = [Drawing.StringAlignment]::Center
        $symbolFormat.LineAlignment = [Drawing.StringAlignment]::Center
        $graphics.DrawString($Symbol, $symbolFont, $symbolBrush, [Drawing.RectangleF]::new(550, 190, 128, 94), $symbolFormat)
        $symbolFormat.Dispose()

        $graphics.DrawString($Title, $titleFont, $textBrush, 94, 190)
        $graphics.DrawString($Subtitle, $subtitleFont, $mutedBrush, 96, 274)

        $descFormat = [Drawing.StringFormat]::new()
        $graphics.DrawString($Description, $descFont, $mutedBrush, [Drawing.RectangleF]::new(96, 358, 590, 98), $descFormat)
        $descFormat.Dispose()

        $tag = From-Base64Utf8 'TWluZUFkbWluIFBsdWdpbg=='
        $sizeText = From-Base64Utf8 'ODAwIHggNjAw'
        $graphics.FillRectangle($accentBrush, 96, 468, 144, 34)
        $graphics.DrawString($tag, $tagFont, $whiteBrush, 112, 475)
        $graphics.DrawString($sizeText, $tagFont, $mutedBrush, 637, 482)

        $dir = Split-Path -Parent $OutputPath
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir | Out-Null
        }
        $bitmap.Save($OutputPath, [Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
        foreach ($item in $brushes + $pens + $fonts) {
            $item.Dispose()
        }
    }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
New-Cover `
    -Repo (From-Base64Utf8 'eGpsbGR3L3Blcm1pc3Npb24teHJheQ==') `
    -Title (From-Base64Utf8 '5p2D6ZmQ6YCP6KeG5Zmo') `
    -Subtitle (From-Base64Utf8 '6byg5qCH5oKs5YGc5p+l55yLIERPTSDmnYPpmZA=') `
    -Description (From-Base64Utf8 '54K55Ye76aG26YOo5YWl5Y+j6L+b5YWl5qOA5p+l5Zmo5qih5byP77yM55u05o6l5p+l55yLIHYtYXV0aCAvIHYtcm9sZSAvIHYtdXNlciDlkb3kuK3nirbmgIHvvJvplIHlrprpobXpnaLmk43kvZzvvIxFc2Mg6YCA5Ye644CC') `
    -Symbol (From-Base64Utf8 '4oyW') `
    -OutputPath (Join-Path $root 'assets\cover.png') `
    -Background ([Drawing.Color]::FromArgb(240, 244, 250)) `
    -Accent ([Drawing.Color]::FromArgb(52, 115, 232)) `
    -Accent2 ([Drawing.Color]::FromArgb(255, 177, 66))

Write-Host 'Generated assets/cover.png'
