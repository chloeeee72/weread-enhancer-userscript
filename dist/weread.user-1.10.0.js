// ==UserScript==
// @name         微信读书增强脚本
// @version      1.10.0
// @namespace    http://tampermonkey.net/
// @description  增加多功能按钮，内含多种颜色护眼模式、调整页面宽度、AI 语音阅读、自动翻页滚动、定时停止、图片复制与下载
// @author       Chloe
// @match        https://weread.qq.com/web/reader/*
// @icon         https://weread.qq.com/favicon.ico
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @grant        GM_setClipboard
// @license      MIT
// ==/UserScript==

(function() {
  "use strict";
  const baseCss = "*{font-family: TsangerJinKai05 !important;}\n.readerTopBar{font-family: SourceHanSerifCN-Bold !important;}\n.bookInfo_title{font-family: SourceHanSerifCN-Bold !important;}\n.readerTopBar_title_link{font-family: SourceHanSerifCN-Bold !important; font-weight:bold !important;}\n.readerTopBar_title_chapter{font-family: SourceHanSerifCN-Bold !important;}\n.readerChapterContent{color: rgba(0,0,0,100) !important;}\n.readerControls{margin-left: calc(50% - 60px) !important; margin-bottom: -28px !important;}\n\n.custom-notification {\n  position: fixed;\n  top: 20px;\n  left: 50%;\n  transform: translateX(-50%);\n  background: rgba(0, 0, 0, 0.9);\n  color: white;\n  padding: 12px 24px;\n  border-radius: 6px;\n  z-index: 9999999;\n  font-size: 14px;\n  font-weight: 500;\n  transition: all 0.3s ease-in-out;\n  box-shadow: 0 4px 12px rgba(0,0,0,0.15);\n  max-width: 80%;\n  text-align: center;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.custom-notification.fade-out {\n  opacity: 0;\n  transform: translateX(-50%) translateY(-20px);\n}\n";
  const controlPanelCss = `.control-panel {
  position: fixed;
  left: 60px;
  top: 50%;
  transform: translateY(-50%);
  width: 320px;
  max-width: calc(100vw - 80px);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  box-sizing: border-box;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 30px 15px 15px 15px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  z-index: 99998;
  transition: background-color 0.3s ease;
  cursor: move;
  user-select: none;
}

.panel-resizer {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  z-index: 2;
  background: transparent;
  transition: background-color 0.15s ease;
}

.panel-resizer:hover,
.panel-resizer.resizing {
  background: rgba(76, 175, 80, 0.25);
}

.panel-resizer::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 32px;
  border-radius: 1px;
  background: #bbb;
  opacity: 0.55;
}

.control-panel.dragging {
  opacity: 0.9;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.control-panel-close {
  position: absolute;
  right: 8px;
  top: 8px;
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #999;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  z-index: 1;
}

.control-panel-close:hover {
  background: #f0f0f0;
  color: #333;
}

.control-section {
  margin: 15px 0;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.control-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.control-section-title {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  margin-bottom: 10px;
  text-align: center;
}

.reading-tabs {
  display: flex;
  gap: 4px;
  margin: 0 0 12px;
  padding: 3px;
  background: #f0f0f0;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
}

.reading-tab {
  flex: 1;
  height: 28px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #666;
  font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  cursor: pointer;
}

.reading-tab:hover {
  color: #333;
  background: rgba(0, 0, 0, 0.04);
}

.reading-tab.active {
  background: #4CAF50;
  color: #fff;
  font-weight: 600;
}

.reading-panel {
  width: 100%;
  min-height: 0;
  min-width: 0;
}

.control-item {
  margin: 10px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-label {
  font-size: 12px;
  color: #666;
  margin-right: 6px;
  min-width: 56px;
  flex-shrink: 0;
}

.slider-box {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.slider-box .control-slider {
  width: 100%;
}

.control-select,
.range-input {
  height: 30px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #333;
  font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  box-sizing: border-box;
}

.control-select {
  flex: 1;
  min-width: 0;
  padding: 0 6px;
}

.range-input {
  flex: 1;
  min-width: 0;
  padding: 0 8px;
}

.range-fields {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #eee;
}

.range-row {
  display: flex;
  gap: 8px;
}

.range-row .control-item {
  flex: 1;
  min-width: 0;
  margin: 8px 0 0;
}

.range-row .control-label {
  min-width: 40px;
  margin-right: 6px;
}

.control-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

.control-checkbox input {
  accent-color: #4f8cff;
}

body:not(.wr_whiteTheme) .control-select,
body:not(.wr_whiteTheme) .range-input {
  background: #444;
  color: #f5f5f5;
  border-color: #555;
}

body:not(.wr_whiteTheme) .range-fields {
  border-top-color: #3e3e3e;
}

body:not(.wr_whiteTheme) .control-checkbox {
  color: #cfcfcf;
}

body:not(.wr_whiteTheme) .reading-tabs {
  background: #3a3a3a;
  border-color: #4a4a4a;
}

body:not(.wr_whiteTheme) .reading-tab {
  color: #bdbdbd;
}

body:not(.wr_whiteTheme) .reading-tab:hover {
  color: #f5f5f5;
  background: rgba(255, 255, 255, 0.06);
}

body:not(.wr_whiteTheme) .reading-tab.active {
  background: #4CAF50;
  color: #fff;
}

.control-slider {
  width: 100%;
  height: 4px;
  background: #ddd;
  accent-color: #4CAF50;
  outline: none;
  opacity: 0.7;
  transition: opacity .2s;
  border-radius: 2px;
}

.control-slider:hover {
  opacity: 1;
}

.control-value {
  font-size: 12px;
  color: #333;
  min-width: 40px;
  text-align: center;
  font-family: monospace;
  flex-shrink: 0;
}

.control-buttons {
  display: flex;
  gap: 5px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.control-btn {
  flex: 1;
  padding: 6px 8px;
  font-size: 12px;
  border: 1px solid #ddd;
  background: #f5f5f5;
  border-radius: 4px;
  cursor: pointer;
  text-align: center;
  min-width: 60px;
}

.control-btn:hover {
  background: #e9e9e9;
}

.control-btn.active {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.control-btn.reset {
  background: #ff9800;
  color: white;
  border-color: #ff9800;
}

.control-btn.reset:hover {
  background: #f57c00;
}

.control-btn.disabled {
  background: #cccccc;
  color: #666666;
  cursor: not-allowed;
  border-color: #cccccc;
}

.control-btn.secondary {
  background: #e0e0e0;
  color: #333;
  border-color: #bdbdbd;
}

.color-options {
  display: flex;
  gap: 10px;
  margin: 10px 0;
  justify-content: center;
  flex-wrap: wrap;
}

.color-option-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}

.color-option {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid #ddd;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.color-option:hover {
  transform: scale(1.1);
  box-shadow: 0 3px 6px rgba(0,0,0,0.15);
}

.color-option.active {
  border-color: #333;
  transform: scale(1.1);
  box-shadow: 0 3px 8px rgba(0,0,0,0.2);
}

.color-name {
  font-size: 10px;
  color: #666;
  text-align: center;
  min-width: 40px;
}

.timer-display {
  font-size: 12px;
  color: #666;
  text-align: center;
  margin-top: 5px;
}

.settings-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  background: currentColor;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z'/%3E%3C/svg%3E") no-repeat center;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z'/%3E%3C/svg%3E") no-repeat center;
}

body:not(.wr_whiteTheme) .panel-resizer::after {
  background: #888;
}
`;
  const progressBarCss = "#auto-turn-progress {\n  position: fixed;\n  bottom: 20px;\n  right: 20px;\n  background: white;\n  border: 1px solid #ddd;\n  border-radius: 8px;\n  padding: 10px 15px 8px;\n  box-shadow: 0 2px 10px rgba(0,0,0,0.1);\n  z-index: 99997;\n  min-width: 172px;\n  display: none;\n}\n\n.timer-popup-row,\n.page-turn-popup-row {\n  min-width: 140px;\n}\n\n.timer-popup-row {\n  padding-bottom: 2px;\n}\n\n.page-turn-popup-row {\n  padding-top: 2px;\n}\n\n.page-turn-popup-row + .timer-popup-row,\n.timer-popup-row + .page-turn-popup-row {\n  border-top: 1px solid #eee;\n  margin-top: 4px;\n  padding-top: 6px;\n}\n\n.progress-text {\n  font-size: 12px;\n  color: #333;\n  margin-bottom: 5px;\n  text-align: center;\n  white-space: nowrap;\n}\n\n.progress-bar {\n  width: 100%;\n  height: 6px;\n  background: #f0f0f0;\n  border-radius: 3px;\n  overflow: hidden;\n}\n\n.progress-fill {\n  height: 100%;\n  background: #2196F3;\n  border-radius: 3px;\n  transition: width 0.1s linear;\n  width: 100%;\n}\n\nbody:not(.wr_whiteTheme) #auto-turn-progress {\n  background: #2f2f2f;\n  border-color: #4a4a4a;\n}\n\nbody:not(.wr_whiteTheme) .progress-text {\n  color: #e5e5e5;\n}\n\nbody:not(.wr_whiteTheme) .page-turn-popup-row + .timer-popup-row,\nbody:not(.wr_whiteTheme) .timer-popup-row + .page-turn-popup-row {\n  border-top-color: #444;\n}\n";
  const imageToolsCss = ".image-toolbar-container {\n  position: absolute;\n  top: 5px;\n  right: 5px;\n  z-index: 1000;\n  display: none;\n}\n\n.image-toolbar {\n  display: flex;\n  gap: 3px;\n  background: rgba(0,0,0,0.7);\n  border-radius: 4px;\n  padding: 3px;\n  backdrop-filter: blur(5px);\n}\n\n.image-tool-btn {\n  background: none;\n  border: none;\n  color: white;\n  font-size: 12px;\n  cursor: pointer;\n  padding: 4px;\n  border-radius: 3px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 24px;\n  height: 24px;\n  transition: all 0.2s ease;\n}\n\n.image-tool-btn:hover:not(.disabled) {\n  background: rgba(255,255,255,0.2);\n  transform: scale(1.1);\n}\n\n.image-tool-btn.disabled {\n  opacity: 0.5;\n  cursor: not-allowed;\n  transform: none;\n}\n\n.image-tool-btn.loading {\n  opacity: 0.7;\n  cursor: wait;\n}\n\n.image-tool-icon {\n  font-size: 12px;\n  line-height: 1;\n}\n\n.passage-content {\n  position: relative !important;\n}\n\n.passage-content .image-toolbar-container {\n  position: absolute;\n  top: 5px;\n  right: 5px;\n  z-index: 1001;\n}\n\n.passageContent_wrapper .image-toolbar-container {\n  position: absolute;\n  top: 5px;\n  right: 5px;\n}\n";
  const imagePreviewCss = ".image-preview-overlay {\n  position: fixed;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 100%;\n  background: rgba(0,0,0,0.5);\n  z-index: 100000;\n  display: none;\n}\n\n.image-preview-overlay {\n  background: rgba(17, 24, 39, 0.45) !important;\n  backdrop-filter: blur(2px);\n}\n\n.image-preview-overlay.theme-dark {\n  background: rgba(0, 0, 0, 0.62) !important;\n}\n\n.image-preview-panel {\n  position: fixed;\n  top: 50%;\n  left: 50%;\n  transform: translate(-50%, -50%);\n  border: 1px solid #ddd;\n  border-radius: 8px;\n  z-index: 100001;\n  width: 95%;\n  max-width: 1200px;\n  height: 90vh;\n  display: none;\n  flex-direction: column;\n  overflow: hidden;\n  --ip-panel-bg: #ffffff;\n  --ip-subtle-bg: #f7f8fa;\n  --ip-surface-bg: #ffffff;\n  --ip-thumb-bg: #eef2f6;\n  --ip-border: #d9dee7;\n  --ip-text: #1f2937;\n  --ip-muted: #667085;\n  --ip-hover: #f0f7f2;\n  --ip-shadow: 0 18px 50px rgba(15, 23, 42, 0.18);\n  --ip-accent: #2f9e44;\n  --ip-accent-soft: rgba(47, 158, 68, 0.18);\n  background: var(--ip-panel-bg) !important;\n  border-color: var(--ip-border) !important;\n  color: var(--ip-text) !important;\n  box-shadow: var(--ip-shadow) !important;\n}\n\n.image-preview-panel.theme-dark {\n  --ip-panel-bg: #171a21;\n  --ip-subtle-bg: #1f2430;\n  --ip-surface-bg: #202632;\n  --ip-thumb-bg: #262d3a;\n  --ip-border: #353d4c;\n  --ip-text: #edf2f7;\n  --ip-muted: #aab4c3;\n  --ip-hover: #263241;\n  --ip-shadow: 0 18px 50px rgba(0, 0, 0, 0.42);\n  --ip-accent: #63b3ed;\n  --ip-accent-soft: rgba(99, 179, 237, 0.22);\n}\n\n.image-preview-panel.theme-light {\n  background: #ffffff;\n  border-color: #ddd;\n  color: #222;\n}\n\n.image-preview-header,\n.image-preview-scan-banner,\n.image-preview-controls,\n.image-preview-actions,\n.image-preview-stats {\n  background: var(--ip-subtle-bg) !important;\n  border-color: var(--ip-border) !important;\n  color: var(--ip-text) !important;\n}\n\n.image-preview-header {\n  padding: 15px 20px;\n  border-bottom: 1px solid #eee;\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  flex-shrink: 0;\n  min-height: 60px;\n  box-sizing: border-box;\n}\n\n.image-preview-header-main {\n  display: flex;\n  align-items: center;\n  gap: 14px;\n  min-width: 0;\n}\n\n.image-preview-title,\n.image-preview-stats,\n.select-all-label,\n.image-preview-empty,\n.image-preview-meta,\n.image-preview-loading-title,\n.image-preview-loading-stats,\n.image-preview-loading-tip,\n.image-preview-loading-status,\n.image-preview-info,\n.image-preview-info div {\n  color: var(--ip-text) !important;\n}\n\n.image-preview-meta,\n.image-preview-loading-tip,\n.image-preview-loading-status,\n.image-preview-panel .image-preview-info div:not(:first-child) {\n  color: var(--ip-muted) !important;\n}\n\n.image-preview-title {\n  font-size: 16px;\n  font-weight: bold;\n  color: #333;\n}\n\n.image-preview-close {\n  background: none;\n  border: none;\n  font-size: 20px;\n  cursor: pointer;\n  width: 30px;\n  height: 30px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  border-radius: 50%;\n  color: var(--ip-muted) !important;\n}\n\n.image-preview-close:hover {\n  background: var(--ip-hover) !important;\n  color: var(--ip-text) !important;\n}\n\n.image-preview-content-container {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  min-height: 0;\n}\n\n.image-preview-scan-banner {\n  display: none;\n  padding: 12px 20px 14px;\n  border-bottom: 1px solid #eee;\n  gap: 8px;\n  flex-shrink: 0;\n}\n\n.image-preview-scan-banner.is-visible {\n  display: flex !important;\n  flex-direction: column;\n}\n\n.image-preview-scan-banner.is-complete .image-preview-scan-banner-bar {\n  display: none;\n}\n\n.image-preview-scan-banner.is-complete {\n  background: linear-gradient(180deg, rgba(34, 197, 94, 0.14), rgba(34, 197, 94, 0.06)) !important;\n  padding: 10px 20px;\n  gap: 6px;\n}\n\n.image-preview-scan-banner.is-complete .image-preview-scan-banner-status {\n  display: none;\n}\n\n.image-preview-scan-banner.is-complete .image-preview-scan-banner-title {\n  color: #15803d !important;\n}\n\n.image-preview-panel.theme-dark .image-preview-scan-banner.is-complete .image-preview-scan-banner-title {\n  color: #86efac !important;\n}\n\n.image-preview-scan-banner.is-complete .image-preview-scan-banner-status {\n  color: #15803d !important;\n  font-weight: 700;\n}\n\n.image-preview-panel.theme-dark .image-preview-scan-banner.is-complete .image-preview-scan-banner-status {\n  color: #bbf7d0 !important;\n}\n\n.image-preview-scan-banner.is-complete .image-preview-scan-banner-main {\n  align-items: center;\n  gap: 10px;\n  justify-content: space-between;\n}\n\n.image-preview-scan-banner.is-complete .image-preview-scan-banner-meta {\n  display: flex;\n  gap: 8px;\n}\n\n.image-preview-scan-banner.is-complete .image-preview-scan-banner-status {\n  margin-top: -2px;\n}\n\n.image-preview-scan-banner.is-complete .image-preview-scan-count {\n  padding: 2px 9px;\n  font-size: 12px;\n}\n\n.image-preview-scan-banner.is-complete .image-preview-scan-eta {\n  font-size: 11px;\n}\n\n.image-preview-scan-banner-main {\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n  gap: 12px;\n  flex-wrap: wrap;\n}\n\n.image-preview-scan-banner-title {\n  font-size: 14px;\n  font-weight: 600;\n  color: var(--ip-text) !important;\n}\n\n.image-preview-scan-banner-meta,\n.image-preview-scan-banner-status {\n  font-size: 12px;\n  color: var(--ip-muted) !important;\n}\n\n.image-preview-scan-banner-meta {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  flex-wrap: wrap;\n}\n\n.image-preview-scan-count {\n  display: inline-flex;\n  align-items: center;\n  padding: 3px 10px;\n  border-radius: 999px;\n  font-size: 13px;\n  font-weight: 800;\n  letter-spacing: 0.02em;\n  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);\n}\n\n.image-preview-scan-count-discovered {\n  color: #fff7ed !important;\n  background: linear-gradient(135deg, #f97316, #ef4444) !important;\n}\n\n.image-preview-scan-count-loaded {\n  color: #ecfeff !important;\n  background: linear-gradient(135deg, #0ea5e9, #2563eb) !important;\n}\n\n.image-preview-scan-eta {\n  font-size: 12px;\n  font-weight: 600;\n  color: var(--ip-muted) !important;\n}\n\n.image-preview-scan-banner-bar {\n  width: 100%;\n  height: 6px;\n  border-radius: 999px;\n  overflow: hidden;\n  background: var(--ip-thumb-bg) !important;\n}\n\n.image-preview-scan-banner-fill {\n  width: 0%;\n  height: 100%;\n  border-radius: 999px;\n  background: linear-gradient(90deg, #4caf50, #2196f3);\n  transition: width 0.16s ease;\n}\n\n.image-preview-stats {\n  padding: 12px 20px;\n  border-bottom: 1px solid #eee;\n  font-size: 14px;\n  text-align: center;\n  flex-shrink: 0;\n  min-height: 44px;\n  box-sizing: border-box;\n}\n\n.image-preview-controls {\n  display: none;\n}\n\n.select-all-container {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.select-all-container-inline {\n  padding: 4px 10px;\n  border-radius: 999px;\n  background: var(--ip-surface-bg) !important;\n  border: 1px solid var(--ip-border) !important;\n}\n\n.select-all-checkbox {\n  width: 16px;\n  height: 16px;\n  cursor: pointer;\n}\n\n.select-all-label {\n  font-size: 14px;\n  cursor: pointer;\n  font-weight: 500;\n}\n\n.image-preview-content {\n  flex: 1 1 auto;\n  overflow-y: auto;\n  padding: 0 20px;\n  min-height: 0;\n  max-height: none;\n  background: var(--ip-panel-bg) !important;\n}\n\n.image-preview-loading {\n  height: 100%;\n  min-height: 42vh;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 14px;\n  text-align: center;\n  padding: 40px 20px;\n}\n\n.image-preview-loading-title {\n  font-size: 18px;\n  font-weight: 600;\n}\n\n.image-preview-loading-stats {\n  font-size: 14px;\n  color: inherit;\n  opacity: 0.85;\n}\n\n.image-preview-loading-bar {\n  width: min(520px, 80%);\n  height: 8px;\n  border-radius: 999px;\n  overflow: hidden;\n  background: var(--ip-thumb-bg) !important;\n}\n\n.image-preview-loading-fill {\n  width: 0%;\n  height: 100%;\n  border-radius: 999px;\n  background: linear-gradient(90deg, #4caf50, #2196f3);\n  transition: width 0.12s linear;\n}\n\n.image-preview-loading-tip {\n  font-size: 12px;\n  opacity: 0.75;\n}\n\n.image-preview-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));\n  gap: 5px;\n  align-content: flex-start;\n}\n\n.image-preview-item {\n  border: 1px solid var(--ip-border) !important;\n  border-radius: 8px;\n  overflow: hidden;\n  cursor: pointer;\n  transition: all 0.2s ease;\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  height: 100%;\n  min-height: 300px; \n  background: var(--ip-panel-bg) !important;\n}\n\n.image-preview-item:hover {\n  background: var(--ip-hover) !important;\n  border-color: var(--ip-accent) !important;\n  box-shadow: 0 4px 16px var(--ip-accent-soft) !important;\n  transform: translateY(-2px);\n}\n\n.image-preview-item.selected {\n  border-color: var(--ip-accent) !important;\n  box-shadow: 0 0 0 2px var(--ip-accent-soft) !important;\n}\n\n.image-preview-checkbox {\n  position: absolute;\n  top: 8px;\n  left: 8px;\n  z-index: 2;\n  width: 18px;\n  height: 18px;\n  cursor: pointer;\n}\n\n.image-preview-thumb {\n  width: 100%;\n  height: 140px;\n  object-fit: cover;\n  display: block;\n  background: var(--ip-thumb-bg) !important;\n}\n\n.image-preview-info {\n  padding: 20px;\n  font-size: 12px;\n  border-top: 1px solid #eee;\n  text-align: center;\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  justify-content: flex-start;\n  gap: 4px;\n  background: var(--ip-panel-bg) !important;\n}\n\n.image-preview-info div {\n  margin-bottom: 0;\n}\n\n.image-preview-info div:first-child {\n  font-weight: bold;\n  font-size: 13px;\n}\n\n.image-preview-file-name {\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.image-preview-meta {\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.image-action-buttons {\n  margin-top: auto;\n}\n\n.image-action-buttons {\n  display: flex;\n  gap: 6px;\n  margin-top: 6px;\n  justify-content: center;\n}\n\n.image-action-btn,\n.image-preview-panel .control-btn {\n  background: var(--ip-surface-bg) !important;\n  color: var(--ip-text) !important;\n  border-color: var(--ip-border) !important;\n}\n\n.image-action-btn {\n  padding: 4px 10px;\n  font-size: 11px;\n  border: 1px solid #ddd;\n  border-radius: 4px;\n  cursor: pointer;\n  transition: all 0.2s ease;\n  flex: 1;\n  max-width: 70px;\n}\n\n.image-action-btn:hover,\n.image-preview-panel .control-btn:hover {\n  background: var(--ip-accent) !important;\n  border-color: var(--ip-accent) !important;\n  color: #fff !important;\n}\n\n.image-action-btn.loading,\n.image-action-btn.disabled {\n  background: #ccc;\n  color: #666;\n  border-color: #ccc;\n  cursor: not-allowed;\n}\n\n.image-preview-actions {\n  padding: 18px 20px 22px;\n  border-top: 1px solid #eee;\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));\n  gap: 12px;\n  align-items: stretch;\n  flex-shrink: 0;\n  box-sizing: border-box;\n  margin-bottom: 0;\n}\n\n.image-preview-actions .control-btn {\n  width: 100%;\n  min-width: 0;\n  box-sizing: border-box;\n  white-space: normal;\n  word-break: keep-all;\n  line-height: 1.4;\n  min-height: 44px;\n}\n\n.image-preview-content::-webkit-scrollbar {\n  width: 8px;\n}\n\n.image-preview-content::-webkit-scrollbar-track {\n  background: #f1f1f1;\n  border-radius: 4px;\n}\n\n.image-preview-content::-webkit-scrollbar-thumb {\n  background: #c1c1c1;\n  border-radius: 4px;\n}\n\n.image-preview-content::-webkit-scrollbar-thumb:hover {\n  background: #a8a8a8;\n}\n\n.image-preview-empty {\n  text-align: center;\n  padding: 40px;\n  font-size: 14px;\n}\n\n@media (max-height: 800px) {\n  .image-preview-panel {\n    height: 95vh;\n    top: 50%;\n  }\n\n  .image-preview-thumb {\n    height: 120px;\n  }\n}\n\n@media (max-width: 768px) {\n  .image-preview-panel {\n    width: 98%;\n    height: 95vh;\n  }\n\n  .image-preview-grid {\n    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));\n    gap: 10px;\n  }\n\n  .image-preview-actions {\n    gap: 8px;\n  }\n\n  .image-preview-panel .control-btn {\n    min-width: auto;\n    width: 100%;\n  }\n}\n\n@media (max-width: 520px) {\n  .image-preview-header {\n    gap: 8px;\n    align-items: flex-start;\n  }\n\n  .image-preview-stats {\n    font-size: 12px;\n  }\n\n  .image-preview-actions {\n    grid-template-columns: minmax(0, 1fr);\n    padding: 16px;\n  }\n}\n";
  const voiceReadCss = '.voice-quick {\n  position: fixed;\n  right: 16px;\n  bottom: 24px;\n  z-index: 2147483647;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 8px 12px;\n  background: rgba(255, 255, 255, 0.96);\n  color: #333;\n  border: 1px solid #ddd;\n  border-radius: 8px;\n  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);\n  font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n  cursor: move;\n  user-select: none;\n  transition: transform 0.18s ease, opacity 0.18s ease;\n}\n\n.voice-quick.edge-hidden[data-edge="left"] {\n  transform: translateX(calc(-100% + 12px));\n}\n\n.voice-quick.edge-hidden[data-edge="right"] {\n  transform: translateX(calc(100% - 32px));\n}\n\n.voice-quick.edge-hidden[data-edge="top"] {\n  transform: translateY(calc(-100% + 8px));\n}\n\n.voice-quick.edge-hidden[data-edge="bottom"] {\n  transform: translateY(calc(100% - 8px));\n}\n\n.voice-quick.dragging {\n  opacity: 0.92;\n  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);\n}\n\n.voice-quick button {\n  height: 28px;\n  border: 1px solid #ddd;\n  border-radius: 4px;\n  background: #f5f5f5;\n  color: #333;\n  font: inherit;\n  min-width: 46px;\n  cursor: pointer;\n}\n\n.voice-quick button:hover {\n  background: #e9e9e9;\n}\n\n.voice-quick-status {\n  color: #666;\n  min-width: 52px;\n  text-align: right;\n}\n\nbody:not(.wr_whiteTheme) .voice-quick {\n  background: rgba(68, 68, 68, 0.96);\n  color: #f5f5f5;\n  border-color: #555;\n}\n\nbody:not(.wr_whiteTheme) .voice-quick button {\n  background: #555;\n  color: #f5f5f5;\n  border-color: #666;\n}\n\nbody:not(.wr_whiteTheme) .voice-quick button:hover {\n  background: #666;\n}\n\nbody:not(.wr_whiteTheme) .voice-quick-status {\n  color: #cfcfcf;\n}\n';
  const DEFAULT_WIDTH = 800;
  const IMAGE_PREVIEW_CONFIG = {
    // 最多保留多少本书的整本图片缓存，超出后按最久未使用淘汰。
    collectionCacheLimit: 6,
    // 单本书最多缓存多少张图片，限制内存占用。
    collectionCacheImageLimit: 1500,
    // 缩略图资源在内存中的缓存上限。
    imageResourceCacheLimit: 120,
    // 首屏和后续批量渲染时，每次预热/渲染多少张图片。
    preloadBatchSize: 24,
    // 每批渲染前，额外向后预读多少张图片资源。
    preloadAheadCount: 18,
    // 扫描整本书时允许的最大滚动轮次，防止异常页面无限扫描。
    collectionMaxRounds: 1200,
    // 每次等待新内容加载时，最多重试多少次。
    growthWaitAttempts: 6,
    // 等待图片/章节继续加载的基础时长。
    growthWaitBaseMs: 220,
    // 每次重试递增的等待时长。
    growthWaitStepMs: 40,
    // 每轮向下滚动的最小像素值。
    scrollStepMinPx: 320,
    // 每轮滚动步长占当前视口高度的比例。
    scrollStepViewportRatio: 0.85,
    // 连续触底多少轮后，认为已接近扫描终点。
    stableBottomRounds: 4,
    // 连续多少轮没有新内容增长后，停止继续扫描。
    stalledRounds: 3
  };
  const EYE_PROTECTION_COLORS = {
    white: {
      name: "白色",
      color: "rgba(255,255,255,1)",
      className: "eye-protection-white"
    },
    green: {
      name: "绿色",
      color: "rgba(216,226,200,1)",
      className: "eye-protection-green"
    },
    yellow: {
      name: "黄色",
      color: "rgba(240,234,214,1)",
      className: "eye-protection-yellow"
    },
    blue: {
      name: "蓝色",
      color: "rgba(200,220,240,1)",
      className: "eye-protection-blue"
    },
    pink: {
      name: "粉色",
      color: "rgba(255,230,230,1)",
      className: "eye-protection-pink"
    },
    purple: {
      name: "紫色",
      color: "rgba(230,220,250,1)",
      className: "eye-protection-purple"
    },
    gray: {
      name: "灰色",
      color: "rgba(240,240,240,1)",
      className: "eye-protection-gray"
    }
  };
  const generateEyeProtectionStyles = () => {
    let styles = "";
    Object.keys(EYE_PROTECTION_COLORS).forEach((colorKey) => {
      const colorInfo = EYE_PROTECTION_COLORS[colorKey];
      styles += `

        body.${colorInfo.className} .app_content,
        body.${colorInfo.className} .readerContent .app_content,
        body.${colorInfo.className} .wr_various_font_provider_wrapper,
        body.${colorInfo.className} .readerChapterContent,
        body.${colorInfo.className} .readerChapterContent_container,
        body.${colorInfo.className} .wr_horizontalReader,
        body.${colorInfo.className} .wr_horizontalReader_app_content,
        body.${colorInfo.className} .readerTopBar {
            background-color: ${colorInfo.color} !important;
        }
        .color-${colorKey} {
            background-color: ${colorInfo.color} !important;
        }

      `;
    });
    return styles;
  };
  const appState = {
    scrollInterval: null,
    timerInterval: null,
    isAutoReading: GM_getValue("weread_auto_reading", false),
    activeReadingMode: GM_getValue("weread_reading_mode", "auto"),
    readingDuration: GM_getValue("weread_reading_duration", 10),
    isPageTurning: false,
    pageTurnCooldown: false,
    currentScrollSpeed: GM_getValue("weread_scroll_speed", 1),
    remainingTime: GM_getValue("weread_remaining_time", 0),
    lastTimerValue: GM_getValue("weread_last_timer", 0),
    timerPopupActive: false,
    windowTop: 0,
    bottomReachedTimer: null,
    isWaitingForPageTurn: false,
    lastScrollPosition: 0,
    progressInterval: null
  };
  const moduleRegistry = {
    autoPageTurn: null,
    autoRead: null,
    controlPanel: null,
    eyeProtection: null,
    imagePreviewPanel: null,
    imageTools: null,
    progressBar: null,
    voiceRead: null
  };
  function registerModules(modules) {
    Object.assign(moduleRegistry, modules);
  }
  const notificationManager = {
    currentNotification: null,
    timeoutId: null,
    show: function(message, duration = 1e3) {
      this.clear();
      this.currentNotification = $(`<div class="custom-notification">${message}</div>`);
      $("body").append(this.currentNotification);
      this.timeoutId = setTimeout(() => this.close(), duration);
    },
    close: function() {
      const element = this.currentNotification;
      element?.addClass("fade-out");
      setTimeout(() => {
        element?.remove();
        if (this.currentNotification === element) {
          this.currentNotification = null;
        }
      }, 300);
      this.timeoutId && clearTimeout(this.timeoutId);
      this.timeoutId = null;
    },
    clear: function() {
      this.close();
      $(".custom-notification").remove();
    }
  };
  const EYE_PROTECTION_BODY_CLASSES = Object.values(EYE_PROTECTION_COLORS).map(({ className }) => className);
  const EYE_PROTECTION_ENABLED_TEXT = "护眼模式:开";
  const EYE_PROTECTION_DISABLED_TEXT = "护眼模式:关";
  const EYE_PROTECTION_DARK_THEME_NOTICE = "插件提示：护眼模式仅在白色主题下可用";
  let cachedThemeIsWhite = null;
  const utils = {
    notificationManager,
    waitForElement(selector, maxAttempts = 80) {
      return new Promise((resolve) => {
        let attempts = 0;
        const checkInterval = setInterval(() => {
          if (document.querySelectorAll(selector).length) {
            clearInterval(checkInterval);
            resolve(true);
            return;
          }
          if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            resolve(false);
            return;
          }
          attempts += 1;
        }, 100);
      });
    },
    isWhiteTheme() {
      return document.body.classList.contains("wr_whiteTheme");
    },
    isThemeChanged() {
      if (cachedThemeIsWhite === null) {
        cachedThemeIsWhite = GM_getValue("isWhiteTheme", this.isWhiteTheme());
      }
      return cachedThemeIsWhite !== this.isWhiteTheme();
    },
    syncStoredThemeState(isWhite = this.isWhiteTheme()) {
      if (cachedThemeIsWhite === isWhite) {
        return false;
      }
      cachedThemeIsWhite = isWhite;
      GM_setValue("isWhiteTheme", isWhite);
      return true;
    },
    updateEyeProtectionButton(enabled, isWhite = this.isWhiteTheme()) {
      const button = $("#eyeProtectionBtn");
      if (!button.length) {
        return;
      }
      const isActive = Boolean(enabled && isWhite);
      button.toggleClass("active", isActive);
      button.text(isActive ? EYE_PROTECTION_ENABLED_TEXT : EYE_PROTECTION_DISABLED_TEXT);
    },
    clearEyeProtectionClasses() {
      document.body.classList.remove(...EYE_PROTECTION_BODY_CLASSES);
    },
    applyEyeProtectionClass(color) {
      this.clearEyeProtectionClasses();
      const className = EYE_PROTECTION_COLORS[color]?.className;
      if (className) {
        document.body.classList.add(className);
      }
    },
    saveEyeProtectionState(enabled, color) {
      const nextColor = color ?? "green";
      const isWhite = this.isWhiteTheme();
      let colorCode = EYE_PROTECTION_COLORS[nextColor]?.color ?? "rgb(255, 255, 255)";
      if (isWhite) {
        const rgbaMatch = colorCode.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (rgbaMatch && colorCode.startsWith("rgba")) {
          const [, r, g, b] = rgbaMatch;
          colorCode = `rgb(${r}, ${g}, ${b})`;
        }
      }
      GM_setValue("weread_eye_protection", enabled);
      GM_setValue("weread_eye_protection_color", nextColor);
      GM_setValue("weread_eye_protection_color_code", colorCode);
      this.updateEyeProtectionButton(enabled, isWhite);
    },
    getEyeProtectionState() {
      return {
        enabled: GM_getValue("weread_eye_protection", false),
        color: GM_getValue("weread_eye_protection_color", "green"),
        code: GM_getValue("weread_eye_protection_color_code", EYE_PROTECTION_COLORS.green.color)
      };
    },
    syncControlPanelBackground(isWhite = this.isWhiteTheme(), state = this.getEyeProtectionState()) {
      const color = state.color ?? "white";
      const colorCode = state.code ?? "rgb(255, 255, 255)";
      const shouldApplyEyeProtection = Boolean(isWhite && state.enabled && color);
      const panel = $("#mainControlPanel");
      if (shouldApplyEyeProtection) {
        this.applyEyeProtectionClass(color);
      } else {
        this.clearEyeProtectionClasses();
      }
      if (isWhite) {
        this.resetControlPanelStyle();
        if (shouldApplyEyeProtection) {
          panel.css({
            backgroundColor: colorCode,
            borderColor: "",
            color: ""
          });
        } else {
          panel.css({
            backgroundColor: "rgba(255, 255, 255, 1)",
            borderColor: "",
            color: ""
          });
        }
        this.syncQuickBarTheme(isWhite, state);
        return;
      }
      panel.css({
        backgroundColor: "rgb(32, 32, 32)",
        borderColor: "#3e3e3e"
      });
      panel.find(".control-section-title").css("color", "#e6e6e6");
      panel.find(".control-btn").css({
        background: "#444",
        color: "#f5f5f5",
        borderColor: "#555"
      });
      this.syncQuickBarTheme(isWhite, state);
    },
    resetControlPanelStyle() {
      $("#mainControlPanel").find(".control-section-title").css("color", "");
      $("#mainControlPanel").find(".control-btn").css({
        background: "",
        color: "",
        borderColor: ""
      });
    },
    syncQuickBarTheme(isWhite, state) {
      const bar = $("#wr-voice-quick");
      if (!bar.length) return;
      const colorCode = state.code ?? "rgb(255, 255, 255)";
      const shouldApplyEyeProtection = Boolean(isWhite && state.enabled && state.color);
      if (isWhite) {
        bar.css({
          backgroundColor: shouldApplyEyeProtection ? colorCode : "rgba(255, 255, 255, 1)",
          color: "",
          borderColor: ""
        });
        bar.find("button").css({
          background: "",
          color: "",
          borderColor: ""
        });
        bar.find(".voice-quick-status").css("color", "");
        return;
      }
      bar.css({
        backgroundColor: "rgb(32, 32, 32)",
        color: "#e6e6e6",
        borderColor: "#3e3e3e"
      });
      bar.find("button").css({
        background: "#444",
        color: "#f5f5f5",
        borderColor: "#555"
      });
      bar.find(".voice-quick-status").css("color", "#cfcfcf");
    },
    handleThemeChange(isWhite = this.isWhiteTheme(), options = {}) {
      const { silent = false } = options;
      const state = this.getEyeProtectionState();
      this.syncStoredThemeState(isWhite);
      if (isWhite) {
        $("#eyeProtectionBtn").removeClass("disabled");
        this.updateEyeProtectionButton(state.enabled, true);
      } else {
        $("#eyeProtectionBtn").addClass("disabled");
        this.updateEyeProtectionButton(false, false);
        if (!silent) {
          this.notificationManager.show(EYE_PROTECTION_DARK_THEME_NOTICE);
        }
      }
      this.syncControlPanelBackground(isWhite, state);
    },
    disableConsoleWithProxy() {
      window.console = new Proxy(console, {
        get(target, prop) {
          if (["log", "warn", "info", "debug"].includes(prop)) {
            return function noop() {
            };
          }
          return target[prop];
        }
      });
    }
  };
  const widthControl = {
    init() {
      const savedWidth = GM_getValue("weread_max_width", DEFAULT_WIDTH);
      this.applyWidth(savedWidth);
      return savedWidth;
    },
    applyWidth(width) {
      const content = document.querySelector(".readerContent .app_content");
      const topBar = document.querySelector(".readerTopBar");
      if (!content || !topBar) {
        return;
      }
      content.style.maxWidth = `${width}px`;
      topBar.style.maxWidth = `${width}px`;
      GM_setValue("weread_max_width", width);
      if ($("#widthSlider").length) {
        $("#widthSlider").val(width);
        $("#widthValue").text(`${width}px`);
      }
      window.dispatchEvent(new Event("resize"));
    },
    reset() {
      this.applyWidth(DEFAULT_WIDTH);
    }
  };
  const eyeProtection = {
    init() {
      const enabled = utils.getEyeProtectionState().enabled;
      const color = utils.getEyeProtectionState().color;
      if (enabled) {
        this.enable(color);
      } else {
        this.disable();
      }
      return enabled;
    },
    enable(color) {
      utils.saveEyeProtectionState(true, color);
      utils.syncControlPanelBackground();
    },
    disable() {
      utils.clearEyeProtectionClasses();
      utils.saveEyeProtectionState(false, utils.getEyeProtectionState().color);
      utils.syncControlPanelBackground();
    },
    changeColor(color) {
      const enabled = utils.getEyeProtectionState().enabled;
      utils.saveEyeProtectionState(enabled, color);
      utils.syncControlPanelBackground();
    },
    restoreState() {
      const state = utils.getEyeProtectionState();
      if (!state.enabled) {
        return;
      }
      setTimeout(() => {
        this.enable(state.color);
        document.querySelectorAll(".color-option-container").forEach((container) => {
          const colorOption = container.querySelector(".color-option");
          const colorKey = container.getAttribute("data-color");
          if (colorOption) {
            colorOption.classList.toggle("active", colorKey === state.color);
          }
        });
      }, 50);
    },
    syncButtonState() {
      const state = utils.getEyeProtectionState();
      const isWhite = utils.isWhiteTheme();
      if (!isWhite) {
        $("#eyeProtectionBtn").addClass("disabled");
        utils.updateEyeProtectionButton(false, false);
        return;
      }
      $("#eyeProtectionBtn").removeClass("disabled");
      utils.updateEyeProtectionButton(state.enabled, true);
    }
  };
  const autoPageTurn = {
    trigger() {
      if (appState.isPageTurning || appState.pageTurnCooldown) {
        return;
      }
      appState.isPageTurning = true;
      appState.pageTurnCooldown = true;
      ["keydown", "keyup"].forEach((eventType) => {
        document.dispatchEvent(new KeyboardEvent(eventType, {
          bubbles: true,
          cancelable: true,
          key: "ArrowRight",
          code: "ArrowRight",
          keyCode: 39
        }));
      });
      setTimeout(() => {
        appState.pageTurnCooldown = false;
      }, 2e3);
      setTimeout(() => {
        appState.isPageTurning = false;
        window.scrollTo(0, 100);
      }, 1500);
    }
  };
  const RATE_MIN = 0.5;
  const RATE_MAX = 4;
  const RATE_STEP = 0.5;
  const DURATION_MIN = 5;
  const DURATION_MAX = 60;
  const PAGE_DURATION_AT_1X = 10;
  const CHARS_PER_SECOND_AT_1X = 4.5;
  const TICK_INTERVAL = 20;
  const pace = {
    clampRate(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return 1;
      const rate = Math.min(RATE_MAX, Math.max(RATE_MIN, number));
      return Math.round(rate / RATE_STEP) * RATE_STEP;
    },
    clampDuration(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return 10;
      return Math.min(DURATION_MAX, Math.max(DURATION_MIN, Math.round(number / 5) * 5));
    },
    getRateFromDuration(duration) {
      return this.clampRate(PAGE_DURATION_AT_1X / this.clampDuration(duration));
    },
    getDurationFromRate(rate) {
      return this.clampDuration(PAGE_DURATION_AT_1X / this.clampRate(rate));
    },
    getScrollStepFromPage(rate, scrollHeight, clientHeight) {
      const distance = Math.max(0, scrollHeight - clientHeight);
      const durationSeconds = this.getPageTurnWaitSeconds(rate);
      return Math.max(1, distance / (durationSeconds * TICK_INTERVAL));
    },
    getScrollStepFromDuration(duration, scrollHeight, clientHeight) {
      const distance = Math.max(0, scrollHeight - clientHeight);
      return Math.max(1, distance / (this.clampDuration(duration) * TICK_INTERVAL));
    },
    getPageTurnWaitSeconds(rate) {
      return this.clampDuration(PAGE_DURATION_AT_1X / this.clampRate(rate));
    },
    getPageTurnWaitFromDuration(duration) {
      return this.clampDuration(duration);
    },
    /** 根据正文长度和语速估算朗读时长（秒），不钳制到 [DURATION_MIN, DURATION_MAX] */
    getReadingSeconds(textLength, rate) {
      const chars = Math.max(0, Number(textLength) || 0);
      if (!chars) return 0;
      return chars / (CHARS_PER_SECOND_AT_1X * this.clampRate(rate));
    },
    /** 根据给定的时长（秒）计算每 20ms tick 的滚动步长，不下限，支持亚像素 */
    getScrollStepFromSeconds(seconds, scrollHeight, clientHeight) {
      const distance = Math.max(0, scrollHeight - clientHeight);
      const duration = Math.max(0.1, Number(seconds) || 0);
      return distance / (duration * TICK_INTERVAL);
    },
    applyRate(rate) {
      appState.currentScrollSpeed = this.clampRate(rate);
      GM_setValue("weread_scroll_speed", appState.currentScrollSpeed);
      moduleRegistry.autoRead?.syncPace();
    }
  };
  const autoRead = {
    calculateWaitTime() {
      if (appState.activeReadingMode === "auto") {
        return pace.getPageTurnWaitFromDuration(appState.readingDuration);
      }
      return pace.getPageTurnWaitSeconds(appState.currentScrollSpeed);
    },
    /** 语音模式下，根据当前朗读正文长度估算步长；无正文时退回到 10/rate 秒/页 */
    getVoiceScrollStep(scrollHeight, clientHeight) {
      const readingSeconds = moduleRegistry.voiceRead?.getReadingSeconds?.();
      if (Number.isFinite(readingSeconds) && readingSeconds > 0) {
        return pace.getScrollStepFromSeconds(readingSeconds, scrollHeight, clientHeight);
      }
      return pace.getScrollStepFromPage(appState.currentScrollSpeed, scrollHeight, clientHeight);
    },
    getTimerSlider() {
      return $("#autoTimerSlider").length && appState.activeReadingMode === "auto" ? $("#autoTimerSlider") : $("#timerSlider");
    },
    getTimerValue() {
      return parseInt(this.getTimerSlider().val(), 10) || 0;
    },
    start() {
      this.stopScrolling();
      this.clearBottomTimer();
      const timerMinutes = this.getTimerValue();
      if (timerMinutes > 0) {
        appState.lastTimerValue = timerMinutes;
        GM_setValue("weread_last_timer", appState.lastTimerValue);
        this.updateLastTimerButton();
      }
      this.beginScroll();
      this.updateButton();
      this.startTimer();
      this.saveState();
    },
    beginScroll() {
      if (appState.scrollInterval) {
        clearInterval(appState.scrollInterval);
        appState.scrollInterval = null;
      }
      let lastScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      let stuckCount = 0;
      appState.scrollInterval = setInterval(() => {
        if (appState.isPageTurning) {
          return;
        }
        const currentScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
        const clientHeight = document.documentElement.clientHeight || document.body.clientHeight;
        const scrollStep = appState.activeReadingMode === "auto" ? pace.getScrollStepFromDuration(appState.readingDuration, scrollHeight, clientHeight) : this.getVoiceScrollStep(scrollHeight, clientHeight);
        if (currentScrollTop + clientHeight >= scrollHeight - 10) {
          if (!appState.isWaitingForPageTurn) {
            this.schedulePageTurn();
          }
          return;
        }
        if (currentScrollTop === lastScrollTop) {
          stuckCount += 1;
          window.scrollBy(0, scrollStep * (stuckCount > 5 ? 3 : 1));
        } else {
          stuckCount = 0;
          window.scrollBy(0, scrollStep);
        }
        lastScrollTop = currentScrollTop;
        appState.lastScrollPosition = currentScrollTop;
      }, 20);
      appState.isAutoReading = true;
    },
    stopScrolling() {
      if (appState.scrollInterval) {
        clearInterval(appState.scrollInterval);
        appState.scrollInterval = null;
      }
    },
    stop() {
      this.stopScrolling();
      appState.isAutoReading = false;
      appState.isPageTurning = false;
      appState.isWaitingForPageTurn = false;
      this.updateButton();
      this.clearBottomTimer();
      moduleRegistry.progressBar?.hide();
      this.stopTimer();
      this.saveState();
    },
    pause() {
      this.stopScrolling();
      this.clearBottomTimer();
      appState.isAutoReading = false;
      this.updateButton();
      this.saveState();
    },
    resume() {
      if (appState.scrollInterval) return;
      this.beginScroll();
      this.updateButton();
      this.saveState();
    },
    syncPace() {
      if (!appState.isAutoReading) return;
      this.clearBottomTimer();
      this.beginScroll();
      this.updateButton();
      this.saveState();
    },
    toggle() {
      if (appState.isAutoReading) {
        this.stop();
        return;
      }
      this.start();
    },
    schedulePageTurn() {
      appState.isWaitingForPageTurn = true;
      const waitTime = this.calculateWaitTime();
      moduleRegistry.progressBar?.show(waitTime);
      appState.bottomReachedTimer = setTimeout(() => {
        if (appState.isWaitingForPageTurn) {
          moduleRegistry.autoPageTurn?.trigger();
          appState.isWaitingForPageTurn = false;
          moduleRegistry.progressBar?.hide();
        }
        setTimeout(() => {
          if (appState.isAutoReading) {
            appState.lastScrollPosition = 0;
          }
        }, 2e3);
      }, waitTime * 1e3);
    },
    clearBottomTimer() {
      if (appState.bottomReachedTimer) {
        clearTimeout(appState.bottomReachedTimer);
        appState.bottomReachedTimer = null;
      }
      appState.isWaitingForPageTurn = false;
      moduleRegistry.progressBar?.hide();
    },
    checkManualPageTurn() {
      if (!appState.isWaitingForPageTurn) {
        return;
      }
      const currentScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      if (Math.abs(currentScrollTop - appState.lastScrollPosition) > 50) {
        this.clearBottomTimer();
        this.schedulePageTurn();
      }
      appState.lastScrollPosition = currentScrollTop;
    },
    startTimer() {
      const timerMinutes = this.getTimerValue();
      if (timerMinutes <= 0) {
        this.stopTimer();
        return;
      }
      if (appState.timerInterval) {
        clearInterval(appState.timerInterval);
        appState.timerInterval = null;
      }
      if (appState.remainingTime <= 0) {
        appState.remainingTime = timerMinutes * 60;
      }
      appState.timerPopupActive = true;
      this.updateTimerDisplay();
      moduleRegistry.progressBar?.showTimer(appState.remainingTime);
      appState.timerInterval = setInterval(() => {
        appState.remainingTime -= 1;
        this.updateTimerDisplay();
        GM_setValue("weread_remaining_time", appState.remainingTime);
        if (appState.remainingTime <= 0) {
          const stoppedByMode = appState.activeReadingMode;
          if (stoppedByMode === "voice" && moduleRegistry.voiceRead) {
            moduleRegistry.voiceRead.stop({ silent: true });
          } else {
            this.stop();
          }
          const label = stoppedByMode === "voice" ? "语音阅读" : "自动阅读";
          utils.notificationManager.show(`定时时间到，${label}已停止`);
        }
      }, 1e3);
    },
    stopTimer() {
      if (appState.timerInterval) {
        clearInterval(appState.timerInterval);
        appState.timerInterval = null;
      }
      appState.remainingTime = 0;
      appState.timerPopupActive = false;
      GM_setValue("weread_remaining_time", 0);
      this.updateTimerDisplay();
      moduleRegistry.progressBar?.hideTimer();
    },
    updateTimerDisplay() {
      const displayId = appState.activeReadingMode === "auto" ? "#autoTimerDisplay" : "#timerDisplay";
      const timerMinutes = this.getTimerValue();
      const display = $(displayId);
      if (appState.remainingTime > 0) {
        display.text(`剩余: ${Math.floor(appState.remainingTime / 60)}:${String(appState.remainingTime % 60).padStart(2, "0")}`);
      } else if (timerMinutes > 0) {
        display.text(`定时: ${timerMinutes}分钟`);
      } else {
        display.text("");
      }
      this.syncTimerSliders();
      moduleRegistry.controlPanel?.syncLastTimerButtons?.();
    },
    updateButton() {
      const button = $("#toggleAutoRead");
      if (button.length) {
        button.text(appState.isAutoReading ? "停止阅读" : "开始阅读");
        button.toggleClass("active", appState.isAutoReading);
        return;
      }
      moduleRegistry.voiceRead?.syncPlaybackUI();
    },
    updateLastTimerButton() {
      $("#lastTimerBtn, #autoLastTimerBtn").each(function updateLastTimer() {
        $(this).removeClass("disabled").css("background", "");
      });
    },
    applyLastTimer() {
      if (appState.lastTimerValue <= 0) {
        utils.notificationManager.show("没有找到上次定时时间");
        return;
      }
      this.setTimerMinutes(appState.lastTimerValue);
      utils.notificationManager.show(`已设置为上次定时时间: ${appState.lastTimerValue}分钟`);
    },
    setTimerMinutes(minutes) {
      const nextMinutes = Math.max(0, parseInt(minutes, 10) || 0);
      this.setTimerValue(nextMinutes);
      const voiceActive = Boolean(
        moduleRegistry.voiceRead && (moduleRegistry.voiceRead.isActive?.() || moduleRegistry.voiceRead.speechEngine?.playing || moduleRegistry.voiceRead.speechEngine?.paused)
      );
      if (!appState.isAutoReading && !voiceActive) {
        return;
      }
      if (nextMinutes <= 0) {
        this.stopTimer();
        return;
      }
      appState.remainingTime = nextMinutes * 60;
      this.startTimer();
      this.updateTimerDisplay();
    },
    setTimerValue(minutes) {
      const snappedMinutes = Math.max(0, Math.round(minutes / 10) * 10);
      $("#timerSlider").val(snappedMinutes);
      $("#autoTimerSlider").val(snappedMinutes);
      $("#timerValue").text(`${snappedMinutes}分钟`);
      $("#autoTimerValue").text(`${snappedMinutes}分钟`);
      this.updateTimerDisplay();
    },
    syncTimerSliders() {
      const voiceValue = parseInt($("#timerSlider").val(), 10) || 0;
      const autoValue = parseInt($("#autoTimerSlider").val(), 10) || 0;
      const nextValue = appState.activeReadingMode === "auto" ? autoValue : voiceValue;
      const snappedValue = Math.max(0, Math.round(nextValue / 10) * 10);
      $("#timerSlider").val(snappedValue);
      $("#autoTimerSlider").val(snappedValue);
      $("#timerValue").text(`${snappedValue}分钟`);
      $("#autoTimerValue").text(`${snappedValue}分钟`);
    },
    getReadingDuration() {
      return pace.clampDuration(appState.readingDuration);
    },
    saveState() {
      GM_setValue("weread_auto_reading", appState.isAutoReading);
      GM_setValue("weread_scroll_speed", appState.currentScrollSpeed);
    },
    restoreState() {
      if (!appState.isAutoReading) {
        return;
      }
      $("#ttsRateSlider").val(appState.currentScrollSpeed);
      $("#ttsRateValue").text(`${appState.currentScrollSpeed.toFixed(1)}x`);
      const timerMinutes = Math.ceil(appState.remainingTime / 60);
      if (timerMinutes > 0) {
        this.setTimerValue(timerMinutes);
      }
      this.updateButton();
      this.start();
      moduleRegistry.voiceRead?.syncAllUI();
      utils.notificationManager.show("已恢复自动阅读状态");
    }
  };
  const headerControl = {
    init() {
      $(window).on("scroll", function handleHeaderScroll() {
        const scrollTop = $(this).scrollTop();
        const topBar = document.querySelector(".readerTopBar");
        if (!topBar) {
          return;
        }
        $(".readerControls").hover(
          () => $(".readerControls").css("opacity", "1"),
          () => $(".readerControls").css("opacity", "0")
        );
        topBar.style.opacity = scrollTop >= appState.windowTop ? 0 : 1;
        appState.windowTop = scrollTop;
        if (appState.isAutoReading) {
          moduleRegistry.autoRead?.checkManualPageTurn();
        }
      });
    }
  };
  const panelDrag = {
    init(panel) {
      let isDragging = false;
      let startX;
      let startY;
      let initialLeft;
      let initialTop;
      panel.on("mousedown", function handleMouseDown(event) {
        const interactiveControl = $(event.target).closest(
          "button, input, select, textarea, .color-option, .control-btn, .control-select, .range-input, .panel-resizer"
        );
        if (interactiveControl.length) {
          return;
        }
        isDragging = true;
        panel.addClass("dragging");
        startX = event.clientX;
        startY = event.clientY;
        const rect = panel[0].getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        event.preventDefault();
      });
      $(document).on("mousemove", function handleMouseMove(event) {
        if (!isDragging) {
          return;
        }
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        const newLeft = initialLeft + deltaX;
        const newTop = initialTop + deltaY;
        const maxX = window.innerWidth - panel.outerWidth();
        const maxY = window.innerHeight - panel.outerHeight();
        panel.css({
          left: `${Math.max(0, Math.min(newLeft, maxX))}px`,
          top: `${Math.max(0, Math.min(newTop, maxY))}px`,
          transform: "none"
        });
      });
      $(document).on("mouseup", function handleMouseUp() {
        if (!isDragging) {
          return;
        }
        isDragging = false;
        panel.removeClass("dragging");
        GM_setValue("control_panel_position", {
          left: parseInt(panel.css("left"), 10),
          top: parseInt(panel.css("top"), 10)
        });
      });
      const savedPosition = GM_getValue("control_panel_position");
      if (savedPosition) {
        const left = Math.max(0, Math.min(parseInt(savedPosition.left, 10) || 0, window.innerWidth - panel.outerWidth()));
        const top = Math.max(0, Math.min(parseInt(savedPosition.top, 10) || 0, window.innerHeight - panel.outerHeight()));
        panel.css({
          left: `${left}px`,
          top: `${top}px`,
          transform: "none"
        });
      }
    }
  };
  const controlPanel = {
    snapToDetent(value, min, max, step) {
      const number = Number(value);
      if (!Number.isFinite(number)) return min;
      return Math.min(max, Math.max(min, Math.round(number / step) * step));
    },
    getMaxPanelWidth() {
      const panel = $("#mainControlPanel");
      const left = panel.length ? parseInt(panel.css("left"), 10) || 0 : 60;
      return Math.max(260, window.innerWidth - left - 16);
    },
    init() {
      const savedWidth = GM_getValue("weread_max_width", DEFAULT_WIDTH);
      const savedPanelWidth = Math.max(260, parseInt(GM_getValue("weread_control_panel_width", 320), 10) || 320);
      const initialPanelWidth = Math.min(savedPanelWidth, window.innerWidth - 60 - 16);
      $("body").append(`
      <div class="control-panel" style="display: none; width: ${initialPanelWidth}px;" id="mainControlPanel">
        <button class="control-panel-close" id="closeControlPanel">×</button>
        <div class="control-section">
          <div class="control-section-title">宽度控制</div>
          <div class="control-item">
            <span class="control-label">页面宽度</span>
            <div class="slider-box">
              <input type="range" class="control-slider" id="widthSlider" min="600" max="1400" step="100" value="${savedWidth}">
            </div>
            <span class="control-value" id="widthValue">${savedWidth}px</span>
          </div>
          <div class="control-buttons">
            <button class="control-btn reset" id="resetWidth">恢复默认</button>
          </div>
        </div>
        <div class="control-section">
          <div class="reading-tabs">
            <button class="reading-tab active" id="autoReadTab" type="button">自动阅读</button>
            <button class="reading-tab" id="voiceReadTab" type="button">语音阅读</button>
          </div>
          <div class="reading-panel" id="autoReadPanel">
            <div class="control-section-title">自动阅读</div>
            <div class="control-item">
              <span class="control-label">阅读时长</span>
              <div class="slider-box">
                <input type="range" class="control-slider duration-slider" id="readingDurationSlider" min="5" max="60" step="5" value="${appState.readingDuration}">
              </div>
              <span class="control-value" id="readingDurationValue">${appState.readingDuration}秒/页</span>
            </div>
            <div class="control-item">
              <span class="control-label">定时时长</span>
              <div class="slider-box">
                <input type="range" class="control-slider timer-slider" id="autoTimerSlider" min="0" max="120" step="10" value="0">
              </div>
              <span class="control-value" id="autoTimerValue">0分钟</span>
            </div>
            <div class="timer-display" id="autoTimerDisplay"></div>
            <div class="control-buttons">
              <button class="control-btn" id="autoLastTimerBtn">上次定时</button>
              <button class="control-btn" id="toggleAutoRead">开始阅读</button>
            </div>
          </div>
          <div class="reading-panel" id="voiceReadPanel" style="display:none;">
            <div class="control-item">
              <span class="control-label">语速</span>
              <div class="slider-box">
                <input type="range" class="control-slider speed-slider" id="ttsRateSlider" min="0.5" max="4" step="0.5" value="${appState.currentScrollSpeed}">
              </div>
              <span class="control-value" id="ttsRateValue">${appState.currentScrollSpeed.toFixed(1)}x</span>
            </div>
            <div class="control-item">
              <span class="control-label">音色</span>
              <select class="control-select" id="ttsVoiceSelect"></select>
            </div>
            <div class="control-item">
              <span class="control-label">定时时长</span>
              <div class="slider-box">
                <input type="range" class="control-slider timer-slider" id="timerSlider" min="0" max="120" step="10" value="0">
              </div>
              <span class="control-value" id="timerValue">0分钟</span>
            </div>
            <div class="timer-display" id="timerDisplay"></div>
            <div class="range-fields">
              <div class="range-row">
                <div class="control-item">
                  <span class="control-label">从文字</span>
                  <input type="text" class="range-input" id="ttsRangeStart">
                </div>
                <div class="control-item">
                  <span class="control-label">到文字</span>
                  <input type="text" class="range-input" id="ttsRangeEnd">
                </div>
              </div>
              <div class="control-buttons">
                <button class="control-btn secondary" id="ttsRangeApply">确定范围</button>
                <button class="control-btn secondary" id="ttsRangeClear">清除范围</button>
              </div>
            </div>
            <div class="control-buttons">
              <button class="control-btn" id="ttsToggleBtn">朗读</button>
              <button class="control-btn secondary" id="ttsStopBtn" disabled>停止</button>
              <button class="control-btn secondary" id="ttsRetryBtn">重试</button>
            </div>
          </div>
        </div>
        <div class="control-section">
          <div class="control-section-title">显示设置</div>
          <div class="color-options" id="colorOptionsContainer"></div>
          <div class="control-buttons">
            <button class="control-btn" id="eyeProtectionBtn">护眼模式:关</button>
          </div>
        </div>
        <div class="control-section">
          <div class="control-section-title">图片工具</div>
          <div class="control-buttons">
            <button class="control-btn" id="previewAllImages">预览/下载图片</button>
          </div>
        </div>
        <div class="panel-resizer" id="controlPanelResizer" title="拖动调整宽度"></div>
      </div>
    `);
      this.generateColorOptions();
      this.snapSliderValues();
      this.addControlButton();
      this.bindEvents();
      this.setReadingMode(appState.activeReadingMode);
      this.syncLastTimerButtons();
      this.syncTimerDisplays();
      panelDrag.init($("#mainControlPanel"));
      moduleRegistry.autoRead?.updateLastTimerButton();
      $(".control-slider").on("pointerup", function handleSliderDetent() {
        controlPanel.snapSliderValues();
      });
    },
    setReadingMode(mode) {
      appState.activeReadingMode = mode === "voice" ? "voice" : "auto";
      GM_setValue("weread_reading_mode", appState.activeReadingMode);
      $("#autoReadTab").toggleClass("active", appState.activeReadingMode === "auto");
      $("#voiceReadTab").toggleClass("active", appState.activeReadingMode === "voice");
      $("#autoReadPanel").toggle(appState.activeReadingMode === "auto");
      $("#voiceReadPanel").toggle(appState.activeReadingMode === "voice");
      this.syncModeControls();
    },
    syncModeControls() {
      if (appState.activeReadingMode === "auto") {
        const duration = pace.clampDuration(pace.getDurationFromRate(appState.currentScrollSpeed));
        appState.readingDuration = duration;
        GM_setValue("weread_reading_duration", duration);
        $("#readingDurationSlider").val(duration);
        $("#readingDurationValue").text(`${duration}秒/页`);
        moduleRegistry.autoRead?.updateButton();
      } else {
        moduleRegistry.voiceRead?.syncAllUI();
      }
      this.syncTimerDisplays();
    },
    syncTimerDisplays() {
      const timerValue = parseInt($("#timerSlider").val(), 10) || 0;
      $("#timerValue").text(`${timerValue}分钟`);
      $("#autoTimerValue").text(`${timerValue}分钟`);
      moduleRegistry.autoRead?.updateTimerDisplay?.();
    },
    syncLastTimerButtons() {
      moduleRegistry.autoRead?.updateLastTimerButton();
    },
    generateColorOptions() {
      const container = $("#colorOptionsContainer");
      container.empty();
      const state = utils.getEyeProtectionState();
      Object.keys(EYE_PROTECTION_COLORS).forEach((colorKey) => {
        const colorInfo = EYE_PROTECTION_COLORS[colorKey];
        const isActive = colorKey === state.color;
        const colorOption = $(`
        <div class="color-option-container" data-color="${colorKey}">
          <div class="color-option color-${colorKey} ${isActive ? "active" : ""}"></div>
          <div class="color-name">${colorInfo.name}</div>
        </div>
      `);
        container.append(colorOption);
      });
    },
    snapSliderValues() {
      const durationValue = pace.clampDuration(parseInt($("#readingDurationSlider").val(), 10) || 10);
      $("#readingDurationSlider").val(durationValue);
      $("#readingDurationValue").text(`${durationValue}秒/页`);
      const timerValue = Math.min(120, Math.max(0, Math.round((parseInt($("#timerSlider").val(), 10) || 0) / 10) * 10));
      $("#timerSlider").val(timerValue);
      $("#autoTimerSlider").val(timerValue);
      $("#timerValue").text(`${timerValue}分钟`);
      $("#autoTimerValue").text(`${timerValue}分钟`);
      const widthValue = Math.min(1400, Math.max(600, Math.round((parseInt($("#widthSlider").val(), 10) || 1e3) / 100) * 100));
      $("#widthSlider").val(widthValue);
      $("#widthValue").text(`${widthValue}px`);
      widthControl.applyWidth(widthValue);
      const rateValue = pace.clampRate(parseFloat($("#ttsRateSlider").val()) || 1);
      $("#ttsRateSlider").val(rateValue);
      $("#ttsRateValue").text(`${rateValue.toFixed(1)}x`);
    },
    addControlButton() {
      $(".readerControls").append(`
      <div class="wr_tooltip_container" style="--offset: 6px;">
        <button class="readerControls_item" id="mainControl" style="color:#6a6c6c;cursor:pointer;">
          <span class="settings-icon"></span>
        </button>
        <div class="wr_tooltip_item wr_tooltip_item--right" style="display: none;">设置</div>
      </div>
    `);
    },
    bindEvents() {
      $("#mainControl").on("click", () => $("#mainControlPanel").toggle());
      $("#mainControl").hover(
        function showTooltip() {
          $(this).siblings(".wr_tooltip_item").show();
        },
        function hideTooltip() {
          $(this).siblings(".wr_tooltip_item").hide();
        }
      );
      $(document).on("click", "#closeControlPanel", (event) => {
        event.stopPropagation();
        $("#mainControlPanel").hide();
      });
      $("#widthSlider").on("input", function handleWidthInput() {
        const newWidth = controlPanel.snapToDetent(parseInt($(this).val(), 10), 600, 1400, 100);
        $(this).val(newWidth);
        $("#widthValue").text(`${newWidth}px`);
        widthControl.applyWidth(newWidth);
      });
      $("#resetWidth").on("click", () => {
        $("#widthSlider").val(DEFAULT_WIDTH);
        $("#widthValue").text(`${DEFAULT_WIDTH}px`);
        widthControl.reset();
      });
      $("#controlPanelResizer").on("mousedown", function handlePanelResize(event) {
        event.preventDefault();
        event.stopPropagation();
        const panel = $("#mainControlPanel");
        $("#controlPanelResizer").addClass("resizing");
        const startX = event.clientX;
        const startWidth = panel.outerWidth();
        function resizePanel(moveEvent) {
          const maxWidth = controlPanel.getMaxPanelWidth();
          const nextWidth = Math.max(260, Math.min(startWidth + moveEvent.clientX - startX, maxWidth));
          panel.css("width", `${nextWidth}px`);
        }
        function finishResize() {
          $(document).off("mousemove", resizePanel);
          $(document).off("mouseup", finishResize);
          $("#controlPanelResizer").removeClass("resizing");
          GM_setValue("weread_control_panel_width", Math.round(panel.outerWidth()));
        }
        $(document).on("mousemove", resizePanel);
        $(document).on("mouseup", finishResize);
      });
      $(document).on("click", ".color-option-container", function handleColorSelect() {
        const color = $(this).data("color");
        $(".color-option").removeClass("active");
        $(this).find(".color-option").addClass("active");
        moduleRegistry.eyeProtection?.changeColor(color);
      });
      $(document).on("click", "#eyeProtectionBtn", () => {
        const isWhite = utils.isWhiteTheme();
        const isEnabled = utils.getEyeProtectionState().enabled;
        if (!isWhite) {
          utils.notificationManager.show("护眼模式仅在白色主题下可用", 3e3);
          return;
        }
        if (isEnabled) {
          moduleRegistry.eyeProtection?.disable();
        } else {
          moduleRegistry.eyeProtection?.enable(utils.getEyeProtectionState().color);
        }
      });
      $(document).on("click", "#autoReadTab", () => this.setReadingMode("auto"));
      $(document).on("click", "#voiceReadTab", () => this.setReadingMode("voice"));
      $("#readingDurationSlider").on("input", function handleDurationInput() {
        const duration = pace.clampDuration(parseInt($(this).val(), 10) || 10);
        $(this).val(duration);
        appState.readingDuration = duration;
        GM_setValue("weread_reading_duration", duration);
        $("#readingDurationValue").text(`${duration}秒/页`);
        moduleRegistry.autoRead?.syncPace();
      });
      $("#timerSlider").on("input", function handleTimerInput() {
        const minutes = controlPanel.snapToDetent(parseInt($(this).val(), 10), 0, 120, 10);
        $(this).val(minutes);
        $("#timerValue").text(`${minutes}分钟`);
        moduleRegistry.autoRead?.setTimerMinutes(minutes);
      });
      $("#autoTimerSlider").on("input", function handleAutoTimerInput() {
        const minutes = controlPanel.snapToDetent(parseInt($(this).val(), 10), 0, 120, 10);
        $(this).val(minutes);
        $("#autoTimerValue").text(`${minutes}分钟`);
        moduleRegistry.autoRead?.setTimerMinutes(minutes);
      });
      $(document).on("click", "#lastTimerBtn, #autoLastTimerBtn", () => moduleRegistry.autoRead?.applyLastTimer());
      $(document).on("click", "#toggleAutoRead", () => moduleRegistry.autoRead?.toggle());
      $("#previewAllImages").on("click", () => moduleRegistry.imagePreviewPanel?.show());
      $(document).on("click", (event) => {
        if (!$(event.target).closest(".control-panel, #mainControl, #closeControlPanel").length) {
          $(".control-panel").hide();
        }
      });
    }
  };
  const progressBar = {
    waitTime: 0,
    startTime: 0,
    timerRemaining: 0,
    pageTurnActive: false,
    timerActive: false,
    init() {
      if ($("#auto-turn-progress").length) {
        return;
      }
      $("body").append(`
      <div id="auto-turn-progress" style="display:none;">
        <div class="timer-popup-row" id="timerPopupRow" style="display:none;">
          <div class="progress-text" id="timerPopupText">0秒后停止</div>
        </div>
        <div class="page-turn-popup-row" id="pageTurnPopupRow" style="display:none;">
          <div class="progress-text" id="pageTurnPopupText">0秒后自动翻页</div>
          <div class="progress-bar"><div class="progress-fill"></div></div>
        </div>
      </div>
    `);
    },
    show(waitTime) {
      this.waitTime = waitTime;
      this.startTime = Date.now();
      this.pageTurnActive = true;
      $("#pageTurnPopupRow").show();
      this.refreshContainerVisibility();
      this.update();
      this.startInterval();
    },
    showTimer(totalSeconds) {
      this.timerRemaining = totalSeconds;
      this.timerActive = true;
      appState.timerPopupActive = true;
      $("#timerPopupText").text(this.formatCountdown(totalSeconds) + "后停止");
      $("#timerPopupRow").show();
      this.refreshContainerVisibility();
      this.startInterval();
    },
    formatCountdown(totalSeconds) {
      const seconds = Math.max(0, Math.round(totalSeconds));
      const minutes = Math.floor(seconds / 60);
      const remainder = seconds % 60;
      return minutes > 0 ? `${minutes}分${String(remainder).padStart(2, "0")}秒` : `${remainder}秒`;
    },
    startInterval() {
      if (appState.progressInterval) {
        return;
      }
      appState.progressInterval = setInterval(() => this.update(), 100);
    },
    refreshContainerVisibility() {
      $("#auto-turn-progress").toggle(Boolean(this.pageTurnActive || this.timerActive));
    },
    update() {
      if (this.pageTurnActive) {
        const elapsed = (Date.now() - this.startTime) / 1e3;
        const remaining = Math.max(0, this.waitTime - elapsed);
        const percentage = remaining / this.waitTime * 100;
        $("#pageTurnPopupText").text(`${remaining.toFixed(1)}秒后自动翻页`);
        $(".progress-fill").css("width", `${percentage}%`);
        if (remaining <= 0) {
          this.hidePageTurn();
        }
      }
      if (this.timerActive && appState.timerPopupActive && appState.remainingTime >= 0) {
        this.timerRemaining = appState.remainingTime;
        $("#timerPopupText").text(this.formatCountdown(this.timerRemaining) + "后停止");
      }
    },
    hide() {
      this.hidePageTurn();
      this.hideTimer();
    },
    hidePageTurn() {
      this.pageTurnActive = false;
      $("#pageTurnPopupRow").hide();
      this.refreshContainerVisibility();
      this.stopInterval();
    },
    hideTimer() {
      this.timerActive = false;
      appState.timerPopupActive = false;
      $("#timerPopupRow").hide();
      this.refreshContainerVisibility();
      this.stopInterval();
    },
    stopInterval() {
      if (this.pageTurnActive || this.timerActive) {
        return;
      }
      if (appState.progressInterval) {
        clearInterval(appState.progressInterval);
        appState.progressInterval = null;
      }
    }
  };
  function normalizeDownloadItem(item, index) {
    const normalizedIndex = index + 1;
    if (typeof item === "string") {
      const fileName = buildFileNameFromItem({ src: item, fileName: extractFileName(item, normalizedIndex) }, index);
      return {
        src: item,
        fileName,
        chapter: "book",
        order: index
      };
    }
    const src = item?.src || "";
    const baseItem = {
      ...item,
      src,
      chapter: item?.chapter || item?.chapters?.[0] || "",
      order: item?.order ?? index
    };
    return {
      ...baseItem,
      fileName: buildFileNameFromItem({
        ...baseItem,
        fileName: item?.fileName || extractFileName(src, normalizedIndex)
      }, index)
    };
  }
  function extractFileName(src, fallbackIndex) {
    if (!src) {
      return `image_${fallbackIndex}.jpg`;
    }
    try {
      const url = new URL(src, window.location.origin);
      const lastSegment = decodeURIComponent(url.pathname.split("/").pop() || "");
      if (lastSegment) {
        return lastSegment;
      }
    } catch (_error) {
      const segments = src.split("/");
      const fallback = segments[segments.length - 1];
      if (fallback) {
        return fallback;
      }
    }
    return `image_${fallbackIndex}.jpg`;
  }
  function isPlaceholderImageSrc(src) {
    if (!src) {
      return true;
    }
    if (src.startsWith("data:image/gif")) {
      return true;
    }
    try {
      const url = new URL(src, window.location.origin);
      const fileName = decodeURIComponent(url.pathname.split("/").pop() || "").toLowerCase();
      return fileName.startsWith("loading_") || fileName === "loading.png" || fileName.includes("placeholder");
    } catch (_error) {
      return /loading_|placeholder/i.test(src);
    }
  }
  function resolveImageSource($img) {
    const candidates = [
      $img.attr("data-src"),
      $img.attr("data-original"),
      $img.attr("data-lazy-src"),
      $img.attr("data-url"),
      $img.attr("src")
    ].map((value) => String(value || "").trim()).filter(Boolean);
    return candidates.find((src) => !isPlaceholderImageSrc(src)) || candidates[0] || "";
  }
  function sanitizeFileSegment(text, fallback = "image") {
    return String(text || fallback).replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || fallback;
  }
  function getFileExtension(src) {
    try {
      const url = new URL(src, window.location.origin);
      const match = (url.pathname || "").match(/\.([a-zA-Z0-9]{2,5})$/);
      return match ? match[1].toLowerCase() : "jpg";
    } catch (_error) {
      return "jpg";
    }
  }
  function buildFileNameFromItem(item, index) {
    const chapter = sanitizeFileSegment(item?.chapter || item?.chapters?.[0] || "book", "book");
    const baseName = sanitizeFileSegment(item?.fileName || `image_${index + 1}`, `image_${index + 1}`);
    const ext = baseName.includes(".") ? "" : `.${getFileExtension(item?.src || "")}`;
    return `${String(index + 1).padStart(4, "0")}_${chapter}_${baseName}${ext}`;
  }
  const imageTools = {
    observer: null,
    init() {
      this.observeImages();
    },
    observeImages() {
      if (this.observer) {
        return;
      }
      this.observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type !== "childList") {
            return;
          }
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              this.processImageNode(node);
            }
          });
        });
      });
      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      setTimeout(() => {
        $("img.wr_readerImage_opacity").each((_, img) => this.addImageToolbar(img));
      }, 1e3);
    },
    processImageNode(node) {
      if (node.tagName === "IMG" && node.classList.contains("wr_readerImage_opacity")) {
        this.addImageToolbar(node);
      }
      $(node).find("img.wr_readerImage_opacity").each((_, img) => {
        this.addImageToolbar(img);
      });
    },
    addImageToolbar(img) {
      const $img = $(img);
      const src = resolveImageSource($img);
      if (!src || $img.data("toolbar-added")) {
        return;
      }
      $img.data("toolbar-added", true);
      const toolbarContainer = $(`
      <div class="image-toolbar-container">
        <div class="image-toolbar">
          <button class="image-tool-btn download-btn" title="下载图片">
            <span class="image-tool-icon">↓</span>
          </button>
          <button class="image-tool-btn copy-btn" title="复制链接">
            <span class="image-tool-icon">⧉</span>
          </button>
          <button class="image-tool-btn open-btn" title="新标签页打开">
            <span class="image-tool-icon">↗</span>
          </button>
        </div>
      </div>
    `);
      const isDoubleColumn = $img.closest(".passageContent_wrapper").length > 0;
      const isSingleColumn = $img.closest(".passage-content").length > 0;
      let parentContainer;
      if (isDoubleColumn) {
        parentContainer = $img.closest(".passageContent_wrapper");
        parentContainer.append(toolbarContainer);
      } else if (isSingleColumn) {
        parentContainer = $img.closest(".passage-content");
        parentContainer.css("position", "relative");
        toolbarContainer.css({
          position: "absolute",
          left: `${img.getBoundingClientRect().width}px`,
          display: "flex",
          transform: $img.css("transform")
        });
        parentContainer.append(toolbarContainer);
      } else {
        $img.after(toolbarContainer);
      }
      this.bindToolbarEvents(toolbarContainer, src);
    },
    bindToolbarEvents(toolbarContainer, src) {
      const downloadBtn = toolbarContainer.find(".download-btn");
      const copyBtn = toolbarContainer.find(".copy-btn");
      const openBtn = toolbarContainer.find(".open-btn");
      downloadBtn.on("click", () => {
        if (downloadBtn.hasClass("disabled") || downloadBtn.hasClass("loading")) {
          return;
        }
        downloadBtn.addClass("loading disabled").attr("title", "下载中...").find(".image-tool-icon").text("…");
        this.downloadImage(src, () => {
          setTimeout(() => {
            downloadBtn.removeClass("loading disabled").attr("title", "下载图片").find(".image-tool-icon").text("↓");
          }, 1e3);
        });
      });
      copyBtn.on("click", () => {
        this.copyImageUrl(src);
      });
      openBtn.on("click", () => {
        this.openImage(src);
      });
      const $img = toolbarContainer.prev("img.wr_readerImage_opacity");
      if ($img.length) {
        $img.hover(
          () => toolbarContainer.show(),
          () => setTimeout(() => !toolbarContainer.is(":hover") && toolbarContainer.hide(), 100)
        );
      }
      toolbarContainer.hover(
        () => toolbarContainer.show(),
        () => toolbarContainer.hide()
      );
    },
    downloadImage(src, callback) {
      if (!src) {
        callback?.();
        return;
      }
      const fileName = extractFileName(src, 1);
      try {
        GM_download({
          url: src,
          name: fileName,
          onload: () => {
            utils.notificationManager.show("图片下载成功");
            callback?.();
          },
          onerror: (error) => {
            utils.notificationManager.show(`图片下载失败: ${error.error}`);
            callback?.();
          }
        });
      } catch (_error) {
        this.downloadImageFallback(src, fileName);
        callback?.();
      }
    },
    downloadImageFallback(src, fileName) {
      const link = document.createElement("a");
      link.href = src;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      utils.notificationManager.show("图片下载成功");
    },
    openImage(src) {
      if (src) {
        window.open(src, "_blank");
      }
    },
    copyImageUrl(src) {
      if (!src) {
        return;
      }
      this.copyTextWithGM(src).then(() => utils.notificationManager.show("图片链接已复制到剪贴板")).catch((error) => {
        console.error("复制失败:", error);
        this.fallbackCopyText(src);
      });
    },
    copyTextWithGM(text) {
      return new Promise((resolve, reject) => {
        try {
          const result = GM_setClipboard(text, "text/plain");
          if (result && typeof result.then === "function") {
            result.then(resolve).catch(reject);
          } else {
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
    },
    fallbackCopyText(text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(() => utils.notificationManager.show("图片链接已复制到剪贴板")).catch(() => this.fallbackCopyText2(text));
        } else {
          this.fallbackCopyText2(text);
        }
      } catch (error) {
        console.error("备用复制方法1失败:", error);
        this.fallbackCopyText2(text);
      }
    },
    fallbackCopyText2(text) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (successful) {
          utils.notificationManager.show("图片链接已复制到剪贴板");
        } else {
          utils.notificationManager.show("复制失败，请手动复制链接");
        }
      } catch (error) {
        console.error("备用复制方法2失败:", error);
        utils.notificationManager.show("复制失败，请手动复制链接");
      }
    },
    downloadImagesByUrls(items, _type = "all", callback) {
      const normalizedItems = (items || []).map((item, index) => normalizeDownloadItem(item, index));
      if (!normalizedItems.length) {
        return;
      }
      let downloaded = 0;
      let hasError = false;
      normalizedItems.forEach((item, index) => {
        setTimeout(() => {
          this.downloadSingleImageByUrl(item, index, (success) => {
            if (!success) {
              hasError = true;
            }
            downloaded += 1;
            if (downloaded === normalizedItems.length) {
              callback?.();
              if (hasError) {
                utils.notificationManager.show(`图片下载完成，部分图片下载失败 (${downloaded}/${normalizedItems.length})`);
              } else {
                utils.notificationManager.show(`所有图片下载完成 (${downloaded}/${normalizedItems.length})`);
              }
            }
          });
        }, index * 1e3);
      });
    },
    downloadSingleImageByUrl(item, index, callback, attempt = 0) {
      const normalizedItem = normalizeDownloadItem(item, index);
      if (!normalizedItem.src) {
        callback?.(false);
        return;
      }
      try {
        GM_download({
          url: normalizedItem.src,
          name: normalizedItem.fileName,
          onload: () => callback?.(true),
          onerror: (error) => {
            console.error("下载失败:", normalizedItem.src, error);
            if (attempt < 2) {
              setTimeout(() => {
                this.downloadSingleImageByUrl(normalizedItem, index, callback, attempt + 1);
              }, 500 * (attempt + 1));
              return;
            }
            callback?.(false);
          }
        });
      } catch (_error) {
        this.downloadImageFallback(normalizedItem.src, normalizedItem.fileName);
        callback?.(true);
      }
    },
    downloadImagesBatch(images, callback) {
      let downloaded = 0;
      const total = images.length;
      let hasError = false;
      images.each((index, img) => {
        const src = resolveImageSource($(img));
        if (!src) {
          downloaded += 1;
          if (downloaded === total) {
            callback?.();
          }
          return;
        }
        setTimeout(() => {
          this.downloadSingleImageByUrl(src, index, (success) => {
            if (!success) {
              hasError = true;
            }
            downloaded += 1;
            if (downloaded === total) {
              if (hasError) {
                utils.notificationManager.show(`图片下载完成，部分图片下载失败 (${downloaded}/${total})`);
              } else {
                utils.notificationManager.show(`所有图片下载完成 (${downloaded}/${total})`);
              }
              callback?.();
            }
          });
        }, index * 1e3);
      });
    }
  };
  function createImagePreviewTemplate() {
    return `
    <div class="image-preview-overlay" id="imagePreviewOverlay"></div>
    <div class="image-preview-panel" id="imagePreviewPanel">
      <div class="image-preview-header">
        <div class="image-preview-header-main">
          <div class="image-preview-title">全书图片预览</div>
          <div class="select-all-container select-all-container-inline">
            <input type="checkbox" class="select-all-checkbox" id="selectAllImages">
            <label class="select-all-label" for="selectAllImages">全选</label>
          </div>
        </div>
        <span class="image-preview-stats" id="imagePreviewStats">已选择 0 张图片 | 章节 0 | 共 0 张</span>
        <button class="image-preview-close" id="closeImagePreview">×</button>
      </div>
      <div class="image-preview-scan-banner" id="imagePreviewScanBanner" style="display:none;">
        <div class="image-preview-scan-banner-main">
          <div class="image-preview-scan-banner-title" id="imagePreviewScanTitle">正在扫描图片</div>
          <div class="image-preview-scan-banner-meta" id="imagePreviewScanMeta">图片 0 | 预计 --:--</div>
        </div>
        <div class="image-preview-scan-banner-bar">
          <div class="image-preview-scan-banner-fill" id="imagePreviewScanFill" style="width:0%"></div>
        </div>
        <div class="image-preview-scan-banner-status" id="imagePreviewScanStatus">正在准备扫描章节与图片...</div>
      </div>
      <div class="image-preview-content-container">
        <div class="image-preview-content" id="imagePreviewContent"></div>
      </div>
      <div class="image-preview-actions">
        <button class="control-btn" id="downloadSelectedImages">下载所选图片</button>
        <button class="control-btn" id="copySelectedImages">复制所选图片</button>
        <button class="control-btn" id="copySelectedImageUrls">复制所选图片url</button>
      </div>
    </div>
  `;
  }
  function createImagePreviewPanelMethods() {
    return {
      init() {
        if (this.isInitialized) {
          return;
        }
        $("#imagePreviewOverlay, #imagePreviewPanel").remove();
        $("body").append(createImagePreviewTemplate());
        this.bindEvents();
        this.observeThemeChange();
        this.applyTheme();
        this.isInitialized = true;
      },
      bindEvents() {
        $("#closeImagePreview, #imagePreviewOverlay").off("click.imagePreview").on("click.imagePreview", () => this.hide());
        $("#selectAllImages").off("change.imagePreview").on("change.imagePreview", (event) => this.toggleSelectAll(event.target.checked));
        $("#downloadSelectedImages").off("click.imagePreview").on("click.imagePreview", () => this.downloadSelectedImages());
        $("#copySelectedImages").off("click.imagePreview").on("click.imagePreview", () => this.copySelectedImages());
        $("#copySelectedImageUrls").off("click.imagePreview").on("click.imagePreview", () => this.copySelectedImageUrls());
        $("#imagePreviewPanel").off("click.imagePreview").on("click.imagePreview", (event) => event.stopPropagation());
      },
      observeThemeChange() {
        if (this.themeObserver) {
          return;
        }
        this.themeObserver = new MutationObserver(() => {
          if (this.themeFramePending) {
            return;
          }
          this.themeFramePending = true;
          requestAnimationFrame(() => {
            this.themeFramePending = false;
            const nextTheme = this.getThemeMode();
            if (nextTheme !== this.currentTheme) {
              this.applyTheme(nextTheme);
            }
          });
        });
        this.themeObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ["class"]
        });
      },
      getThemeMode() {
        return utils.isWhiteTheme() ? "light" : "dark";
      },
      applyTheme(theme = this.getThemeMode()) {
        const panel = $("#imagePreviewPanel");
        const overlay = $("#imagePreviewOverlay");
        const nextThemeClass = `theme-${theme}`;
        if (!panel.length || !overlay.length) {
          return;
        }
        if (theme === this.currentTheme && panel.hasClass(nextThemeClass) && overlay.hasClass(nextThemeClass)) {
          return;
        }
        this.currentTheme = theme;
        panel.removeClass("theme-light theme-dark").addClass(nextThemeClass);
        overlay.removeClass("theme-light theme-dark").addClass(nextThemeClass);
      },
      renderChapterButtons() {
        return null;
      }
    };
  }
  function escapeHtml(text) {
    return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function createImagePreviewGalleryMethods() {
    return {
      getBookCacheKey() {
        const candidates = [
          $(".readerTopBar_title_link").text(),
          $(".readerTopBar_bookInfo_title").text(),
          $(".readerCatalog_bookInfo_title").text(),
          document.title,
          window.location.pathname
        ];
        return candidates.map((value) => String(value || "").replace(/\s+/g, " ").trim()).find(Boolean) || window.location.pathname;
      },
      cloneImageEntry(image, index = 0) {
        return {
          ...image,
          chapters: Array.isArray(image?.chapters) ? image.chapters.slice() : [],
          displayIndex: image?.displayIndex ?? index + 1
        };
      },
      cloneImageList(images) {
        return (images || []).map((image, index) => this.cloneImageEntry(image, index));
      },
      mergeChapterFilters(...groups) {
        const merged = [];
        const seen = /* @__PURE__ */ new Set();
        groups.flat().forEach((chapter) => {
          const normalized = String(chapter || "").trim();
          if (!normalized || seen.has(normalized)) {
            return;
          }
          seen.add(normalized);
          merged.push(normalized);
        });
        return merged;
      },
      mergeImageCollections(...groups) {
        const imageMap = /* @__PURE__ */ new Map();
        groups.flat().forEach((image) => {
          if (!image?.src) {
            return;
          }
          const chapters = Array.isArray(image.chapters) ? image.chapters : image.chapter ? [image.chapter] : [];
          const existing = imageMap.get(image.src);
          if (!existing) {
            imageMap.set(image.src, {
              ...image,
              chapters: this.mergeChapterFilters(chapters),
              duplicateCount: Math.max(image.duplicateCount || 1, chapters.length || 1),
              order: Number.isFinite(image.order) ? image.order : imageMap.size + 1
            });
            return;
          }
          const mergedChapters = this.mergeChapterFilters(existing.chapters, chapters);
          imageMap.set(image.src, {
            ...existing,
            ...image,
            width: Math.max(existing.width || 0, image.width || 0),
            height: Math.max(existing.height || 0, image.height || 0),
            chapter: existing.chapter || image.chapter || mergedChapters[0] || "",
            chapters: mergedChapters,
            duplicateCount: Math.max(
              existing.duplicateCount || 1,
              image.duplicateCount || 1,
              mergedChapters.length || 1
            ),
            order: Math.min(
              Number.isFinite(existing.order) ? existing.order : Number.MAX_SAFE_INTEGER,
              Number.isFinite(image.order) ? image.order : Number.MAX_SAFE_INTEGER
            ),
            fileName: existing.fileName || image.fileName
          });
        });
        return this.sanitizeCollectedImages(
          Array.from(imageMap.values()).sort((left, right) => (left.order || 0) - (right.order || 0))
        );
      },
      sortImagesNewestFirst(images) {
        return this.sanitizeCollectedImages(
          [...images || []].sort((left, right) => {
            const leftOrder = Number.isFinite(left?.order) ? left.order : 0;
            const rightOrder = Number.isFinite(right?.order) ? right.order : 0;
            return rightOrder - leftOrder;
          })
        );
      },
      buildScanStatsMarkup(discoveredCount, loadedCount, estimatedText) {
        return `
        <span class="image-preview-scan-count image-preview-scan-count-discovered">已发现 ${discoveredCount}</span>
        <span class="image-preview-scan-count image-preview-scan-count-loaded">已加载 ${loadedCount}</span>
        <span class="image-preview-scan-eta">预计 ${estimatedText || "--:--"}</span>
      `;
      },
      buildCompletedScanStatsMarkup(discoveredCount, loadedCount) {
        return `
        <span class="image-preview-scan-count image-preview-scan-count-discovered">已发现 ${discoveredCount}</span>
        <span class="image-preview-scan-count image-preview-scan-count-loaded">已加载 ${loadedCount}</span>
      `;
      },
      getLoadedImageCount(state) {
        return Math.max(0, Number(state?.loadedCount) || 0);
      },
      getDiscoveredImageCount(state) {
        const loadedCount = this.getLoadedImageCount(state);
        const loadedSourceSet = state?.loadedSourceSet || /* @__PURE__ */ new Set();
        const currentImages = this.sanitizeCollectedImages(state?.images || []);
        const extraCount = currentImages.reduce((count, image) => {
          if (!image?.src || loadedSourceSet.has(image.src)) {
            return count;
          }
          return count + 1;
        }, 0);
        return loadedCount + extraCount;
      },
      showScanBanner(title, discoveredCount, loadedCount, estimatedText, progress, statusText) {
        $("#imagePreviewScanBanner").removeClass("is-complete").addClass("is-visible").show();
        $("#imagePreviewScanTitle").text(title || "正在扫描图片");
        $("#imagePreviewScanMeta").html(this.buildScanStatsMarkup(discoveredCount, loadedCount, estimatedText));
        $("#imagePreviewScanFill").css("width", `${Math.max(0, Math.min(100, progress || 0))}%`);
        $("#imagePreviewScanStatus").text(statusText || "正在扫描...");
      },
      showCompletedScanBanner(discoveredCount, loadedCount, statusText = "扫描完成") {
        $("#imagePreviewScanBanner").addClass("is-visible is-complete").show();
        $("#imagePreviewScanTitle").text("扫描完成");
        $("#imagePreviewScanMeta").html(this.buildCompletedScanStatsMarkup(discoveredCount, loadedCount));
        $("#imagePreviewScanFill").css("width", "100%");
        $("#imagePreviewScanStatus").empty();
      },
      hideScanBanner() {
        $("#imagePreviewScanBanner").removeClass("is-visible").hide();
      },
      readCollectionCache() {
        const cacheKey = this.getBookCacheKey();
        const cached = this.collectionCache.get(cacheKey);
        if (!cached?.images?.length) {
          return null;
        }
        this.collectionCache.delete(cacheKey);
        this.collectionCache.set(cacheKey, cached);
        return {
          chapterFilters: Array.isArray(cached.chapterFilters) ? cached.chapterFilters.slice() : [],
          images: this.cloneImageList(cached.images)
        };
      },
      writeCollectionCache(images, chapterFilters) {
        const normalizedImages = this.cloneImageList(images);
        const trimmedImages = normalizedImages.slice(0, this.collectionCacheImageLimit);
        const cacheKey = this.getBookCacheKey();
        if (this.collectionCache.has(cacheKey)) {
          this.collectionCache.delete(cacheKey);
        }
        this.collectionCache.set(cacheKey, {
          images: trimmedImages,
          chapterFilters: Array.isArray(chapterFilters) ? chapterFilters.slice() : []
        });
        while (this.collectionCache.size > this.collectionCacheLimit) {
          const oldestKey = this.collectionCache.keys().next().value;
          if (!oldestKey) {
            break;
          }
          this.collectionCache.delete(oldestKey);
        }
      },
      getDisplayImageCount(images) {
        return this.sanitizeCollectedImages(images || []).length;
      },
      touchImageResourceCache(src, resource) {
        if (!src || !resource) {
          return;
        }
        if (this.imageResourceCache.has(src)) {
          this.imageResourceCache.delete(src);
        }
        this.imageResourceCache.set(src, resource);
        while (this.imageResourceCache.size > this.imageResourceCacheLimit) {
          const oldestKey = this.imageResourceCache.keys().next().value;
          if (!oldestKey) {
            break;
          }
          this.imageResourceCache.delete(oldestKey);
        }
      },
      preloadImageResource(src) {
        if (!src) {
          return Promise.resolve("");
        }
        const cached = this.imageResourceCache.get(src);
        if (cached) {
          this.touchImageResourceCache(src, cached);
          return Promise.resolve(cached);
        }
        const pending = this.imageResourceQueue.get(src);
        if (pending) {
          return pending;
        }
        const task = new Promise((resolve) => {
          const image = new Image();
          let settled = false;
          image.decoding = "async";
          const finish = () => {
            if (settled) {
              return;
            }
            settled = true;
            this.imageResourceQueue.delete(src);
            this.touchImageResourceCache(src, image);
            resolve(src);
          };
          image.onload = finish;
          image.onerror = finish;
          image.src = src;
          if (image.complete) {
            finish();
          }
        });
        this.imageResourceQueue.set(src, task);
        return task;
      },
      warmVisibleImageResources(images, startIndex = 0, count = IMAGE_PREVIEW_CONFIG.preloadAheadCount) {
        const visibleImages = Array.isArray(images) ? images : [];
        const endIndex = Math.min(startIndex + count, visibleImages.length);
        for (let index = startIndex; index < endIndex; index += 1) {
          this.preloadImageResource(visibleImages[index]?.src);
        }
      },
      createCancelError() {
        const error = new Error("IMAGE_PREVIEW_CANCELLED");
        error.code = "IMAGE_PREVIEW_CANCELLED";
        return error;
      },
      isCancelError(error) {
        return error && (error.code === "IMAGE_PREVIEW_CANCELLED" || error.message === "IMAGE_PREVIEW_CANCELLED");
      },
      isActiveToken(token) {
        return !this.loadCancelled && this.loadToken === token;
      },
      queueTimeout(handler, delay) {
        const timerId = setTimeout(() => {
          this.pendingTimeouts.delete(timerId);
          handler();
        }, delay);
        this.pendingTimeouts.add(timerId);
        return timerId;
      },
      clearPendingWork() {
        this.pendingTimeouts.forEach((timerId) => clearTimeout(timerId));
        this.pendingTimeouts.clear();
        this.pendingWaits.forEach((task) => {
          clearTimeout(task.timerId);
          task.reject(this.createCancelError());
        });
        this.pendingWaits.clear();
      },
      wait(ms, token) {
        return new Promise((resolve, reject) => {
          if (!this.isActiveToken(token)) {
            reject(this.createCancelError());
            return;
          }
          const waitTask = { timerId: null, reject };
          waitTask.timerId = setTimeout(() => {
            this.pendingWaits.delete(waitTask);
            if (!this.isActiveToken(token)) {
              reject(this.createCancelError());
              return;
            }
            resolve();
          }, ms);
          this.pendingWaits.add(waitTask);
        });
      },
      getScrollRoot() {
        return document.scrollingElement || document.documentElement || document.body;
      },
      getScrollMetrics() {
        const root = this.getScrollRoot();
        const viewportHeight = window.innerHeight || root.clientHeight || 0;
        const scrollTop = window.scrollY || root.scrollTop || document.documentElement.scrollTop || document.body.scrollTop || 0;
        const scrollHeight = Math.max(
          root.scrollHeight || 0,
          document.documentElement.scrollHeight || 0,
          document.body.scrollHeight || 0,
          viewportHeight
        );
        return {
          scrollTop,
          viewportHeight,
          scrollHeight,
          maxScrollTop: Math.max(0, scrollHeight - viewportHeight)
        };
      },
      setScrollTop(top) {
        const nextTop = Math.max(0, Math.round(top || 0));
        window.scrollTo(0, nextTop);
        const root = this.getScrollRoot();
        if (root) {
          root.scrollTop = nextTop;
        }
      },
      triggerReaderLoad() {
        window.dispatchEvent(new Event("scroll"));
        window.dispatchEvent(new Event("resize"));
        document.dispatchEvent(new Event("scroll"));
      },
      getTimeText(seconds) {
        const safe = Math.max(0, Math.round(seconds || 0));
        return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
      },
      getCurrentChapterLabel() {
        return ($(".readerTopBar_title_chapter").text() || $(".readerTopBar_title_link").text() || $(".readerCatalog_currentChapter").text() || "").trim() || "未命名章节";
      },
      discoverChapterLabelsFromDom() {
        const selectors = [
          ".readerCatalog_list a",
          ".readerCatalog_list li",
          ".readerCatalog_list button",
          '[class*="readerCatalog"] a',
          '[class*="readerCatalog"] li',
          '[class*="readerCatalog"] button',
          '[class*="chapter"] a',
          '[class*="chapter"] li',
          '[class*="chapter"] button'
        ];
        const labels = [];
        const seen = /* @__PURE__ */ new Set();
        selectors.forEach((selector) => {
          $(selector).each((_, node) => {
            const text = $(node).clone().children().remove().end().text().replace(/\s+/g, " ").trim();
            if (!text || text.length > 80) {
              return;
            }
            if (text === this.getCurrentChapterLabel() || seen.has(text)) {
              return;
            }
            seen.add(text);
            labels.push(text);
          });
        });
        const current = this.getCurrentChapterLabel();
        if (current && !seen.has(current)) {
          labels.unshift(current);
        }
        return labels;
      },
      getImageSelectors() {
        return [
          ".readerChapterContent img",
          ".readerChapterContent_container img",
          ".wr_horizontalReader_app_content img",
          ".app_content img"
        ].join(", ");
      },
      getCandidateImages() {
        return $(this.getImageSelectors()).filter((_, img) => {
          const $img = $(img);
          return !$img.closest(".image-preview-panel, .image-toolbar-container, .control-panel, .readerControls, .readerTopBar").length;
        });
      },
      getImageDimensions($img) {
        const el = $img[0];
        return {
          width: el?.naturalWidth || $img.width() || el?.width || Number($img.attr("width")) || 0,
          height: el?.naturalHeight || $img.height() || el?.height || Number($img.attr("height")) || 0
        };
      },
      getImageSizeText(image) {
        const width = image?.width || 0;
        const height = image?.height || 0;
        return width && height ? `${width}x${height}` : "尺寸未知";
      },
      isPlaceholderImageSrc(src) {
        if (!src) {
          return true;
        }
        if (src.startsWith("data:image/gif")) {
          return true;
        }
        try {
          const url = new URL(src, window.location.origin);
          const fileName = decodeURIComponent(url.pathname.split("/").pop() || "").toLowerCase();
          return fileName.startsWith("loading_") || fileName === "loading.png" || fileName.includes("placeholder");
        } catch (_error) {
          return /loading_|placeholder/i.test(src);
        }
      },
      resolveImageSource($img) {
        const candidates = [
          $img.attr("data-src"),
          $img.attr("data-original"),
          $img.attr("data-lazy-src"),
          $img.attr("data-url"),
          $img.attr("src")
        ].map((value) => String(value || "").trim()).filter(Boolean);
        return candidates.find((src) => !this.isPlaceholderImageSrc(src)) || candidates[0] || "";
      },
      isBlankImage($img, src) {
        if (!src || this.isPlaceholderImageSrc(src)) {
          return true;
        }
        const dimensions = this.getImageDimensions($img);
        return !dimensions.width || !dimensions.height || dimensions.width <= 4 || dimensions.height <= 4;
      },
      extractFileName(src, fallbackIndex) {
        try {
          const url = new URL(src, window.location.origin);
          const lastSegment = decodeURIComponent(url.pathname.split("/").pop() || "");
          if (lastSegment) {
            return lastSegment;
          }
        } catch (error) {
          console.error("图片文件名解析失败:", src, error);
        }
        return `image_${fallbackIndex}.jpg`;
      },
      shouldDropTrailingImage(image) {
        if (!image?.src) {
          return true;
        }
        if (this.isPlaceholderImageSrc(image.src)) {
          return true;
        }
        const fileName = String(image.fileName || "").toLowerCase();
        if (/loading|placeholder/.test(fileName)) {
          return true;
        }
        return false;
      },
      sanitizeCollectedImages(images) {
        if (!Array.isArray(images) || !images.length) {
          return [];
        }
        const sanitized = images.filter((item) => item && item.src);
        while (sanitized.length > 0 && this.shouldDropTrailingImage(sanitized[sanitized.length - 1])) {
          sanitized.pop();
        }
        return sanitized.map((item, index) => ({
          ...item,
          displayIndex: index + 1
        }));
      },
      getRenderableImageSrc(src) {
        if (!src) {
          return "";
        }
        const cached = this.imageResourceCache.get(src);
        if (cached) {
          this.touchImageResourceCache(src, cached);
          return src;
        }
        return src;
      },
      buildImageEntry($img, src, chapter, state) {
        const dimensions = this.getImageDimensions($img);
        return {
          src,
          width: dimensions.width,
          height: dimensions.height,
          chapter,
          chapters: chapter ? [chapter] : [],
          duplicateCount: 1,
          order: state.sequence++,
          fileName: this.extractFileName(src, state.sequence)
        };
      },
      collectImageNodes(state) {
        const chapter = this.getCurrentChapterLabel();
        if (chapter && !state.chapterSet.has(chapter)) {
          state.chapterSet.add(chapter);
          state.chapterOrder.push(chapter);
          this.chapterFilters = state.chapterOrder.slice();
          this.renderChapterButtons(state.chapterOrder, { loading: true });
        }
        this.getCandidateImages().each((_, img) => {
          if (state.visitedNodes.has(img)) {
            return;
          }
          const $img = $(img);
          const src = this.resolveImageSource($img);
          if (this.isBlankImage($img, src)) {
            return;
          }
          state.visitedNodes.add(img);
          const existing = state.imageMap.get(src);
          if (existing) {
            if (chapter && !existing.chapters.includes(chapter)) {
              existing.chapters.push(chapter);
              existing.duplicateCount = existing.chapters.length;
            } else {
              existing.duplicateCount += 1;
            }
            return;
          }
          const entry = this.buildImageEntry($img, src, chapter || "未命名章节", state);
          state.imageMap.set(entry.src, entry);
          state.images.push(entry);
        });
      },
      estimateProgress() {
        const metrics = this.getScrollMetrics();
        if (metrics.maxScrollTop <= 0) {
          return 0;
        }
        return Math.min(99, Math.max(0, metrics.scrollTop / metrics.maxScrollTop * 100));
      },
      setLoadingView(imageCount, estimatedText, progress, statusText = "正在准备扫描章节与图片...") {
        $("#imagePreviewContent").html(`
        <div class="image-preview-loading">
          <div class="image-preview-loading-title">正在加载全书图片</div>
          <div class="image-preview-loading-stats" id="imagePreviewLoadingStats">图片 ${imageCount} | 预计 ${estimatedText}</div>
          <div class="image-preview-loading-bar">
            <div class="image-preview-loading-fill" id="imagePreviewLoadingFill" style="width:${progress}%"></div>
          </div>
          <div class="image-preview-loading-status" id="imagePreviewLoadingStatus">${statusText}</div>
          <div class="image-preview-loading-tip">关闭面板即可取消抓取与扫描</div>
        </div>
      `);
        this.showScanBanner("正在扫描全书图片", imageCount, 0, estimatedText, progress, statusText);
        this.updateStats(0);
      },
      updateLoadingView(imageCount, estimatedText, progress, statusText = "", loadedCount = imageCount) {
        $("#imagePreviewLoadingStats").text(`图片 ${imageCount} | 预计 ${estimatedText}`);
        $("#imagePreviewLoadingFill").css("width", `${Math.max(0, Math.min(100, progress))}%`);
        $("#imagePreviewLoadingStatus").text(statusText || "正在扫描...");
        this.showScanBanner(
          "正在扫描全书图片",
          imageCount,
          loadedCount,
          estimatedText,
          progress,
          statusText || "正在扫描..."
        );
        this.updateStats(loadedCount);
      },
      updateCollectionProgress(state, progress, statusText) {
        const elapsed = (Date.now() - state.startTime) / 1e3;
        const eta = progress > 0 ? Math.max(1, elapsed * (100 / progress - 1)) : 0;
        const discoveredCount = this.getDiscoveredImageCount(state);
        const loadedCount = this.getLoadedImageCount(state);
        this.updateLoadingView(
          discoveredCount,
          progress > 0 ? this.getTimeText(eta) : "--:--",
          progress,
          statusText,
          loadedCount
        );
      },
      async waitForGrowth(token, state, baseline) {
        let hasGrowth = false;
        for (let attempt = 0; attempt < IMAGE_PREVIEW_CONFIG.growthWaitAttempts; attempt += 1) {
          await this.wait(
            IMAGE_PREVIEW_CONFIG.growthWaitBaseMs + attempt * IMAGE_PREVIEW_CONFIG.growthWaitStepMs,
            token
          );
          this.triggerReaderLoad();
          this.collectImageNodes(state);
          const metrics = this.getScrollMetrics();
          const imageGrowth = state.images.length > baseline.imageCount;
          const scrollGrowth = metrics.scrollHeight > baseline.scrollHeight + 4;
          if (imageGrowth || scrollGrowth) {
            baseline.imageCount = state.images.length;
            baseline.scrollHeight = metrics.scrollHeight;
            hasGrowth = true;
          }
          this.updateCollectionProgress(
            state,
            this.estimateProgress(),
            `已发现 ${this.getDisplayImageCount(state.images)} 张图片`
          );
          if (hasGrowth && attempt >= 1) {
            break;
          }
        }
        return hasGrowth;
      },
      async startBookImageCollection(token) {
        const cachedImages = this.readCollectionCache()?.images || [];
        const state = {
          visitedNodes: /* @__PURE__ */ new WeakSet(),
          imageMap: /* @__PURE__ */ new Map(),
          images: [],
          chapterSet: /* @__PURE__ */ new Set(),
          chapterOrder: [],
          sequence: 1,
          startTime: Date.now(),
          loadedCount: this.getDisplayImageCount(cachedImages),
          loadedSourceSet: new Set(cachedImages.map((image) => image?.src).filter(Boolean))
        };
        const startScrollTop = this.originalScrollTop;
        const step = Math.max(
          IMAGE_PREVIEW_CONFIG.scrollStepMinPx,
          Math.floor((window.innerHeight || 900) * IMAGE_PREVIEW_CONFIG.scrollStepViewportRatio)
        );
        let round = 0;
        let stableBottomRounds = 0;
        let stalledRounds = 0;
        let lastImageCount = 0;
        let lastScrollHeight = this.getScrollMetrics().scrollHeight;
        try {
          const domChapters = this.discoverChapterLabelsFromDom();
          if (domChapters.length) {
            this.renderChapterButtons(domChapters, { loading: true });
          }
          this.collectImageNodes(state);
          this.updateCollectionProgress(state, this.estimateProgress(), "正在扫描封面与当前章节...");
          while (round < IMAGE_PREVIEW_CONFIG.collectionMaxRounds && this.isActiveToken(token)) {
            const metrics = this.getScrollMetrics();
            const nextTop = Math.min(metrics.maxScrollTop, metrics.scrollTop + step);
            const reachedBottomSoon = nextTop >= metrics.maxScrollTop - 4;
            this.setScrollTop(nextTop);
            this.triggerReaderLoad();
            const baseline = {
              imageCount: lastImageCount,
              scrollHeight: lastScrollHeight
            };
            const hasGrowth = await this.waitForGrowth(token, state, baseline);
            const afterMetrics = this.getScrollMetrics();
            stableBottomRounds = reachedBottomSoon ? stableBottomRounds + 1 : 0;
            const hasNewImages = state.images.length > lastImageCount;
            const hasNewHeight = afterMetrics.scrollHeight > lastScrollHeight + 4;
            stalledRounds = !hasNewImages && !hasNewHeight && !hasGrowth ? stalledRounds + 1 : 0;
            lastImageCount = state.images.length;
            lastScrollHeight = afterMetrics.scrollHeight;
            if (state.chapterOrder.length) {
              this.chapterFilters = state.chapterOrder.slice();
              this.renderChapterButtons(this.chapterFilters, { loading: true });
            }
            if (stableBottomRounds >= IMAGE_PREVIEW_CONFIG.stableBottomRounds && stalledRounds >= IMAGE_PREVIEW_CONFIG.stalledRounds) {
              break;
            }
            round += 1;
          }
          this.setScrollTop(this.getScrollMetrics().maxScrollTop);
          await this.waitForGrowth(token, state, {
            imageCount: lastImageCount,
            scrollHeight: lastScrollHeight
          });
          this.collectImageNodes(state);
          this.updateCollectionProgress(
            state,
            100,
            `扫描完成，共整理 ${this.getDisplayImageCount(state.images)} 张去重图片`
          );
          this.chapterFilters = state.chapterOrder.slice();
          return this.sanitizeCollectedImages(state.images.sort((left, right) => left.order - right.order));
        } finally {
          this.setScrollTop(startScrollTop);
        }
      },
      getImageChapterText(image) {
        const chapters = image.chapters || [];
        if (!chapters.length) {
          return image.chapter || "未命名章节";
        }
        if (chapters.length === 1) {
          return chapters[0];
        }
        return `${chapters[0]} 等 ${chapters.length} 章`;
      },
      getFilteredImages() {
        const items = this.allImages.filter((item) => item && item.src);
        if (!this.activeFilter || this.activeFilter === "all") {
          return items;
        }
        return items.filter((item) => {
          const chapters = item.chapters || [];
          return chapters.includes(this.activeFilter) || item.chapter === this.activeFilter;
        });
      },
      renderImages(images) {
        const visibleImages = images || [];
        this.visibleImages = visibleImages;
        const content = $("#imagePreviewContent").empty();
        if (!visibleImages.length) {
          this.renderEmpty(this.activeFilter && this.activeFilter !== "all" ? "当前章节没有可用图片" : "全书未找到可用图片");
          return;
        }
        const grid = $('<div class="image-preview-grid" id="imagePreviewGrid"></div>');
        content.append(grid);
        this.warmVisibleImageResources(visibleImages, 0, IMAGE_PREVIEW_CONFIG.preloadBatchSize);
        this.renderImagesBatch(visibleImages, 0, IMAGE_PREVIEW_CONFIG.preloadBatchSize, grid, this.loadToken);
      },
      renderImagesBatch(images, startIndex, batchSize, grid, token) {
        if (!this.isActiveToken(token)) {
          return;
        }
        const endIndex = Math.min(startIndex + batchSize, images.length);
        for (let index = startIndex; index < endIndex; index += 1) {
          const image = images[index];
          const fileSize = this.getImageSizeText(image);
          const chapterText = this.getImageChapterText(image);
          const renderSrc = this.getRenderableImageSrc(image.src);
          const item = $(`
          <div class="image-preview-item" data-src="${escapeHtml(image.src)}" data-chapter="${escapeHtml(chapterText)}">
            <input type="checkbox" class="image-preview-checkbox" id="img-checkbox-${index}" data-src="${escapeHtml(image.src)}">
            <img class="image-preview-thumb" src="${escapeHtml(renderSrc)}" alt="预览图 ${index + 1}" decoding="async" loading="lazy" onerror="this.style.display='none'">
            <div class="image-preview-info">
              <div><strong>图片 ${index + 1}</strong></div>
              <div class="image-preview-meta">${escapeHtml(chapterText)}</div>
              <div class="image-preview-meta image-preview-file-name" title="${escapeHtml(image.fileName)}">${escapeHtml(image.fileName)}</div>
              <div class="image-preview-meta">${escapeHtml(fileSize)}</div>
              <div class="image-preview-meta">${image.duplicateCount > 1 ? `重复 ${image.duplicateCount} 次` : "唯一图片"}</div>
              <div class="image-action-buttons">
                <button class="image-action-btn copy-btn" data-src="${escapeHtml(image.src)}">复制链接</button>
                <button class="image-action-btn download-btn" data-src="${escapeHtml(image.src)}">下载图片</button>
              </div>
            </div>
          </div>
        `);
          const checkbox = item.find(".image-preview-checkbox");
          checkbox.on("change", (event) => {
            event.stopPropagation();
            this.toggleImageSelection(event.target.dataset.src, event.target.checked);
          });
          item.on("click", (event) => {
            if (event.target.type !== "checkbox" && !$(event.target).hasClass("image-action-btn")) {
              checkbox.prop("checked", !checkbox.prop("checked")).trigger("change");
            }
          });
          item.find(".copy-btn").on("click", (event) => {
            event.stopPropagation();
            this.copySingleImageUrl(image.src);
          });
          item.find(".download-btn").on("click", (event) => {
            event.stopPropagation();
            this.downloadSingleImage(image, index);
          });
          grid.append(item);
        }
        this.updateSelectAllState();
        this.updateStats();
        if (endIndex < images.length && this.isActiveToken(token)) {
          this.warmVisibleImageResources(images, endIndex, batchSize || IMAGE_PREVIEW_CONFIG.preloadBatchSize);
          this.queueTimeout(() => this.renderImagesBatch(images, endIndex, batchSize, grid, token), 60);
        }
      },
      renderEmpty(message) {
        $("#imagePreviewContent").html(`<div class="image-preview-empty">${escapeHtml(message)}</div>`);
        this.updateStats();
      },
      activateChapterFilter(filter) {
        const nextFilter = filter || "all";
        this.activeFilter = nextFilter;
        this.selectedImages.clear();
        $("#selectAllImages").prop("checked", false).prop("indeterminate", false);
        this.renderChapterButtons(this.chapterFilters || [], { loading: this.isLoading });
        this.updateStats();
        if (this.allImages.length && !this.isLoading) {
          this.renderImages(this.getFilteredImages());
          return;
        }
        if (!this.isLoading && !this.allImages.length) {
          this.setLoadingView(0, "--:--", 0, "正在准备扫描章节与图片...");
        }
      },
      show() {
        this.clearPendingWork();
        this.selectedImages.clear();
        const cachedCollection = this.readCollectionCache();
        this.allImages = this.sortImagesNewestFirst(cachedCollection?.images || []);
        this.visibleImages = [];
        this.chapterFilters = this.mergeChapterFilters(
          cachedCollection?.chapterFilters || [],
          this.discoverChapterLabelsFromDom()
        );
        this.activeFilter = "all";
        this.originalScrollTop = this.getScrollMetrics().scrollTop;
        this.loadCancelled = false;
        this.isLoading = true;
        this.chapterIndexReady = false;
        this.applyTheme();
        $("#selectAllImages").prop("checked", false).prop("indeterminate", false);
        $("#imagePreviewOverlay").show();
        $("#imagePreviewPanel").css("display", "flex");
        this.renderChapterButtons(this.chapterFilters, { loading: true });
        this.setLoadingView(0, "--:--", 0, "正在准备扫描章节与图片...");
        if (cachedCollection) {
          this.chapterIndexReady = true;
          this.renderImages(this.getFilteredImages());
          this.updateLoadingView(
            this.allImages.length,
            "--:--",
            0,
            "已加载缓存，正在继续扫描未加载内容..."
          );
        }
        if (cachedCollection) {
          this.showScanBanner(
            "正在补充新图片",
            this.allImages.length,
            this.allImages.length,
            "--:--",
            0,
            "已加载缓存，正在继续扫描当前已加载内容，新图片会插入到前方..."
          );
        }
        const token = ++this.loadToken;
        Promise.resolve().then(() => this.startBookImageCollection(token)).then((images) => {
          if (!this.isActiveToken(token)) {
            return;
          }
          const nextImages = Array.isArray(images) ? images : [];
          this.isLoading = false;
          this.chapterIndexReady = true;
          this.allImages = this.sortImagesNewestFirst(
            this.mergeImageCollections(cachedCollection?.images || [], nextImages)
          );
          this.chapterFilters = this.mergeChapterFilters(
            cachedCollection?.chapterFilters || [],
            this.chapterFilters,
            nextImages.flatMap((image) => image?.chapters || (image?.chapter ? [image.chapter] : []))
          );
          if (!this.chapterFilters.length) {
            this.chapterFilters = this.discoverChapterLabelsFromDom();
          }
          this.writeCollectionCache(this.allImages, this.chapterFilters);
          this.renderChapterButtons(this.chapterFilters, { loading: false });
          this.renderImages(this.getFilteredImages());
          this.showCompletedScanBanner(
            this.allImages.length,
            this.allImages.length,
            "扫描完成"
          );
        }).catch((error) => {
          if (this.isCancelError(error) || this.loadToken !== token) {
            return;
          }
          this.isLoading = false;
          this.hideScanBanner();
          console.error("图片预览加载失败:", error);
          this.renderEmpty("图片加载失败，请稍后重试");
        }).finally(() => {
          if (this.loadToken === token) {
            this.isLoading = false;
            this.updateStats();
          }
        });
      }
    };
  }
  function createImagePreviewActionMethods() {
    return {
      getCurrentImageItems() {
        return this.getFilteredImages().filter((item) => item && item.src);
      },
      updateStats(imageCount = 0) {
        const selected = this.selectedImages.size;
        const total = imageCount || this.getCurrentImageItems().length || this.allImages.length || $(".image-preview-checkbox").length;
        $("#imagePreviewStats").text(`已选择 ${selected} 张图片 | 共 ${total} 张`);
      },
      toggleImageSelection(src, selected) {
        if (!src) {
          return;
        }
        const items = $(".image-preview-item").filter((_, item) => item.dataset.src === src);
        if (selected) {
          this.selectedImages.add(src);
          items.addClass("selected");
        } else {
          this.selectedImages.delete(src);
          items.removeClass("selected");
        }
        this.updateStats();
        this.updateSelectAllState();
      },
      toggleSelectAll(selected) {
        const checkboxes = $(".image-preview-checkbox");
        this.selectedImages.clear();
        checkboxes.each((_, checkbox) => {
          const src = checkbox.dataset.src;
          checkbox.checked = selected;
          $(checkbox).closest(".image-preview-item").toggleClass("selected", selected);
          if (selected && src) {
            this.selectedImages.add(src);
          }
        });
        this.updateStats();
        this.updateSelectAllState();
      },
      updateSelectAllState() {
        const total = $(".image-preview-checkbox").length;
        const selected = this.selectedImages.size;
        const selectAll = $("#selectAllImages");
        if (!total || selected === 0) {
          selectAll.prop("checked", false).prop("indeterminate", false);
        } else if (selected === total) {
          selectAll.prop("checked", true).prop("indeterminate", false);
        } else {
          selectAll.prop("checked", false).prop("indeterminate", true);
        }
      },
      getSelectedImageItems() {
        return this.getCurrentImageItems().filter((item) => this.selectedImages.has(item.src));
      },
      getSelectedImageUrls() {
        return this.getSelectedImageItems().map((item) => item.src);
      },
      getAllImageItems() {
        return this.getCurrentImageItems();
      },
      getAllImageUrls() {
        return this.getAllImageItems().map((item) => item.src);
      },
      copyTextWithGM(text) {
        return imageTools.copyTextWithGM(text);
      },
      copySelectedImageUrls() {
        const urls = this.getSelectedImageUrls();
        if (!urls.length) {
          utils.notificationManager.show("请先选择要复制的图片");
          return;
        }
        const text = urls.join("\n");
        this.copyTextWithGM(text).then(() => utils.notificationManager.show(`已复制 ${urls.length} 个选中图片链接到剪贴板`)).catch((error) => {
          console.error("复制失败:", error);
          this.fallbackCopyText(text);
        });
      },
      copySelectedImages() {
        const items = this.getSelectedImageItems();
        if (!items.length) {
          utils.notificationManager.show("请先选择要复制的图片");
          return;
        }
        const text = items.map((item) => `![${item.fileName || "image"}](${item.src})`).join("\n");
        this.copyTextWithGM(text).then(() => utils.notificationManager.show(`已复制 ${items.length} 条图片引用`)).catch((error) => {
          console.error("复制失败:", error);
          this.fallbackCopyText(text);
        });
      },
      downloadSelectedImages() {
        const items = this.getSelectedImageItems();
        if (!items.length) {
          utils.notificationManager.show("请先选择要下载的图片");
          return;
        }
        const downloadBtn = $("#downloadSelectedImages");
        if (downloadBtn.hasClass("loading")) {
          return;
        }
        downloadBtn.addClass("loading disabled").text("下载中...");
        utils.notificationManager.show(`开始下载 ${items.length} 张选中图片...`);
        imageTools.downloadImagesByUrls(items, "selected", () => {
          downloadBtn.removeClass("loading disabled").text("下载所选图片");
        });
      },
      copyAllImageUrls() {
        const urls = this.getAllImageUrls();
        if (!urls.length) {
          utils.notificationManager.show("没有找到图片链接");
          return;
        }
        const text = urls.join("\n");
        this.copyTextWithGM(text).then(() => utils.notificationManager.show(`已复制 ${urls.length} 个图片链接到剪贴板`)).catch((error) => {
          console.error("复制失败:", error);
          this.fallbackCopyText(text);
        });
      },
      confirmDownloadAll(count) {
        return window.confirm(`将下载 ${count} 张图片，继续吗？`);
      },
      downloadAllImages() {
        const items = this.getAllImageItems();
        if (!items.length) {
          utils.notificationManager.show("当前页面没有找到图片");
          return;
        }
        if (!this.confirmDownloadAll(items.length)) {
          return;
        }
        const downloadBtn = $("#downloadAllImages");
        if (downloadBtn.hasClass("loading")) {
          return;
        }
        downloadBtn.addClass("loading disabled").text("下载中...");
        utils.notificationManager.show(`开始下载 ${items.length} 张图片...`);
        imageTools.downloadImagesByUrls(items, "all", () => {
          downloadBtn.removeClass("loading disabled").text("下载所有图片");
        });
      },
      copySingleImageUrl(src) {
        if (!src) {
          utils.notificationManager.show("获取图片链接失败");
          return;
        }
        this.copyTextWithGM(src).then(() => utils.notificationManager.show("图片链接已复制到剪贴板")).catch((error) => {
          console.error("复制失败:", error);
          this.fallbackCopyText(src);
        });
      },
      downloadSingleImage(image, index) {
        if (!image?.src) {
          utils.notificationManager.show("获取图片链接失败");
          return;
        }
        const downloadBtn = $(".image-action-btn.download-btn").filter((_, button) => button.dataset.src === image.src);
        if (downloadBtn.hasClass("loading")) {
          return;
        }
        downloadBtn.addClass("loading disabled").text("下载中...");
        utils.notificationManager.show("开始下载单张图片...");
        imageTools.downloadSingleImageByUrl(image, index, () => {
          downloadBtn.removeClass("loading disabled").text("下载图片");
        });
      },
      fallbackCopyText(text) {
        imageTools.fallbackCopyText(text);
      },
      fallbackCopyText2(text) {
        imageTools.fallbackCopyText2(text);
      },
      hide() {
        const wasLoading = this.isLoading;
        this.loadCancelled = true;
        this.loadToken += 1;
        this.isLoading = false;
        this.clearPendingWork();
        this.hideScanBanner?.();
        $("#imagePreviewOverlay, #imagePreviewPanel").hide();
        $("#imagePreviewContent").empty();
        $("#selectAllImages").prop("checked", false).prop("indeterminate", false);
        this.selectedImages.clear();
        this.visibleImages = [];
        this.setScrollTop(this.originalScrollTop || 0);
        if (wasLoading) {
          utils.notificationManager.show("已取消全书图片加载");
        }
      }
    };
  }
  const imagePreviewPanel = {
    selectedImages: /* @__PURE__ */ new Set(),
    allImages: [],
    visibleImages: [],
    chapterFilters: [],
    activeFilter: "all",
    isInitialized: false,
    isLoading: false,
    chapterIndexReady: false,
    loadCancelled: false,
    loadToken: 0,
    originalScrollTop: 0,
    currentTheme: "light",
    themeObserver: null,
    themeFramePending: false,
    pendingTimeouts: /* @__PURE__ */ new Set(),
    pendingWaits: /* @__PURE__ */ new Set(),
    collectionCache: /* @__PURE__ */ new Map(),
    collectionCacheLimit: IMAGE_PREVIEW_CONFIG.collectionCacheLimit,
    collectionCacheImageLimit: IMAGE_PREVIEW_CONFIG.collectionCacheImageLimit,
    imageResourceCache: /* @__PURE__ */ new Map(),
    imageResourceQueue: /* @__PURE__ */ new Map(),
    imageResourceCacheLimit: IMAGE_PREVIEW_CONFIG.imageResourceCacheLimit,
    ...createImagePreviewPanelMethods(),
    ...createImagePreviewGalleryMethods(),
    ...createImagePreviewActionMethods()
  };
  const chunker = {
    normalizeText(raw) {
      return String(raw || "").replace(/\u00A0/g, " ").replace(/\u200B/g, "").replace(/\s+/g, " ").trim();
    },
    splitSentences(text) {
      const parts = text.match(/[^。！？!?；;…]+[。！？!?；;…]?/g) || [];
      return parts.map((part) => part.trim()).filter(Boolean);
    },
    splitLongSentence(sentence) {
      if (sentence.length <= 220) return [sentence];
      const parts = sentence.match(/[^，、：:，。！？!?；;…]+[，、：:，。！？!?；;…]?/g) || [sentence];
      return parts.map((part) => part.trim()).filter(Boolean);
    },
    chunkText(text) {
      const chunks = [];
      let current = "";
      for (const sentence of this.splitSentences(text)) {
        const pieces = this.splitLongSentence(sentence);
        for (const piece of pieces) {
          if ((current + piece).length > 220 && current) {
            chunks.push(current);
            current = piece;
          } else {
            current += piece;
          }
        }
      }
      if (current) chunks.push(current);
      return chunks;
    },
    isPlausibleText(text) {
      const value = this.normalizeText(text);
      if (value.length < 12) return false;
      return /[\u3400-\u9FFF]/.test(value) || /[A-Za-z]{4,}/.test(value);
    },
    applyRange(text, startText, endText) {
      const normalized = this.normalizeText(text);
      const startPhrase = this.normalizeText(startText);
      const endPhrase = this.normalizeText(endText);
      const startIndex = startPhrase ? normalized.indexOf(startPhrase) : 0;
      if (startIndex === -1) {
        return { text: normalized, warning: "start-not-found", rangePolicy: "dynamic" };
      }
      if (!endPhrase) {
        return { text: normalized.slice(startIndex), rangePolicy: "dynamic" };
      }
      const endStart = normalized.indexOf(endPhrase, startIndex);
      if (endStart === -1) {
        return { text: normalized.slice(startIndex), warning: "end-not-found", rangePolicy: "dynamic" };
      }
      const endIndex = endStart + endPhrase.length;
      return { text: normalized.slice(startIndex, endIndex), rangePolicy: "explicit" };
    }
  };
  const LEGACY_TTS_PANEL_ID = "wr-tts-panel";
  const VOICE_QUICK_ID = "wr-voice-quick";
  const extractorState = {
    cachedStore: null,
    cachedVm: null,
    cachedReaderState: null,
    cachedPreRenderHtml: null,
    preRenderObserver: null
  };
  function nextTick(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  function htmlToText(html) {
    if (!html) return "";
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("script, style, noscript, svg, canvas, audio, video, iframe").forEach((el) => el.remove());
      const bodyText = doc.body && (doc.body.innerText || doc.body.textContent);
      return chunker.normalizeText(bodyText || html.replace(/<[^>]+>/g, " "));
    } catch (error) {
      return chunker.normalizeText(html.replace(/<[^>]+>/g, " "));
    }
  }
  function findAppElement() {
    return document.querySelector("#app") || document.body;
  }
  function collectVueInstances() {
    const seen = /* @__PURE__ */ new Set();
    const list = [];
    function push(vm) {
      if (!vm || typeof vm !== "object" || seen.has(vm)) return;
      seen.add(vm);
      list.push(vm);
    }
    function getSubTree(vm) {
      if (!vm) return null;
      if (vm.$subTree) return vm.$subTree;
      if (vm.$.subTree) return vm.$.subTree;
      if (vm._instance && vm._instance.subTree) return vm._instance.subTree;
      if (vm.proxy && vm.proxy.$subTree) return vm.proxy.$subTree;
      if (vm.proxy && vm.proxy.$.subTree) return vm.proxy.$.subTree;
      return null;
    }
    function walkVNode(vnode) {
      if (!vnode || typeof vnode !== "object") return;
      if (vnode.component) push(vnode.component.proxy || vnode.component);
      if (vnode.component && vnode.component.subTree) walkVNode(vnode.component.subTree);
      if (vnode.subTree) walkVNode(vnode.subTree);
      if (Array.isArray(vnode.children)) vnode.children.forEach(walkVNode);
      if (Array.isArray(vnode.dynamicChildren)) vnode.dynamicChildren.forEach(walkVNode);
      if (vnode.suspense && vnode.suspense.activeBranch) walkVNode(vnode.suspense.activeBranch);
    }
    const app = findAppElement();
    if (app) {
      if (app.__vue__) push(app.__vue__);
      if (app.__vue_app__ && app.__vue_app__._instance) {
        const root = app.__vue_app__._instance;
        push(root.proxy || root);
      }
      if (app.__vueParentComponent) {
        push(app.__vueParentComponent.proxy || app.__vueParentComponent);
      }
    }
    for (let i = 0; i < list.length; i += 1) {
      const vm = list[i];
      const children = vm.$children || [];
      for (const child of children) push(child);
      const subTree = getSubTree(vm);
      if (subTree) walkVNode(subTree);
    }
    const elements = app && app.querySelectorAll ? app.querySelectorAll("*") : document.querySelectorAll("*");
    for (const el of elements) {
      const owner = el.__vueParentComponent;
      if (owner) push(owner.proxy || owner);
    }
    return list;
  }
  function getStore(instances) {
    for (const vm of instances) {
      const store = vm.$store || vm.proxy && vm.proxy.$store;
      if (store && store.state) return store;
    }
    return null;
  }
  function getReaderState(store, vm) {
    if (store && store.state && store.state.reader) return store.state.reader;
    if (vm && vm.$store && vm.$store.state && vm.$store.state.reader) return vm.$store.state.reader;
    return null;
  }
  function findReaderVms(instances) {
    let newRenderer = null;
    let decryptor = null;
    let fallbackDecryptor = null;
    let preRenderer = null;
    let preRendererRef = null;
    let refOwner = null;
    for (const vm of instances) {
      const isNewRenderer = vm && ("tempContent" in vm || "isShowPreRender" in vm || vm.getCurrentSection != null || vm.currentChapter && vm.currentChapter.chapterUid);
      if (!newRenderer && isNewRenderer) newRenderer = vm;
      if (!decryptor && typeof vm.decryptRenderHtml === "function" && vm.bookId) decryptor = vm;
      if (!fallbackDecryptor && typeof vm.decryptRenderHtml === "function") fallbackDecryptor = vm;
      if (!preRenderer && typeof vm.preRender === "function" && "preRenderHtml" in vm) preRenderer = vm;
      if (!preRendererRef && vm.$refs && vm.$refs.preRenderContainer && typeof vm.preRender === "function") preRendererRef = vm;
      if (!refOwner && vm.$refs && (vm.$refs.preRenderContainer || vm.$refs.renderTargetCanvasContainer)) {
        refOwner = vm;
      }
    }
    const result = [];
    const seen = /* @__PURE__ */ new Set();
    for (const vm of [newRenderer, preRendererRef, preRenderer, decryptor, fallbackDecryptor, refOwner]) {
      if (vm && !seen.has(vm)) {
        seen.add(vm);
        result.push(vm);
      }
    }
    return result;
  }
  function getCurrentChapterUid(readerState, vm) {
    if (readerState) {
      const current = readerState.currentChapter;
      if (current && current.chapterUid) return String(current.chapterUid);
      const section = readerState.currentSection;
      if (section && section.chapterUid) return String(section.chapterUid);
    }
    if (vm) {
      if (vm.currentChapterUid) return String(vm.currentChapterUid);
      if (vm.currentChapter && vm.currentChapter.chapterUid) return String(vm.currentChapter.chapterUid);
    }
    return "";
  }
  function findCachedPlaintext(instances, uid) {
    let best = null;
    for (const vm of instances) {
      const candidates = [];
      if (typeof vm.preRenderHtml === "string" && vm.preRenderHtml) {
        candidates.push({ raw: vm.preRenderHtml, key: "preRenderHtml" });
      }
      if (typeof vm.tempContent === "string" && vm.tempContent) {
        candidates.push({ raw: vm.tempContent, key: "tempContent" });
      }
      for (const candidate of candidates) {
        const text = htmlToText(candidate.raw);
        if (!chunker.isPlausibleText(text)) continue;
        const vmUid = getCurrentChapterUid(getReaderState(null, vm), vm);
        const mismatch = uid && vmUid && vmUid !== uid ? 20 : 0;
        const score = (candidate.key === "preRenderHtml" ? 0 : 1) + mismatch;
        if (!best || score < best.score) {
          best = { text, source: "Vue:" + candidate.key, score };
        }
      }
    }
    return best ? { text: best.text, source: best.source } : null;
  }
  function normalizeEntries(value, fallbackUid) {
    const result = [];
    if (!value) return result;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        if (!entry || typeof entry.value !== "string" || typeof entry.valueHasStr !== "function") return;
        result.push({
          entry,
          chapterUid: entry.chapterUid != null ? String(entry.chapterUid) : fallbackUid,
          index
        });
      });
      return result;
    }
    Object.keys(value).forEach((uid) => {
      const item = value[uid];
      const list = Array.isArray(item) ? item : [item];
      list.forEach((entry, index) => {
        if (!entry || typeof entry.value !== "string" || typeof entry.valueHasStr !== "function") return;
        result.push({ entry, chapterUid: String(uid), index });
      });
    });
    return result;
  }
  function collectEntries(readerState, vm) {
    const result = [];
    const seen = /* @__PURE__ */ new Set();
    function add(value, fallbackUid) {
      const items = normalizeEntries(value, fallbackUid);
      for (const item of items) {
        const key = item.entry.value.slice(0, 200) + "|" + item.chapterUid + "|" + item.index;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(item);
      }
    }
    if (readerState) {
      add(readerState.horizontalReaderChapterContentHtml, "");
      add(readerState.chapterContentHtml, "");
      Object.keys(readerState).forEach((key) => {
        if (!/(ContentHtml|ChapterContent|RenderContent)/i.test(key)) return;
        if (/Target|Highlight|Selection/i.test(key)) return;
        add(readerState[key], "");
      });
    }
    if (vm) {
      add(vm.horizontalReaderChapterContentHtml, "");
      add(vm.chapterContentHtml, "");
    }
    return result;
  }
  async function decryptEntry(vms, entry, uid, index, probe) {
    const vmList = Array.isArray(vms) ? vms : vms ? [vms] : [];
    for (const vm of vmList) {
      if (!vm || !("tempContent" in vm) && !("isShowPreRender" in vm)) continue;
      if (typeof vm.tempContent === "string" && chunker.isPlausibleText(htmlToText(vm.tempContent))) {
        return vm.tempContent;
      }
      if ("isShowPreRender" in vm && probe && !probe.toggleAttempted) {
        probe.toggleAttempted = true;
        const previous = vm.isShowPreRender;
        if (!previous) {
          try {
            vm.isShowPreRender = true;
            await nextTick();
            if (typeof vm.tempContent === "string" && vm.tempContent) return vm.tempContent;
          } catch (error) {
          } finally {
            if (vm.isShowPreRender !== previous) vm.isShowPreRender = previous;
          }
        }
      }
    }
    for (const vm of vmList) {
      if (typeof vm.decryptRenderHtml !== "function") continue;
      try {
        vm.decryptRenderHtml(entry.value, uid || "0", getSectionIndex(vm, index || 0));
        if (typeof vm.tempContent === "string" && vm.tempContent) return vm.tempContent;
        if (typeof vm.preRenderHtml === "string" && vm.preRenderHtml) return vm.preRenderHtml;
      } catch (error) {
      }
    }
    for (const vm of vmList) {
      if (typeof vm.preRender !== "function" || !("preRenderHtml" in vm)) continue;
      if (typeof vm.preRenderHtml === "string" && vm.preRenderHtml) return vm.preRenderHtml;
      if (probe && probe.preRenderAttempted) continue;
      if (probe) probe.preRenderAttempted = true;
      const previousShouldPreRender = vm.shouldPreRender;
      try {
        vm.preRender(uid || "0");
        if (typeof vm.preRenderHtml === "string" && vm.preRenderHtml) return vm.preRenderHtml;
      } catch (error) {
      } finally {
        if (previousShouldPreRender !== void 0) vm.shouldPreRender = previousShouldPreRender;
      }
    }
    return "";
  }
  function getSectionIndex(vm, fallback) {
    if (!vm) return fallback || 0;
    try {
      if (typeof vm.getCurrentSectionIdx === "function") {
        const value = vm.getCurrentSectionIdx();
        if (typeof value === "number") return value;
      } else if (typeof vm.getCurrentSectionIdx === "number") {
        return vm.getCurrentSectionIdx;
      }
    } catch (error) {
    }
    return fallback || 0;
  }
  function capturePreRenderDom(root) {
    const selectors = ["#preRenderContent", "#preRenderContents", ".preRenderContent", ".preRenderContainer"];
    const nodes = root && root.querySelectorAll ? Array.from(root.querySelectorAll(selectors.join(","))) : [];
    for (const el of nodes) {
      const text = chunker.normalizeText(el.innerText || el.textContent);
      if (chunker.isPlausibleText(text)) {
        extractorState.cachedPreRenderHtml = {
          text,
          html: el.innerHTML || "",
          source: "preRenderDOM",
          capturedAt: Date.now()
        };
        return extractorState.cachedPreRenderHtml;
      }
    }
    return extractorState.cachedPreRenderHtml;
  }
  function readPreRenderDom() {
    const captured = capturePreRenderDom(findAppElement());
    if (captured && captured.text) {
      return { text: captured.text, source: captured.source };
    }
    return null;
  }
  function getLegacyDomText() {
    const selectors = [".readerChapterContent", ".readerContent", ".readerChapter", ".app_content", ".readerContainer"];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const text = chunker.normalizeText(el.innerText);
      if (chunker.isPlausibleText(text)) return { text, source: "DOM" };
    }
    let best = null;
    let bestLength = 0;
    const app = findAppElement();
    const candidates = app ? app.querySelectorAll("div, article, main, section") : document.querySelectorAll("div, article, main, section");
    for (const el of candidates) {
      if (el.closest("#" + LEGACY_TTS_PANEL_ID)) continue;
      if (el.closest("#" + VOICE_QUICK_ID)) continue;
      if (el.querySelector("canvas, iframe, button, input, textarea, select")) continue;
      const text = chunker.normalizeText(el.innerText);
      if (!chunker.isPlausibleText(text)) continue;
      const cjkCount = (text.match(/[\u4E00-\u9FFF]/g) || []).length;
      if (cjkCount < text.length * 0.2) continue;
      if (text.length > bestLength) {
        best = { text, source: "DOM" };
        bestLength = text.length;
      }
    }
    return best;
  }
  async function extractCurrentChapterText() {
    const dom = readPreRenderDom();
    if (dom) return dom;
    const instances = collectVueInstances();
    const store = getStore(instances);
    extractorState.cachedStore = store;
    const readerVms = findReaderVms(instances);
    const vm = readerVms[0] || null;
    extractorState.cachedVm = vm;
    const readerState = getReaderState(store, vm);
    extractorState.cachedReaderState = readerState;
    const uid = getCurrentChapterUid(readerState, vm);
    const cached = findCachedPlaintext(instances, uid);
    if (cached) {
      return {
        text: cached.text,
        source: cached.source,
        chapterUid: uid
      };
    }
    const entries = collectEntries(readerState, vm);
    const preferred = uid ? entries.filter((item) => item.chapterUid === uid) : [];
    const pool = preferred.length ? preferred : entries;
    const texts = [];
    const probe = { preRenderAttempted: false, toggleAttempted: false };
    for (const item of pool.slice(0, 20)) {
      const html = await decryptEntry(readerVms, item.entry, item.chapterUid || uid || "0", item.index || 0, probe);
      const text2 = htmlToText(html);
      if (chunker.isPlausibleText(text2)) texts.push(text2);
    }
    const text = chunker.normalizeText(texts.join("\n"));
    if (chunker.isPlausibleText(text)) {
      return {
        text,
        source: uid ? "Vue:" + uid : "Vue",
        chapterUid: uid
      };
    }
    return { text: "", source: "", chapterUid: uid };
  }
  const extractor = {
    clearCache() {
      extractorState.cachedStore = null;
      extractorState.cachedVm = null;
      extractorState.cachedReaderState = null;
      extractorState.cachedPreRenderHtml = null;
    },
    getCurrentChapterUid() {
      return getCurrentChapterUid(extractorState.cachedReaderState, extractorState.cachedVm);
    },
    getLegacyDomText,
    startPreRenderObserver() {
      if (extractorState.preRenderObserver || typeof MutationObserver === "undefined") return;
      const target = document.documentElement || document.body;
      if (!target) return;
      extractorState.preRenderObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (!mutation.addedNodes) continue;
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue;
            capturePreRenderDom(node);
          }
        }
        capturePreRenderDom(document);
      });
      extractorState.preRenderObserver.observe(target, { subtree: true, childList: true });
      capturePreRenderDom(document);
    },
    async extractCurrentChapterText() {
      return extractCurrentChapterText();
    }
  };
  const DEFAULT_HANDLERS = {
    onStateChange() {
    },
    onChunkStart() {
    },
    onFinish() {
    },
    onError() {
    }
  };
  const speechEngine = {
    available: typeof window !== "undefined" && "speechSynthesis" in window,
    chunks: [],
    index: 0,
    rate: 1,
    voiceURI: "",
    utterance: null,
    stopped: true,
    paused: false,
    playing: false,
    restarting: false,
    handlers: DEFAULT_HANDLERS,
    setHandlers(handlers) {
      Object.assign(this.handlers, handlers);
    },
    getVoices() {
      if (!this.available) return [];
      return window.speechSynthesis.getVoices() || [];
    },
    getSelectedVoice() {
      const voices = this.getVoices();
      return voices.find((voice) => voice.voiceURI === this.voiceURI) || null;
    },
    speak(chunks, rate, voiceURI) {
      if (!this.available) return false;
      this.chunks = chunks || [];
      this.rate = rate;
      this.voiceURI = voiceURI || "";
      this.index = 0;
      this.stopped = false;
      this.paused = false;
      this.restarting = false;
      this.cancelCurrent();
      window.setTimeout(() => this.speakChunk(0), 120);
      this.handlers.onStateChange();
      return true;
    },
    cancelCurrent() {
      try {
        window.speechSynthesis.cancel();
      } catch (error) {
      }
    },
    speakChunk(index) {
      if (this.stopped) return;
      if (index >= this.chunks.length) {
        this.finish();
        return;
      }
      const chunk = this.chunks[index];
      const utterance = new SpeechSynthesisUtterance(chunk);
      const voice = this.getSelectedVoice();
      utterance.rate = this.rate;
      utterance.pitch = 1;
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = "zh-CN";
      }
      utterance.onstart = () => {
        if (this.stopped || this.restarting) return;
        this.playing = true;
        this.paused = false;
        this.index = index;
        this.handlers.onChunkStart(index);
        this.handlers.onStateChange();
      };
      utterance.onend = () => {
        if (this.stopped || this.paused || this.restarting) return;
        this.index += 1;
        this.speakChunk(this.index);
      };
      utterance.onerror = (event) => {
        if (event && ["interrupted", "canceled"].includes(event.error)) return;
        if (event && event.error === "not-allowed") {
          this.handlers.onError("浏览器阻止语音，请先点击页面任意位置");
        }
        this.stop();
        this.handlers.onStateChange();
      };
      this.utterance = utterance;
      window.speechSynthesis.speak(utterance);
      this.playing = true;
      this.paused = false;
      this.handlers.onStateChange();
    },
    pause() {
      if (!this.available || !this.playing || this.paused) return;
      if (typeof window.speechSynthesis.pause === "function") {
        window.speechSynthesis.pause();
        this.paused = true;
        this.handlers.onStateChange();
        return;
      }
      this.paused = true;
      this.cancelCurrent();
      this.handlers.onStateChange();
    },
    resume() {
      if (!this.available || !this.paused) return;
      if (typeof window.speechSynthesis.resume === "function") {
        window.speechSynthesis.resume();
        this.paused = false;
        this.handlers.onStateChange();
        return;
      }
      const index = this.index;
      this.restarting = true;
      this.cancelCurrent();
      window.setTimeout(() => {
        this.restarting = false;
        this.speakChunk(index);
      }, 120);
      this.handlers.onStateChange();
    },
    restartCurrentChunk() {
      if (this.stopped || !this.chunks.length) return;
      const index = this.index;
      this.restarting = true;
      this.cancelCurrent();
      window.setTimeout(() => {
        this.restarting = false;
        this.speakChunk(index);
      }, 120);
    },
    applyRate(rate) {
      this.rate = rate;
      if (this.playing && !this.paused && !this.stopped) {
        this.restartCurrentChunk();
      }
      this.handlers.onStateChange();
    },
    setVoice(voiceURI) {
      this.voiceURI = voiceURI || "";
      if (this.playing && !this.paused && !this.stopped) {
        this.restartCurrentChunk();
      }
      this.handlers.onStateChange();
    },
    stop() {
      this.stopped = true;
      this.paused = false;
      this.playing = false;
      this.cancelCurrent();
      this.chunks = [];
      this.index = 0;
      this.utterance = null;
      this.handlers.onStateChange();
    },
    finish() {
      this.stopped = true;
      this.paused = false;
      this.playing = false;
      this.handlers.onFinish();
      this.handlers.onStateChange();
    }
  };
  const KEYS = {
    rate: "weread_tts_rate",
    voiceURI: "weread_tts_voice_uri",
    follow: "weread_tts_follow",
    rangeStart: "weread_tts_range_start",
    rangeEnd: "weread_tts_range_end"
  };
  const LEGACY_KEY = "wr-tts-settings";
  const DEFAULTS = {
    rate: 1,
    voiceURI: "",
    follow: true,
    rangeStart: "",
    rangeEnd: ""
  };
  function readLegacy() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }
  function readNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }
  const ttsSettings = {
    rate: DEFAULTS.rate,
    voiceURI: DEFAULTS.voiceURI,
    follow: DEFAULTS.follow,
    rangeStart: DEFAULTS.rangeStart,
    rangeEnd: DEFAULTS.rangeEnd,
    load() {
      const legacy = readLegacy();
      this.rate = pace.clampRate(readNumber(GM_getValue(KEYS.rate, null), legacy.rate));
      this.voiceURI = GM_getValue(KEYS.voiceURI, legacy.voiceURI) || DEFAULTS.voiceURI;
      this.follow = Boolean(GM_getValue(KEYS.follow, legacy.follow ?? DEFAULTS.follow));
      this.rangeStart = GM_getValue(KEYS.rangeStart, DEFAULTS.rangeStart) || DEFAULTS.rangeStart;
      this.rangeEnd = GM_getValue(KEYS.rangeEnd, DEFAULTS.rangeEnd) || DEFAULTS.rangeEnd;
    },
    save() {
      GM_setValue(KEYS.rate, this.rate);
      GM_setValue(KEYS.voiceURI, this.voiceURI);
      GM_setValue(KEYS.follow, this.follow);
      GM_setValue(KEYS.rangeStart, this.rangeStart);
      GM_setValue(KEYS.rangeEnd, this.rangeEnd);
      try {
        localStorage.setItem(LEGACY_KEY, JSON.stringify({
          rate: this.rate,
          voiceURI: this.voiceURI,
          follow: this.follow
        }));
      } catch (error) {
      }
    },
    setRange(startText, endText) {
      this.rangeStart = String(startText || "").trim();
      this.rangeEnd = String(endText || "").trim();
      this.save();
    },
    clearRange() {
      this.rangeStart = "";
      this.rangeEnd = "";
      this.save();
    }
  };
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  let scrollbarWidth = 0;
  function getScrollbarWidth() {
    if (scrollbarWidth > 0) return scrollbarWidth;
    const outer = document.createElement("div");
    outer.style.cssText = "position:absolute;top:-9999px;left:-9999px;width:100px;height:100px;overflow:scroll;visibility:hidden;";
    const inner = document.createElement("div");
    inner.style.width = "100%";
    outer.appendChild(inner);
    document.body.appendChild(outer);
    scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
    outer.remove();
    return scrollbarWidth;
  }
  function getSnapPosition(bar, left, top) {
    const width = bar.offsetWidth;
    const height = bar.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rightGap = getScrollbarWidth();
    const leftDistance = Math.abs(left);
    const rightDistance = Math.abs(viewportWidth - width - left);
    const topDistance = Math.abs(top);
    const bottomDistance = Math.abs(viewportHeight - height - top);
    const distances = [
      { edge: "left", distance: leftDistance },
      { edge: "right", distance: rightDistance },
      { edge: "top", distance: topDistance },
      { edge: "bottom", distance: bottomDistance }
    ].sort((a, b) => a.distance - b.distance);
    const edge = distances[0].edge;
    const nextLeft = edge === "left" ? 0 : edge === "right" ? viewportWidth - width - rightGap : clamp(left, 0, viewportWidth - width);
    const nextTop = edge === "top" ? 0 : edge === "bottom" ? viewportHeight - height : clamp(top, 0, viewportHeight - height);
    return { left: nextLeft, top: nextTop, edge };
  }
  function initQuickBarDrag(bar) {
    let edgeHidden = false;
    const saved = GM_getValue("wr_voice_quick_position");
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      bar.style.left = `${saved.left}px`;
      bar.style.top = `${saved.top}px`;
      bar.style.right = "auto";
      bar.style.bottom = "auto";
      bar.dataset.edge = saved.edge || "bottom";
      edgeHidden = Boolean(saved.edgeHidden);
      bar.classList.toggle("edge-hidden", edgeHidden);
    }
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    bar.addEventListener("mousedown", (event) => {
      if (event.target.closest("button")) {
        return;
      }
      isDragging = true;
      startX = event.clientX;
      startY = event.clientY;
      const rect = bar.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      bar.classList.add("dragging");
      event.preventDefault();
    });
    document.addEventListener("mousemove", (event) => {
      if (!isDragging) {
        return;
      }
      const left = initialLeft + event.clientX - startX;
      const top = initialTop + event.clientY - startY;
      bar.style.left = `${left}px`;
      bar.style.top = `${top}px`;
      bar.style.right = "auto";
      bar.style.bottom = "auto";
      bar.classList.remove("edge-hidden");
      delete bar.dataset.edge;
      edgeHidden = false;
    });
    document.addEventListener("mouseup", () => {
      if (!isDragging) {
        return;
      }
      isDragging = false;
      bar.classList.remove("dragging");
      const left = parseInt(bar.style.left, 10) || 0;
      const top = parseInt(bar.style.top, 10) || 0;
      const snap = getSnapPosition(bar, left, top);
      bar.style.left = `${snap.left}px`;
      bar.style.top = `${snap.top}px`;
      bar.dataset.edge = snap.edge;
      edgeHidden = true;
      bar.classList.add("edge-hidden");
      GM_setValue("wr_voice_quick_position", {
        left: snap.left,
        top: snap.top,
        edge: snap.edge,
        edgeHidden
      });
    });
    bar.addEventListener("mouseenter", () => {
      if (!isDragging) {
        bar.classList.remove("edge-hidden");
      }
    });
    bar.addEventListener("mouseleave", () => {
      if (!isDragging && bar.dataset.edge && edgeHidden) {
        bar.classList.add("edge-hidden");
      }
    });
  }
  const QUICK_BAR_ID = "wr-voice-quick";
  const voiceState = {
    chapterUid: "",
    source: "",
    rangePolicy: "dynamic",
    loading: false,
    waitingForChapter: false,
    chapterWatcher: null,
    initialized: false,
    /** 当前正在朗读的正文长度（字符数），用于 pace 估算朗读时长以匹配滚动速度 */
    textLength: 0
  };
  function setButtonDisabled(id, disabled) {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  }
  const voiceRead = {
    isActive() {
      return Boolean(
        speechEngine.playing || speechEngine.paused || voiceState.loading || voiceState.waitingForChapter
      );
    },
    init() {
      if (voiceState.initialized) return;
      voiceState.initialized = true;
      ttsSettings.load();
      pace.applyRate(ttsSettings.rate);
      extractor.startPreRenderObserver();
      speechEngine.setHandlers({
        onStateChange: () => this.syncPlaybackUI(),
        onChunkStart: () => {
        },
        onFinish: () => this.handleFinish(),
        onError: (message) => {
          utils.notificationManager.show(message);
          this.stop({ silent: true });
        }
      });
      this.buildQuickBar();
      this.bindControlEvents();
      this.refreshVoices();
      if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== void 0) {
        window.speechSynthesis.onvoiceschanged = () => this.refreshVoices();
      } else {
        window.setInterval(() => this.refreshVoices(), 3e3);
      }
      window.setTimeout(() => this.refreshVoices(), 500);
      this.syncAllUI();
      this.syncRangeInputs();
    },
    start(options = {}) {
      if (!speechEngine.available) {
        utils.notificationManager.show("当前浏览器不支持语音合成");
        return Promise.resolve();
      }
      return this.loadAndSpeak(options);
    },
    async loadAndSpeak(options = {}) {
      if (voiceState.loading) return;
      voiceState.loading = true;
      voiceState.waitingForChapter = false;
      try {
        const result = await extractor.extractCurrentChapterText();
        let text = result.text;
        let source = result.source;
        let chapterUid = result.chapterUid;
        if (!chunker.isPlausibleText(text)) {
          const legacy = extractor.getLegacyDomText();
          if (legacy) {
            text = legacy.text;
            source = legacy.source;
            chapterUid = "";
          }
        }
        if (!chunker.isPlausibleText(text)) {
          utils.notificationManager.show("未找到章节正文，请打开书籍正文页后重试");
          return;
        }
        const rangeResult = chunker.applyRange(text, ttsSettings.rangeStart, ttsSettings.rangeEnd);
        if (rangeResult.warning === "start-not-found") {
          utils.notificationManager.show("未找到开始文字，将朗读整章");
        } else if (rangeResult.warning === "end-not-found") {
          utils.notificationManager.show("未找到结束文字，将朗读到章节末尾");
        }
        const chunks = chunker.chunkText(rangeResult.text);
        if (!chunks.length) {
          utils.notificationManager.show("所选范围没有可朗读的文本");
          return;
        }
        voiceState.chapterUid = chapterUid || "";
        voiceState.source = source;
        voiceState.rangePolicy = rangeResult.rangePolicy || "dynamic";
        voiceState.textLength = rangeResult.text.length;
        if (!options.skipAutoRead) {
          if (!appState.isAutoReading) {
            moduleRegistry.autoRead?.start();
          } else {
            moduleRegistry.autoRead?.syncPace();
          }
        }
        speechEngine.speak(chunks, ttsSettings.rate, ttsSettings.voiceURI);
        this.startChapterWatcher();
        this.showQuickBar();
        this.syncAllUI();
        utils.notificationManager.show("已提取正文 " + text.length + " 字");
      } finally {
        voiceState.loading = false;
      }
    },
    toggle() {
      if (speechEngine.playing && !speechEngine.paused) {
        this.pause();
      } else if (speechEngine.paused) {
        this.resume();
      } else {
        this.start();
      }
    },
    pause() {
      if (!speechEngine.playing) return;
      speechEngine.pause();
      moduleRegistry.autoRead?.pause();
      this.syncAllUI();
    },
    resume() {
      if (!speechEngine.paused) return;
      speechEngine.resume();
      moduleRegistry.autoRead?.resume();
      this.syncAllUI();
    },
    stop(options = {}) {
      speechEngine.stop();
      this.stopChapterWatcher();
      moduleRegistry.autoRead?.stop();
      voiceState.chapterUid = "";
      voiceState.source = "";
      voiceState.rangePolicy = "dynamic";
      voiceState.waitingForChapter = false;
      voiceState.textLength = 0;
      this.hideQuickBar();
      this.syncAllUI();
      if (!options.silent) {
        utils.notificationManager.show("语音阅读已停止");
      }
    },
    /** 根据当前正文长度和语速估算朗读时长（秒），供 autoRead 换算滚动步长 */
    getReadingSeconds() {
      if (!voiceState.textLength) return 0;
      return pace.getReadingSeconds(voiceState.textLength, ttsSettings.rate);
    },
    setRate(rate) {
      ttsSettings.rate = pace.clampRate(rate);
      ttsSettings.save();
      pace.applyRate(ttsSettings.rate);
      speechEngine.applyRate(ttsSettings.rate);
      this.syncAllUI();
    },
    setVoice(voiceURI) {
      ttsSettings.voiceURI = voiceURI || "";
      ttsSettings.save();
      speechEngine.setVoice(ttsSettings.voiceURI);
      this.syncAllUI();
    },
    setFollow(enabled) {
      ttsSettings.follow = Boolean(enabled);
      ttsSettings.save();
      this.syncAllUI();
    },
    setRange(startText, endText) {
      ttsSettings.setRange(startText, endText);
      this.syncRangeInputs();
      utils.notificationManager.show("阅读范围已保存");
    },
    clearRange() {
      ttsSettings.clearRange();
      this.syncRangeInputs();
      utils.notificationManager.show("阅读范围已清除");
    },
    refreshVoices() {
      if (!speechEngine.available) return;
      const voices = speechEngine.getVoices();
      const chineseVoices = voices.filter(
        (voice) => (voice.lang || "").toLowerCase().startsWith("zh")
      );
      const usableVoices = chineseVoices.length ? chineseVoices : voices;
      const select = document.getElementById("ttsVoiceSelect");
      if (!select) return;
      const current = select.value || ttsSettings.voiceURI;
      select.innerHTML = "";
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "系统默认音色";
      select.appendChild(defaultOption);
      usableVoices.forEach((voice) => {
        const option = document.createElement("option");
        option.value = voice.voiceURI;
        option.textContent = voice.name + " (" + voice.lang + ")";
        select.appendChild(option);
      });
      select.value = current;
    },
    syncAllUI() {
      this.syncPlaybackUI();
      this.syncRateUI();
      this.syncVoiceSelect();
      this.syncFollowUI();
    },
    syncPlaybackUI() {
      const toggle = document.getElementById("ttsToggleBtn");
      if (toggle) {
        if (speechEngine.paused) {
          toggle.textContent = "继续";
        } else if (speechEngine.playing) {
          toggle.textContent = "暂停";
        } else {
          toggle.textContent = "朗读";
        }
      }
      setButtonDisabled(
        "ttsStopBtn",
        !speechEngine.playing && !speechEngine.paused && !voiceState.waitingForChapter
      );
      setButtonDisabled("ttsRetryBtn", voiceState.loading);
      const quickToggle = document.getElementById("wr-voice-quick-toggle");
      if (quickToggle) {
        quickToggle.textContent = speechEngine.paused ? "继续" : speechEngine.playing ? "暂停" : "朗读";
      }
      const status = document.getElementById("wr-voice-quick-status");
      if (status) {
        if (voiceState.waitingForChapter) {
          status.textContent = "等待下一章";
        } else {
          status.textContent = speechEngine.chunks.length ? Math.min(speechEngine.index + 1, speechEngine.chunks.length) + "/" + speechEngine.chunks.length : "就绪";
        }
      }
    },
    syncRateUI() {
      const slider = document.getElementById("ttsRateSlider");
      if (slider && document.activeElement !== slider) {
        slider.value = String(ttsSettings.rate);
      }
      const value = document.getElementById("ttsRateValue");
      if (value) value.textContent = ttsSettings.rate.toFixed(1) + "x";
    },
    syncVoiceSelect() {
      const select = document.getElementById("ttsVoiceSelect");
      if (select && document.activeElement !== select) {
        select.value = ttsSettings.voiceURI;
      }
    },
    syncFollowUI() {
      const checkbox = document.getElementById("ttsFollowCheckbox");
      if (checkbox && document.activeElement !== checkbox) {
        checkbox.checked = ttsSettings.follow;
      }
    },
    syncRangeInputs() {
      const startInput = document.getElementById("ttsRangeStart");
      if (startInput && document.activeElement !== startInput) {
        startInput.value = ttsSettings.rangeStart;
      }
      const endInput = document.getElementById("ttsRangeEnd");
      if (endInput && document.activeElement !== endInput) {
        endInput.value = ttsSettings.rangeEnd;
      }
    },
    buildQuickBar() {
      if (document.getElementById(QUICK_BAR_ID)) return;
      const bar = document.createElement("div");
      bar.id = QUICK_BAR_ID;
      bar.className = "voice-quick";
      bar.style.display = "none";
      bar.innerHTML = [
        '<button type="button" id="wr-voice-quick-toggle">朗读</button>',
        '<button type="button" id="wr-voice-quick-stop">停止</button>',
        '<span class="voice-quick-status" id="wr-voice-quick-status">就绪</span>'
      ].join("");
      document.body.appendChild(bar);
      initQuickBarDrag(bar);
      $("#" + QUICK_BAR_ID + " #wr-voice-quick-toggle").on("click", () => this.toggle());
      $("#" + QUICK_BAR_ID + " #wr-voice-quick-stop").on("click", () => this.stop());
    },
    bindControlEvents() {
      $(document).on("click", "#ttsToggleBtn", () => this.toggle());
      $(document).on("click", "#ttsStopBtn", () => this.stop());
      $(document).on("click", "#ttsRetryBtn", () => {
        if (speechEngine.playing || speechEngine.paused) {
          this.stop({ silent: true });
        }
        this.start();
      });
      $(document).on("input", "#ttsRateSlider", function handleRateInput() {
        const rate = pace.clampRate(parseFloat($(this).val()));
        $(this).val(rate);
        voiceRead.setRate(rate);
      });
      $(document).on("change", "#ttsVoiceSelect", function handleVoiceChange() {
        voiceRead.setVoice($(this).val());
      });
      $(document).on("change", "#ttsFollowCheckbox", function handleFollowChange() {
        voiceRead.setFollow($(this).is(":checked"));
      });
      $(document).on("click", "#ttsRangeApply", () => {
        this.setRange($("#ttsRangeStart").val(), $("#ttsRangeEnd").val());
      });
      $(document).on("click", "#ttsRangeClear", () => this.clearRange());
    },
    showQuickBar() {
      const bar = document.getElementById(QUICK_BAR_ID);
      if (bar) {
        bar.style.display = "flex";
        bar.classList.remove("edge-hidden");
        delete bar.dataset.edge;
      }
    },
    hideQuickBar() {
      const bar = document.getElementById(QUICK_BAR_ID);
      if (bar) bar.style.display = "none";
    },
    startChapterWatcher() {
      if (voiceState.chapterWatcher) return;
      voiceState.chapterWatcher = window.setInterval(() => {
        if (!speechEngine.playing && !speechEngine.paused && !voiceState.waitingForChapter) return;
        const uid = extractor.getCurrentChapterUid();
        if (!uid || !voiceState.chapterUid || uid === voiceState.chapterUid) return;
        if (ttsSettings.follow) {
          utils.notificationManager.show("章节已切换，继续朗读");
          speechEngine.stop();
          this.loadAndSpeak();
        } else {
          utils.notificationManager.show("章节已切换，已停止朗读");
          this.stop({ silent: true });
        }
      }, 700);
    },
    stopChapterWatcher() {
      if (voiceState.chapterWatcher) {
        window.clearInterval(voiceState.chapterWatcher);
        voiceState.chapterWatcher = null;
      }
    },
    handleFinish() {
      if (voiceState.rangePolicy !== "explicit" && ttsSettings.follow) {
        voiceState.waitingForChapter = true;
        utils.notificationManager.show("本章朗读完成，等待下一章");
        this.syncAllUI();
        return;
      }
      const message = voiceState.rangePolicy === "explicit" ? "指定范围朗读完成" : "本章朗读完成";
      utils.notificationManager.show(message);
      this.stop({ silent: true });
    }
  };
  GM_addStyle(baseCss);
  GM_addStyle(controlPanelCss);
  GM_addStyle(progressBarCss);
  GM_addStyle(imageToolsCss);
  GM_addStyle(imagePreviewCss);
  GM_addStyle(voiceReadCss);
  GM_addStyle(generateEyeProtectionStyles());
  registerModules({
    autoPageTurn,
    autoRead,
    controlPanel,
    eyeProtection,
    imagePreviewPanel,
    imageTools,
    progressBar,
    voiceRead
  });
  function initialize() {
    if (appState.isAutoReading) {
      setTimeout(() => {
        autoRead.restoreState();
      }, 1e3);
    }
    progressBar.init();
    imageTools.init();
    imagePreviewPanel.init();
    controlPanel.init();
    headerControl.init();
    voiceRead.init();
    const currentWidth = widthControl.init();
    $("#widthSlider").val(currentWidth);
    $("#widthValue").text(`${currentWidth}px`);
    eyeProtection.syncButtonState();
    let lastThemeIsWhite = utils.isWhiteTheme();
    utils.handleThemeChange(lastThemeIsWhite, { silent: true });
    let themeSyncQueued = false;
    const flushThemeChange = () => {
      themeSyncQueued = false;
      const nextThemeIsWhite = utils.isWhiteTheme();
      if (nextThemeIsWhite === lastThemeIsWhite) {
        return;
      }
      lastThemeIsWhite = nextThemeIsWhite;
      utils.handleThemeChange(nextThemeIsWhite);
    };
    const observer = new MutationObserver(() => {
      if (themeSyncQueued) {
        return;
      }
      themeSyncQueued = true;
      requestAnimationFrame(flushThemeChange);
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }
  $(window).on("load", initialize);
})();
