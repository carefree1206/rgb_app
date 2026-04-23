function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[y * outWidth + x] = luma;
    }
  }

  return {
    gray,
    width: outWidth,
    height: outHeight
  };
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
    const v = gray[i];
    rgba[idx] = v;
    rgba[idx + 1] = v;
    rgba[idx + 2] = v;
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

module.exports = {
  enhanceFrame
};
