const DEVICE_TIER = {
  HIGH: "high",
  MID: "mid",
  LOW: "low"
};

const REALTIME_PRESETS = {
  high: {
    label: "高",
    realtimeEnabled: true,
    processEveryMs: 30,
    baseScale: 0.42,
    denoiseLevel: 0.08,
    contrastLevel: 1.08,
    sharpenLevel: 0.52
  },
  mid: {
    label: "中",
    realtimeEnabled: true,
    processEveryMs: 45,
    baseScale: 0.36,
    denoiseLevel: 0.12,
    contrastLevel: 1.02,
    sharpenLevel: 0.44
  },
  low: {
    label: "低",
    realtimeEnabled: false,
    processEveryMs: 80,
    baseScale: 0.3,
    denoiseLevel: 0.16,
    contrastLevel: 0.95,
    sharpenLevel: 0.36
  }
};

function detectDeviceTier(systemInfo) {
  let info = systemInfo;
  if (!info) {
    try {
      info = wx.getSystemInfoSync();
    } catch (error) {
      return DEVICE_TIER.MID;
    }
  }

  const benchmarkLevel = Number(info.benchmarkLevel || 0);

  if (benchmarkLevel >= 30) {
    return DEVICE_TIER.HIGH;
  }

  if (benchmarkLevel >= 10) {
    return DEVICE_TIER.MID;
  }

  return DEVICE_TIER.LOW;
}

function getRealtimePreset(tier) {
  if (REALTIME_PRESETS[tier]) {
    return Object.assign({}, REALTIME_PRESETS[tier]);
  }
  return Object.assign({}, REALTIME_PRESETS.mid);
}

module.exports = {
  DEVICE_TIER,
  REALTIME_PRESETS,
  detectDeviceTier,
  getRealtimePreset
};
