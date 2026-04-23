const CameraState = {
  IDLE: "idle",
  PREVIEWING: "previewing",
  PROCESSING: "processing",
  UPLOADING: "uploading",
  DONE: "done",
  ERROR: "error"
};

const EnhanceMode = {
  REALTIME: "realtime",
  CAPTURE: "capture"
};

module.exports = {
  CameraState,
  EnhanceMode
};
