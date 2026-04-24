# Vercel 部署步骤（手机可直接访问）

## 1. 推送代码到 GitHub

先下载并纳入 OCR 本地资源（推荐）：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\download-ocr-assets.ps1
```

在项目根目录执行：

```bash
git add .
git commit -m "feat: web text enhance camera with mobile deployment"
git push origin main
```

## 2. 在 Vercel 导入仓库

1. 打开 Vercel 控制台，点击 `Add New Project`。
2. 选择该 GitHub 仓库。
3. Framework Preset 选择 `Other`。
4. Build Command 留空，Output Directory 留空。
5. 点击 Deploy。

## 3. 验证手机端

1. 用手机打开部署后的 `https://xxx.vercel.app`。
2. 允许相机权限。
3. 验证拍照增强和 OCR 识别链路。

## 4. 可选：绑定自定义域名

在 Vercel 的 `Domains` 页面添加域名，按提示配置 DNS，证书会自动签发。
