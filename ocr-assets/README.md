# OCR 本地资源目录

本目录用于托管 OCR 引擎和语言模型，部署到 Vercel 后可直接通过 HTTPS 访问，减少移动网络下纯 CDN 加载的不稳定。

## 目录结构

- `ocr-assets/tesseract/tesseract.min.js`
- `ocr-assets/tesseract/worker.min.js`
- `ocr-assets/tesseract/tesseract-core.wasm.js`
- `ocr-assets/tesseract/tesseract-core.wasm`
- `ocr-assets/lang/chi_sim.traineddata.gz`
- `ocr-assets/lang/eng.traineddata.gz`

## 下载方式

在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\download-ocr-assets.ps1
```
