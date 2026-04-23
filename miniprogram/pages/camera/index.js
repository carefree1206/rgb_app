const { CameraState, EnhanceMode } = require("../../types/enhance");
const { detectDeviceTier, getRealtimePreset } = require("../../utils/device");
const { enhanceFrame } = require("../../utils/enhancer");

const PROFILE_VERSION = "local-document-v1";

const CAMERA_STATE_TEXT = {
  [CameraState.IDLE]: "待机",
  [CameraState.PREVIEWING]: "实时预览中",
  [CameraState.PROCESSING]: "处理中",
  [CameraState.UPLOADING]: "上传中",
  [CameraState.DONE]: "完成",
  [CameraState.ERROR]: "异常"
};

const DEVICE_TIER_TEXT = {
  high: "高性能",
  mid: "均衡",
  low: "省电"
};

const ENHANCE_MODE_TEXT = {
  [EnhanceMode.REALTIME]: "实时优先",
  [EnhanceMode.CAPTURE]: "拍照优先"
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Page({
  data: {
    cameraState: CameraState.IDLE,
    cameraStateText: CAMERA_STATE_TEXT[CameraState.IDLE],
    enhanceMode: EnhanceMode.REALTIME,
    enhanceModeText: ENHANCE_MODE_TEXT[EnhanceMode.REALTIME],
    permissionGranted: false,
    permissionDenied: false,
    realtimeEnabled: true,
    realtimeAvailable: true,
    perspectiveCorrection: false,
    deviceTier: "mid",
    deviceTierLabel: DEVICE_TIER_TEXT.mid,
    presetLabel: "--",
    zoom: 1,
    maxZoom: 5,
    digitalZoom: 1,
    enhanceStrength: 70,
    fps: 0,
    processingMs: 0,
    errorMessage: "",
    showResult: false,
    rawPhoto: "",
    enhancedPhoto: "",
    metricsText: "",
    canRetry: false,
    showPermissionMask: true,
    overlayClass: "enhance-hidden",
    resultImagePath: "",
    realtimeModeClass: "mode-chip-active",
    captureModeClass: "",
    captureCanvasWidth: 1,
    captureCanvasHeight: 1
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const isDevtools = (systemInfo.platform || "").toLowerCase() === "devtools";
    this.deviceTier = detectDeviceTier(systemInfo);
    this.realtimePreset = getRealtimePreset(this.deviceTier);
    if (isDevtools) {
      this.realtimePreset.realtimeEnabled = false;
    }

    this.dynamicProcessEveryMs = this.realtimePreset.processEveryMs;
    this.processingFrame = false;
    this.lastFrameProcessAt = 0;
    this.statsUpdateAt = 0;
    this.fpsWindowStart = 0;
    this.fpsFrameCount = 0;
    this.cameraContext = null;
    this.frameListener = null;
    this.canvasNode = null;
    this.canvasContext = null;
    this.captureCanvasNode = null;
    this.captureCanvasContext = null;
    this.captureNodeReady = false;
    this.canvasReady = false;
    this.lastRealtimeFrame = null;

    this.setData({
      deviceTier: this.deviceTier,
      deviceTierLabel: DEVICE_TIER_TEXT[this.deviceTier] || this.deviceTier,
      presetLabel: this.realtimePreset.label,
      realtimeAvailable: this.realtimePreset.realtimeEnabled,
      realtimeEnabled: this.realtimePreset.realtimeEnabled,
      enhanceModeText: ENHANCE_MODE_TEXT[this.data.enhanceMode]
    });
    this.syncModeClass(this.data.enhanceMode);
  },

  async onReady() {
    try {
      this.cameraContext = wx.createCameraContext();
      await this.initCanvasNodes();
      await this.ensureCameraPermission(false);
      this.syncFrameListener();
    } catch (error) {
      this.setCameraState(CameraState.ERROR, {
        errorMessage: `初始化失败：${this.toUserError(error)}`
      });
    }
  },

  onShow() {
    this.ensureCameraPermission(false)
      .then(() => {
        this.syncFrameListener();
      })
      .catch(() => {
        this.setData({ showPermissionMask: true });
      });
  },

  onHide() {
    this.stopFrameListener();
  },

  onUnload() {
    this.stopFrameListener();
  },

  setCameraState(nextState, extra) {
    this.setData(
      Object.assign(
        {
          cameraState: nextState,
          cameraStateText: CAMERA_STATE_TEXT[nextState] || nextState
        },
        extra || {}
      )
    );
  },

  async initCanvasNodes() {
    const query = wx.createSelectorQuery().in(this);
    return new Promise((resolve) => {
      query.select("#enhanceCanvas").fields({ node: true, size: true });
      query.select("#captureCanvasNode").fields({ node: true, size: true });
      query.exec((res) => {
        const previewNodeData = res && res[0];
        const captureNodeData = res && res[1];

        if (!previewNodeData || !previewNodeData.node) {
          this.setData({
            realtimeAvailable: false,
            realtimeEnabled: false,
            errorMessage: "当前设备不支持实时画布节点，已自动关闭实时增强。"
          });
          this.canvasReady = false;
          resolve();
          return;
        }

        let dpr = 2;
        try {
          if (typeof wx.getWindowInfo === "function") {
            dpr = wx.getWindowInfo().pixelRatio || 2;
          } else {
            dpr = wx.getSystemInfoSync().pixelRatio || 2;
          }
        } catch (error) {
          dpr = 2;
        }

        const previewCanvas = previewNodeData.node;
        previewCanvas.width = Math.floor(previewNodeData.width * dpr);
        previewCanvas.height = Math.floor(previewNodeData.height * dpr);
        const previewContext = previewCanvas.getContext("2d");
        previewContext.imageSmoothingEnabled = true;
        this.canvasNode = previewCanvas;
        this.canvasContext = previewContext;
        this.canvasReady = true;

        if (captureNodeData && captureNodeData.node) {
          const captureCanvas = captureNodeData.node;
          captureCanvas.width = 1;
          captureCanvas.height = 1;
          const captureContext = captureCanvas.getContext("2d");
          captureContext.imageSmoothingEnabled = false;
          this.captureCanvasNode = captureCanvas;
          this.captureCanvasContext = captureContext;
          this.captureNodeReady = true;
        } else {
          this.captureNodeReady = false;
        }

        resolve();
      });
    });
  },

  async ensureCameraPermission(requestIfNeeded) {
    const authInfo = await new Promise((resolve) => {
      wx.getSetting({
        success: (res) =>
          resolve({
            granted: Boolean(res.authSetting["scope.camera"]),
            known: Object.prototype.hasOwnProperty.call(res.authSetting || {}, "scope.camera")
          }),
        fail: () =>
          resolve({
            granted: false,
            known: false
          })
      });
    });

    if (authInfo.granted) {
      this.setData({
        permissionGranted: true,
        permissionDenied: false,
        showPermissionMask: false
      });
      return true;
    }

    if (!requestIfNeeded) {
      this.setData({
        permissionGranted: false,
        permissionDenied: authInfo.known,
        showPermissionMask: true
      });
      return false;
    }

    try {
      await new Promise((resolve, reject) => {
        wx.authorize({
          scope: "scope.camera",
          success: resolve,
          fail: reject
        });
      });

      this.setData({
        permissionGranted: true,
        permissionDenied: false,
        showPermissionMask: false,
        errorMessage: ""
      });
      return true;
    } catch (error) {
      this.setData({
        permissionGranted: false,
        permissionDenied: true,
        showPermissionMask: true
      });
      return false;
    }
  },

  async requestCameraPermission() {
    const granted = await this.ensureCameraPermission(true);
    if (granted) {
      this.syncFrameListener();
    }
  },

  openSettingsForCamera() {
    wx.openSetting({
      success: () => {
        this.ensureCameraPermission(false).then(() => {
          this.syncFrameListener();
        });
      }
    });
  },

  handleCameraInitDone(event) {
    const detail = event.detail || {};
    const maxZoom = Number(detail.maxZoom || 5);
    this.setData({
      maxZoom: clamp(Number(maxZoom.toFixed(1)), 2, 10)
    });
  },

  handleCameraError(event) {
    const message = (event.detail && event.detail.errMsg) || "摄像头初始化失败。";
    this.setCameraState(CameraState.ERROR, {
      errorMessage: message
    });
    this.stopFrameListener();
  },

  handleModeChange(event) {
    const mode = event.detail.value;
    const realtimeEnabled = mode === EnhanceMode.REALTIME && this.data.realtimeAvailable;
    this.setData({
      enhanceMode: mode,
      enhanceModeText: ENHANCE_MODE_TEXT[mode] || mode,
      realtimeEnabled
    });
    this.syncModeClass(mode);
    this.syncFrameListener();
  },

  syncModeClass(mode) {
    const activeMode = mode || this.data.enhanceMode;
    this.setData({
      realtimeModeClass: activeMode === EnhanceMode.REALTIME ? "mode-chip-active" : "",
      captureModeClass: activeMode === EnhanceMode.CAPTURE ? "mode-chip-active" : ""
    });
  },

  handleRealtimeSwitchChange(event) {
    const realtimeEnabled = Boolean(event.detail.value) && this.data.realtimeAvailable;
    this.setData({ realtimeEnabled });
    this.syncFrameListener();
  },

  handlePerspectiveSwitchChange(event) {
    this.setData({
      perspectiveCorrection: Boolean(event.detail.value)
    });
  },

  handleNativeZoomChange(event) {
    const value = Number(event.detail.value || 1);
    this.setData({
      zoom: Number(clamp(value, 1, this.data.maxZoom).toFixed(2))
    });
  },

  handleDigitalZoomChange(event) {
    const value = Number(event.detail.value || 1);
    this.setData({
      digitalZoom: Number(clamp(value, 1, 2).toFixed(2))
    });
  },

  handleEnhanceStrengthChange(event) {
    const value = Number(event.detail.value || 70);
    this.setData({
      enhanceStrength: Math.round(clamp(value, 20, 100))
    });
  },

  syncFrameListener() {
    const shouldRun =
      this.data.permissionGranted &&
      this.data.realtimeEnabled &&
      this.data.realtimeAvailable &&
      this.canvasReady;

    if (shouldRun) {
      this.setData({
        overlayClass: ""
      });
      this.startFrameListener();
      return;
    }

    this.stopFrameListener();
    this.lastRealtimeFrame = null;
    this.setData({
      overlayClass: "enhance-hidden"
    });
    if (this.data.cameraState === CameraState.PREVIEWING) {
      this.setCameraState(CameraState.IDLE);
    }
  },

  startFrameListener() {
    if (this.frameListener || !this.cameraContext) {
      return;
    }

    if (typeof this.cameraContext.onCameraFrame !== "function") {
      this.setData({
        realtimeAvailable: false,
        realtimeEnabled: false,
        errorMessage: "当前环境不支持实时帧监听。"
      });
      return;
    }

    this.frameListener = this.cameraContext.onCameraFrame((frame) => {
      this.handleCameraFrame(frame);
    });

    try {
      this.frameListener.start();
      this.setCameraState(CameraState.PREVIEWING, {
        errorMessage: ""
      });
    } catch (error) {
      this.frameListener = null;
      this.setCameraState(CameraState.ERROR, {
        errorMessage: "实时帧监听启动失败。"
      });
    }
  },

  stopFrameListener() {
    if (!this.frameListener) {
      return;
    }
    try {
      this.frameListener.stop();
    } catch (error) {
      console.warn("Failed to stop frame listener:", error);
    }
    this.frameListener = null;
  },

  buildRealtimeOptions() {
    const strength = this.data.enhanceStrength / 100;
    const preset = this.realtimePreset || getRealtimePreset("mid");
    return {
      scale: clamp(preset.baseScale + (strength - 0.7) * 0.05, 0.46, 0.72),
      denoiseLevel: clamp(preset.denoiseLevel + strength * 0.06, 0, 0.36),
      contrastLevel: clamp(preset.contrastLevel + strength * 0.16, 0.9, 1.28),
      sharpenLevel: clamp(preset.sharpenLevel + strength * 0.12, 0.16, 0.88)
    };
  },

  buildCaptureOptions() {
    const strength = this.data.enhanceStrength / 100;
    return {
      scale: 1,
      denoiseLevel: clamp(0.05 + strength * 0.22, 0.04, 0.42),
      contrastLevel: clamp(0.95 + strength * 0.8, 0.95, 1.85),
      sharpenLevel: clamp(0.5 + strength * 0.95, 0.5, 1.95)
    };
  },

  handleCameraFrame(frame) {
    if (!frame || !frame.data || this.processingFrame) {
      return;
    }

    const now = Date.now();
    if (now - this.lastFrameProcessAt < this.dynamicProcessEveryMs) {
      return;
    }

    this.lastFrameProcessAt = now;
    this.processingFrame = true;

    const processStart = Date.now();
    setTimeout(() => {
      try {
        const options = this.buildRealtimeOptions();
        const enhanced = enhanceFrame(frame.data, frame.width, frame.height, options);
        this.drawEnhancedFrame(enhanced, frame);
      } catch (error) {
        this.setCameraState(CameraState.ERROR, {
          errorMessage: "实时增强处理失败，已自动停止。"
        });
        this.stopFrameListener();
      } finally {
        const doneAt = Date.now();
        this.trackFrameStats(processStart, doneAt);
        this.processingFrame = false;
      }
    }, 0);
  },

  drawEnhancedFrame(frame, rawFrame) {
    if (!this.canvasContext || !this.canvasNode) {
      return;
    }

    if (this.canvasNode.width !== frame.width || this.canvasNode.height !== frame.height) {
      this.canvasNode.width = frame.width;
      this.canvasNode.height = frame.height;
    }

    const imageData = this.canvasContext.createImageData(frame.width, frame.height);
    const output = imageData.data;
    const enhanced = frame.data;
    const previous = this.lastRealtimeFrame;
    const mix = clamp(0.24 + (this.data.enhanceStrength / 100) * 0.18, 0.22, 0.42);
    const source = rawFrame && rawFrame.data ? rawFrame.data : null;
    const srcWidth = rawFrame && rawFrame.width ? rawFrame.width : frame.width;
    const srcHeight = rawFrame && rawFrame.height ? rawFrame.height : frame.height;
    const xRatio = srcWidth / frame.width;
    const yRatio = srcHeight / frame.height;

    for (let y = 0; y < frame.height; y += 1) {
      const srcY = Math.min(srcHeight - 1, Math.floor(y * yRatio));
      for (let x = 0; x < frame.width; x += 1) {
        const outIdx = (y * frame.width + x) * 4;
        const luma = enhanced[outIdx];

        let baseR = luma;
        let baseG = luma;
        let baseB = luma;

        if (source) {
          const srcX = Math.min(srcWidth - 1, Math.floor(x * xRatio));
          const srcIdx = (srcY * srcWidth + srcX) * 4;
          baseR = source[srcIdx];
          baseG = source[srcIdx + 1];
          baseB = source[srcIdx + 2];
        }

        output[outIdx] = Math.round(baseR * (1 - mix) + luma * mix);
        output[outIdx + 1] = Math.round(baseG * (1 - mix) + luma * mix);
        output[outIdx + 2] = Math.round(baseB * (1 - mix) + luma * mix);
        output[outIdx + 3] = 255;
      }
    }

    if (previous && previous.length === output.length) {
      const temporal = 0.22;
      for (let i = 0; i < output.length; i += 4) {
        output[i] = Math.round(output[i] * (1 - temporal) + previous[i] * temporal);
        output[i + 1] = Math.round(output[i + 1] * (1 - temporal) + previous[i + 1] * temporal);
        output[i + 2] = Math.round(output[i + 2] * (1 - temporal) + previous[i + 2] * temporal);
      }
    }

    this.lastRealtimeFrame = new Uint8ClampedArray(output);
    this.canvasContext.putImageData(imageData, 0, 0);
  },

  trackFrameStats(startAt, endAt) {
    const now = endAt;
    this.fpsFrameCount += 1;
    if (!this.fpsWindowStart) {
      this.fpsWindowStart = now;
    }

    if (now - this.fpsWindowStart >= 1000) {
      const elapsed = now - this.fpsWindowStart;
      const fps = Math.round((this.fpsFrameCount * 1000) / elapsed);
      this.fpsWindowStart = now;
      this.fpsFrameCount = 0;
      this.setData({ fps });
    }

    const processMs = endAt - startAt;
    this.dynamicProcessEveryMs = clamp(
      Math.round(this.realtimePreset.processEveryMs + processMs * 0.7),
      this.realtimePreset.processEveryMs,
      140
    );

    if (now - this.statsUpdateAt > 300) {
      this.statsUpdateAt = now;
      this.setData({
        processingMs: processMs
      });
    }
  },

  async captureAndEnhance() {
    if (!this.data.permissionGranted) {
      this.setData({
        errorMessage: "请先授权相机权限。"
      });
      return;
    }

    if (!this.cameraContext) {
      this.setCameraState(CameraState.ERROR, {
        errorMessage: "相机上下文未初始化。"
      });
      return;
    }

    const hadRealtimeListener = Boolean(this.frameListener);
    if (hadRealtimeListener) {
      this.stopFrameListener();
    }

    try {
      this.setCameraState(CameraState.PROCESSING, {
        errorMessage: "",
        canRetry: false
      });

      const photoRes = await new Promise((resolve, reject) => {
        this.cameraContext.takePhoto({
          quality: "high",
          success: resolve,
          fail: reject
        });
      });

      const rawPhoto = photoRes.tempImagePath;
      this.setData({
        rawPhoto,
        enhancedPhoto: "",
        resultImagePath: rawPhoto,
        showResult: true
      });

      const localResult = await this.enhanceCapturedPhotoLocally(rawPhoto);
      this.applyLocalResult(localResult);
    } catch (error) {
      this.setCameraState(CameraState.ERROR, {
        errorMessage: this.toUserError(error),
        canRetry: Boolean(this.data.rawPhoto)
      });
    } finally {
      if (hadRealtimeListener) {
        this.syncFrameListener();
      }
    }
  },

  async retryLocalEnhance() {
    if (!this.data.rawPhoto) {
      this.setData({
        canRetry: false,
        errorMessage: "暂无可重试的照片，请先拍照。"
      });
      return;
    }

    try {
      this.setCameraState(CameraState.PROCESSING, {
        errorMessage: ""
      });

      const localResult = await this.enhanceCapturedPhotoLocally(this.data.rawPhoto);
      this.applyLocalResult(localResult);
    } catch (error) {
      this.setCameraState(CameraState.ERROR, {
        errorMessage: this.toUserError(error),
        canRetry: true
      });
    }
  },

  async enhanceCapturedPhotoLocally(photoPath) {
    const imageInfo = await new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: photoPath,
        success: resolve,
        fail: reject
      });
    });

    const normalizedSize = this.normalizeCaptureSize(imageInfo.width, imageInfo.height);
    const options = this.buildCaptureOptions();
    const startedAt = Date.now();

    let enhancedPath = "";
    let outputSize = `${normalizedSize.width}x${normalizedSize.height}`;
    let fallbackUsed = false;

    try {
      const nodeResult = await this.enhanceByNodeCanvas(photoPath, normalizedSize, options);
      enhancedPath = nodeResult.enhancedPath;
      outputSize = `${nodeResult.width}x${nodeResult.height}`;
    } catch (nodeError) {
      console.warn("Node canvas enhancement failed, fallback to legacy canvas:", nodeError);
      fallbackUsed = true;
      const legacyResult = await this.enhanceByLegacyCanvas(photoPath, normalizedSize, options);
      enhancedPath = legacyResult.enhancedPath;
      outputSize = `${legacyResult.width}x${legacyResult.height}`;
    }

    return {
      enhancedPath,
      metrics: {
        processMs: Date.now() - startedAt,
        profileVersion: PROFILE_VERSION,
        perspectiveApplied: false,
        outputSize,
        fallbackUsed
      }
    };
  },

  async enhanceByNodeCanvas(photoPath, normalizedSize, options) {
    if (!this.captureNodeReady || !this.captureCanvasNode || !this.captureCanvasContext) {
      throw new Error("node canvas unavailable");
    }

    const width = normalizedSize.width;
    const height = normalizedSize.height;
    this.captureCanvasNode.width = width;
    this.captureCanvasNode.height = height;
    this.captureCanvasContext = this.captureCanvasNode.getContext("2d");
    this.captureCanvasContext.imageSmoothingEnabled = false;

    const image = await this.loadCanvasImage(this.captureCanvasNode, photoPath);
    this.captureCanvasContext.clearRect(0, 0, width, height);
    this.captureCanvasContext.drawImage(image, 0, 0, width, height);

    const sourceImageData = this.captureCanvasContext.getImageData(0, 0, width, height);
    const enhanced = enhanceFrame(sourceImageData.data, width, height, options);

    this.captureCanvasNode.width = enhanced.width;
    this.captureCanvasNode.height = enhanced.height;
    this.captureCanvasContext = this.captureCanvasNode.getContext("2d");
    this.captureCanvasContext.imageSmoothingEnabled = false;

    const outputImageData = this.captureCanvasContext.createImageData(enhanced.width, enhanced.height);
    outputImageData.data.set(enhanced.data);
    this.captureCanvasContext.putImageData(outputImageData, 0, 0);

    const enhancedPath = await this.exportNodeCanvas(enhanced.width, enhanced.height);
    return {
      enhancedPath,
      width: enhanced.width,
      height: enhanced.height
    };
  },

  async enhanceByLegacyCanvas(photoPath, normalizedSize, options) {
    const width = normalizedSize.width;
    const height = normalizedSize.height;
    await this.setLegacyCanvasSize(width, height);

    const ctx = wx.createCanvasContext("captureCanvasLegacy", this);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(photoPath, 0, 0, width, height);
    await this.drawLegacyContext(ctx);

    const sourceImageData = await this.legacyGetImageData(width, height);
    const enhanced = enhanceFrame(sourceImageData.data, width, height, options);

    await this.legacyPutImageData(enhanced.data, enhanced.width, enhanced.height);
    const enhancedPath = await this.exportLegacyCanvas(enhanced.width, enhanced.height);
    return {
      enhancedPath,
      width: enhanced.width,
      height: enhanced.height
    };
  },

  setLegacyCanvasSize(width, height) {
    return new Promise((resolve) => {
      this.setData(
        {
          captureCanvasWidth: width,
          captureCanvasHeight: height
        },
        async () => {
          await wait(16);
          resolve();
        }
      );
    });
  },

  drawLegacyContext(ctx) {
    return new Promise((resolve) => {
      ctx.draw(false, () => resolve());
    });
  },

  legacyGetImageData(width, height) {
    return new Promise((resolve, reject) => {
      wx.canvasGetImageData({
        canvasId: "captureCanvasLegacy",
        x: 0,
        y: 0,
        width,
        height,
        success: resolve,
        fail: reject
      });
    });
  },

  legacyPutImageData(data, width, height) {
    return new Promise((resolve, reject) => {
      wx.canvasPutImageData({
        canvasId: "captureCanvasLegacy",
        data,
        x: 0,
        y: 0,
        width,
        height,
        success: resolve,
        fail: reject
      });
    });
  },

  exportNodeCanvas(width, height) {
    return new Promise((resolve, reject) => {
      if (!this.captureCanvasNode || typeof this.captureCanvasNode.toTempFilePath !== "function") {
        reject(new Error("node canvas export unavailable"));
        return;
      }

      this.captureCanvasNode.toTempFilePath({
        x: 0,
        y: 0,
        width,
        height,
        destWidth: width,
        destHeight: height,
        fileType: "jpg",
        quality: 0.92,
        success: (res) => resolve(res.tempFilePath),
        fail: reject
      });
    });
  },

  exportLegacyCanvas(width, height) {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath(
        {
          canvasId: "captureCanvasLegacy",
          x: 0,
          y: 0,
          width,
          height,
          destWidth: width,
          destHeight: height,
          fileType: "jpg",
          quality: 0.92,
          success: (res) => resolve(res.tempFilePath),
          fail: reject
        },
        this
      );
    });
  },

  normalizeCaptureSize(width, height) {
    const maxSide = 1280;
    const w = Number(width || 0);
    const h = Number(height || 0);
    if (!w || !h) {
      return { width: 1280, height: 720 };
    }

    const larger = Math.max(w, h);
    if (larger <= maxSide) {
      return { width: w, height: h };
    }

    const ratio = maxSide / larger;
    return {
      width: Math.max(1, Math.round(w * ratio)),
      height: Math.max(1, Math.round(h * ratio))
    };
  },

  loadCanvasImage(canvas, src) {
    return new Promise((resolve, reject) => {
      const image = canvas.createImage();
      image.onload = () => resolve(image);
      image.onerror = (error) => reject(error);
      image.src = src;
    });
  },

  applyLocalResult(result) {
    const metrics = result.metrics || {};
    const processMs = metrics.processMs ? `${metrics.processMs}ms` : "--";
    const profileVersion = metrics.profileVersion || PROFILE_VERSION;
    const outputSize = metrics.outputSize || "--";
    const fallbackTag = metrics.fallbackUsed ? " / 兼容模式" : "";

    this.setCameraState(CameraState.DONE, {
      enhancedPhoto: result.enhancedPath || "",
      resultImagePath: result.enhancedPath || this.data.rawPhoto,
      metricsText: `耗时 ${processMs} / ${profileVersion} / ${outputSize}${fallbackTag}`,
      errorMessage: "",
      canRetry: false
    });
  },

  toUserError(error) {
    const raw = (error && (error.errMsg || error.message)) || "未知错误";
    if (raw.includes("timeout") || raw.includes("Timeout")) {
      return "接口超时，请重试或重新进入页面。";
    }
    if (raw.includes("permission")) {
      return "权限不足，请检查相机授权。";
    }
    if (raw.includes("canvas")) {
      return "Canvas 处理失败，已尝试兼容处理，请重试。";
    }
    if (raw.includes("fail")) {
      return `操作失败：${raw}`;
    }
    return `处理失败：${raw}`;
  }
});
