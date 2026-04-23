# 微信小程序：文字增强相机（V1）

这是一个原生微信小程序示例，聚焦“文档文字更清晰”的拍摄体验，包含以下能力：

- 实时预览增强（灰度、对比度、锐化、降噪）
- 两段式变焦（相机原生变焦 + 画面数字变焦）
- 拍照后本地增强（纯端侧，不依赖云开发）
- 根据设备档位自动调整实时增强强度（`high / mid / low`）

## 项目结构

- `miniprogram/`：小程序前端代码
- `docs/test-plan.md`：手工测试清单

## 运行方式

1. 用微信开发者工具打开项目根目录。
2. 在 `project.config.json` 中确认 `appid`。
3. 点击“编译”运行。

## 启动性能优化（已启用）

本项目已启用以下特性以降低启动注入开销：

1. 按需注入  
在 `miniprogram/app.json` 中配置：

```json
{
  "lazyCodeLoading": "requiredComponents"
}
```

2. 用时注入  
将结果对比区域拆为自定义组件，并为其配置占位组件：

- 页面配置：`miniprogram/pages/camera/index.json`
- 实际组件：`miniprogram/components/result-compare/`
- 占位组件：`miniprogram/components/result-compare-placeholder/`

这样结果组件不会在首屏启动时注入，首次渲染到该组件时才注入并替换占位内容。

## 说明

- V1 不包含 OCR 文字识别，仅做画面清晰化增强。
- 当前版本为纯本地方案，不依赖微信云开发。
- “透视矫正”在界面中作为预留开关，后续可接入更强图像算法。
