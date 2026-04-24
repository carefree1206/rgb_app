# 文字增强相机（网页版）

这是一个纯前端静态站点，支持：
- 实时预览增强
- 拍照后增强
- OCR 文字识别（中文/英文）
- 识别结果复制

## 本地开发

1. 双击 `start-web.bat`  
2. 浏览器打开 `http://127.0.0.1:5173/index.html`

说明：本地入口仅用于开发调试，不是手机正式访问入口。

## 手机端正式访问（推荐）

使用 `GitHub -> Vercel -> HTTPS URL`：

1. 将项目推送到 GitHub。
2. 登录 Vercel，导入该仓库。
3. Framework 选择 `Other`（静态站点），无需构建命令。
4. 发布后获得 `https://xxx.vercel.app`。
5. 手机浏览器直接打开该 HTTPS 地址即可使用。

注意：手机调用摄像头必须在 HTTPS 下（`localhost/127.0.0.1` 本地例外）。

## OCR 资源策略（本地优先 + CDN 回退）

前端默认优先加载：
- `/ocr-assets/tesseract/tesseract.min.js`
- `/ocr-assets/tesseract/worker.min.js`
- `/ocr-assets/tesseract/tesseract-core.wasm.js`
- `/ocr-assets/lang/*.traineddata.gz`

若本地资源不存在，会自动回退到 CDN，并提供可重试提示。

### 下载 OCR 本地资源

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\download-ocr-assets.ps1
```

建议将下载后的 `ocr-assets` 一并提交到仓库，这样 Vercel 部署后手机端会优先走站点本地资源。

## 关键文件

- `index.html`：页面结构
- `style.css`：页面样式
- `app.js`：摄像头、增强、OCR 逻辑
- `vercel.json`：Vercel 静态部署配置
- `ocr-assets/`：本地 OCR 引擎与语言模型目录
- `scripts/download-ocr-assets.ps1`：OCR 资源下载脚本

## 手机端验收清单

1. iOS Safari / Android Chrome 能打开 HTTPS 地址。
2. 首次授权、拒绝授权、再次授权都能正常恢复。
3. 拍照增强 -> OCR 识别 -> 复制结果链路可用。
4. 弱网下 OCR 有加载状态提示，失败后可重试。
