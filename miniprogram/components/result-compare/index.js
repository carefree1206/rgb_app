Component({
  properties: {
    metricsText: {
      type: String,
      value: ""
    },
    rawPhoto: {
      type: String,
      value: ""
    },
    enhancedPhoto: {
      type: String,
      value: ""
    }
  },

  methods: {
    previewRaw() {
      this.openPreview(this.properties.rawPhoto);
    },

    previewEnhanced() {
      this.openPreview(this.properties.enhancedPhoto);
    },

    openPreview(current) {
      const urls = [this.properties.rawPhoto, this.properties.enhancedPhoto].filter((item) => !!item);
      if (!current || !urls.length) {
        wx.showToast({
          icon: "none",
          title: "暂无可预览图片"
        });
        return;
      }

      wx.previewImage({
        current,
        urls,
        fail: () => {
          wx.showToast({
            icon: "none",
            title: "图片预览失败"
          });
        }
      });
    }
  }
});
