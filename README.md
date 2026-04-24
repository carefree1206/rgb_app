# 文字增强相机（网页版）

这是一个纯前端网页项目，支持：
- 相机预览
- 拍照增强
- OCR 文字识别与复制

## 本地运行

```bash
cd D:\Project\rgb_app
python -m http.server 5173
```

浏览器打开：`http://127.0.0.1:5173/index.html`

## 手机端访问

请使用 HTTPS 公网地址（例如 Vercel 部署地址），否则手机浏览器通常无法调用相机权限。

推荐部署流程：
1. 推送到 GitHub
2. 在 Vercel 导入仓库
3. Framework 选 `Other`
4. 发布后使用 `https://xxx.vercel.app`

## OCR 资源

项目支持 OCR 本地资源优先加载，目录如下：
- `ocr-assets/tesseract/`
- `ocr-assets/lang/`

下载脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\download-ocr-assets.ps1
```

## 说明

`start-web.bat` 仅用于本地开发调试，不作为手机正式入口。
