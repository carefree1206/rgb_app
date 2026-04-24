(function main() {
  const elements = {
    statusText: document.getElementById("statusText"),
    tierText: document.getElementById("tierText"),
    fpsText: document.getElementById("fpsText"),
    processingText: document.getElementById("processingText"),
    modeText: document.getElementById("modeText"),
    chipRealtime: document.getElementById("chipRealtime"),
    chipCapture: document.getElementById("chipCapture"),
    permissionMask: document.getElementById("permissionMask"),
    grantCameraBtn: document.getElementById("grantCameraBtn"),
    cameraVideo: document.getElementById("cameraVideo"),
    overlayCanvas: document.getElementById("overlayCanvas"),
    previewStage: document.getElementById("previewStage"),
    realtimeHint: document.getElementById("realtimeHint"),
    realtimeToggle: document.getElementById("realtimeToggle"),
    nativeZoomRange: document.getElementById("nativeZoomRange"),
    nativeZoomText: document.getElementById("nativeZoomText"),
    nativeZoomHint: document.getElementById("nativeZoomHint"),
    digitalZoomRange: document.getElementById("digitalZoomRange"),
    digitalZoomText: document.getElementById("digitalZoomText"),
    strengthRange: document.getElementById("strengthRange"),
    strengthText: document.getElementById("strengthText"),
    captureBtn: document.getElementById("captureBtn"),
    retryBtn: document.getElementById("retryBtn"),
    errorCard: document.getElementById("errorCard"),
    errorText: document.getElementById("errorText"),
    resultCard: document.getElementById("resultCard"),
    metricsText: document.getElementById("metricsText"),
    rawImage: document.getElementById("rawImage"),
    enhancedImage: document.getElementById("enhancedImage"),
    ocrStatusText: document.getElementById("ocrStatusText"),
    ocrLangSelect: document.getElementById("ocrLangSelect"),
    recognizeBtn: document.getElementById("recognizeBtn"),
    copyTextBtn: document.getElementById("copyTextBtn"),
    ocrOutput: document.getElementById("ocrOutput"),
    workCanvas: document.getElementById("workCanvas"),
    captureCanvas: document.getElementById("captureCanvas")
  };

  const tierPresets = {
    high: {
      label: "高性能",
      processEveryMs: 28,
      baseScale: 0.58,
      denoiseLevel: 0.08,
      contrastLevel: 1.06,
      sharpenLevel: 0.44
    },
    mid: {
      label: "均衡",
      processEveryMs: 40,
      baseScale: 0.52,
      denoiseLevel: 0.12,
      contrastLevel: 1.01,
      sharpenLevel: 0.38
    },
    low: {
      label: "省电",
      processEveryMs: 70,
      baseScale: 0.46,
      denoiseLevel: 0.16,
      contrastLevel: 0.96,
      sharpenLevel: 0.34
    }
  };

  const OcrLoadState = Object.freeze({
    IDLE: "idle",
    LOADING: "loading",
    READY: "ready",
    FAILED: "failed"
  });

  const OcrRunState = Object.freeze({
    IDLE: "idle",
    RUNNING: "running",
    DONE: "done",
    ERROR: "error"
  });

  const ocrConfig = {
    scriptSources: [
      { name: "local", src: "/ocr-assets/tesseract/tesseract.min.js" },
      { name: "cdn", src: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js" }
    ],
    local: {
      workerPath: "/ocr-assets/tesseract/worker.min.js",
      langPath: "/ocr-assets/lang",
      corePath: "/ocr-assets/tesseract/tesseract-core.wasm.js"
    },
    cdn: {
      workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",
      langPath: "https://tessdata.projectnaptha.com/4.0.0_best",
      corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js"
    }
  };

  const state = {
    stream: null,
    track: null,
    tier: detectDeviceTier(),
    mode: "realtime",
    manualRealtimeEnabled: true,
    realtimeEnabled: true,
    processingRealtime: false,
    processIntervalMs: 40,
    lastProcessAt: 0,
    rafId: 0,
    lastRealtimeFrame: null,
    fpsCounter: 0,
    fpsWindowStart: 0,
    statsUpdateAt: 0,
    enhanceStrength: 70,
    nativeZoomAvailable: false,
    nativeZoomValue: 1,
    digitalZoomValue: 1,
    lastCaptureSource: null,
    lastRawImageUrl: "",
    lastEnhancedImageUrl: "",
    ocrLoadState: OcrLoadState.IDLE,
    ocrRunState: OcrRunState.IDLE,
    ocrLoadPromise: null,
    ocrSource: "",
    lastOcrText: ""
  };

  const overlayCtx = elements.overlayCanvas.getContext("2d", { alpha: true });
  const workCtx = elements.workCanvas.getContext("2d", { willReadFrequently: true });
  const captureCtx = elements.captureCanvas.getContext("2d", { willReadFrequently: true });

  initializeUI();
  bindEvents();
  refreshOcrControls();
  setStatus("待机");
  if (window.location.protocol === "file:") {
    showError("请不要直接双击 index.html 打开。请使用本地服务访问：http://127.0.0.1:5173/index.html");
  }
  if (!isSecureCameraContext()) {
    showError("当前不是 HTTPS 环境，手机端可能无法调用摄像头。请使用 Vercel HTTPS 地址访问。");
  }

  function initializeUI() {
    const preset = tierPresets[state.tier];
    state.processIntervalMs = preset.processEveryMs;
    elements.tierText.textContent = preset.label;
    elements.modeText.textContent = "当前模式：实时优先";
    elements.realtimeHint.textContent = "实时增强已开启，建议在真机中查看最终效果。";
    elements.nativeZoomText.textContent = "1.0";
    elements.digitalZoomText.textContent = "1.00";
    elements.strengthText.textContent = `${state.enhanceStrength}%`;
    elements.ocrOutput.value = "";
    setOcrStatus("尚未识别");
    setModeChip("realtime");
  }

  function bindEvents() {
    elements.grantCameraBtn.addEventListener("click", () => {
      startCamera();
    });

    document.querySelectorAll("input[name='mode']").forEach((radio) => {
      radio.addEventListener("change", (event) => {
        setMode(event.target.value);
      });
    });

    elements.realtimeToggle.addEventListener("change", (event) => {
      state.manualRealtimeEnabled = Boolean(event.target.checked);
      applyRealtimeState();
    });

    elements.nativeZoomRange.addEventListener("input", (event) => {
      const value = Number(event.target.value);
      setNativeZoom(value);
    });

    elements.digitalZoomRange.addEventListener("input", (event) => {
      const value = Number(event.target.value);
      setDigitalZoom(value);
    });

    elements.strengthRange.addEventListener("input", (event) => {
      state.enhanceStrength = clamp(Number(event.target.value), 20, 100);
      elements.strengthText.textContent = `${state.enhanceStrength}%`;
    });

    elements.captureBtn.addEventListener("click", () => {
      captureAndEnhance();
    });

    elements.retryBtn.addEventListener("click", () => {
      retryEnhance();
    });

    elements.recognizeBtn.addEventListener("click", () => {
      recognizeTextFromEnhancedImage();
    });

    elements.copyTextBtn.addEventListener("click", () => {
      copyRecognizedText();
    });

    elements.rawImage.addEventListener("click", () => {
      openPreview(state.lastRawImageUrl);
    });

    elements.enhancedImage.addEventListener("click", () => {
      openPreview(state.lastEnhancedImageUrl);
    });

    window.addEventListener("resize", () => {
      if (state.stream) {
        updateCanvasSizeFromVideo();
      }
    });
  }

  function isSecureCameraContext() {
    if (window.location.protocol === "https:") {
      return true;
    }
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1";
  }

  function setStatus(text) {
    elements.statusText.textContent = text;
  }

  function setPermissionMaskVisible(visible) {
    elements.permissionMask.hidden = !visible;
    elements.permissionMask.style.display = visible ? "grid" : "none";
  }

  function showError(message) {
    elements.errorText.textContent = message;
    elements.errorCard.hidden = false;
  }

  function clearError() {
    elements.errorText.textContent = "";
    elements.errorCard.hidden = true;
  }

  function setMode(mode) {
    state.mode = mode === "capture" ? "capture" : "realtime";
    setModeChip(state.mode);
    elements.modeText.textContent = `当前模式：${state.mode === "realtime" ? "实时优先" : "拍照优先"}`;
    applyRealtimeState();
  }

  function setModeChip(mode) {
    const realtimeActive = mode === "realtime";
    elements.chipRealtime.classList.toggle("mode-chip-active", realtimeActive);
    elements.chipCapture.classList.toggle("mode-chip-active", !realtimeActive);
  }

  function applyRealtimeState() {
    state.realtimeEnabled = state.mode === "realtime" && state.manualRealtimeEnabled;

    if (!state.realtimeEnabled) {
      stopRealtimeLoop();
      clearOverlay();
      elements.overlayCanvas.style.display = "none";
      elements.realtimeHint.textContent = state.mode === "capture" ? "拍照优先模式下，实时叠层默认关闭。" : "实时叠层已关闭。";
      if (state.stream) {
        setStatus("预览中");
      }
      return;
    }

    elements.overlayCanvas.style.display = "block";
    elements.realtimeHint.textContent = "实时增强已开启，建议在真机中查看最终效果。";
    if (state.stream) {
      startRealtimeLoop();
      setStatus("实时预览中");
    }
  }

  async function startCamera() {
    clearError();
    setStatus("初始化中");

    try {
      if (state.stream) {
        applyRealtimeState();
        setPermissionMaskVisible(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      state.stream = stream;
      state.track = stream.getVideoTracks()[0] || null;
      elements.cameraVideo.srcObject = stream;
      setPermissionMaskVisible(false);
      await elements.cameraVideo.play().catch(() => {});
      await waitVideoReady(elements.cameraVideo);
      updateCanvasSizeFromVideo();
      detectNativeZoomCapability();
      applyRealtimeState();

      if (!state.realtimeEnabled) {
        setStatus("预览中");
      }
    } catch (error) {
      setStatus("异常");
      setPermissionMaskVisible(true);
      showError(`摄像头启动失败：${toUserError(error)}`);
    }
  }

  function waitVideoReady(video) {
    return new Promise((resolve) => {
      if (video.readyState >= 2) {
        resolve();
        return;
      }
      video.onloadedmetadata = () => resolve();
    });
  }

  function updateCanvasSizeFromVideo() {
    const width = Math.max(1, elements.cameraVideo.videoWidth || 1280);
    const height = Math.max(1, elements.cameraVideo.videoHeight || 720);
    elements.overlayCanvas.width = width;
    elements.overlayCanvas.height = height;
    elements.workCanvas.width = width;
    elements.workCanvas.height = height;
  }

  function detectNativeZoomCapability() {
    if (!state.track || typeof state.track.getCapabilities !== "function") {
      disableNativeZoom("当前浏览器不支持原生变焦");
      return;
    }

    const capabilities = state.track.getCapabilities();
    if (!capabilities || typeof capabilities.zoom === "undefined") {
      disableNativeZoom("当前设备不支持原生变焦");
      return;
    }

    state.nativeZoomAvailable = true;
    elements.nativeZoomRange.disabled = false;
    elements.nativeZoomRange.min = String(capabilities.zoom.min ?? 1);
    elements.nativeZoomRange.max = String(capabilities.zoom.max ?? 1);
    elements.nativeZoomRange.step = String(capabilities.zoom.step ?? 0.1);
    elements.nativeZoomRange.value = String(capabilities.zoom.min ?? 1);
    state.nativeZoomValue = Number(elements.nativeZoomRange.value);
    elements.nativeZoomText.textContent = state.nativeZoomValue.toFixed(1);
    elements.nativeZoomHint.textContent = "支持原生变焦，优先使用相机硬件缩放。";
  }

  function disableNativeZoom(hint) {
    state.nativeZoomAvailable = false;
    elements.nativeZoomRange.disabled = true;
    elements.nativeZoomRange.min = "1";
    elements.nativeZoomRange.max = "1";
    elements.nativeZoomRange.step = "0.1";
    elements.nativeZoomRange.value = "1";
    state.nativeZoomValue = 1;
    elements.nativeZoomText.textContent = "1.0";
    elements.nativeZoomHint.textContent = hint;
  }

  async function setNativeZoom(value) {
    const zoom = Number.isFinite(value) ? value : 1;
    state.nativeZoomValue = zoom;
    elements.nativeZoomText.textContent = zoom.toFixed(1);

    if (!state.nativeZoomAvailable || !state.track || typeof state.track.applyConstraints !== "function") {
      return;
    }

    try {
      await state.track.applyConstraints({
        advanced: [{ zoom }]
      });
    } catch (error) {
      showError(`原生变焦设置失败：${toUserError(error)}`);
    }
  }

  function setDigitalZoom(value) {
    const zoom = clamp(value, 1, 2);
    state.digitalZoomValue = zoom;
    elements.digitalZoomText.textContent = zoom.toFixed(2);
    elements.previewStage.style.transform = `scale(${zoom})`;
  }

  function startRealtimeLoop() {
    if (state.rafId) {
      return;
    }

    state.lastProcessAt = 0;
    state.fpsCounter = 0;
    state.fpsWindowStart = 0;
    state.lastRealtimeFrame = null;
    elements.overlayCanvas.style.display = "block";
    state.rafId = requestAnimationFrame(realtimeTick);
  }

  function stopRealtimeLoop() {
    if (!state.rafId) {
      return;
    }
    cancelAnimationFrame(state.rafId);
    state.rafId = 0;
    state.processingRealtime = false;
  }

  function clearOverlay() {
    overlayCtx.clearRect(0, 0, elements.overlayCanvas.width, elements.overlayCanvas.height);
  }

  function realtimeTick(timestamp) {
    if (!state.realtimeEnabled || !state.stream) {
      stopRealtimeLoop();
      return;
    }

    if (!state.processingRealtime && timestamp - state.lastProcessAt >= state.processIntervalMs) {
      processRealtimeFrame(timestamp);
    }

    state.rafId = requestAnimationFrame(realtimeTick);
  }

  function processRealtimeFrame(timestamp) {
    if (!elements.cameraVideo.videoWidth || !elements.cameraVideo.videoHeight) {
      return;
    }

    state.processingRealtime = true;
    state.lastProcessAt = timestamp;
    const processStart = performance.now();

    try {
      const options = buildRealtimeOptions();
      const sourceWidth = elements.cameraVideo.videoWidth;
      const sourceHeight = elements.cameraVideo.videoHeight;
      const workWidth = Math.max(320, Math.round(sourceWidth * options.scale));
      const workHeight = Math.max(180, Math.round(sourceHeight * options.scale));
      ensureCanvasSize(elements.workCanvas, workWidth, workHeight);

      workCtx.imageSmoothingEnabled = true;
      workCtx.drawImage(elements.cameraVideo, 0, 0, workWidth, workHeight);
      const sourceImageData = workCtx.getImageData(0, 0, workWidth, workHeight);

      const enhanced = enhanceFrame(sourceImageData.data, workWidth, workHeight, {
        scale: 1,
        denoiseLevel: options.denoiseLevel,
        contrastLevel: options.contrastLevel,
        sharpenLevel: options.sharpenLevel
      });

      const blendedData = blendEnhancedWithColor(
        sourceImageData.data,
        enhanced.data,
        options.colorMix,
        state.lastRealtimeFrame,
        options.temporalBlend
      );

      const outputImageData = new ImageData(blendedData, enhanced.width, enhanced.height);
      workCtx.putImageData(outputImageData, 0, 0);

      overlayCtx.clearRect(0, 0, elements.overlayCanvas.width, elements.overlayCanvas.height);
      overlayCtx.drawImage(elements.workCanvas, 0, 0, elements.overlayCanvas.width, elements.overlayCanvas.height);
      state.lastRealtimeFrame = blendedData;

      updateRealtimeStats(performance.now() - processStart);
      setStatus("实时预览中");
    } catch (error) {
      stopRealtimeLoop();
      setStatus("异常");
      showError(`实时增强失败：${toUserError(error)}`);
    } finally {
      state.processingRealtime = false;
    }
  }

  function updateRealtimeStats(processMs) {
    const now = performance.now();
    state.fpsCounter += 1;

    if (!state.fpsWindowStart) {
      state.fpsWindowStart = now;
    }

    if (now - state.fpsWindowStart >= 1000) {
      const elapsed = now - state.fpsWindowStart;
      const fps = Math.round((state.fpsCounter * 1000) / elapsed);
      elements.fpsText.textContent = String(fps);
      state.fpsCounter = 0;
      state.fpsWindowStart = now;
    }

    const preset = tierPresets[state.tier];
    state.processIntervalMs = clamp(Math.round(preset.processEveryMs + processMs * 0.7), preset.processEveryMs, 160);

    if (now - state.statsUpdateAt > 220) {
      elements.processingText.textContent = `单帧耗时 ${Math.round(processMs)}ms`;
      state.statsUpdateAt = now;
    }
  }

  function buildRealtimeOptions() {
    const preset = tierPresets[state.tier];
    const strength = state.enhanceStrength / 100;
    return {
      scale: clamp(preset.baseScale + (strength - 0.7) * 0.06, 0.42, 0.75),
      denoiseLevel: clamp(preset.denoiseLevel + strength * 0.06, 0.04, 0.34),
      contrastLevel: clamp(preset.contrastLevel + strength * 0.12, 0.92, 1.25),
      sharpenLevel: clamp(preset.sharpenLevel + strength * 0.1, 0.2, 0.86),
      colorMix: clamp(0.22 + strength * 0.16, 0.22, 0.4),
      temporalBlend: 0.22
    };
  }

  function buildCaptureOptions() {
    const strength = state.enhanceStrength / 100;
    return {
      denoiseLevel: clamp(0.05 + strength * 0.22, 0.04, 0.42),
      contrastLevel: clamp(0.96 + strength * 0.8, 0.96, 1.85),
      sharpenLevel: clamp(0.52 + strength * 0.95, 0.52, 1.95),
      colorMix: clamp(0.34 + strength * 0.26, 0.34, 0.66)
    };
  }

  async function captureAndEnhance() {
    clearError();

    if (!state.stream || !elements.cameraVideo.videoWidth) {
      showError("摄像头尚未就绪，请先点击“开启摄像头”。");
      return;
    }

    setStatus("处理中");
    elements.captureBtn.disabled = true;
    elements.retryBtn.hidden = true;

    try {
      const target = normalizeCaptureSize(elements.cameraVideo.videoWidth, elements.cameraVideo.videoHeight, 1400);
      ensureCanvasSize(elements.captureCanvas, target.width, target.height);
      captureCtx.imageSmoothingEnabled = true;
      captureCtx.drawImage(elements.cameraVideo, 0, 0, target.width, target.height);

      const rawDataUrl = elements.captureCanvas.toDataURL("image/jpeg", 0.92);
      const sourceImageData = captureCtx.getImageData(0, 0, target.width, target.height);
      state.lastCaptureSource = {
        width: target.width,
        height: target.height,
        data: new Uint8ClampedArray(sourceImageData.data)
      };

      const startedAt = performance.now();
      const enhancedResult = enhanceFromSource(state.lastCaptureSource);
      const elapsed = Math.round(performance.now() - startedAt);
      const enhancedDataUrl = enhancedResult.dataUrl;

      showResult(rawDataUrl, enhancedDataUrl, `耗时 ${elapsed}ms / ${target.width}x${target.height}`);
      setStatus(state.realtimeEnabled ? "实时预览中" : "预览中");
    } catch (error) {
      setStatus("异常");
      showError(`拍照增强失败：${toUserError(error)}`);
      elements.retryBtn.hidden = !state.lastCaptureSource;
    } finally {
      elements.captureBtn.disabled = false;
    }
  }

  function retryEnhance() {
    clearError();
    if (!state.lastCaptureSource) {
      showError("暂无可重试的拍照数据，请先拍照。");
      return;
    }

    try {
      setStatus("处理中");
      elements.captureBtn.disabled = true;
      const startedAt = performance.now();
      const enhancedResult = enhanceFromSource(state.lastCaptureSource);
      const elapsed = Math.round(performance.now() - startedAt);
      showResult(state.lastRawImageUrl, enhancedResult.dataUrl, `耗时 ${elapsed}ms / ${state.lastCaptureSource.width}x${state.lastCaptureSource.height}`);
      setStatus(state.realtimeEnabled ? "实时预览中" : "预览中");
      elements.retryBtn.hidden = true;
    } catch (error) {
      setStatus("异常");
      showError(`重新增强失败：${toUserError(error)}`);
      elements.retryBtn.hidden = false;
    } finally {
      elements.captureBtn.disabled = false;
    }
  }

  function enhanceFromSource(source) {
    ensureCanvasSize(elements.captureCanvas, source.width, source.height);
    const sourceData = new Uint8ClampedArray(source.data);
    const options = buildCaptureOptions();
    const enhanced = enhanceFrame(sourceData, source.width, source.height, {
      scale: 1,
      denoiseLevel: options.denoiseLevel,
      contrastLevel: options.contrastLevel,
      sharpenLevel: options.sharpenLevel
    });
    const blendedData = blendEnhancedWithColor(sourceData, enhanced.data, options.colorMix, null, 0);
    const outputImageData = new ImageData(blendedData, enhanced.width, enhanced.height);
    captureCtx.putImageData(outputImageData, 0, 0);
    return {
      dataUrl: elements.captureCanvas.toDataURL("image/jpeg", 0.92)
    };
  }

  function showResult(rawSrc, enhancedSrc, metricsText) {
    state.lastRawImageUrl = rawSrc;
    state.lastEnhancedImageUrl = enhancedSrc;
    state.lastOcrText = "";
    state.ocrRunState = OcrRunState.IDLE;
    elements.rawImage.src = rawSrc;
    elements.enhancedImage.src = enhancedSrc;
    elements.metricsText.textContent = metricsText;
    elements.ocrOutput.value = "";
    setOcrStatus("可开始识别");
    refreshOcrControls();
    elements.resultCard.hidden = false;
  }

  function setOcrStatus(text) {
    elements.ocrStatusText.textContent = text;
  }

  function formatOcrProgressStatus(status) {
    const mapping = {
      "loading tesseract core": "加载 OCR 核心",
      "initializing tesseract": "初始化 OCR",
      "loading language traineddata": "加载语言模型",
      "initializing api": "初始化识别器",
      "recognizing text": "文字识别中"
    };
    return mapping[status] || status || "处理中";
  }

  function refreshOcrControls() {
    const hasEnhancedImage = Boolean(state.lastEnhancedImageUrl);
    const isBusy = state.ocrLoadState === OcrLoadState.LOADING || state.ocrRunState === OcrRunState.RUNNING;
    elements.recognizeBtn.disabled = !hasEnhancedImage || isBusy;
    elements.copyTextBtn.disabled = !state.lastOcrText || isBusy;
  }

  function isTesseractReady() {
    return Boolean(window.Tesseract && typeof window.Tesseract.recognize === "function");
  }

  function loadExternalScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-ocr-src="${src}"]`);
      if (existing?.dataset.loaded === "true") {
        resolve();
        return;
      }

      if (existing?.dataset.failed === "true") {
        existing.remove();
      }

      const loadingScript = document.querySelector(`script[data-ocr-src="${src}"]`);
      if (loadingScript) {
        loadingScript.addEventListener("load", () => resolve(), { once: true });
        loadingScript.addEventListener("error", () => reject(new Error(`脚本加载失败：${src}`)), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.ocrSrc = src;
      script.addEventListener(
        "load",
        () => {
          script.dataset.loaded = "true";
          resolve();
        },
        { once: true }
      );
      script.addEventListener(
        "error",
        () => {
          script.dataset.failed = "true";
          reject(new Error(`脚本加载失败：${src}`));
        },
        { once: true }
      );
      document.head.appendChild(script);
    });
  }

  async function ensureOcrEngineReady() {
    if (isTesseractReady()) {
      state.ocrLoadState = OcrLoadState.READY;
      if (!state.ocrSource) {
        state.ocrSource = "cdn";
      }
      return true;
    }

    if (state.ocrLoadPromise) {
      return state.ocrLoadPromise;
    }

    state.ocrLoadState = OcrLoadState.LOADING;
    setOcrStatus("OCR 引擎加载中...");
    refreshOcrControls();

    state.ocrLoadPromise = (async () => {
      let lastError = null;
      for (const source of ocrConfig.scriptSources) {
        try {
          await loadExternalScript(source.src);
          if (isTesseractReady()) {
            state.ocrLoadState = OcrLoadState.READY;
            state.ocrSource = source.name;
            setOcrStatus(source.name === "local" ? "OCR 引擎已就绪（本地资源）" : "OCR 引擎已就绪（CDN）");
            return true;
          }
        } catch (error) {
          lastError = error;
        }
      }

      state.ocrLoadState = OcrLoadState.FAILED;
      state.ocrSource = "";
      setOcrStatus("OCR 引擎加载失败，点击识别可重试");
      if (lastError) {
        showError(`OCR 引擎加载失败：${toUserError(lastError)}`);
      }
      return false;
    })();

    try {
      return await state.ocrLoadPromise;
    } finally {
      state.ocrLoadPromise = null;
      refreshOcrControls();
    }
  }

  function getOcrRuntimeOptions() {
    const source = state.ocrSource === "local" ? "local" : "cdn";
    const cfg = ocrConfig[source];
    return {
      workerPath: cfg.workerPath,
      langPath: cfg.langPath,
      corePath: cfg.corePath
    };
  }

  async function recognizeTextFromEnhancedImage() {
    clearError();
    if (!state.lastEnhancedImageUrl) {
      showError("请先拍照并增强，再进行文字识别。");
      return;
    }
    if (state.ocrRunState === OcrRunState.RUNNING) {
      return;
    }

    state.lastOcrText = "";
    elements.ocrOutput.value = "";
    const ready = await ensureOcrEngineReady();
    if (!ready) {
      state.ocrRunState = OcrRunState.ERROR;
      refreshOcrControls();
      return;
    }

    state.ocrRunState = OcrRunState.RUNNING;
    refreshOcrControls();
    setStatus("识别中");
    setOcrStatus("准备识别模型...");

    const language = elements.ocrLangSelect.value || "chi_sim+eng";
    const runtimeOptions = getOcrRuntimeOptions();

    try {
      const result = await window.Tesseract.recognize(state.lastEnhancedImageUrl, language, {
        workerPath: runtimeOptions.workerPath,
        langPath: runtimeOptions.langPath,
        corePath: runtimeOptions.corePath,
        logger: (message) => {
          if (message && typeof message.progress === "number" && message.status) {
            const percent = Math.round(message.progress * 100);
            setOcrStatus(`${formatOcrProgressStatus(message.status)} ${percent}%`);
          }
        }
      });

      const text = normalizeOcrText(result?.data?.text || "");
      state.lastOcrText = text;
      if (text) {
        elements.ocrOutput.value = text;
        setOcrStatus("识别完成");
      } else {
        elements.ocrOutput.value = "未识别到有效文字，请尝试提高增强强度或调整拍摄角度后重试。";
        setOcrStatus("识别完成（无有效文本）");
      }
      state.ocrRunState = OcrRunState.DONE;
      setStatus(state.realtimeEnabled ? "实时预览中" : "预览中");
    } catch (error) {
      state.ocrRunState = OcrRunState.ERROR;
      setStatus("异常");
      setOcrStatus("识别失败");
      showError(`文字识别失败：${toUserError(error)}`);
    } finally {
      refreshOcrControls();
    }
  }

  async function copyRecognizedText() {
    if (!state.lastOcrText) {
      showError("暂无可复制的识别结果。");
      return;
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(state.lastOcrText);
      } else {
        elements.ocrOutput.focus();
        elements.ocrOutput.select();
        document.execCommand("copy");
        elements.ocrOutput.setSelectionRange(0, 0);
      }
      setOcrStatus("已复制识别结果");
    } catch (error) {
      showError(`复制失败：${toUserError(error)}`);
    }
  }

  function normalizeOcrText(text) {
    return String(text || "")
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line, index, arr) => line.length > 0 || (index > 0 && arr[index - 1].length > 0))
      .join("\n")
      .trim();
  }

  function openPreview(currentSrc) {
    if (!currentSrc) {
      return;
    }
    const popup = window.open(currentSrc, "_blank", "noopener,noreferrer");
    if (popup) {
      return;
    }
    const link = document.createElement("a");
    link.href = currentSrc;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function ensureCanvasSize(canvas, width, height) {
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function normalizeCaptureSize(width, height, maxSide) {
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
  }

  function detectDeviceTier() {
    const cores = Number(navigator.hardwareConcurrency || 4);
    const memory = Number(navigator.deviceMemory || 4);
    if (cores >= 8 && memory >= 6) {
      return "high";
    }
    if (cores >= 4 && memory >= 4) {
      return "mid";
    }
    return "low";
  }

  function toUserError(error) {
    const text = error && (error.message || error.name || String(error));
    if (!text) {
      return "未知错误";
    }
    const lower = text.toLowerCase();
    if (lower.includes("permission")) {
      return "权限不足，请确认浏览器已允许摄像头访问。";
    }
    if (lower.includes("notallowederror")) {
      return "你拒绝了摄像头权限，请在浏览器设置中开启。";
    }
    if (lower.includes("notfounderror")) {
      return "未检测到可用摄像头设备。";
    }
    if (lower.includes("timeout")) {
      return "处理超时，请重试。";
    }
    if (lower.includes("failed to fetch")) {
      return "网络请求失败，请检查网络后重试。";
    }
    return text;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function blendEnhancedWithColor(sourceRgba, enhancedRgba, mix, previousFrame, temporalBlend) {
    const output = new Uint8ClampedArray(enhancedRgba.length);
    for (let i = 0; i < enhancedRgba.length; i += 4) {
      const luma = enhancedRgba[i];
      output[i] = Math.round(sourceRgba[i] * (1 - mix) + luma * mix);
      output[i + 1] = Math.round(sourceRgba[i + 1] * (1 - mix) + luma * mix);
      output[i + 2] = Math.round(sourceRgba[i + 2] * (1 - mix) + luma * mix);
      output[i + 3] = 255;
    }
    if (previousFrame && previousFrame.length === output.length && temporalBlend > 0) {
      for (let i = 0; i < output.length; i += 4) {
        output[i] = Math.round(output[i] * (1 - temporalBlend) + previousFrame[i] * temporalBlend);
        output[i + 1] = Math.round(output[i + 1] * (1 - temporalBlend) + previousFrame[i + 1] * temporalBlend);
        output[i + 2] = Math.round(output[i + 2] * (1 - temporalBlend) + previousFrame[i + 2] * temporalBlend);
      }
    }
    return output;
  }

  function buildGrayDownsampled(srcRgba, srcWidth, srcHeight, scale) {
    const safeScale = clamp(scale || 0.5, 0.35, 1);
    const outWidth = Math.max(240, Math.floor(srcWidth * safeScale));
    const outHeight = Math.max(180, Math.floor(srcHeight * safeScale));
    const gray = new Uint8ClampedArray(outWidth * outHeight);
    const xRatio = srcWidth / outWidth;
    const yRatio = srcHeight / outHeight;

    for (let y = 0; y < outHeight; y += 1) {
      const srcY = Math.min(srcHeight - 1, Math.floor(y * yRatio));
      for (let x = 0; x < outWidth; x += 1) {
        const srcX = Math.min(srcWidth - 1, Math.floor(x * xRatio));
        const srcIdx = (srcY * srcWidth + srcX) * 4;
        const r = srcRgba[srcIdx];
        const g = srcRgba[srcIdx + 1];
        const b = srcRgba[srcIdx + 2];
        gray[y * outWidth + x] = 0.299 * r + 0.587 * g + 0.114 * b;
      }
    }

    return { gray, width: outWidth, height: outHeight };
  }

  function boxBlur(gray, width, height, radius) {
    const blurRadius = Math.max(1, Math.floor(radius || 1));
    const integral = new Float32Array((width + 1) * (height + 1));

    for (let y = 1; y <= height; y += 1) {
      let rowSum = 0;
      for (let x = 1; x <= width; x += 1) {
        rowSum += gray[(y - 1) * width + (x - 1)];
        const integralIdx = y * (width + 1) + x;
        integral[integralIdx] = integral[integralIdx - (width + 1)] + rowSum;
      }
    }

    const output = new Uint8ClampedArray(width * height);
    for (let y = 0; y < height; y += 1) {
      const top = Math.max(0, y - blurRadius);
      const bottom = Math.min(height - 1, y + blurRadius);
      for (let x = 0; x < width; x += 1) {
        const left = Math.max(0, x - blurRadius);
        const right = Math.min(width - 1, x + blurRadius);
        const area = (bottom - top + 1) * (right - left + 1);
        const a = top * (width + 1) + left;
        const b = top * (width + 1) + (right + 1);
        const c = (bottom + 1) * (width + 1) + left;
        const d = (bottom + 1) * (width + 1) + (right + 1);
        const sum = integral[d] - integral[b] - integral[c] + integral[a];
        output[y * width + x] = sum / area;
      }
    }
    return output;
  }

  function enhanceGray(gray, width, height, options) {
    const denoiseLevel = clamp(options.denoiseLevel || 0, 0, 1);
    const contrastLevel = clamp(options.contrastLevel || 1, 0, 2);
    const sharpenLevel = clamp(options.sharpenLevel || 0, 0, 2);
    const localBlur = boxBlur(gray, width, height, 1);
    const wideBlur = boxBlur(gray, width, height, 2);
    const outGray = new Uint8ClampedArray(width * height);

    for (let i = 0; i < outGray.length; i += 1) {
      const base = gray[i];
      const localMean = localBlur[i];
      const denoised = base * (1 - denoiseLevel) + localMean * denoiseLevel;
      const contrastEnhanced = denoised + contrastLevel * (denoised - localMean);
      const sharpened = contrastEnhanced + sharpenLevel * (contrastEnhanced - wideBlur[i]);
      outGray[i] = clamp(sharpened, 0, 255);
    }
    return outGray;
  }

  function grayToRgba(gray, width, height) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < gray.length; i += 1) {
      const idx = i * 4;
      const value = gray[i];
      rgba[idx] = value;
      rgba[idx + 1] = value;
      rgba[idx + 2] = value;
      rgba[idx + 3] = 255;
    }
    return rgba;
  }

  function enhanceFrame(frameData, srcWidth, srcHeight, options) {
    const srcRgba = frameData instanceof Uint8Array ? frameData : new Uint8ClampedArray(frameData);
    const sampled = buildGrayDownsampled(srcRgba, srcWidth, srcHeight, options.scale);
    const enhancedGray = enhanceGray(sampled.gray, sampled.width, sampled.height, options);
    const rgba = grayToRgba(enhancedGray, sampled.width, sampled.height);
    return {
      width: sampled.width,
      height: sampled.height,
      data: rgba
    };
  }
})();
