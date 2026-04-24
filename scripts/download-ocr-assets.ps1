param(
  [string]$Root = (Resolve-Path "$PSScriptRoot\..").Path
)

$ErrorActionPreference = "Stop"

$ocrRoot = Join-Path $Root "ocr-assets"
$tesseractDir = Join-Path $ocrRoot "tesseract"
$langDir = Join-Path $ocrRoot "lang"

New-Item -ItemType Directory -Force -Path $tesseractDir | Out-Null
New-Item -ItemType Directory -Force -Path $langDir | Out-Null

$downloads = @(
  @{
    Url = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"
    Target = Join-Path $tesseractDir "tesseract.min.js"
  },
  @{
    Url = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js"
    Target = Join-Path $tesseractDir "worker.min.js"
  },
  @{
    Url = "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js"
    Target = Join-Path $tesseractDir "tesseract-core.wasm.js"
  },
  @{
    Url = "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm"
    Target = Join-Path $tesseractDir "tesseract-core.wasm"
  },
  @{
    Url = "https://tessdata.projectnaptha.com/4.0.0_best/chi_sim.traineddata.gz"
    Target = Join-Path $langDir "chi_sim.traineddata.gz"
  },
  @{
    Url = "https://tessdata.projectnaptha.com/4.0.0_best/eng.traineddata.gz"
    Target = Join-Path $langDir "eng.traineddata.gz"
  }
)

foreach ($item in $downloads) {
  Write-Host "Downloading $($item.Url)"
  Invoke-WebRequest -Uri $item.Url -OutFile $item.Target
}

Write-Host ""
Write-Host "OCR assets downloaded to: $ocrRoot"
