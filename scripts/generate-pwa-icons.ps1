Add-Type -AssemblyName System.Drawing

$outputDirectory = Join-Path $PSScriptRoot "..\public\pwa"
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$icons = @(
    @{ Name = "icon-192.png"; Size = 192 },
    @{ Name = "icon-512.png"; Size = 512 },
    @{ Name = "apple-touch-icon.png"; Size = 180 }
)

foreach ($icon in $icons) {
    $size = [int]$icon.Size
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#123a2d"))

    $margin = [int]($size * 0.18)
    $diameter = $size - (2 * $margin)
    $gold = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#d2b474"))
    $green = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#123a2d"))
    $graphics.FillEllipse($gold, $margin, $margin, $diameter, $diameter)

    $font = New-Object System.Drawing.Font("Arial", ($size * 0.24), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString("LN", $font, $green, (New-Object System.Drawing.RectangleF(0, 0, $size, $size)), $format)

    $bitmap.Save((Join-Path $outputDirectory $icon.Name), [System.Drawing.Imaging.ImageFormat]::Png)
    $format.Dispose()
    $font.Dispose()
    $gold.Dispose()
    $green.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
