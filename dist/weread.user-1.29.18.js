// ==UserScript==
// @name         微信读书增强脚本(新增AI语音阅读）
// @version      1.29.18
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
// @grant        unsafeWindow
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
  cursor: pointer;
}

.control-checkbox input {
  accent-color: #4CAF50;
  cursor: pointer;
}

.control-checkbox-inline {
  flex: 0 0 auto;
  gap: 4px;
  min-height: 30px;
  margin: 0;
}

.control-checkbox-inline input {
  width: 14px;
  height: 14px;
  margin: 0;
}

.control-checkbox input:focus-visible {
  outline: 2px solid #4CAF50;
  outline-offset: 2px;
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

body:not(.wr_whiteTheme) .control-btn {
  background: #444;
  color: #f5f5f5;
  border-color: #555;
}

body:not(.wr_whiteTheme) .control-btn:hover {
  background: #555;
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
  const voiceReadCss = '.voice-quick {\n  position: fixed;\n  right: 16px;\n  bottom: 24px;\n  z-index: 2147483647;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 8px 12px;\n  background: rgba(255, 255, 255, 0.96);\n  color: #333;\n  border: 1px solid #ddd;\n  border-radius: 8px;\n  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);\n  font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n  cursor: move;\n  user-select: none;\n  transition: opacity 0.18s ease;\n}\n\n.voice-quick.dragging {\n  opacity: 0.92;\n  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);\n}\n\n.voice-quick button {\n  height: 28px;\n  border: 1px solid #ddd;\n  border-radius: 4px;\n  background: #f5f5f5;\n  color: #333;\n  font: inherit;\n  min-width: 46px;\n  cursor: pointer;\n}\n\n.voice-quick button:hover {\n  background: #e9e9e9;\n}\n\n.voice-quick-status {\n  color: #666;\n  min-width: 52px;\n  text-align: right;\n}\n\nbody:not(.wr_whiteTheme) .voice-quick {\n  background: rgba(68, 68, 68, 0.96);\n  color: #f5f5f5;\n  border-color: #555;\n}\n\nbody:not(.wr_whiteTheme) .voice-quick button {\n  background: #555;\n  color: #f5f5f5;\n  border-color: #666;\n}\n\nbody:not(.wr_whiteTheme) .voice-quick button:hover {\n  background: #666;\n}\n\nbody:not(.wr_whiteTheme) .voice-quick-status {\n  color: #cfcfcf;\n}\n';
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
    autoScrollSpeed: GM_getValue("weread_auto_scroll_speed", 1),
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
        if (appState.activeReadingMode !== "voice") {
          window.scrollTo(0, 100);
        }
      }, 1500);
    }
  };
  const RATE_MIN = 0.5;
  const RATE_MAX = 1.5;
  const RATE_STEP = 0.1;
  const DURATION_MIN = 5;
  const DURATION_MAX = 60;
  const PAGE_DURATION_AT_1X = 10;
  const CHARS_PER_SECOND_AT_1X = 4.5;
  const TICK_INTERVAL = 20;
  const pace = {
    clampRate(value) {
      const number = Number(value);
      if (!Number.isFinite(number) || value === null || value === void 0 || value === "") return 1;
      const clamped = Math.min(RATE_MAX, Math.max(RATE_MIN, number));
      const steps = Math.round(clamped / RATE_STEP);
      return Math.round(steps * RATE_STEP * 10) / 10;
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
  const MIN_FRAME_SECONDS = 1 / 240;
  const MAX_FRAME_SECONDS$1 = 0.05;
  const MAX_VELOCITY = 1200;
  const MAX_ACCELERATION$1 = 3200;
  const POSITION_GAIN = 7;
  const VELOCITY_FILTER = 0.25;
  function clamp$3(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function createScrollControllerState(position = 0, target = position) {
    return {
      position,
      target,
      velocity: 0,
      targetVelocity: 0
    };
  }
  function advanceScrollController(state, target, dt) {
    const seconds = clamp$3(Number(dt) || MIN_FRAME_SECONDS, MIN_FRAME_SECONDS, MAX_FRAME_SECONDS$1);
    const rawTargetVelocity = (target - state.target) / seconds;
    state.targetVelocity += (rawTargetVelocity - state.targetVelocity) * VELOCITY_FILTER;
    state.target = target;
    const error = target - state.position;
    const desiredVelocity = clamp$3(
      state.targetVelocity + POSITION_GAIN * error,
      -MAX_VELOCITY,
      MAX_VELOCITY
    );
    const maxVelocityChange = MAX_ACCELERATION$1 * seconds;
    state.velocity += clamp$3(desiredVelocity - state.velocity, -maxVelocityChange, maxVelocityChange);
    let step = state.velocity * seconds;
    if (Math.abs(error) < 0.25 && Math.abs(state.targetVelocity) < 1) {
      step = error;
      state.velocity = 0;
    } else if (Math.sign(step) === Math.sign(error) && Math.abs(step) > Math.abs(error)) {
      step = error;
    }
    state.position += step;
    return state;
  }
  function getScrollRoot() {
    const doc = document.scrollingElement || document.documentElement || document.body;
    if (doc && doc.scrollHeight > doc.clientHeight + 50) return doc;
    try {
      const candidates = Array.from(document.querySelectorAll("div, main, section, article")).filter((el) => el.scrollHeight > el.clientHeight + 50 && /(auto|scroll)/.test(getComputedStyle(el).overflowY));
      candidates.sort((a, b) => a.scrollHeight - b.scrollHeight);
      if (candidates.length) return candidates[0];
    } catch (error) {
    }
    return doc;
  }
  function getScrollTop() {
    const root = getScrollRoot();
    return window.scrollY || root.scrollTop || 0;
  }
  function setScrollTop(top) {
    window.scrollTo(0, Math.max(0, top));
  }
  const scrollFollower = {
    frameId: null,
    running: false,
    getTarget: null,
    onHardError: null,
    controller: null,
    lastFrameAt: 0,
    hardErrorReported: false,
    originalScrollBehavior: null,
    alignmentResolve: null,
    disableNativeSmoothScroll() {
      const root = getScrollRoot();
      if (!root?.style) return;
      if (this.originalScrollBehavior === null) {
        this.originalScrollBehavior = root.style.scrollBehavior || "";
      }
      root.style.scrollBehavior = "auto";
    },
    restoreNativeSmoothScroll() {
      const root = getScrollRoot();
      if (root?.style && this.originalScrollBehavior !== null) {
        root.style.scrollBehavior = this.originalScrollBehavior;
      }
      this.originalScrollBehavior = null;
    },
    start({ getTarget, onHardError } = {}) {
      this.stop();
      this.disableNativeSmoothScroll();
      this.getTarget = getTarget;
      this.onHardError = onHardError;
      const current = getScrollTop();
      const initialTarget = Number(getTarget?.());
      this.controller = createScrollControllerState(current, Number.isFinite(initialTarget) ? initialTarget : current);
      this.lastFrameAt = performance.now();
      this.hardErrorReported = false;
      this.running = true;
      const frame = (now2) => {
        if (!this.running) return;
        const currentTop = getScrollTop();
        const rawTarget = Number(this.getTarget?.());
        if (Number.isFinite(rawTarget)) {
          const root = getScrollRoot();
          const maxTop = Math.max(0, (root.scrollHeight || 0) - (root.clientHeight || 0));
          const target = clamp$3(rawTarget, 0, maxTop);
          const error = target - currentTop;
          if (Math.abs(error) > Math.max(120, (window.innerHeight || 800) * 0.2)) {
            if (!this.hardErrorReported) {
              this.hardErrorReported = true;
              this.onHardError?.({ currentTop, target, error });
            }
          } else {
            this.hardErrorReported = false;
            const dt = (now2 - this.lastFrameAt) / 1e3;
            this.controller.position = currentTop;
            advanceScrollController(this.controller, target, dt);
            setScrollTop(this.controller.position);
          }
        }
        this.lastFrameAt = now2;
        this.frameId = window.requestAnimationFrame(frame);
      };
      this.frameId = window.requestAnimationFrame(frame);
      return { type: "voice-follow" };
    },
    stop() {
      this.running = false;
      if (this.frameId !== null) {
        window.cancelAnimationFrame(this.frameId);
        this.frameId = null;
      }
      this.getTarget = null;
      this.onHardError = null;
      this.controller = null;
      if (this.alignmentResolve) {
        const resolve = this.alignmentResolve;
        this.alignmentResolve = null;
        resolve(false);
      }
      this.restoreNativeSmoothScroll();
    },
    alignTo(rawTarget, { signal } = {}) {
      this.stop();
      this.disableNativeSmoothScroll();
      const root = getScrollRoot();
      const maxTop = Math.max(0, (root.scrollHeight || 0) - (root.clientHeight || 0));
      const start = getScrollTop();
      const target = clamp$3(Number(rawTarget) || 0, 0, maxTop);
      const distance = target - start;
      if (Math.abs(distance) < 1) {
        setScrollTop(target);
        this.restoreNativeSmoothScroll();
        return Promise.resolve(true);
      }
      const duration = clamp$3(180 + Math.abs(distance) * 0.35, 180, 700);
      const startedAt = performance.now();
      return new Promise((resolve) => {
        this.alignmentResolve = resolve;
        const finish = (success) => {
          if (this.alignmentResolve !== resolve) return;
          this.alignmentResolve = null;
          this.frameId = null;
          this.restoreNativeSmoothScroll();
          resolve(success);
        };
        const frame = (now2) => {
          if (signal?.aborted) {
            finish(false);
            return;
          }
          const progress = clamp$3((now2 - startedAt) / duration, 0, 1);
          const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          setScrollTop(start + distance * eased);
          if (progress >= 1) {
            setScrollTop(target);
            finish(true);
            return;
          }
          this.frameId = window.requestAnimationFrame(frame);
        };
        this.frameId = window.requestAnimationFrame(frame);
      });
    }
  };
  const autoRead = {
    isDoubleColumnReading() {
      return typeof document !== "undefined" && Boolean(
        document.querySelector(".wr_horizontalReader, .wr_horizontalReader_app_content")
      );
    },
    calculateWaitTime() {
      if (appState.activeReadingMode === "auto") {
        if (this.isDoubleColumnReading()) {
          return pace.getPageTurnWaitFromDuration(appState.readingDuration);
        }
        const speed = Math.min(2, Math.max(0.1, appState.autoScrollSpeed || 1));
        const duration = PAGE_DURATION_AT_1X / speed * 10;
        return pace.getPageTurnWaitFromDuration(duration);
      }
      if (moduleRegistry.voiceRead?.isWaitingChapter?.()) {
        return 1;
      }
      const remaining = moduleRegistry.voiceRead?.getRemainingSeconds?.();
      if (Number.isFinite(remaining) && remaining > 0) {
        return Math.min(Math.max(remaining, 1), 120);
      }
      return pace.getPageTurnWaitSeconds(appState.currentScrollSpeed);
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
      this.stopScrolling();
      if (appState.activeReadingMode === "voice") {
        appState.scrollInterval = scrollFollower.start({
          getTarget: () => moduleRegistry.voiceRead?.getScrollTarget?.(),
          onHardError: (details) => moduleRegistry.voiceRead?.handleHardScrollError?.(details)
        });
        appState.isAutoReading = true;
        return;
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
        if (currentScrollTop + clientHeight >= scrollHeight - 10) {
          if (!appState.isWaitingForPageTurn) {
            this.schedulePageTurn();
          }
          return;
        }
        let scrollSeconds;
        if (this.isDoubleColumnReading()) {
          scrollSeconds = appState.readingDuration;
        } else {
          const speed = Math.min(2, Math.max(0.1, appState.autoScrollSpeed || 1));
          scrollSeconds = PAGE_DURATION_AT_1X / speed * 10;
        }
        const scrollStep = this.isDoubleColumnReading() ? pace.getScrollStepFromDuration(scrollSeconds, scrollHeight, clientHeight) : pace.getScrollStepFromSeconds(scrollSeconds, scrollHeight, clientHeight);
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
        if (appState.scrollInterval?.type === "voice-follow") {
          scrollFollower.stop();
        } else {
          clearInterval(appState.scrollInterval);
        }
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
      const isWhite = utils.isWhiteTheme();
      $("#lastTimerBtn, #autoLastTimerBtn").each(function updateLastTimer() {
        $(this).removeClass("disabled");
        if (isWhite) {
          $(this).css({ background: "", color: "", borderColor: "" });
        } else {
          $(this).css({ background: "#444", color: "#f5f5f5", borderColor: "#555" });
        }
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
      const snappedMinutes = Math.max(0, Math.round(minutes));
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
      const snappedValue = Math.max(0, Math.round(nextValue));
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
      if (appState.activeReadingMode === "voice") {
        appState.isAutoReading = false;
        this.saveState();
        this.updateButton();
        return;
      }
      const restoredRate = pace.clampRate(appState.currentScrollSpeed);
      $("#ttsRateSlider").val(restoredRate);
      $("#ttsRateValue").text(`${restoredRate.toFixed(1)}x`);
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
            <div class="control-item" id="readingDurationItem">
              <span class="control-label">阅读时长</span>
              <div class="slider-box">
                <input type="range" class="control-slider duration-slider" id="readingDurationSlider" min="5" max="60" step="5" value="${appState.readingDuration}">
              </div>
              <span class="control-value" id="readingDurationValue">${appState.readingDuration}秒/页</span>
            </div>
            <div class="control-item" id="autoScrollSpeedItem">
              <span class="control-label">阅读速度</span>
              <div class="slider-box">
                <input type="range" class="control-slider auto-speed-slider" id="autoScrollSpeedSlider" min="0.1" max="2" step="0.1" value="${appState.autoScrollSpeed}">
              </div>
              <span class="control-value" id="autoScrollSpeedValue">${appState.autoScrollSpeed.toFixed(1)}x</span>
            </div>
            <div class="control-item">
              <span class="control-label">定时时长</span>
              <div class="slider-box">
                <input type="range" class="control-slider timer-slider" id="autoTimerSlider" min="0" max="120" step="1" value="0">
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
                <input type="range" class="control-slider speed-slider" id="ttsRateSlider" min="0.5" max="1.5" step="0.1" value="${pace.clampRate(appState.currentScrollSpeed)}">
              </div>
              <span class="control-value" id="ttsRateValue">${appState.currentScrollSpeed.toFixed(1)}x</span>
            </div>
            <div class="control-item voice-select-row">
              <span class="control-label">音色</span>
              <select class="control-select" id="ttsVoiceSelect"></select>
              <label class="control-checkbox control-checkbox-inline" for="ttsFollowCheckbox">
                <input type="checkbox" id="ttsFollowCheckbox">
                <span>章节续读</span>
              </label>
            </div>
            <div class="control-item">
              <span class="control-label">定时时长</span>
              <div class="slider-box">
                <input type="range" class="control-slider timer-slider" id="timerSlider" min="0" max="120" step="1" value="0">
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
      this.updateAutoReadControls();
    },
    updateAutoReadControls() {
      const isDouble = Boolean(moduleRegistry.autoRead?.isDoubleColumnReading?.());
      $("#readingDurationItem").toggle(isDouble);
      $("#autoScrollSpeedItem").toggle(!isDouble);
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
      const autoSpeedValue = Math.min(2, Math.max(0.1, Math.round((parseFloat($("#autoScrollSpeedSlider").val()) || 1) * 10) / 10));
      $("#autoScrollSpeedSlider").val(autoSpeedValue);
      $("#autoScrollSpeedValue").text(`${autoSpeedValue.toFixed(1)}x`);
      const timerValue = Math.min(120, Math.max(0, Math.round(parseInt($("#timerSlider").val(), 10) || 0)));
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
      $("#autoScrollSpeedSlider").on("input", function handleAutoSpeedInput() {
        const speed = Math.min(2, Math.max(0.1, Math.round((parseFloat($(this).val()) || 1) * 10) / 10));
        $(this).val(speed);
        appState.autoScrollSpeed = speed;
        GM_setValue("weread_auto_scroll_speed", speed);
        $("#autoScrollSpeedValue").text(`${speed.toFixed(1)}x`);
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
        if (!$(event.target).closest(".control-panel, .voice-quick, #mainControl, #closeControlPanel").length) {
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
  const UI_NOISE_RE = /(上一章|下一章|上一页|下一页|加入书架|我的书架|书架|书城|目录|返回|分享|复制|书评|评论|推荐|简介|阅读进度|免费试读|最新章节|完本|排行|分类|搜索|登录|注册|会员|充值|购买|下载|设置|朗读|语音|暂停|停止|语速|音色|作者有话说|本章导读|查看全部|听书|笔记|想法|划线|翻译)/g;
  function countCjk$1(value) {
    return (String(value).match(/[\u3400-\u9FFF]/g) || []).length;
  }
  const chunker = {
    normalizeText(raw) {
      return String(raw || "").replace(/\u00A0/g, " ").replace(/[\u200B\uFEFF]/g, "").replace(/\s+/g, " ").trim();
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
      return this.chunkTextWithOffsets(text).map((chunk) => chunk.text);
    },
    /**
     * 分块时保留正文绝对偏移。chunk 文本始终是源文本的连续切片，
     * SpeechSynthesisEvent.charIndex 因而可以直接换算为整章偏移。
     */
    chunkTextWithOffsets(text, baseOffset = 0) {
      const source = String(text || "");
      const pieces = [];
      const sentencePattern = /[^。！？!?；;…]+[。！？!?；;…]?/g;
      const secondaryPattern = /[^，、：:，。！？!?；;…]+[，、：:，。！？!?；;…]?/g;
      let sentenceMatch;
      const addPiece = (start, end) => {
        let safeStart = start;
        let safeEnd = end;
        while (safeStart < safeEnd && /\s/.test(source[safeStart])) safeStart += 1;
        while (safeEnd > safeStart && /\s/.test(source[safeEnd - 1])) safeEnd -= 1;
        for (let cursor = safeStart; cursor < safeEnd; cursor += 220) {
          pieces.push({ start: cursor, end: Math.min(safeEnd, cursor + 220) });
        }
      };
      while (sentenceMatch = sentencePattern.exec(source)) {
        const sentenceStart = sentenceMatch.index;
        const sentenceEnd = sentenceStart + sentenceMatch[0].length;
        if (sentenceMatch[0].length <= 220) {
          addPiece(sentenceStart, sentenceEnd);
          continue;
        }
        secondaryPattern.lastIndex = sentenceStart;
        let pieceMatch;
        while (pieceMatch = secondaryPattern.exec(source)) {
          if (pieceMatch.index >= sentenceEnd) break;
          addPiece(pieceMatch.index, Math.min(sentenceEnd, pieceMatch.index + pieceMatch[0].length));
          if (secondaryPattern.lastIndex >= sentenceEnd) break;
        }
      }
      if (!pieces.length && source.trim()) {
        const first = source.search(/\S/);
        const last = source.search(/\s*$/);
        addPiece(Math.max(0, first), Math.max(0, last));
      }
      const chunks = [];
      let currentStart = -1;
      let currentEnd = -1;
      const flush = () => {
        if (currentStart < 0 || currentEnd <= currentStart) return;
        chunks.push({
          text: source.slice(currentStart, currentEnd),
          startOffset: Number(baseOffset) + currentStart,
          endOffset: Number(baseOffset) + currentEnd
        });
        currentStart = -1;
        currentEnd = -1;
      };
      for (const piece of pieces) {
        if (currentStart < 0) {
          currentStart = piece.start;
          currentEnd = piece.end;
          continue;
        }
        const candidateLength = piece.end - currentStart;
        if (candidateLength > 220) {
          flush();
          currentStart = piece.start;
          currentEnd = piece.end;
        } else {
          currentEnd = piece.end;
        }
      }
      flush();
      return chunks;
    },
    isPlausibleText(text) {
      const value = this.normalizeText(text);
      if (value.length < 12) return false;
      return /[\u3400-\u9FFF]/.test(value) || /[A-Za-z]{4,}/.test(value);
    },
    /**
     * 正文度评分：长度、中文占比、标点密度给正分；导航/UI 短语给负分。
     * 评分只用于在“看起来有文字”的候选里挑选更像正文的内容，
     * 避免把顶部栏、目录、书评、推荐等整块 UI 文案朗读出来。
     */
    scoreChapterText(text) {
      const value = this.normalizeText(text);
      if (!value) return -Infinity;
      if (value.length < 12) return -Infinity;
      const cjkCount = countCjk$1(value);
      const cjkRatio = cjkCount / value.length;
      const hasEnglish = /[A-Za-z]{4,}/.test(value);
      if (cjkRatio < 0.2 && !hasEnglish) return -Infinity;
      let score = 0;
      score += Math.min(30, Math.floor(value.length / 60));
      if (cjkRatio >= 0.5) {
        score += 30;
      } else if (cjkRatio >= 0.25 || hasEnglish) {
        score += 20;
      }
      const sentenceEnds = (value.match(/[。！？!?；;]/g) || []).length;
      const commas = (value.match(/[，、：:,]/g) || []).length;
      score += Math.min(24, sentenceEnds * 4);
      score += Math.min(12, commas * 2);
      const noiseMatches = value.match(UI_NOISE_RE) || [];
      const noiseDensity = noiseMatches.length / Math.max(1, value.length);
      score -= Math.min(60, noiseMatches.length * 8);
      if (noiseMatches.length >= 3 || noiseDensity > 0.06) score -= 30;
      if (cjkRatio >= 0.4) {
        const spaceCount = (value.match(/ /g) || []).length;
        if (spaceCount / value.length > 0.1) score -= 20;
      }
      if (sentenceEnds === 0 && commas === 0 && noiseMatches.length >= 2) score -= 40;
      return score;
    },
    isLikelyChapterText(text) {
      return this.isPlausibleText(text) && this.scoreChapterText(text) > 0;
    },
    /**
     * 解析“从某文字起、到某文字止”的阅读范围。
     * 返回结构里附带定位信息，供朗读开始时把页面滚动到“从文字”位置：
     * - startIndex / endIndex：起止文字在整章归一化文本中的偏移（endIndex 为 0 表示读到章末）；
     * - totalLength：整章归一化文本长度（定位与比例估算共用）。
     */
    applyRange(text, startText, endText) {
      const normalized = this.normalizeText(text);
      const startPhrase = this.normalizeText(startText);
      const endPhrase = this.normalizeText(endText);
      const totalLength = normalized.length;
      const startIndex = startPhrase ? normalized.indexOf(startPhrase) : 0;
      if (startIndex === -1) {
        return { text: normalized, warning: "start-not-found", rangePolicy: "dynamic", startIndex: 0, endIndex: 0, totalLength };
      }
      if (!endPhrase) {
        return { text: normalized.slice(startIndex), rangePolicy: "dynamic", startIndex, endIndex: 0, totalLength };
      }
      const endStart = normalized.indexOf(endPhrase, startIndex);
      if (endStart === -1) {
        return { text: normalized.slice(startIndex), warning: "end-not-found", rangePolicy: "dynamic", startIndex, endIndex: 0, totalLength };
      }
      const endIndex = endStart + endPhrase.length;
      return { text: normalized.slice(startIndex, endIndex), rangePolicy: "explicit", startIndex, endIndex, totalLength };
    }
  };
  const CHAPTER_API_RE = /\/web\/book\/chapter\/e_[^/]*/;
  const PREFIX_SCAN_LIMIT = 160;
  const HTML_START_RE = /<(?:\!DOCTYPE|html|head|body)\b|<p(?:\s|>)/i;
  const HTML_FRAGMENT_START_RE = /^(?:[A-Za-z_:][A-Za-z0-9_:.-]*\s*=|>|\/>)/;
  const CHAPTER_START_RE = /<h1\b[^>]*class\s*=\s*["'][^"']*\bfirstTitle\b[^"']*["'][^>]*>/i;
  const COVER_CLASS_RE = /class\s*=\s*["'][^"']*\bfrontCover\b[^"']*["']/i;
  const READABLE_FRAGMENT_PREFIX_RE = /[\u3400-\u9FFF][\u3400-\u9FFF0-9A-Za-z，。！？、；：“”‘’（）《》…·\s]*/;
  const cache = /* @__PURE__ */ new Map();
  const cssCache = /* @__PURE__ */ new Map();
  let sequence = 0;
  const CACHE_MAX_SIZE = 40;
  const CACHE_MAX_ITEMS_PER_CHAPTER = 32;
  function getPageWindow$1() {
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow) return unsafeWindow;
    } catch (error) {
    }
    return typeof window !== "undefined" ? window : null;
  }
  function base64ToBytes(value) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const map = {};
    for (let i = 0; i < chars.length; i += 1) map[chars[i]] = i;
    const cleaned = String(value || "").replace(/[^A-Za-z0-9+/=]/g, "");
    const bytes = [];
    let bits = 0;
    let buffer = 0;
    for (const ch of cleaned) {
      if (ch === "=") break;
      const code = map[ch];
      if (code === void 0) continue;
      buffer = buffer << 6 | code;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes.push(buffer >> bits & 255);
      }
    }
    return Uint8Array.from(bytes);
  }
  function decodeBase64Text(value) {
    try {
      if (typeof Buffer !== "undefined") {
        const cleaned = String(value || "").replace(/[^A-Za-z0-9+/=]/g, "");
        if (!cleaned) return "";
        const padded = cleaned + "=".repeat((4 - cleaned.length % 4) % 4);
        return Buffer.from(padded, "base64").toString("utf8");
      }
      const bytes = base64ToBytes(value);
      if (!bytes.length) return "";
      if (typeof TextDecoder === "function") {
        return new TextDecoder("utf-8").decode(bytes);
      }
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return decodeURIComponent(escape(binary));
    } catch (error) {
      return "";
    }
  }
  function htmlToText$1(html) {
    return chunker.normalizeText(
      String(html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")
    );
  }
  function hasChapterContentMark(decoded) {
    return /<\s*p\b[^>]*class\s*=\s*["'][^"']*\bcontent\b[^"']*["']/i.test(decoded) || /class\s*=\s*["'][^"']*\bcontent\b[^"']*["'][^>]*>/i.test(decoded) || /<\s*p[\s>]/i.test(decoded);
  }
  function cleanDecodedText(value) {
    return chunker.normalizeText(
      String(value || "").replace(/\uFFFD+/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    );
  }
  function extractReadableFragmentPrefix(decodedBeforeHtml) {
    const match = READABLE_FRAGMENT_PREFIX_RE.exec(String(decodedBeforeHtml || ""));
    return match ? cleanDecodedText(match[0]) : "";
  }
  function isCoverLike(decoded) {
    return COVER_CLASS_RE.test(decoded);
  }
  function isCssLike(decoded) {
    const head = decoded.slice(0, 400);
    return /^\s*\/\*/.test(decoded) || /(?:^|[\s}])[\w.#:@*][^{};]*\{[^}]*\}/.test(head);
  }
  function htmlStructureRank(html) {
    if (/^<\s*!DOCTYPE/i.test(html)) return 3;
    if (/^<\s*html\b/i.test(html)) return 2;
    if (/^<\s*(?:head|body)\b/i.test(html)) return 1;
    return 0;
  }
  function sanitizeMalformedHtml(html) {
    return String(html || "").replace(/<(?![A-Za-z/!?])/g, "");
  }
  function scoreDecoded(decoded) {
    if (!decoded || !hasChapterContentMark(decoded)) return null;
    const htmlMatch = HTML_START_RE.exec(decoded);
    const rawHtml = htmlMatch ? decoded.slice(htmlMatch.index) : null;
    const html = rawHtml ? sanitizeMalformedHtml(rawHtml) : null;
    if (!html) return null;
    if (isCoverLike(decoded) || isCssLike(decoded)) return null;
    const prefixText = extractReadableFragmentPrefix(decoded.slice(0, htmlMatch.index));
    const htmlText = htmlToText$1(html);
    let text = cleanDecodedText(prefixText ? prefixText + " " + htmlText : htmlText);
    text = text.replace(/\s*[A-Za-z0-9][A-Za-z0-9]*\s+class="[^"]*$/g, "").trim();
    if (HTML_FRAGMENT_START_RE.test(text)) return null;
    if (!chunker.isLikelyChapterText(text)) return null;
    const chapterStart = CHAPTER_START_RE.test(html);
    return {
      html,
      text,
      chapterStart,
      structure: htmlStructureRank(html) + (chapterStart ? 10 : 0),
      score: chunker.scoreChapterText(text)
    };
  }
  function findBestCandidate(raw) {
    let best = null;
    let containsCover = false;
    const limit = Math.min(PREFIX_SCAN_LIMIT, Math.max(0, raw.length - 1));
    for (let offset = 0; offset <= limit; offset += 1) {
      const decoded = decodeBase64Text(raw.slice(offset));
      if (!decoded) continue;
      if (isCoverLike(decoded)) {
        containsCover = true;
      }
      const candidate = scoreDecoded(decoded);
      if (!candidate) continue;
      if (!best || candidate.score > best.score || candidate.score === best.score && candidate.structure > best.structure) {
        best = candidate;
      }
    }
    if (containsCover) return null;
    return best;
  }
  function findCssCandidate(raw) {
    const limit = Math.min(PREFIX_SCAN_LIMIT, Math.max(0, raw.length - 1));
    let best = "";
    for (let offset = 0; offset <= limit; offset += 1) {
      const decoded = decodeBase64Text(raw.slice(offset));
      if (!decoded || decoded.length < 50 || !isCssLike(decoded)) continue;
      const commentStart = decoded.indexOf("/*");
      const css = commentStart >= 0 ? decoded.slice(commentStart) : decoded;
      if (css.length > best.length) best = css;
    }
    return best || null;
  }
  function collectStrings(value, out, depth, seen) {
    if (typeof value === "string") {
      out.push(value);
      return;
    }
    if (!value || typeof value !== "object" || depth > 4 || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) collectStrings(item, out, depth + 1, seen);
      return;
    }
    let keys = [];
    try {
      keys = Object.keys(value);
    } catch (error) {
      return;
    }
    for (const key of keys) {
      try {
        collectStrings(value[key], out, depth + 1, seen);
      } catch (error) {
      }
    }
  }
  function collectResponseStrings(responseBody) {
    const result = [];
    if (typeof responseBody === "string") {
      let parsed = null;
      try {
        parsed = JSON.parse(responseBody);
      } catch (error) {
        parsed = null;
      }
      if (parsed !== null) {
        collectStrings(parsed, result, 0, /* @__PURE__ */ new WeakSet());
        if (result.length) return result;
      }
      result.push(responseBody);
      return result;
    }
    collectStrings(responseBody, result, 0, /* @__PURE__ */ new WeakSet());
    return result;
  }
  function extractChapterUid(requestBody) {
    if (!requestBody) return "";
    const body = typeof requestBody === "string" ? requestBody : JSON.stringify(requestBody);
    try {
      const parsed = JSON.parse(body);
      const uid = parsed && (parsed.c || parsed.chapterUid || parsed.chapterId);
      return String(uid || "").trim();
    } catch (error) {
      return "";
    }
  }
  function extractBookId(requestBody) {
    if (!requestBody) return "";
    const body = typeof requestBody === "string" ? requestBody : JSON.stringify(requestBody);
    try {
      const parsed = JSON.parse(body);
      const bookId = parsed && (parsed.b || parsed.bookId);
      return String(bookId || "").trim();
    } catch (error) {
      return "";
    }
  }
  function getResourceOrder(url) {
    const match = String(url || "").match(/\/e_(\d+)/i);
    const order = match ? Number(match[1]) : Number.NaN;
    return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
  }
  function storeResponse(url, requestBody, responseBody) {
    const chapterUid = extractChapterUid(requestBody);
    if (!chapterUid) return null;
    const bookId = extractBookId(requestBody);
    const strings = collectResponseStrings(responseBody);
    const candidates = [];
    for (const raw of strings) {
      const best = findBestCandidate(raw);
      if (best) candidates.push(best);
      const css = findCssCandidate(raw);
      if (css) {
        const existing = cssCache.get(chapterUid) || "";
        if (css.length > existing.length) cssCache.set(chapterUid, css);
      }
    }
    if (!candidates.length) return null;
    sequence += 1;
    const list = cache.get(chapterUid) || [];
    for (const candidate of candidates) {
      const item = {
        ...candidate,
        url: String(url || ""),
        bookId,
        sequence,
        resourceOrder: getResourceOrder(url),
        fetchedAt: Date.now()
      };
      const duplicate = list.some(
        (existing) => existing.url === item.url && existing.bookId === item.bookId && existing.text === item.text
      );
      if (!duplicate) list.push(item);
    }
    cache.set(chapterUid, list);
    if (list.length > CACHE_MAX_ITEMS_PER_CHAPTER) {
      list.splice(0, list.length - CACHE_MAX_ITEMS_PER_CHAPTER);
      cache.set(chapterUid, list);
    }
    if (cache.size > CACHE_MAX_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== void 0) cache.delete(oldestKey);
    }
    return list;
  }
  function mergeChapterTexts(items) {
    const parts = [];
    let combined = "";
    for (const item of items) {
      const text = chunker.normalizeText(item.text);
      if (!text) continue;
      if (combined && combined.includes(text)) continue;
      const last = parts.length ? parts[parts.length - 1] : "";
      const maxOverlap = Math.min(80, text.length, last.length);
      let overlap = 0;
      for (let length = maxOverlap; length > 0; length -= 1) {
        if (last.endsWith(text.slice(0, length))) {
          overlap = length;
          break;
        }
      }
      if (overlap > 0) {
        parts.push(text.slice(overlap));
      } else {
        parts.push(text);
      }
      combined = chunker.normalizeText(parts.join(" "));
    }
    return combined;
  }
  function getChapterText(chapterUid, options = {}) {
    const uid = String(chapterUid || "");
    const bookId = String(options.bookId || "");
    const requireChapterStart = Boolean(options.requireChapterStart);
    const list = (cache.get(uid) || []).filter((item) => !bookId || item.bookId === bookId);
    if (!list.length) return null;
    const accepted = list.filter(
      (item) => item.html && item.text && chunker.isLikelyChapterText(item.text)
    ).sort((a, b) => {
      const startDiff = Number(Boolean(b.chapterStart)) - Number(Boolean(a.chapterStart));
      if (startDiff !== 0) return startDiff;
      if (a.resourceOrder !== b.resourceOrder) return a.resourceOrder - b.resourceOrder;
      return a.fetchedAt - b.fetchedAt || a.sequence - b.sequence;
    });
    if (requireChapterStart && !accepted.some((item) => item.chapterStart)) return null;
    if (!accepted.length) return null;
    const text = mergeChapterTexts(accepted);
    if (!chunker.isLikelyChapterText(text)) return null;
    return {
      text,
      source: "API:chapter",
      chapterUid: uid
    };
  }
  function cleanFragmentTail(body) {
    const idx = String(body).search(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/);
    if (idx >= 0) {
      const tail = String(body).slice(idx);
      if (!tail.includes("<")) return String(body).slice(0, idx);
    }
    return body;
  }
  function extractHtmlBody(html) {
    if (!html) return "";
    const lower = html.toLowerCase();
    const openMatch = /<body[^>]*>/i.exec(html);
    const closeIndex = lower.indexOf("</body>");
    if (openMatch) {
      const start = openMatch.index + openMatch[0].length;
      const end = closeIndex >= start ? closeIndex : html.length;
      return cleanFragmentTail(html.slice(start, end));
    }
    if (closeIndex >= 0) return cleanFragmentTail(html.slice(0, closeIndex));
    return cleanFragmentTail(html);
  }
  function extractFragmentPrefix(item) {
    if (!item?.html || !item?.text) return "";
    const bodyText = chunker.normalizeText(htmlToText$1(extractHtmlBody(item.html)).replace(/\uFFFD+/g, ""));
    if (!bodyText || bodyText.length >= item.text.length) return "";
    if (!item.text.endsWith(bodyText)) return "";
    return chunker.normalizeText(item.text.slice(0, item.text.length - bodyText.length));
  }
  function closeOpenParagraphs(body) {
    const opens = (body.match(/<p\b[^>]*>/gi) || []).length;
    const closes = (body.match(/<\/p>/gi) || []).length;
    if (opens <= closes) return body;
    return body + "</p>".repeat(opens - closes);
  }
  function extractHeadLinks(html) {
    const headMatch = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html || "");
    if (!headMatch) return "";
    const links = (headMatch[1] || "").match(/<link\b[^>]*>/gi) || [];
    return links.join("");
  }
  function mergeChapterHtmls(accepted, css) {
    const bodies = accepted.map((item) => {
      const prefix = extractFragmentPrefix(item);
      const body = closeOpenParagraphs(extractHtmlBody(item.html || "").replace(/\uFFFD+/g, ""));
      return (prefix ? '<p class="content">' + prefix + "</p>" : "") + body;
    }).join("");
    const head = extractHeadLinks(accepted[0]?.html || "");
    const style = css ? "<style>" + css + "</style>" : "";
    return "<!DOCTYPE html><html><head>" + head + "</head><body>" + style + bodies + "</body></html>";
  }
  function getChapterHtml(chapterUid, options = {}) {
    const uid = String(chapterUid || "");
    const bookId = String(options.bookId || "");
    const requireChapterStart = Boolean(options.requireChapterStart);
    const list = (cache.get(uid) || []).filter((item) => !bookId || item.bookId === bookId);
    if (!list.length) return null;
    const accepted = list.filter(
      (item) => item.html && item.text && chunker.isLikelyChapterText(item.text)
    ).sort((a, b) => {
      const startDiff = Number(Boolean(b.chapterStart)) - Number(Boolean(a.chapterStart));
      if (startDiff !== 0) return startDiff;
      if (a.resourceOrder !== b.resourceOrder) return a.resourceOrder - b.resourceOrder;
      return a.fetchedAt - b.fetchedAt || a.sequence - b.sequence;
    });
    if (requireChapterStart && !accepted.some((item) => item.chapterStart)) return null;
    if (!accepted.length) return null;
    return {
      html: mergeChapterHtmls(accepted, cssCache.get(uid) || ""),
      source: "API:chapter",
      chapterUid: uid
    };
  }
  async function waitForChapter(chapterUid, options = {}) {
    const uid = String(chapterUid || "");
    if (!uid) return null;
    const chapterStartOptions = { ...options, requireChapterStart: true };
    const immediate = getChapterText(uid, chapterStartOptions);
    if (immediate) return immediate;
    const timeout = Math.max(0, Number(options.timeout ?? 1200));
    const interval = Math.max(20, Number(options.interval ?? 80));
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      const result = getChapterText(uid, chapterStartOptions);
      if (result) return result;
    }
    return null;
  }
  function installHooks(pageWindow) {
    if (!pageWindow || pageWindow.__wrApiHooked) return;
    let hooked = false;
    if (typeof pageWindow.fetch === "function") {
      hooked = true;
      const originalFetch = pageWindow.fetch;
      pageWindow.fetch = function wrApiFetch(...args) {
        const [input, init = {}] = args;
        const url = typeof input === "string" ? input : input && input.url || "";
        if (CHAPTER_API_RE.test(url) && typeof init.body === "string" && extractChapterUid(init.body)) {
          const requestBody = init.body;
          const promise = originalFetch.call(pageWindow, ...args);
          if (promise && typeof promise.then === "function") {
            promise.then((response) => {
              if (!response || typeof response.clone !== "function") return;
              try {
                const clone = response.clone();
                clone.text().then((text) => {
                  storeResponse(url, requestBody, text);
                }).catch(() => {
                });
              } catch (error) {
              }
            }).catch(() => {
            });
          }
          return promise;
        }
        return originalFetch.call(pageWindow, ...args);
      };
    }
    const xhr = pageWindow.XMLHttpRequest;
    if (xhr && xhr.prototype && typeof xhr.prototype.open === "function") {
      const originalOpen = xhr.prototype.open;
      const originalSend = xhr.prototype.send;
      xhr.prototype.open = function wrApiXhrOpen(method, url, ...rest) {
        this.__wrApiUrl = String(url || "");
        return originalOpen.apply(this, [method, url, ...rest]);
      };
      xhr.prototype.send = function wrApiXhrSend(body) {
        const url = this.__wrApiUrl || "";
        if (CHAPTER_API_RE.test(url) && extractChapterUid(body)) {
          const requestBody = body;
          this.addEventListener("loadend", function wrApiXhrLoadEnd() {
            try {
              if (this.responseText) {
                storeResponse(url, requestBody, this.responseText);
              }
            } catch (error) {
            }
          });
        }
        return originalSend.apply(this, arguments);
      };
    }
    if (hooked) pageWindow.__wrApiHooked = true;
  }
  let hookRetryTimer = null;
  function ensureHooked() {
    const pageWindow = getPageWindow$1();
    if (!pageWindow) return;
    installHooks(pageWindow);
    if (pageWindow.__wrApiHooked) {
      if (hookRetryTimer !== null) {
        clearTimeout(hookRetryTimer);
        hookRetryTimer = null;
      }
      return;
    }
    if (typeof document === "undefined") return;
    if (!pageWindow.document) return;
    if (hookRetryTimer !== null) return;
    hookRetryTimer = setTimeout(() => {
      hookRetryTimer = null;
      ensureHooked();
    }, 300);
  }
  function clearCache() {
    cache.clear();
    cssCache.clear();
  }
  ensureHooked();
  const apiChapter = {
    clearCache,
    ensureHooked,
    getChapterHtml,
    getChapterText,
    installHooks,
    storeResponse,
    waitForChapter
  };
  const MAX_LAYOUT_POINTS = 4e3;
  function clamp$2(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function mapNormToRaw$1(raw, normOffset) {
    let rawIndex = 0;
    let normIndex = 0;
    let inWhitespace = true;
    while (rawIndex < raw.length) {
      const char = raw[rawIndex];
      if (char === "​" || char === "\uFEFF") {
        rawIndex += 1;
        continue;
      }
      if (/\s/.test(char)) {
        if (!inWhitespace) {
          inWhitespace = true;
          if (normIndex === normOffset) return rawIndex;
          normIndex += 1;
        }
        rawIndex += 1;
        continue;
      }
      inWhitespace = false;
      if (normIndex === normOffset) return rawIndex;
      normIndex += 1;
      rawIndex += 1;
    }
    return raw.length;
  }
  function getCharacterY(node, rawOffset) {
    if (!node?.nodeValue) return null;
    const raw = node.nodeValue;
    const start = clamp$2(rawOffset, 0, Math.max(0, raw.length - 1));
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, Math.min(raw.length, start + 1));
    const rect = Array.from(range.getClientRects()).find((item) => item.height > 0) || range.getBoundingClientRect();
    if (!rect || !rect.height && !rect.width) return null;
    const root = document.scrollingElement || document.documentElement;
    const scrollTop = window.scrollY || root.scrollTop || 0;
    const y = rect.top + scrollTop;
    const measureRoot = node.parentElement?.closest?.(".wr-tts-measure-root");
    const maxY = measureRoot ? Math.max(measureRoot.scrollHeight || 0, measureRoot.getBoundingClientRect().height || 0) : Math.max(root.scrollHeight || 0, document.body?.scrollHeight || 0);
    return Number.isFinite(y) && y >= 0 && y <= maxY + 50 ? y : null;
  }
  function findTextAlignment(domText, chapterText) {
    if (!domText || !chapterText) return null;
    if (domText === chapterText) return { domStart: 0, chapterStart: 0 };
    const domStart = domText.indexOf(chapterText);
    if (domStart >= 0) return { domStart, chapterStart: 0 };
    const chapterStart = chapterText.indexOf(domText);
    if (chapterStart >= 0) return { domStart: 0, chapterStart };
    return null;
  }
  function dedupePoints(points) {
    const sorted = points.filter((point) => Number.isFinite(point.offset) && Number.isFinite(point.y)).sort((a, b) => a.offset - b.offset || a.y - b.y);
    const result = [];
    for (const point of sorted) {
      const previous = result[result.length - 1];
      if (previous && previous.offset === point.offset) {
        previous.y = point.y;
        continue;
      }
      if (previous && Math.abs(previous.y - point.y) < 0.5) continue;
      result.push(point);
    }
    return result;
  }
  function getLayoutY(layout, offset) {
    const points = layout?.points || [];
    if (!points.length) return null;
    const target = Number(offset) || 0;
    if (target <= points[0].offset) return points[0].y;
    const last = points[points.length - 1];
    if (target >= last.offset) return last.y;
    let low = 0;
    let high = points.length - 1;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (points[middle].offset <= target) low = middle;
      else high = middle;
    }
    const previous = points[low];
    const next = points[high];
    const lineLength = Math.max(1, next.offset - previous.offset);
    const transitionChars = clamp$2(Math.round(lineLength * 0.12), 1, 4);
    const transitionStart = next.offset - transitionChars;
    const transitionEnd = next.offset + 1;
    if (target <= transitionStart) return previous.y;
    const progress = clamp$2((target - transitionStart) / Math.max(1, transitionEnd - transitionStart), 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    return previous.y + (next.y - previous.y) * eased;
  }
  function buildLayoutMap(root, chapterText, rangeStart, rangeEnd) {
    if (!root || !root.isConnected) return null;
    const normalizedChapter = chunker.normalizeText(chapterText);
    const domText = chunker.normalizeText(root.innerText || root.textContent || "");
    const alignment = findTextAlignment(domText, normalizedChapter);
    if (!alignment) return null;
    const safeStart = clamp$2(Number(rangeStart) || 0, 0, normalizedChapter.length);
    const safeEnd = clamp$2(Number(rangeEnd) || normalizedChapter.length, safeStart, normalizedChapter.length);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const points = [];
    let searchFrom = 0;
    let node;
    const addNodeLines = (textNode, raw, norm, chapterNodeStart) => {
      const localStart = clamp$2(safeStart - chapterNodeStart, 0, norm.length - 1);
      const localEnd = clamp$2(safeEnd - chapterNodeStart - 1, 0, norm.length - 1);
      if (localEnd < localStart) return;
      const measured = /* @__PURE__ */ new Map();
      const measure = (localOffset) => {
        const key = clamp$2(Math.round(localOffset), localStart, localEnd);
        if (measured.has(key)) return measured.get(key);
        const y = getCharacterY(textNode, mapNormToRaw$1(raw, key));
        measured.set(key, y);
        return y;
      };
      const add = (localOffset, y) => {
        if (!Number.isFinite(y) || points.length >= MAX_LAYOUT_POINTS) return;
        points.push({ offset: chapterNodeStart + localOffset, y });
      };
      const scan = (left, right, leftY, rightY) => {
        if (points.length >= MAX_LAYOUT_POINTS || right <= left || !Number.isFinite(leftY) || !Number.isFinite(rightY)) return;
        if (Math.abs(leftY - rightY) < 0.5) return;
        if (right - left <= 1) {
          add(right, rightY);
          return;
        }
        const middle = Math.floor((left + right) / 2);
        const middleY = measure(middle);
        scan(left, middle, leftY, middleY);
        scan(middle, right, middleY, rightY);
      };
      const startY = measure(localStart);
      const endY = measure(localEnd);
      add(localStart, startY);
      scan(localStart, localEnd, startY, endY);
    };
    while (node = walker.nextNode()) {
      const raw = node.nodeValue || "";
      const norm = chunker.normalizeText(raw);
      if (!norm) continue;
      const domNodeStart = domText.indexOf(norm, searchFrom);
      if (domNodeStart < 0) continue;
      searchFrom = domNodeStart + norm.length;
      const chapterNodeStart = domNodeStart - alignment.domStart + alignment.chapterStart;
      const chapterNodeEnd = chapterNodeStart + norm.length;
      if (chapterNodeEnd <= safeStart || chapterNodeStart >= safeEnd) continue;
      addNodeLines(node, raw, norm, chapterNodeStart);
    }
    const compact = dedupePoints(points);
    if (!compact.length) return null;
    const span = Math.max(1, safeEnd - safeStart);
    const coverageTolerance = Math.max(80, span * 0.08);
    if (compact[0].offset > safeStart + coverageTolerance) return null;
    if (compact[compact.length - 1].offset < safeEnd - coverageTolerance) return null;
    for (let index = 1; index < compact.length; index += 1) {
      if (compact[index].y + 2 < compact[index - 1].y) return null;
    }
    return {
      points: compact,
      rangeStart: safeStart,
      rangeEnd: safeEnd,
      sourceLength: normalizedChapter.length,
      createdAt: Date.now()
    };
  }
  const LEGACY_TTS_PANEL_ID = "wr-tts-panel";
  const VOICE_QUICK_ID = "wr-voice-quick";
  const PAGE_BOUNDARY_CACHE_KEY = "weread_page_boundary_cache";
  const pageBoundaryCache = /* @__PURE__ */ new Map();
  function readPageBoundaryCacheFromStorage() {
    try {
      const value = GM_getValue(PAGE_BOUNDARY_CACHE_KEY, {});
      return value && typeof value === "object" ? value : {};
    } catch (error) {
      return {};
    }
  }
  function writePageBoundaryCacheToStorage() {
    try {
      const obj = {};
      for (const [key, entry] of pageBoundaryCache.entries()) {
        obj[key] = entry;
      }
      GM_setValue(PAGE_BOUNDARY_CACHE_KEY, obj);
    } catch (error) {
    }
  }
  const extractorState = {
    cachedStore: null,
    cachedVm: null,
    cachedReaderState: null,
    cachedPreRenderHtml: null,
    /** 观察器捕获到的预渲染 DOM 节点（存引用，测量文本位置用；可能已被移除） */
    cachedPreRenderNode: null,
    preRenderObserver: null,
    currentChapterUid: "",
    lastResult: null,
    webpackRequire: null,
    webpackStore: null,
    webpackDecryption: null,
    webpackVm: null,
    webpackDiagnostic: null,
    lastDiagnosticSignature: ""
  };
  function nextTick(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms || 50));
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
  function getPreRenderDomText(el) {
    if (!el) return "";
    try {
      if (typeof el.cloneNode === "function") {
        const clone = el.cloneNode(true);
        if (typeof clone.querySelectorAll === "function") {
          clone.querySelectorAll("script, style, noscript, svg, canvas, audio, video, iframe").forEach((node) => node.remove());
          return chunker.normalizeText(clone.innerText || clone.textContent || "");
        }
      }
    } catch (error) {
    }
    return chunker.normalizeText(el.innerText || el.textContent || "");
  }
  function findAppElement() {
    return document.querySelector("#app") || document.body;
  }
  function isObjectLike(value) {
    return Boolean(value) && (typeof value === "object" || typeof value === "function");
  }
  function readProperty(value, key) {
    if (!isObjectLike(value) && typeof value !== "string") return void 0;
    try {
      return value[key];
    } catch (error) {
      return void 0;
    }
  }
  function safeObjectKeys(value) {
    if (!isObjectLike(value)) return [];
    try {
      return Object.keys(value);
    } catch (error) {
      return [];
    }
  }
  function uniqueObjects(list) {
    const result = [];
    const seen = /* @__PURE__ */ new Set();
    for (const item of list) {
      if (!item || seen.has(item)) continue;
      seen.add(item);
      result.push(item);
    }
    return result;
  }
  function isStoreLike(value) {
    if (!isObjectLike(value)) return false;
    return Boolean(
      readProperty(value, "state") && typeof readProperty(value, "dispatch") === "function" && typeof readProperty(value, "commit") === "function"
    );
  }
  function isReaderStateLike(value) {
    if (!isObjectLike(value)) return false;
    if (readProperty(value, "currentChapter") || readProperty(value, "currentSection") || readProperty(value, "currentBookSection") || readProperty(value, "chapterContentHtml") || readProperty(value, "horizontalReaderChapterContentHtml")) {
      return true;
    }
    return readProperty(value, "bookId") !== void 0 && (readProperty(value, "chapterUid") !== void 0 || readProperty(value, "currentChapterUid") !== void 0);
  }
  const CONTENT_KEY_RE = /(ContentHtml|ChapterContent|RenderContent|PreRender|Chapter|Section)/i;
  const NOISE_KEY_RE = /^(Target|Highlight|Selection|Settings|Config|Theme|Style|Layout|Header|Footer|Nav|Menu|Toolbar|Panel|Dialog|Modal|Toast|Error|Loading|Scroll|Window|Viewport|Size|Color|Font|Speed|Voice|Rate|Profile|Timer|Anchor)/i;
  const METADATA_KEY_RE = /^(currentChapter|currentSection|currentBookSection|bookSection|chapters|chapterList|chapterInfo|chapterMeta|chapterTitle|chapterNames|sectionInfo|sectionIndex|currentSectionIdx|currentSectionIndex|sectionUid|currentSectionUid|chapterUid|currentChapterUid|chapterId|bookSectionId|sectionCount|chapterCount|nextChapter|prevChapter|previousChapter|nextSection|prevSection|lastChapter|firstChapter|bookChapter)$/i;
  const UI_CONTAINER_SELECTORS = [
    "#readerTopBar",
    ".readerTopBar",
    ".readerNav",
    "nav",
    "header",
    "footer",
    "aside",
    ".catalog",
    ".bookIntro",
    ".bookInfo",
    ".bookReview",
    ".recommend",
    ".bookComment",
    ".footer",
    ".header",
    ".readerMenu",
    ".readerToolbar"
  ];
  const RENDER_FIELD_KEYS = [
    "tempContent",
    "preRenderHtml",
    "renderHtml",
    "currentSectionHtml",
    "chapterContentHtml",
    "preRenderContent",
    "renderedHtml",
    "horizontalReaderChapterContentHtml"
  ];
  const TEXT_LAYER_SELECTORS = [
    '#renderTargetContent [data-wr-role="text"]',
    '[data-wr-role="text"]',
    ".readerTextLayer",
    ".textLayer",
    "#preRenderContent",
    "#preRenderContents",
    ".preRenderContent",
    ".preRenderContainer"
  ];
  const TEXT_LAYER_CONTAINER_SELECTORS = [
    "#renderTargetContent .passage-content",
    ".passage-content",
    ".passageContent",
    ".readerPassageContent"
  ];
  const PRE_RENDER_CONTAINER_SELECTORS = [
    "#preRenderContent",
    "#preRenderContents",
    ".preRenderContent",
    ".preRenderContainer"
  ];
  function queryUniqueContainers(selectors) {
    const seen = /* @__PURE__ */ new Set();
    const list = [];
    for (const selector of selectors) {
      const nodes = typeof document.querySelectorAll === "function" ? Array.from(document.querySelectorAll(selector)) : [];
      for (const node of nodes) {
        if (node && !seen.has(node)) {
          seen.add(node);
          list.push(node);
        }
      }
    }
    return list;
  }
  function getTextLayerLineThreshold(span) {
    if (span && typeof getComputedStyle === "function") {
      try {
        const lineHeight = parseFloat(getComputedStyle(span).lineHeight);
        if (Number.isFinite(lineHeight) && lineHeight > 0) {
          return Math.max(8, lineHeight * 0.4);
        }
      } catch (error) {
      }
    }
    return 12;
  }
  function findApproximateTextRange(chapterText, pageText) {
    const text = chunker.normalizeText(chapterText);
    const page = chunker.normalizeText(pageText);
    if (!text || !page) return null;
    const exact = text.indexOf(page);
    if (exact >= 0) return { start: exact, end: exact + page.length };
    let prefixLen = Math.min(page.length, 160);
    while (prefixLen >= 8) {
      const prefix = page.slice(0, prefixLen);
      const start = text.indexOf(prefix);
      if (start >= 0) {
        let end = start + prefixLen;
        const maxSuffix = Math.min(page.length - prefixLen, 160);
        for (let suffixLen = maxSuffix; suffixLen >= 8; suffixLen -= 1) {
          const suffix = page.slice(page.length - suffixLen);
          const found = text.indexOf(suffix, end);
          if (found >= 0 && found + suffixLen >= end) {
            end = found + suffixLen;
            break;
          }
        }
        return { start, end };
      }
      prefixLen = Math.floor(prefixLen * 0.8);
    }
    return null;
  }
  function collectTextLayerSpans() {
    const spans = [];
    if (typeof document.querySelectorAll !== "function") return spans;
    const passages = queryUniqueContainers(TEXT_LAYER_CONTAINER_SELECTORS);
    for (const passage of passages) {
      const nodes = passage.querySelectorAll ? Array.from(passage.querySelectorAll('[data-wr-role="text"]')) : [];
      for (const span of nodes) {
        const ch = span.textContent;
        if (!ch) continue;
        try {
          const rect = span.getBoundingClientRect();
          if (rect && typeof rect.left === "number" && typeof rect.top === "number") {
            spans.push({ ch, x: rect.left, y: rect.top, rect, span });
          }
        } catch (error) {
        }
      }
    }
    return spans;
  }
  function locatePhraseInTextLayer(normPhrase) {
    if (!normPhrase || typeof document.querySelectorAll !== "function") return null;
    const spans = collectTextLayerSpans();
    if (!spans.length) return null;
    spans.sort((a, b) => a.y - b.y || a.x - b.x);
    const threshold = getTextLayerLineThreshold(spans[0]?.span);
    const lines = [];
    for (const point of spans) {
      const last = lines[lines.length - 1];
      if (!last || point.y - last.centroid > threshold) {
        lines.push({ centroid: point.y, points: [point] });
      } else {
        last.points.push(point);
        last.centroid = last.points.reduce((sum, item) => sum + item.y, 0) / last.points.length;
      }
    }
    const items = [];
    for (const line of lines) {
      line.points.sort((a, b) => a.x - b.x);
      for (const point of line.points) items.push(point);
    }
    const text = chunker.normalizeText(items.map((item) => item.ch).join(""));
    const index = text.indexOf(normPhrase);
    if (index < 0) return null;
    const rawText = items.map((item) => item.ch).join("");
    let rawIndex = 0;
    let normIndex = 0;
    let inWhitespace = true;
    while (rawIndex < rawText.length && normIndex < index) {
      const ch = rawText[rawIndex];
      if (ch === "​" || ch === "\uFEFF") {
        rawIndex += 1;
        continue;
      }
      if (/\s/.test(ch)) {
        if (!inWhitespace) {
          inWhitespace = true;
          normIndex += 1;
        }
        rawIndex += 1;
        continue;
      }
      inWhitespace = false;
      normIndex += 1;
      rawIndex += 1;
    }
    const target = items[Math.min(rawIndex, items.length - 1)];
    if (!target) return null;
    const scrollY = window.scrollY || document.scrollingElement?.scrollTop || 0;
    const y = (target.rect?.top ?? target.span.getBoundingClientRect().top) + scrollY;
    return Number.isFinite(y) ? { y, rawIndex } : null;
  }
  async function findTextLayerBoundary(text) {
    const normText = chunker.normalizeText(text || "");
    if (!normText || typeof document.querySelectorAll !== "function") return null;
    const doc = document.scrollingElement || document.documentElement;
    const maxScroll = Math.max(0, (doc.scrollHeight || 0) - (doc.clientHeight || 0));
    const step = Math.max(120, Math.round((window.innerHeight || 800) * 0.25));
    for (let y = 0; y <= maxScroll + step; y += step) {
      window.scrollTo(0, Math.min(maxScroll, y));
      await new Promise((resolve) => window.setTimeout(resolve, 40));
      const passages = queryUniqueContainers(TEXT_LAYER_CONTAINER_SELECTORS);
      for (const passage of passages) {
        const pageText = reconstructTextLayerPageText(passage);
        if (!pageText) continue;
        const range = findApproximateTextRange(normText, pageText);
        if (range) {
          return { scroll: Math.min(maxScroll, y), offset: range.start };
        }
      }
    }
    return null;
  }
  function isTextLayerPageVisible(passage) {
    const spans = passage.querySelectorAll ? Array.from(passage.querySelectorAll('[data-wr-role="text"]')) : [];
    const viewportHeight = Math.max(
      Number(window.innerHeight) || 0,
      Number(document.documentElement && document.documentElement.clientHeight) || 0
    );
    const aheadMargin = 600;
    for (const span of spans) {
      if (!span.textContent) continue;
      try {
        const rect = span.getBoundingClientRect();
        if (rect && rect.bottom >= 0 && rect.top >= -80 && rect.top <= viewportHeight + aheadMargin) {
          return true;
        }
      } catch (error) {
      }
    }
    return false;
  }
  function reconstructTextLayerPageText(passage) {
    const spans = passage.querySelectorAll ? Array.from(passage.querySelectorAll('[data-wr-role="text"]')) : [];
    const points = [];
    for (const span of spans) {
      const ch = span.textContent;
      if (!ch) continue;
      try {
        const rect = span.getBoundingClientRect();
        if (rect && typeof rect.left === "number" && typeof rect.top === "number") {
          points.push({ ch, x: rect.left, y: rect.top });
        }
      } catch (error) {
      }
    }
    if (!points.length) {
      return chunker.normalizeText(passage.textContent || passage.innerText || "");
    }
    points.sort((a, b) => a.y - b.y || a.x - b.x);
    const threshold = getTextLayerLineThreshold(spans[0]);
    const lines = [];
    for (const point of points) {
      const last = lines[lines.length - 1];
      if (!last || point.y - last.centroid > threshold) {
        lines.push({ centroid: point.y, points: [point] });
      } else {
        last.points.push(point);
        last.centroid = last.points.reduce((sum, item) => sum + item.y, 0) / last.points.length;
      }
    }
    return chunker.normalizeText(
      lines.map((line) => {
        line.points.sort((a, b) => a.x - b.x);
        return line.points.map((item) => item.ch).join("");
      }).join("")
    );
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
    const candidates = [];
    const push = (value) => {
      if (value && !candidates.includes(value)) candidates.push(value);
    };
    for (const vm of instances) {
      push(readProperty(vm, "$store"));
      push(readProperty(vm, "store"));
      push(readProperty(vm, "readerStore"));
      const proxy = readProperty(vm, "proxy");
      if (isObjectLike(proxy)) {
        push(readProperty(proxy, "$store"));
        push(readProperty(proxy, "store"));
        push(readProperty(proxy, "readerStore"));
      }
      const data = readProperty(vm, "$data");
      if (isObjectLike(data)) {
        push(readProperty(data, "$store"));
        push(readProperty(data, "store"));
        push(readProperty(data, "readerStore"));
      }
    }
    for (const candidate of candidates) {
      if (isStoreLike(candidate)) return candidate;
    }
    for (const candidate of candidates) {
      if (candidate && readProperty(candidate, "state")) return candidate;
    }
    return null;
  }
  function getReaderState(store, vm) {
    const state = store ? readProperty(store, "state") : null;
    if (isObjectLike(state)) {
      for (const holderKey of ["book", "books"]) {
        const holder = readProperty(state, holderKey);
        if (!isObjectLike(holder)) continue;
        for (const key of ["reader", "readerState", "readerData", "readerStore", "bookReader", "read"]) {
          const candidate = readProperty(holder, key);
          if (isReaderStateLike(candidate)) return candidate;
        }
      }
      for (const key of ["reader", "readerState", "readerData", "readerStore", "bookReader", "read"]) {
        const candidate = readProperty(state, key);
        if (isReaderStateLike(candidate)) return candidate;
      }
      for (const key of safeObjectKeys(state)) {
        const candidate = readProperty(state, key);
        if (isReaderStateLike(candidate)) return candidate;
      }
    }
    for (const source of [vm, vm ? readProperty(vm, "proxy") : null, vm ? readProperty(vm, "$data") : null]) {
      if (!isObjectLike(source)) continue;
      for (const key of ["reader", "readerState", "readerData", "readerStore", "bookReader", "read"]) {
        const candidate = readProperty(source, key);
        if (isReaderStateLike(candidate)) return candidate;
      }
      for (const key of safeObjectKeys(source)) {
        const candidate = readProperty(source, key);
        if (isReaderStateLike(candidate)) return candidate;
      }
    }
    return null;
  }
  function findReaderVms(instances) {
    const candidates = [];
    const isReaderVm = (vm) => {
      if (!isObjectLike(vm)) return false;
      if (typeof readProperty(vm, "decryptRenderHtml") === "function") return true;
      if (typeof readProperty(vm, "preRender") === "function") {
        if (readProperty(vm, "preRenderHtml") !== void 0) return true;
        const refs = readProperty(vm, "$refs");
        if (isObjectLike(refs) && (readProperty(refs, "preRenderContainer") || readProperty(refs, "renderTargetCanvasContainer"))) {
          return true;
        }
      }
      for (const key of [
        "tempContent",
        "isShowPreRender",
        "preRenderHtml",
        "renderHtml",
        "chapterContentHtml",
        "horizontalReaderChapterContentHtml",
        "currentChapter",
        "currentSection",
        "currentBookSection",
        "currentChapterUid",
        "chapterUid",
        "chapterContent"
      ]) {
        if (readProperty(vm, key) !== void 0) return true;
      }
      if (readProperty(vm, "getCurrentSection") != null || readProperty(vm, "getCurrentSectionIdx") != null) return true;
      return false;
    };
    for (const vm of instances) {
      if (isReaderVm(vm)) candidates.push(vm);
      const proxy = readProperty(vm, "proxy");
      if (isObjectLike(proxy) && isReaderVm(proxy)) candidates.push(proxy);
    }
    return uniqueObjects(candidates);
  }
  function getUidFromHolder(holder) {
    if (Array.isArray(holder)) {
      for (const item of holder) {
        const uid = getUidFromHolder(item);
        if (uid) return uid;
      }
      return "";
    }
    if (!isObjectLike(holder)) return "";
    for (const key of ["chapterUid", "chapterId", "uid", "id"]) {
      const value = readProperty(holder, key);
      if (typeof value === "string" || typeof value === "number") {
        const text = String(value).trim();
        if (text && text !== "0" && text !== "undefined" && text !== "null") return text;
      }
    }
    return "";
  }
  function getChapterUidFromLocation() {
    if (typeof location === "undefined" || !location || !location.href) return "";
    try {
      const href = String(location.href || "");
      const pathMatch = href.match(/\/reader\/[^/?#]+?k([A-Za-z0-9_-]+)/i);
      if (pathMatch) return pathMatch[1];
      const url = new URL(href);
      return String(url.searchParams.get("chapterUid") || url.searchParams.get("chapterId") || "");
    } catch (error) {
      return "";
    }
  }
  function getCurrentChapterUid(readerState, vm) {
    const holders = [];
    if (isObjectLike(readerState)) {
      for (const key of ["currentChapter", "currentSection", "currentBookSection", "bookSection", "chapter"]) {
        const holder = readProperty(readerState, key);
        if (holder) holders.push(holder);
      }
      const direct = getUidFromHolder(readerState);
      if (direct) return direct;
    }
    for (const source of [vm, vm ? readProperty(vm, "proxy") : null, vm ? readProperty(vm, "$data") : null]) {
      if (!isObjectLike(source)) continue;
      for (const key of ["currentChapter", "currentSection", "currentBookSection", "bookSection", "chapter"]) {
        const holder = readProperty(source, key);
        if (holder) holders.push(holder);
      }
      for (const key of ["currentChapterUid", "chapterUid", "currentSectionUid", "chapterId"]) {
        const value = readProperty(source, key);
        if (typeof value === "string" || typeof value === "number") {
          const text = String(value).trim();
          if (text) return text;
        }
      }
    }
    for (const holder of holders) {
      const uid = getUidFromHolder(holder);
      if (uid) return uid;
    }
    return getChapterUidFromLocation();
  }
  function resetPreRenderCache() {
    extractorState.cachedPreRenderHtml = null;
    extractorState.cachedPreRenderNode = null;
  }
  function getLiveCachedChapterUid() {
    const readerState = getReaderState(extractorState.cachedStore, extractorState.cachedVm);
    return getCurrentChapterUid(readerState, extractorState.cachedVm);
  }
  function getPageWindow() {
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow) return unsafeWindow;
    } catch (error) {
    }
    return window;
  }
  function captureWebpackRequire() {
    if (extractorState.webpackRequire && extractorState.webpackStore && extractorState.webpackDecryption) {
      return extractorState.webpackRequire;
    }
    const pageWindow = getPageWindow();
    const webpackJsonp = pageWindow && pageWindow.webpackJsonp;
    const diagnostic = {
      hasUnsafeWindow: pageWindow !== window,
      hasWebpackJsonp: Boolean(webpackJsonp && typeof webpackJsonp.push === "function"),
      capturedRequire: Boolean(extractorState.webpackRequire),
      moduleCount: 0,
      foundStore: Boolean(extractorState.webpackStore),
      foundDecryption: Boolean(extractorState.webpackDecryption),
      error: ""
    };
    extractorState.webpackDiagnostic = diagnostic;
    if (!webpackJsonp || typeof webpackJsonp.push !== "function") {
      return extractorState.webpackRequire;
    }
    let captured = null;
    let bridge = null;
    const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const chunkId = "wr_tts_chunk_" + suffix;
    const moduleId = "wr_tts_module_" + suffix;
    try {
      if (typeof pageWindow.Function === "function") {
        const bootstrap = pageWindow.Function(
          "chunkId",
          "moduleId",
          [
            "var result = {",
            "  webpackRequire: null,",
            "  store: null,",
            "  decryption: null,",
            '  diagnostic: { capturedRequire: false, moduleCount: 0, foundStore: false, foundDecryption: false, error: "" }',
            "};",
            "try {",
            "var modules = {};",
            "modules[moduleId] = function(module, exports, webpackRequire) {",
            "  result.webpackRequire = webpackRequire;",
            "};",
            "window.webpackJsonp.push([[chunkId], modules, [[moduleId]]]);",
            "result.diagnostic.capturedRequire = !!result.webpackRequire;",
            "var cache = result.webpackRequire && result.webpackRequire.c;",
            'var moduleIds = cache && typeof cache === "object" ? Object.keys(cache) : [];',
            "result.diagnostic.moduleCount = moduleIds.length;",
            "var seen = [];",
            "var inspected = 0;",
            "function inspect(value, depth) {",
            '  if (!value || (typeof value !== "object" && typeof value !== "function")) return;',
            "  if (result.store && result.decryption) return;",
            "  if (seen.indexOf(value) >= 0 || inspected >= 60000) return;",
            "  seen.push(value);",
            "  inspected += 1;",
            "  if (!result.store) {",
            "    try {",
            '      if (value.state && value.state.reader && typeof value.dispatch === "function" && typeof value.commit === "function") {',
            "        result.store = value;",
            "      }",
            "    } catch (error) {}",
            "  }",
            "  if (!result.decryption) {",
            "    try {",
            "      var decrypt = value.decryption;",
            '      if (typeof decrypt === "function") {',
            "        result.decryption = function() { return decrypt.apply(value, arguments); };",
            "      }",
            "    } catch (error) {}",
            "  }",
            "  if (depth <= 0 || (result.store && result.decryption)) return;",
            "  var keys = [];",
            "  try { keys = Object.keys(value).slice(0, 100); } catch (error) { return; }",
            "  for (var i = 0; i < keys.length; i += 1) {",
            "    try { inspect(value[keys[i]], depth - 1); } catch (error) {}",
            "    if (result.store && result.decryption) return;",
            "  }",
            "}",
            "for (var i = 0; i < moduleIds.length; i += 1) {",
            "  var cachedModule = cache[moduleIds[i]];",
            "  inspect(cachedModule && cachedModule.exports, 3);",
            "  if (result.store && result.decryption) break;",
            "}",
            "result.diagnostic.foundStore = !!result.store;",
            "result.diagnostic.foundDecryption = !!result.decryption;",
            "} catch (error) {",
            "  result.diagnostic.error = String(error && (error.stack || error.message) || error);",
            "}",
            "return result;"
          ].join("\n")
        );
        bridge = bootstrap(chunkId, moduleId);
        captured = bridge && bridge.webpackRequire;
      } else {
        const modules = {};
        modules[moduleId] = function captureRequire(module, exports, webpackRequire) {
          captured = webpackRequire;
        };
        webpackJsonp.push([[chunkId], modules, [[moduleId]]]);
      }
    } catch (error) {
      diagnostic.error = String(error && (error.stack || error.message) || error);
      return extractorState.webpackRequire;
    }
    if (captured && captured.c) extractorState.webpackRequire = captured;
    if (bridge?.store) extractorState.webpackStore = bridge.store;
    if (bridge?.decryption) extractorState.webpackDecryption = bridge.decryption;
    if (bridge?.diagnostic) {
      diagnostic.capturedRequire = Boolean(bridge.diagnostic.capturedRequire);
      diagnostic.moduleCount = Number(bridge.diagnostic.moduleCount) || 0;
      diagnostic.foundStore = Boolean(bridge.diagnostic.foundStore);
      diagnostic.foundDecryption = Boolean(bridge.diagnostic.foundDecryption);
      diagnostic.error = String(bridge.diagnostic.error || "");
    } else if (extractorState.webpackRequire?.c) {
      diagnostic.capturedRequire = true;
      try {
        diagnostic.moduleCount = Object.keys(extractorState.webpackRequire.c).length;
      } catch (error) {
        diagnostic.error = String(error && (error.stack || error.message) || error);
      }
    }
    return extractorState.webpackRequire;
  }
  function inspectWebpackExport(value, found) {
    if (!value || typeof value !== "object" && typeof value !== "function") return;
    if (!found.store) {
      try {
        const state = value.state;
        if (state && state.reader && typeof value.dispatch === "function" && typeof value.commit === "function") {
          found.store = value;
        }
      } catch (error) {
      }
    }
    if (!found.decryption) {
      try {
        if (typeof value.decryption === "function") found.decryption = value.decryption;
      } catch (error) {
      }
    }
  }
  function findWebpackReaderBridge() {
    if (extractorState.webpackStore && extractorState.webpackDecryption) {
      return {
        store: extractorState.webpackStore,
        decryption: extractorState.webpackDecryption,
        vm: extractorState.webpackVm
      };
    }
    const webpackRequire = captureWebpackRequire();
    const cache2 = webpackRequire && webpackRequire.c;
    if (!cache2 || typeof cache2 !== "object") return null;
    const found = {
      store: extractorState.webpackStore,
      decryption: extractorState.webpackDecryption
    };
    for (const module of Object.values(cache2)) {
      const exported = module && module.exports;
      inspectWebpackExport(exported, found);
      if (exported && (typeof exported === "object" || typeof exported === "function")) {
        try {
          inspectWebpackExport(exported.default, found);
          if (!found.store || !found.decryption) {
            Object.keys(exported).slice(0, 100).forEach((key) => {
              inspectWebpackExport(exported[key], found);
            });
          }
        } catch (error) {
        }
      }
      if (found.store && found.decryption) break;
    }
    if (extractorState.webpackDiagnostic) {
      extractorState.webpackDiagnostic.foundStore = Boolean(found.store);
      extractorState.webpackDiagnostic.foundDecryption = Boolean(found.decryption);
    }
    if (!found.store || !found.decryption) return null;
    extractorState.webpackStore = found.store;
    extractorState.webpackDecryption = found.decryption;
    if (!extractorState.webpackVm) {
      extractorState.webpackVm = {
        isWereadWebpackBridge: true,
        get $store() {
          return extractorState.webpackStore;
        },
        get bookId() {
          return String(extractorState.webpackStore?.state?.reader?.bookId || "");
        },
        decryptRenderHtml(value, chapterUid, sectionIndex) {
          return extractorState.webpackDecryption(
            value,
            this.bookId,
            chapterUid,
            sectionIndex
          );
        }
      };
    }
    return {
      store: extractorState.webpackStore,
      decryption: extractorState.webpackDecryption,
      vm: extractorState.webpackVm
    };
  }
  function warnExtractionFailure(details) {
    const canvas = Boolean(document.querySelector(".wr_canvasContainer, .readerChapterContent canvas"));
    const textLayerNodeCount = document.querySelectorAll('#renderTargetContent [data-wr-role="text"]').length;
    const diagnostic = {
      ...extractorState.webpackDiagnostic,
      ...details,
      canvas,
      textLayerNodeCount
    };
    const signature = JSON.stringify(diagnostic);
    if (signature === extractorState.lastDiagnosticSignature) return;
    extractorState.lastDiagnosticSignature = signature;
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn("[WereadTTS] 未找到章节正文", diagnostic);
    }
  }
  function refreshReaderContext() {
    const instances = collectVueInstances();
    let store = getStore(instances);
    const readerVms = findReaderVms(instances);
    let source = "Vue";
    const hasVueDecryptor = readerVms.some(
      (candidate) => typeof readProperty(candidate, "decryptRenderHtml") === "function"
    );
    const bridge = findWebpackReaderBridge();
    if (bridge) {
      if (!store) store = bridge.store;
      if (!readerVms.some((candidate) => candidate === bridge.vm)) readerVms.push(bridge.vm);
      if (!hasVueDecryptor) source = "WeReadStore";
    }
    const vm = readerVms[0] || null;
    const readerState = getReaderState(store, vm);
    const uid = getCurrentChapterUid(readerState, vm);
    const previousUid = extractorState.currentChapterUid;
    extractorState.cachedStore = store;
    extractorState.cachedVm = vm;
    extractorState.cachedReaderState = readerState;
    extractorState.currentChapterUid = uid;
    if (previousUid !== uid && (previousUid || uid)) {
      resetPreRenderCache();
    }
    return { instances, store, readerVms, vm, readerState, uid, source };
  }
  function isStaleTextForChapter(uid, text) {
    if (!uid || !extractorState.lastResult?.chapterUid) return false;
    if (uid === extractorState.lastResult.chapterUid) return false;
    return chunker.normalizeText(text) === extractorState.lastResult.text;
  }
  function rememberResult(result) {
    const text = chunker.normalizeText(result?.text);
    if (!chunker.isLikelyChapterText(text)) return result;
    extractorState.lastResult = {
      chapterUid: String(result.chapterUid || ""),
      text
    };
    return { ...result, text };
  }
  function findCachedPlaintext(instances, uid) {
    let best = null;
    let bestScore = -Infinity;
    for (const vm of instances) {
      const candidates = [];
      for (const key of RENDER_FIELD_KEYS) {
        const raw = readProperty(vm, key);
        if (typeof raw === "string" && raw) {
          candidates.push({ raw, key });
        } else if (isObjectLike(raw) && typeof readProperty(raw, "html") === "string") {
          candidates.push({ raw: readProperty(raw, "html"), key });
        }
      }
      for (const candidate of candidates) {
        const text = htmlToText(candidate.raw);
        if (!chunker.isLikelyChapterText(text)) continue;
        const vmUid = getCurrentChapterUid(getReaderState(null, vm), vm);
        if (uid && vmUid !== uid) continue;
        if (isStaleTextForChapter(uid, text)) continue;
        const score = chunker.scoreChapterText(text);
        if (score > bestScore) {
          best = { text, source: "Vue:" + candidate.key, score };
          bestScore = score;
        }
      }
    }
    return best ? { text: best.text, source: best.source } : null;
  }
  const ENCRYPTED_STRING_KEYS = ["value", "data", "html", "content", "raw", "ciphertext", "encrypted", "text"];
  function readEncryptedString(value, seen = /* @__PURE__ */ new WeakSet(), depth = 0) {
    if (typeof value === "string") return value;
    if (!isObjectLike(value) || seen.has(value) || depth > 3) return "";
    seen.add(value);
    for (const key of ENCRYPTED_STRING_KEYS) {
      const candidate = readProperty(value, key);
      if (typeof candidate === "string" && candidate) return candidate;
      if (Array.isArray(candidate)) {
        const joined = candidate.filter((item) => typeof item === "string").join("");
        if (joined) return joined;
        for (const item of candidate) {
          const nested = readEncryptedString(item, seen, depth + 1);
          if (nested) return nested;
        }
      }
      if (isObjectLike(candidate)) {
        const nested = readEncryptedString(candidate, seen, depth + 1);
        if (nested) return nested;
      }
    }
    return "";
  }
  function resolveEntryValue(entry) {
    if (typeof entry === "string") return entry;
    if (!isObjectLike(entry)) return "";
    const direct = readProperty(entry, "value");
    if (typeof direct === "string") return direct;
    if (isObjectLike(direct)) {
      const extracted = readEncryptedString(direct);
      if (extracted) return extracted;
    }
    for (const key of ENCRYPTED_STRING_KEYS) {
      const candidate = readProperty(entry, key);
      if (typeof candidate === "string" && candidate) return candidate;
      if (isObjectLike(candidate)) {
        const extracted = readEncryptedString(candidate);
        if (extracted) return extracted;
      }
    }
    return "";
  }
  function getEntryChapterUid(entry, containerUid, fallbackUid) {
    if (isObjectLike(entry)) {
      for (const holder of [entry, readProperty(entry, "chapter"), readProperty(entry, "section")]) {
        if (!isObjectLike(holder)) continue;
        for (const key of ["chapterUid", "chapterId", "uid"]) {
          const value = readProperty(holder, key);
          if (typeof value === "string" || typeof value === "number") {
            const text = String(value).trim();
            if (text) return text;
          }
        }
      }
    }
    if (containerUid) return String(containerUid);
    return fallbackUid ? String(fallbackUid) : "";
  }
  function countCjk(value) {
    return (String(value).match(/[\u3400-\u9FFF]/g) || []).length;
  }
  function isLikelyEncryptedEntry(entry) {
    if (!isObjectLike(entry)) return Boolean(resolveEntryValue(entry));
    if (typeof readProperty(entry, "valueHasStr") === "function") return true;
    const value = resolveEntryValue(entry);
    if (!value) return false;
    if (value.length < 8) return false;
    const cjkCount = countCjk(value);
    if (cjkCount > 0 && cjkCount / value.length > 0.8 && value.length < 80) return false;
    return true;
  }
  function createEntryItem(entry, containerUid, fallbackUid, index) {
    const value = resolveEntryValue(entry);
    if (!value || !isLikelyEncryptedEntry(entry)) return null;
    return {
      entry: isObjectLike(entry) ? entry : { value },
      value,
      chapterUid: getEntryChapterUid(entry, containerUid, fallbackUid),
      index,
      valueType: isObjectLike(entry) ? typeof readProperty(entry, "value") : typeof entry,
      hasValueHasStr: isObjectLike(entry) && typeof readProperty(entry, "valueHasStr") === "function"
    };
  }
  function normalizeEntries(value, fallbackUid, containerUid = "") {
    const result = [];
    if (!value) return result;
    if (typeof value === "string") {
      const item = createEntryItem({ value }, containerUid, fallbackUid, 0);
      if (item) result.push(item);
      return result;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        const item = createEntryItem(entry, "", fallbackUid, index);
        if (item) result.push(item);
      });
      return result;
    }
    if (isObjectLike(value)) {
      if (resolveEntryValue(value)) {
        const item = createEntryItem(value, "", fallbackUid, 0);
        if (item) result.push(item);
        return result;
      }
      safeObjectKeys(value).forEach((uid) => {
        const item = readProperty(value, uid);
        const list = Array.isArray(item) ? item : [item];
        list.forEach((entry, index) => {
          const normalized = createEntryItem(entry, uid, fallbackUid, index);
          if (normalized) result.push(normalized);
        });
      });
    }
    return result;
  }
  function collectEntries(readerState, vm, currentUid, instances = []) {
    const result = [];
    const seen = /* @__PURE__ */ new Set();
    function hasContentField(value, depth = 0) {
      if (!isObjectLike(value) || depth > 1) return false;
      for (const key of safeObjectKeys(value)) {
        if (NOISE_KEY_RE.test(key) || METADATA_KEY_RE.test(key)) continue;
        if (CONTENT_KEY_RE.test(key)) return true;
        if (depth === 0 && isObjectLike(readProperty(value, key)) && hasContentField(readProperty(value, key), 1)) {
          return true;
        }
      }
      return false;
    }
    function add(value, fallbackUid, containerUid = "") {
      const items = normalizeEntries(value, fallbackUid, containerUid);
      for (const item of items) {
        const key = String(item.value).slice(0, 200) + "|" + item.chapterUid + "|" + item.index;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(item);
      }
    }
    function addKnownFields(source) {
      if (!isObjectLike(source)) return;
      for (const key of ["horizontalReaderChapterContentHtml", "chapterContentHtml"]) {
        add(readProperty(source, key), currentUid, key);
      }
    }
    function scanContent(source, seenObjects = /* @__PURE__ */ new WeakSet(), depth = 0) {
      if (!isObjectLike(source) || depth > 2 || seenObjects.has(source)) return;
      seenObjects.add(source);
      const keys = safeObjectKeys(source).slice(0, 400);
      for (const key of keys) {
        if (METADATA_KEY_RE.test(key)) {
          const value2 = readProperty(source, key);
          if (!hasContentField(value2)) continue;
          if (depth < 2 && isObjectLike(value2)) {
            scanContent(value2, seenObjects, depth + 1);
          }
          continue;
        }
        if (NOISE_KEY_RE.test(key)) continue;
        const value = readProperty(source, key);
        if (CONTENT_KEY_RE.test(key)) {
          if (/(Target|Highlight|Selection)/i.test(key)) continue;
          add(value, currentUid, key);
        } else if (depth < 2 && isObjectLike(value)) {
          scanContent(value, seenObjects, depth + 1);
        }
      }
    }
    const sources = [readerState, vm, ...Array.isArray(instances) ? instances : []];
    for (const source of sources) {
      if (!isObjectLike(source)) continue;
      addKnownFields(source);
      scanContent(source);
    }
    return result;
  }
  function getRenderResultString(value) {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      return value.map((item) => getRenderResultString(item)).filter(Boolean).join("");
    }
    if (isObjectLike(value)) {
      for (const key of ["html", "content", "text", "value", "result", "data"]) {
        const text = getRenderResultString(readProperty(value, key));
        if (text) return text;
      }
    }
    return "";
  }
  function snapshotRenderFields(vm) {
    const before = {};
    for (const key of RENDER_FIELD_KEYS) before[key] = readProperty(vm, key);
    return before;
  }
  function getRenderedHtml(returned, vm, before, rejectedValues = []) {
    const candidates = [];
    const rejectedTexts = new Set(rejectedValues.map((value) => htmlToText(value)).filter(Boolean));
    const returnedString = getRenderResultString(returned);
    if (returnedString) candidates.push(returnedString);
    for (const key of RENDER_FIELD_KEYS) {
      const current = readProperty(vm, key);
      if (before && current !== before[key]) {
        const currentString = getRenderResultString(current);
        if (currentString) candidates.push(currentString);
      }
    }
    let best = "";
    let bestScore = -Infinity;
    for (const html of candidates) {
      const text = htmlToText(html);
      if (!chunker.isLikelyChapterText(text) || rejectedTexts.has(text)) continue;
      const score = chunker.scoreChapterText(text);
      if (score > bestScore) {
        best = html;
        bestScore = score;
      }
    }
    return best;
  }
  async function runRenderer(vm, action, rejectedValues) {
    const before = snapshotRenderFields(vm);
    const returned = await Promise.resolve(action());
    const immediate = getRenderedHtml(returned, vm, before, rejectedValues);
    if (immediate) return immediate;
    await nextTick(80);
    return getRenderedHtml(returned, vm, before, rejectedValues);
  }
  async function decryptEntry(vms, entry, uid, index, probe, extraVms = []) {
    const vmList = uniqueObjects([
      ...Array.isArray(vms) ? vms : vms ? [vms] : [],
      ...Array.isArray(extraVms) ? extraVms : extraVms ? [extraVms] : []
    ]);
    const value = resolveEntryValue(entry);
    if (!value) return "";
    const pushError = (step, error) => {
      if (!probe) return;
      if (!Array.isArray(probe.errors)) probe.errors = [];
      if (probe.errors.length >= 20) return;
      probe.errors.push({
        step,
        message: String(error && (error.stack || error.message) || error)
      });
    };
    for (const vm of vmList) {
      if (typeof readProperty(vm, "decryptRenderHtml") !== "function") continue;
      const decryptRenderHtml = readProperty(vm, "decryptRenderHtml");
      const bookId = readProperty(vm, "bookId") || "";
      const sectionIndex = getSectionIndex(vm, index || 0);
      const calls = {
        4: () => decryptRenderHtml.call(vm, value, bookId, uid, sectionIndex),
        3: () => decryptRenderHtml.call(vm, value, uid, sectionIndex),
        2: () => decryptRenderHtml.call(vm, value, uid),
        1: () => decryptRenderHtml.call(vm, value)
      };
      let order;
      if (vm.isWereadWebpackBridge) {
        order = [3, 2, 1, 4];
      } else if (typeof decryptRenderHtml.length === "number" && decryptRenderHtml.length >= 2) {
        order = decryptRenderHtml.length >= 4 ? [4, 3, 2, 1] : decryptRenderHtml.length === 3 ? [3, 2, 1, 4] : [2, 1, 3, 4];
      } else {
        order = [3, 2, 4, 1];
      }
      const attempts = order.filter((key) => key !== 4 || bookId).map((key) => calls[key]);
      for (const attempt of attempts) {
        try {
          const html = await runRenderer(vm, attempt, [value]);
          if (html) return html;
        } catch (error) {
          pushError("decryptRenderHtml", error);
        }
      }
    }
    for (const vm of vmList) {
      if (readProperty(vm, "isShowPreRender") === void 0 || vm.isShowPreRender) continue;
      if (probe?.toggleAttempted?.has(vm)) continue;
      probe?.toggleAttempted?.add(vm);
      const previous = vm.isShowPreRender;
      try {
        const html = await runRenderer(vm, () => {
          vm.isShowPreRender = true;
        });
        if (html) return html;
      } catch (error) {
        pushError("isShowPreRender", error);
      } finally {
        if (vm.isShowPreRender !== previous) vm.isShowPreRender = previous;
      }
    }
    for (const vm of vmList) {
      if (typeof readProperty(vm, "preRender") !== "function" || readProperty(vm, "preRenderHtml") === void 0) continue;
      if (probe?.preRenderAttempted?.has(vm)) continue;
      probe?.preRenderAttempted?.add(vm);
      const previousShouldPreRender = vm.shouldPreRender;
      try {
        const html = await runRenderer(vm, () => vm.preRender(uid || "0"));
        if (html) return html;
      } catch (error) {
        pushError("preRender", error);
      } finally {
        if (previousShouldPreRender !== void 0) vm.shouldPreRender = previousShouldPreRender;
      }
    }
    return "";
  }
  function getSectionIndex(vm, fallback) {
    const entryIndex = Number(fallback);
    if (Number.isInteger(entryIndex) && entryIndex >= 0) return entryIndex;
    if (!vm) return 0;
    try {
      if (typeof vm.getCurrentSectionIdx === "function") {
        const value = vm.getCurrentSectionIdx();
        if (typeof value === "number") return value;
      } else if (typeof vm.getCurrentSectionIdx === "number") {
        return vm.getCurrentSectionIdx;
      }
    } catch (error) {
    }
    return 0;
  }
  function capturePreRenderDom(root, chapterUid = getLiveCachedChapterUid()) {
    const selectors = ["#preRenderContent", "#preRenderContents", ".preRenderContent", ".preRenderContainer"];
    const nodes = root && root.querySelectorAll ? Array.from(root.querySelectorAll(selectors.join(","))) : [];
    let best = null;
    let bestScore = -Infinity;
    for (const el of nodes) {
      const text = getPreRenderDomText(el);
      const score = chunker.scoreChapterText(text);
      if (score > bestScore) {
        best = { text, html: el.innerHTML || "", node: el };
        bestScore = score;
      }
    }
    if (!best || bestScore <= 0) return null;
    extractorState.cachedPreRenderHtml = {
      text: best.text,
      html: best.html,
      source: "preRenderDOM",
      capturedAt: Date.now(),
      chapterUid: String(chapterUid || "")
    };
    extractorState.cachedPreRenderNode = best.node;
    return extractorState.cachedPreRenderHtml;
  }
  function readPreRenderDom(chapterUid) {
    const uid = String(chapterUid || "");
    const captured = capturePreRenderDom(findAppElement(), uid);
    const cached = captured || extractorState.cachedPreRenderHtml;
    if (!cached?.text || !chunker.isLikelyChapterText(cached.text)) return null;
    if (uid && cached.chapterUid !== uid) return null;
    if (isStaleTextForChapter(uid, cached.text)) return null;
    return {
      text: cached.text,
      source: !captured && cached.source === "preRenderDOM" ? "preRenderDOM:cache" : cached.source,
      chapterUid: uid
    };
  }
  function getElementTextExcluding(el) {
    if (!el) return "";
    try {
      if (typeof el.cloneNode === "function") {
        const clone = el.cloneNode(true);
        if (typeof clone.querySelectorAll === "function") {
          clone.querySelectorAll(
            "script, style, noscript, svg, canvas, audio, video, iframe, button, input, textarea, select, a, nav, header, footer, aside, .readerTopBar, .catalog, .bookReview, .recommend, .bookIntro, .bookInfo, .bookComment, .readerMenu, .readerToolbar"
          ).forEach((node) => node.remove());
          const text = chunker.normalizeText(clone.innerText || clone.textContent || "");
          if (text) return text;
        }
      }
    } catch (error) {
    }
    return chunker.normalizeText(el.innerText || el.textContent || "");
  }
  function getLegacyDomText() {
    const selectors = [".readerChapterContent", ".readerContent", ".readerChapter", ".app_content", ".readerContainer"];
    let bestKnown = null;
    let bestKnownScore = -Infinity;
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      if (el.querySelector && el.querySelector("canvas, button, input, textarea, select")) continue;
      const text = chunker.normalizeText(el.innerText);
      const score = chunker.scoreChapterText(text);
      if (score > bestKnownScore) {
        bestKnown = { text, source: "DOM" };
        bestKnownScore = score;
      }
    }
    if (bestKnown) return bestKnown;
    const hasCanvas = Boolean(document.querySelector(".wr_canvasContainer, .readerChapterContent canvas"));
    if (hasCanvas) {
      const passages = queryUniqueContainers(TEXT_LAYER_CONTAINER_SELECTORS);
      const visiblePages = passages.filter(isTextLayerPageVisible);
      const selectedPages = visiblePages.length ? visiblePages : passages;
      const pageTexts = [];
      const seenTexts = /* @__PURE__ */ new Set();
      for (const passage of selectedPages) {
        const text = reconstructTextLayerPageText(passage);
        if (text && !seenTexts.has(text)) {
          seenTexts.add(text);
          pageTexts.push(text);
        }
      }
      const joined = chunker.normalizeText(pageTexts.join("\n"));
      if (joined && chunker.isLikelyChapterText(joined)) {
        return { text: joined, source: "DOM:textLayer" };
      }
      const preRenderTexts = [];
      for (const container of queryUniqueContainers(PRE_RENDER_CONTAINER_SELECTORS)) {
        const text = chunker.normalizeText(getPreRenderDomText(container));
        if (text && !preRenderTexts.includes(text)) preRenderTexts.push(text);
      }
      const preRenderJoined = chunker.normalizeText(preRenderTexts.join("\n"));
      if (preRenderJoined && chunker.isLikelyChapterText(preRenderJoined)) {
        return { text: preRenderJoined, source: "DOM:textLayer" };
      }
      for (const selector of TEXT_LAYER_SELECTORS) {
        const nodes = typeof document.querySelectorAll === "function" ? Array.from(document.querySelectorAll(selector)) : [];
        const text = chunker.normalizeText(nodes.map((node) => getPreRenderDomText(node)).join(""));
        if (chunker.isLikelyChapterText(text)) return { text, source: "DOM:textLayer" };
      }
      const preRender = capturePreRenderDom(findAppElement());
      if (preRender && chunker.isLikelyChapterText(preRender.text)) {
        return { text: preRender.text, source: "DOM:preRender" };
      }
      return null;
    }
    let best = null;
    let bestScore = -Infinity;
    const app = findAppElement();
    const candidates = app ? app.querySelectorAll("div, article, main, section") : document.querySelectorAll("div, article, main, section");
    for (const el of candidates) {
      if (typeof el.closest === "function") {
        if (el.closest("#" + LEGACY_TTS_PANEL_ID)) continue;
        if (el.closest("#" + VOICE_QUICK_ID)) continue;
        if (el.closest(UI_CONTAINER_SELECTORS.join(","))) continue;
      }
      const text = getElementTextExcluding(el);
      const score = chunker.scoreChapterText(text);
      if (score <= 0) continue;
      if (score > bestScore) {
        best = { text, source: "DOM" };
        bestScore = score;
      }
    }
    return best;
  }
  async function extractCurrentChapterText(options = {}) {
    const { instances, readerVms, vm, readerState, uid, source } = refreshReaderContext();
    const expectedChapterUid = String(options.expectedChapterUid || "");
    if (expectedChapterUid && uid && expectedChapterUid !== uid) {
      return { text: "", source: "", chapterUid: uid };
    }
    const bookId = String(
      readProperty(readerState, "bookId") || readProperty(vm, "bookId") || ""
    );
    if (uid) {
      const apiResult = await apiChapter.waitForChapter(uid, {
        bookId,
        timeout: Number(options.apiTimeout ?? 1200),
        interval: 80
      });
      if (apiResult && String(apiResult.chapterUid) === String(uid)) {
        return rememberResult({
          text: apiResult.text,
          source: apiResult.source,
          chapterUid: uid
        });
      }
    }
    const entries = collectEntries(readerState, vm, uid, instances);
    const preferred = uid ? entries.filter((item) => item.chapterUid === uid) : [];
    const pool = uid ? preferred : entries;
    const texts = [];
    const seenTexts = /* @__PURE__ */ new Set();
    const probe = {
      preRenderAttempted: /* @__PURE__ */ new WeakSet(),
      toggleAttempted: /* @__PURE__ */ new WeakSet(),
      errors: []
    };
    for (const item of pool.slice(0, 20)) {
      const html = await decryptEntry(readerVms, item, item.chapterUid || uid || "0", item.index || 0, probe, instances);
      const text2 = htmlToText(html);
      if (!chunker.isLikelyChapterText(text2) || isStaleTextForChapter(uid, text2) || seenTexts.has(text2)) {
        continue;
      }
      seenTexts.add(text2);
      texts.push(text2);
    }
    const text = chunker.normalizeText(texts.join("\n"));
    if (chunker.isLikelyChapterText(text)) {
      return rememberResult({
        text,
        source: uid ? source + ":" + uid : source,
        chapterUid: uid
      });
    }
    const dom = readPreRenderDom(uid);
    if (dom) return rememberResult(dom);
    const cached = findCachedPlaintext(uniqueObjects([...instances, ...readerVms]), uid);
    if (cached) {
      return rememberResult({
        text: cached.text,
        source: cached.source,
        chapterUid: uid
      });
    }
    const decryptorCount = uniqueObjects([...readerVms, ...instances]).filter((candidate) => typeof readProperty(candidate, "decryptRenderHtml") === "function").length;
    const textLayerCount = typeof document.querySelectorAll === "function" ? document.querySelectorAll('#renderTargetContent [data-wr-role="text"], [data-wr-role="text"]').length : 0;
    warnExtractionFailure({
      uid,
      expectedChapterUid,
      source,
      vueInstanceCount: instances.length,
      readerVmCount: readerVms.length,
      decryptorCount,
      entryCount: entries.length,
      preferredEntryCount: preferred.length,
      readerStateKeys: readerState ? safeObjectKeys(readerState).slice(0, 80) : [],
      entryValueTypes: entries.slice(0, 20).map((item) => item.valueType || typeof item.value),
      decryptErrors: probe.errors.slice(0, 10),
      domHits: {
        preRender: queryPreRenderNodes().length,
        textLayer: textLayerCount,
        canvas: Boolean(document.querySelector(".wr_canvasContainer, .readerChapterContent canvas"))
      }
    });
    return { text: "", source: "", chapterUid: uid };
  }
  const PRE_RENDER_SELECTORS = ["#preRenderContent", "#preRenderContents", ".preRenderContent", ".preRenderContainer"];
  function queryPreRenderNodes(root) {
    const base = document;
    return base.querySelectorAll ? Array.from(base.querySelectorAll(PRE_RENDER_SELECTORS.join(","))) : [];
  }
  function getCanvasPageRects() {
    const nodes = typeof document.querySelectorAll === "function" ? Array.from(document.querySelectorAll(".wr_canvasContainer canvas, .readerChapterContent canvas")) : [];
    const rects = [];
    for (const canvas of nodes) {
      try {
        const rect = canvas.getBoundingClientRect();
        const top = rect.top + (window.scrollY || document.scrollingElement?.scrollTop || 0);
        const bottom = top + rect.height;
        if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top + 1) continue;
        rects.push({
          top,
          bottom,
          width: rect.width,
          height: rect.height
        });
      } catch (error) {
      }
    }
    rects.sort((a, b) => a.top - b.top);
    if (!rects.length) return [];
    const firstTop = rects[0].top;
    return rects.map((rect) => ({
      ...rect,
      relativeTop: rect.top - firstTop,
      relativeBottom: rect.bottom - firstTop
    }));
  }
  function getCurrentPageIndex(rects) {
    if (!rects || !rects.length) return 0;
    const doc = document.scrollingElement || document.documentElement;
    const scrollY = window.scrollY || doc?.scrollTop || 0;
    const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 800;
    const focusY = scrollY + Math.max(80, viewportHeight * 0.4);
    let bestIndex = 0;
    let bestOverlap = -1;
    for (let index = 0; index < rects.length; index += 1) {
      const rect = rects[index];
      const overlap = Math.min(focusY, rect.bottom) - Math.max(focusY, rect.top);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestIndex = index;
      }
    }
    if (bestOverlap > 0) return bestIndex;
    if (focusY < rects[0].top) return 0;
    if (focusY >= rects[rects.length - 1].bottom) return rects.length - 1;
    let nearest = 0;
    let nearestDistance = Infinity;
    for (let index = 0; index < rects.length; index += 1) {
      const distance = Math.min(Math.abs(focusY - rects[index].top), Math.abs(focusY - rects[index].bottom));
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    }
    return nearest;
  }
  function getPageControlSignature() {
    if (typeof document.querySelectorAll !== "function") return "";
    const labels = Array.from(document.querySelectorAll('button, a, [class*="button"], [class*="paging"]')).map((el) => (el.textContent || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim()).filter((text) => /上一页|下一页|下一章|上一章|下一页|下一章/.test(text));
    return labels.join(",");
  }
  function isLastChapterPageByControls() {
    if (typeof document.querySelectorAll !== "function") return null;
    const labels = Array.from(document.querySelectorAll('button, a, [class*="button"], [class*="paging"]')).map((el) => (el.textContent || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim()).filter(Boolean);
    const hasNextPage = labels.some((text) => text.includes("下一页"));
    const hasNextChapter = labels.some((text) => text.includes("下一章"));
    if (hasNextPage) return false;
    if (hasNextChapter) return true;
    return null;
  }
  function getCurrentPageSignature() {
    const rects = getCanvasPageRects();
    const doc = document.scrollingElement || document.documentElement;
    const scrollY = Math.round(window.scrollY || doc?.scrollTop || 0);
    return [
      rects.map((rect) => `${Math.round(rect.top)}:${Math.round(rect.bottom)}`).join("|"),
      getCurrentPageIndex(rects),
      scrollY,
      getPageControlSignature()
    ].join("#");
  }
  function getDynamicReaderStyleText() {
    try {
      const styleEl = document.querySelector("#renderTargetContent style, .renderTargetContent style");
      const css = styleEl?.textContent || "";
      if (!css) return "";
      const fontMatch = /font\s*:\s*([^;]+);/.exec(css);
      const lineHeightMatch = /line-height\s*:\s*([^;]+);/.exec(css);
      if (!fontMatch && !lineHeightMatch) return "";
      const rules = [];
      if (fontMatch) rules.push("font:" + fontMatch[1].trim() + ";");
      if (lineHeightMatch) rules.push("line-height:" + lineHeightMatch[1].trim() + ";");
      if (!rules.length) return "";
      return ".readerChapterContent .content{" + rules.join("") + "}";
    } catch (error) {
      return "";
    }
  }
  function createMeasuredChapterRoot(html, width, top) {
    if (!html || typeof DOMParser === "undefined" || !document?.body) return null;
    let doc;
    try {
      doc = new DOMParser().parseFromString(html, "text/html");
    } catch (error) {
      return null;
    }
    if (!doc?.body) return null;
    const root = document.createElement("div");
    root.className = "readerChapterContent wr-tts-measure-root";
    root.style.cssText = [
      "position:absolute",
      "left:-100000px",
      "top:" + (Number.isFinite(Number(top)) ? Number(top) : 0) + "px",
      "width:" + (Number(width) > 0 ? Number(width) : 600) + "px",
      "opacity:0",
      "pointer-events:none",
      "z-index:-1"
    ].join(";") + ";";
    while (doc.body.firstChild) root.appendChild(doc.body.firstChild);
    const dynamicCss = getDynamicReaderStyleText();
    if (dynamicCss) {
      const style = document.createElement("style");
      style.textContent = dynamicCss;
      root.appendChild(style);
    }
    document.body.appendChild(root);
    void root.offsetHeight;
    return root;
  }
  async function withMeasurableChapterDom(callback, options = {}) {
    const preRenderResult = await withPreRenderDomNode(async (root2) => {
      const result = await callback(root2, { hidden: false });
      return result === void 0 ? null : result;
    }, { probe: options.probe === false ? false : true });
    if (preRenderResult !== null) return preRenderResult;
    const uid = getLiveCachedChapterUid();
    const htmlInfo = apiChapter.getChapterHtml(uid, { requireChapterStart: true });
    if (!htmlInfo?.html) return null;
    const rects = getCanvasPageRects();
    const firstCanvas = rects[0];
    const width = firstCanvas?.width || document.querySelector(".wr_canvasContainer")?.clientWidth || 600;
    const root = createMeasuredChapterRoot(htmlInfo.html, width, firstCanvas?.top);
    if (!root) return null;
    try {
      const result = await callback(root, { hidden: true });
      return result === void 0 ? null : result;
    } finally {
      root.remove();
    }
  }
  function mapNormToRaw(raw, normOffset) {
    let rawIndex = 0;
    let normIndex = 0;
    let inWsRun = true;
    while (rawIndex < raw.length) {
      const ch = raw[rawIndex];
      if (ch === "​" || ch === "\uFEFF") {
        rawIndex += 1;
        continue;
      }
      if (/\s/.test(ch)) {
        if (!inWsRun) {
          inWsRun = true;
          if (normIndex === normOffset) return rawIndex;
          normIndex += 1;
        }
        rawIndex += 1;
        continue;
      }
      inWsRun = false;
      if (normIndex === normOffset) return rawIndex;
      normIndex += 1;
      rawIndex += 1;
    }
    return raw.length;
  }
  function collectAlignedTextSegments(root) {
    const normalizedText = chunker.normalizeText(root?.innerText || root?.textContent || "");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const segments = [];
    let searchFrom = 0;
    let node;
    while (node = walker.nextNode()) {
      const raw = node.nodeValue || "";
      const norm = chunker.normalizeText(raw);
      if (!norm) continue;
      const normStartInAcc = normalizedText.indexOf(norm, searchFrom);
      if (normStartInAcc < 0) continue;
      segments.push({ node, raw, norm, normStartInAcc });
      searchFrom = normStartInAcc + norm.length;
    }
    return { normalizedText, segments };
  }
  function findPhraseInDom(root, normPhrase, fromNormOffset) {
    if (!root || !normPhrase) return null;
    const { normalizedText, segments } = collectAlignedTextSegments(root);
    const matchIndex = normalizedText.indexOf(normPhrase, Math.max(0, fromNormOffset || 0));
    if (matchIndex < 0) return null;
    let segment = segments[segments.length - 1];
    for (let i = 0; i < segments.length; i += 1) {
      if (segments[i].normStartInAcc + segments[i].norm.length > matchIndex) {
        segment = segments[i];
        break;
      }
    }
    const localNormStart = matchIndex - segment.normStartInAcc;
    return {
      node: segment.node,
      rawOffset: mapNormToRaw(segment.raw, localNormStart),
      normOffset: matchIndex
    };
  }
  function findNormOffsetInDom(root, normOffset) {
    if (!root) return null;
    const { segments } = collectAlignedTextSegments(root);
    for (const segment of segments) {
      const segmentEnd = segment.normStartInAcc + segment.norm.length;
      if (segmentEnd > normOffset) {
        const localOffset = Math.max(0, normOffset - segment.normStartInAcc);
        return { node: segment.node, rawOffset: mapNormToRaw(segment.raw, localOffset), normOffset };
      }
    }
    return null;
  }
  function getFlowY(node, rawOffset) {
    if (!node || !node.nodeValue) return null;
    const range = document.createRange();
    const textLength = node.nodeValue.length;
    range.setStart(node, Math.min(Math.max(0, rawOffset), textLength));
    range.collapse(true);
    const rect = range.getBoundingClientRect();
    if (!rect || rect.width === 0 && rect.height === 0) return null;
    const doc = document.scrollingElement || document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop || 0;
    const y = rect.top + scrollTop;
    const maxY = Math.max(doc.scrollHeight || 0, document.body.scrollHeight || 0);
    if (y < 0 || y > maxY + 50) return null;
    return y;
  }
  async function ensurePreRenderDomNode() {
    const liveUid = getLiveCachedChapterUid();
    const cachedUid = extractorState.cachedPreRenderHtml?.chapterUid || "";
    if (extractorState.cachedPreRenderNode?.isConnected && (!liveUid || cachedUid === liveUid)) {
      return extractorState.cachedPreRenderNode;
    }
    const existing = queryPreRenderNodes()[0];
    if (existing) return existing;
    const instances = collectVueInstances();
    const store = getStore(instances);
    const readerVms = findReaderVms(instances);
    const vm = readerVms[0] || null;
    const uid = getCurrentChapterUid(getReaderState(store, vm), vm);
    for (const candidate of readerVms) {
      const canProbe = typeof candidate.preRender === "function" || "isShowPreRender" in candidate;
      if (!canProbe) continue;
      const prevShouldPreRender = candidate.shouldPreRender;
      const prevShowPreRender = candidate.isShowPreRender;
      try {
        if (typeof candidate.preRender === "function") {
          candidate.preRender(uid || "0");
        }
        if ("isShowPreRender" in candidate && !candidate.isShowPreRender) {
          candidate.isShowPreRender = true;
        }
        await nextTick(120);
        const found = queryPreRenderNodes()[0];
        if (found) return found;
      } catch (error) {
      } finally {
        if (prevShouldPreRender !== void 0) candidate.shouldPreRender = prevShouldPreRender;
        if (prevShowPreRender !== void 0 && candidate.isShowPreRender !== prevShowPreRender) {
          candidate.isShowPreRender = prevShowPreRender;
        }
      }
    }
    return null;
  }
  async function withPreRenderDomNode(callback, options = {}) {
    const tryNode = async (node) => {
      if (!node || !node.isConnected) return null;
      try {
        const result = await callback(node);
        return result === void 0 ? null : result;
      } catch (error) {
        return null;
      }
    };
    const immediate = [];
    const liveUid = getLiveCachedChapterUid();
    const cachedUid = extractorState.cachedPreRenderHtml?.chapterUid || "";
    if (extractorState.cachedPreRenderNode?.isConnected && (!liveUid || cachedUid === liveUid)) {
      immediate.push(extractorState.cachedPreRenderNode);
    }
    for (const node of queryPreRenderNodes()) {
      if (!immediate.includes(node)) immediate.push(node);
    }
    for (const node of immediate) {
      const result = await tryNode(node);
      if (result !== null) return result;
    }
    if (options.probe === false) return null;
    const instances = collectVueInstances();
    const store = getStore(instances);
    const readerVms = findReaderVms(instances);
    const vm = readerVms[0] || null;
    const uid = getCurrentChapterUid(getReaderState(store, vm), vm);
    for (const candidate of readerVms) {
      const canProbe = typeof candidate.preRender === "function" || "isShowPreRender" in candidate;
      if (!canProbe) continue;
      const prevShouldPreRender = candidate.shouldPreRender;
      const prevShowPreRender = candidate.isShowPreRender;
      try {
        if (typeof candidate.preRender === "function") candidate.preRender(uid || "0");
        if ("isShowPreRender" in candidate && !candidate.isShowPreRender) candidate.isShowPreRender = true;
        await nextTick(120);
        for (const node of queryPreRenderNodes()) {
          const result = await tryNode(node);
          if (result !== null) return result;
        }
      } catch (error) {
      } finally {
        if (prevShouldPreRender !== void 0) candidate.shouldPreRender = prevShouldPreRender;
        if (prevShowPreRender !== void 0 && candidate.isShowPreRender !== prevShowPreRender) {
          candidate.isShowPreRender = prevShowPreRender;
        }
      }
    }
    return null;
  }
  function rememberFirstPageEnd(chapterUid, pageCount, endIndex) {
    if (!chapterUid || !pageCount || !Number.isFinite(endIndex)) return;
    const key = chapterUid + ":" + pageCount;
    pageBoundaryCache.set(key, { firstPageEndIndex: endIndex, updatedAt: Date.now() });
    writePageBoundaryCacheToStorage();
  }
  function getCachedFirstPageEnd(chapterUid, pageCount) {
    if (!chapterUid || !pageCount) return null;
    const key = chapterUid + ":" + pageCount;
    if (pageBoundaryCache.has(key)) {
      const entry2 = pageBoundaryCache.get(key);
      return entry2 ? entry2.firstPageEndIndex : null;
    }
    const stored = readPageBoundaryCacheFromStorage();
    const entry = stored[key];
    if (entry && Number.isFinite(entry.firstPageEndIndex)) {
      pageBoundaryCache.set(key, entry);
      return entry.firstPageEndIndex;
    }
    return null;
  }
  async function extractCurrentPageContext(options = {}) {
    const text = chunker.normalizeText(options.text || "");
    if (!chunker.isPlausibleText(text)) return null;
    const chapterUid = String(options.chapterUid || getLiveCachedChapterUid());
    const rects = getCanvasPageRects();
    const pageCount = Math.max(1, rects.length);
    let pageIndex = rects.length ? getCurrentPageIndex(rects) : 0;
    const controlsLast = isLastChapterPageByControls();
    const isLastChapterPage = controlsLast === null ? pageIndex >= pageCount - 1 : controlsLast;
    if (controlsLast !== null && pageCount > 1) {
      pageIndex = controlsLast ? pageCount - 1 : 0;
    }
    const currentRect = rects[pageIndex] || null;
    const pageStartY = currentRect?.top ?? null;
    const pageEndY = currentRect?.bottom ?? null;
    const pageSignature = getCurrentPageSignature();
    if (typeof document.querySelectorAll === "function") {
      const passages = queryUniqueContainers(TEXT_LAYER_CONTAINER_SELECTORS);
      const visible = passages.filter(isTextLayerPageVisible);
      const selected = visible.length ? visible : passages;
      const pageTexts = [];
      for (const passage of selected) {
        const pageText = reconstructTextLayerPageText(passage);
        if (pageText) pageTexts.push(pageText);
      }
      if (pageTexts.length) {
        const combinedText = pageTexts.join("");
        const range = findApproximateTextRange(text, combinedText) || pageTexts.map((item) => findApproximateTextRange(text, item)).find(Boolean);
        if (range) {
          let pageStartIndex = Math.max(0, Math.min(text.length, range.start));
          let pageEndIndex = Math.max(pageStartIndex + 1, Math.min(text.length, range.end));
          if (!isLastChapterPage && pageIndex === 0 && pageCount > 1) {
            pageStartIndex = 0;
          }
          if (!isLastChapterPage) {
            rememberFirstPageEnd(chapterUid, pageCount, pageEndIndex);
          }
          return {
            pageStartIndex,
            pageEndIndex,
            pageIndex,
            pageCount,
            isLastChapterPage,
            pageStartY,
            pageEndY,
            pageSignature,
            pageSource: "text-layer"
          };
        }
      }
    }
    if (isLastChapterPage && pageCount > 1) {
      const cachedEnd = getCachedFirstPageEnd(chapterUid, pageCount);
      if (cachedEnd && cachedEnd > 0 && cachedEnd < text.length) {
        return {
          pageStartIndex: cachedEnd,
          pageEndIndex: text.length,
          pageIndex: pageCount - 1,
          pageCount,
          isLastChapterPage: true,
          pageStartY,
          pageEndY,
          pageSignature,
          pageSource: "cached-page-boundary"
        };
      }
    }
    if (rects.length > 1 && currentRect) {
      const totalHeight = rects[rects.length - 1].relativeBottom;
      if (Number.isFinite(totalHeight) && totalHeight > 0) {
        const startFraction = Math.min(1, Math.max(0, currentRect.relativeTop / totalHeight));
        const endFraction = Math.min(1, Math.max(startFraction, currentRect.relativeBottom / totalHeight));
        const pageStartIndex = Math.min(text.length, Math.round(text.length * startFraction));
        const pageEndIndex = Math.max(pageStartIndex + 1, Math.min(text.length, Math.round(text.length * endFraction)));
        return {
          pageStartIndex,
          pageEndIndex,
          pageIndex,
          pageCount,
          isLastChapterPage,
          pageStartY,
          pageEndY,
          pageSignature,
          pageSource: "ratio"
        };
      }
    }
    return {
      pageStartIndex: 0,
      pageEndIndex: text.length,
      pageIndex,
      pageCount,
      isLastChapterPage,
      pageStartY,
      pageEndY,
      pageSignature,
      pageSource: "whole-chapter"
    };
  }
  const extractor = {
    clearCache() {
      extractorState.cachedStore = null;
      extractorState.cachedVm = null;
      extractorState.cachedReaderState = null;
      resetPreRenderCache();
      extractorState.currentChapterUid = "";
      extractorState.lastResult = null;
      extractorState.webpackRequire = null;
      extractorState.webpackStore = null;
      extractorState.webpackDecryption = null;
      extractorState.webpackVm = null;
      extractorState.webpackDiagnostic = null;
      extractorState.lastDiagnosticSignature = "";
      apiChapter.clearCache();
    },
    getCurrentChapterUid(options = {}) {
      if (options.refresh) return refreshReaderContext().uid;
      const uid = getLiveCachedChapterUid();
      if (uid) return uid;
      return options.refreshIfMissing ? refreshReaderContext().uid : "";
    },
    getLegacyDomText,
    getDiagnostics() {
      return extractorState.webpackDiagnostic ? { ...extractorState.webpackDiagnostic } : null;
    },
    /**
     * 轻量获取当前可用的预渲染 DOM 节点（不做任何渲染触发）。
     * 用于朗读中逐块校准：拿不到就跳过本次校准，避免干扰阅读器渲染。
     */
    peekPreRenderDom() {
      const liveUid = getLiveCachedChapterUid();
      const cachedUid = extractorState.cachedPreRenderHtml?.chapterUid || "";
      if (extractorState.cachedPreRenderNode?.isConnected && (!liveUid || cachedUid === liveUid)) {
        return extractorState.cachedPreRenderNode;
      }
      return queryPreRenderNodes()[0] || null;
    },
    /** 播放前获取可测量的预渲染 DOM；运行中可传 probe:false，禁止触发渲染。 */
    async getPreRenderDom(options = {}) {
      if (options.probe === false) return this.peekPreRenderDom();
      return ensurePreRenderDomNode();
    },
    async withPreRenderDom(callback, options = {}) {
      if (typeof callback !== "function") return null;
      return withMeasurableChapterDom(callback, options);
    },
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
    async extractCurrentChapterText(options = {}) {
      return extractCurrentChapterText(options);
    },
    extractCurrentPageContext(options = {}) {
      return extractCurrentPageContext(options);
    },
    getCurrentPageSignature() {
      return getCurrentPageSignature();
    },
    getCanvasPageRects() {
      return getCanvasPageRects();
    },
    /**
     * 定位正文中某归一化文本偏移处的页面位置（文档流 y 坐标）。
     * - phrase 非空时优先按短语在预渲染 DOM 中搜索（与 applyRange 匹配口径一致）；
     * - 短语搜索失败再退化为纯偏移定位；
     * - 仍失败返回 null（调用方降级为比例估算）。
     * @param {number} normOffset 整章归一化文本中的字符偏移
     * @param {string} [phrase] 该偏移附近的短语（用于校验与搜索）
     * @param {number} [fromNormOffset] 短语搜索起点（归一化偏移）
     * @returns {Promise<{ y: number } | null>}
     */
    locateTextOffsetInTextLayer(normOffset, phrase) {
      if (phrase) return locatePhraseInTextLayer(chunker.normalizeText(phrase));
      return null;
    },
    findTextLayerBoundary(text) {
      return findTextLayerBoundary(text);
    },
    getFirstTextLayerOffsetAtCurrentScroll(text) {
      const normText = chunker.normalizeText(text || "");
      if (!normText || typeof document.querySelectorAll !== "function") return null;
      const passages = queryUniqueContainers(TEXT_LAYER_CONTAINER_SELECTORS);
      for (const passage of passages) {
        const pageText = reconstructTextLayerPageText(passage);
        if (!pageText) continue;
        const range = findApproximateTextRange(normText, pageText);
        if (range) {
          const doc = document.scrollingElement || document.documentElement;
          return { scroll: window.scrollY || doc.scrollTop || 0, offset: range.start };
        }
      }
      return null;
    },
    async locateTextOffset(normOffset, phrase, fromNormOffset, options = {}) {
      if (phrase) {
        const layerLoc = locatePhraseInTextLayer(chunker.normalizeText(phrase));
        if (layerLoc) return layerLoc;
      }
      return withPreRenderDomNode((root) => {
        const safeOffset = Math.max(0, Number(normOffset) || 0);
        let found = null;
        if (phrase) {
          found = findPhraseInDom(root, chunker.normalizeText(phrase), fromNormOffset);
        }
        if (!found) found = findNormOffsetInDom(root, safeOffset);
        if (!found) return null;
        const y = getFlowY(found.node, found.rawOffset);
        return y === null ? null : { y };
      }, options);
    }
  };
  const DEFAULT_HANDLERS = {
    onStateChange() {
    },
    onChunkStart() {
    },
    onBoundary() {
    },
    onChunkEnd() {
    },
    onFinish() {
    },
    onError() {
    }
  };
  function now() {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }
  function normalizeChunk(chunk, fallbackStart = 0) {
    if (typeof chunk === "string") {
      return { text: chunk, startOffset: fallbackStart, endOffset: fallbackStart + chunk.length };
    }
    const text = String(chunk?.text || "");
    const startOffset = Number.isFinite(chunk?.startOffset) ? chunk.startOffset : fallbackStart;
    const endOffset = Number.isFinite(chunk?.endOffset) ? chunk.endOffset : startOffset + text.length;
    return { ...chunk, text, startOffset, endOffset };
  }
  const speechEngine = {
    available: typeof window !== "undefined" && "speechSynthesis" in window,
    chunks: [],
    index: 0,
    rate: 1,
    voiceURI: "",
    utterance: null,
    /** 当前 chunk 开始朗读的时间戳，用于估算块内朗读进度以对齐滚动 */
    chunkStartTime: 0,
    /** 暂停时刻，恢复时用来扣除暂停占用的时间，避免进度估算跳变 */
    pausedAt: 0,
    /** 当前 chunk 内累计的暂停时长（ms），计算真实朗读耗时与进度时扣除 */
    pausedTotalMs: 0,
    /** 当前 chunk 最近一次 boundary 事件报告的字符位置（无事件为 -1） */
    boundaryCharIndex: -1,
    /** 本会话是否收到过 boundary 事件（用于检测音色是否支持词边界） */
    boundarySeen: false,
    /** 已完成 chunk 的真实耗时记录 [{ chars, ms, rate }]，供自适应语速校准 */
    chunkTimings: [],
    stopped: true,
    paused: false,
    playing: false,
    restarting: false,
    pendingRestartOffset: null,
    errorRetryCount: 0,
    handlers: DEFAULT_HANDLERS,
    setHandlers(handlers) {
      Object.assign(this.handlers, handlers);
    },
    getChunk(index) {
      let fallbackStart = 0;
      for (let i = 0; i < index; i += 1) {
        const item = normalizeChunk(this.chunks[i], fallbackStart);
        fallbackStart = item.endOffset;
      }
      return normalizeChunk(this.chunks[index], fallbackStart);
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
      this.pendingRestartOffset = null;
      this.chunkStartTime = 0;
      this.pausedAt = 0;
      this.pausedTotalMs = 0;
      this.boundaryCharIndex = -1;
      this.boundarySeen = false;
      this.chunkTimings = [];
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
      this.errorRetryCount = 0;
      const chunk = this.getChunk(index);
      const utterance = new SpeechSynthesisUtterance(chunk.text);
      const voice = this.getSelectedVoice();
      utterance.rate = this.rate;
      utterance.pitch = 1;
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = "zh-CN";
      }
      this.boundaryCharIndex = -1;
      this.pausedTotalMs = 0;
      utterance.onstart = () => {
        if (this.stopped || this.restarting) return;
        this.chunkStartTime = now();
        this.playing = true;
        this.paused = false;
        this.index = index;
        this.handlers.onChunkStart(index, { at: this.chunkStartTime, chunk });
        this.handlers.onStateChange();
      };
      utterance.onboundary = (event) => {
        if (this.stopped || this.restarting || this.paused) return;
        const rawIndex = event && Number.isFinite(event.charIndex) ? event.charIndex : -1;
        const chunkText = chunk.text;
        if (rawIndex < 0 || rawIndex > chunkText.length) return;
        if (rawIndex < this.boundaryCharIndex) return;
        const receivedAt = now();
        const elapsedSeconds = Number(event?.elapsedTime);
        const observedAt = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? Math.min(receivedAt, this.chunkStartTime + elapsedSeconds * 1e3) : receivedAt;
        this.boundaryCharIndex = rawIndex;
        this.boundarySeen = true;
        this.handlers.onBoundary(index, {
          at: observedAt,
          charIndex: rawIndex,
          globalOffset: chunk.startOffset + rawIndex,
          chunk,
          name: event?.name || ""
        });
      };
      utterance.onend = () => {
        if (this.stopped || this.paused || this.restarting) return;
        const endedAt = now();
        const durationMs = Math.max(1, endedAt - this.chunkStartTime - this.pausedTotalMs);
        const chunkText = chunk.text;
        this.chunkTimings.push({ chars: chunkText.length, ms: durationMs, rate: this.rate });
        if (this.chunkTimings.length > 12) this.chunkTimings.shift();
        this.handlers.onChunkEnd(index, { at: endedAt, durationMs, chunk });
        this.index += 1;
        this.speakChunk(this.index);
      };
      utterance.onerror = (event) => {
        if (event && ["interrupted", "canceled"].includes(event.error)) return;
        if (event && event.error === "not-allowed") {
          this.handlers.onError("浏览器阻止语音，请先点击页面任意位置后重试", true);
          return;
        }
        if (this.errorRetryCount < 1) {
          this.errorRetryCount += 1;
          this.cancelCurrent();
          window.setTimeout(() => this.speakChunk(this.index), 150);
          return;
        }
        this.handlers.onError("语音朗读出错，请重试", false);
      };
      this.utterance = utterance;
      this.chunkStartTime = now();
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
        this.pausedAt = now();
        this.handlers.onStateChange();
        return;
      }
      this.paused = true;
      this.pausedAt = now();
      this.cancelCurrent();
      this.handlers.onStateChange();
    },
    resume() {
      if (!this.available || !this.paused) return;
      if (Number.isFinite(this.pendingRestartOffset)) {
        const index2 = this.index;
        this.trimCurrentChunkTo(this.pendingRestartOffset);
        this.pendingRestartOffset = null;
        this.adjustChunkStartTimeAfterPause();
        this.restarting = true;
        this.paused = false;
        this.cancelCurrent();
        window.setTimeout(() => {
          this.restarting = false;
          this.speakChunk(index2);
        }, 120);
        this.handlers.onStateChange();
        return;
      }
      if (typeof window.speechSynthesis.resume === "function") {
        window.speechSynthesis.resume();
        this.paused = false;
        this.adjustChunkStartTimeAfterPause();
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
    /** 从当前 chunk 的已确认字符位置重启，避免改速/换音色时整块回读。 */
    trimCurrentChunkTo(globalOffset) {
      if (this.stopped || !this.chunks.length) return;
      const chunk = this.getChunk(this.index);
      const safeOffset = Math.min(chunk.endOffset - 1, Math.max(chunk.startOffset, Number(globalOffset) || chunk.startOffset));
      const localOffset = Math.max(0, safeOffset - chunk.startOffset);
      if (localOffset > 0 && localOffset < chunk.text.length) {
        this.chunks[this.index] = {
          ...chunk,
          text: chunk.text.slice(localOffset),
          startOffset: safeOffset
        };
      }
    },
    restartCurrentChunkFrom(globalOffset) {
      this.trimCurrentChunkTo(globalOffset);
      this.restartCurrentChunk();
    },
    applyRate(rate, resumeOffset) {
      this.rate = rate;
      if (this.playing && !this.paused && !this.stopped) {
        if (Number.isFinite(resumeOffset)) this.restartCurrentChunkFrom(resumeOffset);
        else this.restartCurrentChunk();
      } else if (this.paused && !this.stopped) {
        this.pendingRestartOffset = Number.isFinite(resumeOffset) ? resumeOffset : this.getChunk(this.index).startOffset;
      }
      this.handlers.onStateChange();
    },
    setVoice(voiceURI, resumeOffset) {
      this.voiceURI = voiceURI || "";
      if (this.playing && !this.paused && !this.stopped) {
        if (Number.isFinite(resumeOffset)) this.restartCurrentChunkFrom(resumeOffset);
        else this.restartCurrentChunk();
      } else if (this.paused && !this.stopped) {
        this.pendingRestartOffset = Number.isFinite(resumeOffset) ? resumeOffset : this.getChunk(this.index).startOffset;
      }
      this.handlers.onStateChange();
    },
    adjustChunkStartTimeAfterPause() {
      if (this.pausedAt > 0) {
        const pausedMs = now() - this.pausedAt;
        this.pausedTotalMs += pausedMs;
        this.pausedAt = 0;
      }
    },
    stop() {
      this.stopped = true;
      this.paused = false;
      this.playing = false;
      this.chunkStartTime = 0;
      this.pausedAt = 0;
      this.pausedTotalMs = 0;
      this.boundaryCharIndex = -1;
      this.boundarySeen = false;
      this.pendingRestartOffset = null;
      this.chunkTimings = [];
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
    if (value === null || value === void 0 || value === "") return fallback;
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
  function clamp$1(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  let scrollbarWidth = 0;
  const EDGE_SNAP_THRESHOLD = 60;
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
    const nextLeft = edge === "left" ? 0 : edge === "right" ? viewportWidth - width - rightGap : clamp$1(left, 0, viewportWidth - width);
    const nextTop = edge === "top" ? 0 : edge === "bottom" ? viewportHeight - height : clamp$1(top, 0, viewportHeight - height);
    return { left: nextLeft, top: nextTop, edge };
  }
  function isPositionUsable(saved) {
    if (!saved || !Number.isFinite(saved.left) || !Number.isFinite(saved.top)) return false;
    const width = saved.width || 140;
    const height = saved.height || 44;
    const margin = 24;
    if (saved.left < margin - width || saved.left > window.innerWidth - margin) return false;
    if (saved.top < margin - height || saved.top > window.innerHeight - margin) return false;
    return true;
  }
  function initQuickBarDrag(bar) {
    const saved = GM_getValue("wr_voice_quick_position", null);
    if (isPositionUsable(saved)) {
      bar.style.left = `${saved.left}px`;
      bar.style.top = `${saved.top}px`;
      bar.style.right = "auto";
      bar.style.bottom = "auto";
    }
    bar.classList.remove("edge-hidden");
    delete bar.dataset.edge;
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
    });
    document.addEventListener("mouseup", () => {
      if (!isDragging) {
        return;
      }
      isDragging = false;
      bar.classList.remove("dragging");
      const left = parseInt(bar.style.left, 10) || 0;
      const top = parseInt(bar.style.top, 10) || 0;
      const width = bar.offsetWidth;
      const height = bar.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const minEdgeDistance = Math.min(
        Math.abs(left),
        Math.abs(viewportWidth - width - left),
        Math.abs(top),
        Math.abs(viewportHeight - height - top)
      );
      if (minEdgeDistance <= EDGE_SNAP_THRESHOLD) {
        const snap = getSnapPosition(bar, left, top);
        bar.style.left = `${snap.left}px`;
        bar.style.top = `${snap.top}px`;
        delete bar.dataset.edge;
        bar.classList.remove("edge-hidden");
        GM_setValue("wr_voice_quick_position", {
          left: snap.left,
          top: snap.top,
          edge: snap.edge,
          edgeHidden: false,
          width,
          height
        });
      } else {
        const clampedLeft = clamp$1(left, 0, Math.max(0, viewportWidth - width));
        const clampedTop = clamp$1(top, 0, Math.max(0, viewportHeight - height));
        bar.style.left = `${clampedLeft}px`;
        bar.style.top = `${clampedTop}px`;
        delete bar.dataset.edge;
        bar.classList.remove("edge-hidden");
        GM_setValue("wr_voice_quick_position", {
          left: clampedLeft,
          top: clampedTop,
          edge: "",
          edgeHidden: false,
          width,
          height
        });
      }
    });
    return {
      reset() {
        bar.classList.remove("edge-hidden");
        delete bar.dataset.edge;
      }
    };
  }
  const DEFAULT_CPS_AT_1X = 4.5;
  const MAX_FRAME_SECONDS = 0.1;
  const PHASE_GAIN = 4.5;
  const MAX_ACCELERATION = 40;
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function getChunk(chunks, index) {
    const chunk = chunks[index];
    if (!chunk) return null;
    if (typeof chunk === "string") {
      let startOffset = 0;
      for (let i = 0; i < index; i += 1) {
        startOffset += String(chunks[i] || "").length;
      }
      return { text: chunk, startOffset, endOffset: startOffset + chunk.length };
    }
    return chunk;
  }
  class SpeechClock {
    constructor() {
      this.reset();
    }
    reset() {
      this.chunks = [];
      this.rate = 1;
      this.fallbackCps = DEFAULT_CPS_AT_1X;
      this.rangeStart = 0;
      this.rangeEnd = 0;
      this.position = 0;
      this.velocity = 0;
      this.currentIndex = -1;
      this.lastTickAt = 0;
      this.chunkStartedAt = 0;
      this.lastObservation = null;
      this.previousObservation = null;
      this.observedVelocity = null;
      this.confirmedOffset = 0;
      this.boundarySeen = false;
      this.paused = false;
      this.pausedAt = 0;
      this.running = false;
    }
    configure({ chunks, rate, fallbackCps, rangeStart, rangeEnd }) {
      this.reset();
      this.chunks = chunks || [];
      this.rate = Math.max(0.1, Number(rate) || 1);
      this.fallbackCps = Math.max(0.1, Number(fallbackCps) || DEFAULT_CPS_AT_1X);
      const first = getChunk(this.chunks, 0);
      const last = getChunk(this.chunks, this.chunks.length - 1);
      this.rangeStart = Number.isFinite(rangeStart) ? rangeStart : first?.startOffset || 0;
      this.rangeEnd = Number.isFinite(rangeEnd) ? rangeEnd : last?.endOffset || this.rangeStart;
      this.position = this.rangeStart;
      this.confirmedOffset = this.rangeStart;
      this.velocity = this.fallbackCps * this.rate;
    }
    getBaseVelocity() {
      if (Number.isFinite(this.observedVelocity)) return this.observedVelocity;
      return this.fallbackCps * this.rate;
    }
    advance(now2) {
      const time = Number(now2) || 0;
      if (!this.running || this.paused) return this.position;
      if (!this.lastTickAt) {
        this.lastTickAt = time;
        return this.position;
      }
      const dt = clamp((time - this.lastTickAt) / 1e3, 0, MAX_FRAME_SECONDS);
      this.lastTickAt = time;
      if (!dt) return this.position;
      const chunk = getChunk(this.chunks, this.currentIndex);
      if (!chunk) return this.position;
      const baseVelocity = this.getBaseVelocity();
      const observation = this.lastObservation || {
        offset: chunk.startOffset,
        at: this.chunkStartedAt || time
      };
      const observationAge = Math.max(0, (time - observation.at) / 1e3);
      const projectedOffset = Math.min(chunk.endOffset, observation.offset + baseVelocity * observationAge);
      const phaseError = projectedOffset - this.position;
      const desiredVelocity = clamp(
        baseVelocity + PHASE_GAIN * phaseError,
        0,
        Math.max(4, baseVelocity * 3)
      );
      const velocityDelta = clamp(
        desiredVelocity - this.velocity,
        -MAX_ACCELERATION * dt,
        MAX_ACCELERATION * dt
      );
      this.velocity = Math.max(0, this.velocity + velocityDelta);
      this.position = clamp(this.position + this.velocity * dt, this.rangeStart, chunk.endOffset);
      return this.position;
    }
    startChunk(index, now2, observedStartOffset) {
      const chunk = getChunk(this.chunks, index);
      if (!chunk) return;
      const time = Number(now2) || 0;
      const startOffset = clamp(
        Number.isFinite(observedStartOffset) ? observedStartOffset : chunk.startOffset,
        chunk.startOffset,
        chunk.endOffset
      );
      this.advance(time);
      this.currentIndex = index;
      this.chunkStartedAt = time;
      this.lastTickAt = time;
      this.running = true;
      this.paused = false;
      this.previousObservation = this.lastObservation;
      this.lastObservation = { offset: startOffset, at: time, source: "chunk-start" };
      this.confirmedOffset = Math.max(this.confirmedOffset, startOffset);
      if (this.position < startOffset) this.position = startOffset;
    }
    observeBoundary(index, charIndex, now2) {
      const chunk = getChunk(this.chunks, index);
      if (!chunk) return;
      const time = Number(now2) || 0;
      this.advance(time);
      const local = clamp(Number(charIndex) || 0, 0, chunk.text.length);
      const offset = clamp(chunk.startOffset + local, chunk.startOffset, chunk.endOffset);
      if (this.lastObservation && offset < this.lastObservation.offset) return;
      if (this.lastObservation) {
        const seconds = (time - this.lastObservation.at) / 1e3;
        const chars = offset - this.lastObservation.offset;
        if (seconds > 0.04 && chars > 0) {
          const sample = clamp(chars / seconds, 0.1, 30);
          this.observedVelocity = Number.isFinite(this.observedVelocity) ? this.observedVelocity * 0.7 + sample * 0.3 : sample;
        }
      }
      this.previousObservation = this.lastObservation;
      this.lastObservation = { offset, at: time, source: "boundary" };
      this.confirmedOffset = Math.max(this.confirmedOffset, offset);
      this.boundarySeen = true;
    }
    finishChunk(index, now2) {
      const chunk = getChunk(this.chunks, index);
      if (!chunk) return;
      const time = Number(now2) || 0;
      this.advance(time);
      this.previousObservation = this.lastObservation;
      this.lastObservation = { offset: chunk.endOffset, at: time, source: "chunk-end" };
      this.confirmedOffset = Math.max(this.confirmedOffset, chunk.endOffset);
    }
    pause(now2) {
      const time = Number(now2) || 0;
      this.advance(time);
      this.paused = true;
      this.pausedAt = time;
    }
    resume(now2) {
      const time = Number(now2) || 0;
      if (this.pausedAt && this.lastObservation) {
        this.lastObservation.at += Math.max(0, time - this.pausedAt);
      }
      this.paused = false;
      this.pausedAt = 0;
      this.lastTickAt = time;
    }
    setRate(rate) {
      this.rate = Math.max(0.1, Number(rate) || 1);
    }
    setFallbackCps(cps) {
      this.fallbackCps = Math.max(0.1, Number(cps) || DEFAULT_CPS_AT_1X);
    }
    resetObservations(offset, now2) {
      const time = Number(now2) || 0;
      const safeOffset = clamp(Number(offset) || this.position, this.rangeStart, this.rangeEnd);
      this.previousObservation = null;
      this.observedVelocity = null;
      this.lastObservation = { offset: safeOffset, at: time, source: "reset" };
      this.confirmedOffset = Math.max(this.confirmedOffset, safeOffset);
      this.lastTickAt = time;
      this.velocity = this.fallbackCps * this.rate;
      if (this.paused) this.pausedAt = time;
    }
    getOffset(now2) {
      return this.advance(now2);
    }
    getConfirmedOffset() {
      return this.confirmedOffset;
    }
    getProgress(now2) {
      const offset = this.getOffset(now2);
      const span = Math.max(1, this.rangeEnd - this.rangeStart);
      return {
        offset,
        charsRead: clamp(offset - this.rangeStart, 0, span),
        totalChars: span,
        fraction: clamp((offset - this.rangeStart) / span, 0, 1)
      };
    }
  }
  const QUICK_BAR_ID = "wr-voice-quick";
  const CPS_PROFILES_KEY = "weread_tts_cps_profiles";
  const CHAPTER_WAIT_TIMEOUT_MS = 15e3;
  const CHAPTER_LOAD_RETRY_COUNT = 4;
  const RANGE_SCROLL_TOP_PADDING = 80;
  let quickBarController = null;
  const voiceState = {
    chapterUid: "",
    source: "",
    rangePolicy: "dynamic",
    loading: false,
    waitingForChapter: false,
    chapterWatcher: null,
    chapterWaitTimer: null,
    initialized: false,
    /** 当前正在朗读的正文长度（字符数），用于 pace 估算朗读时长以匹配滚动速度 */
    textLength: 0,
    /** 范围定位：起止文字在整章归一化文本中的绝对偏移与总长 */
    rangeStartIndex: 0,
    rangeEndIndex: 0,
    rangeTotalLength: 0,
    /** 当前可见页在整章归一化文本中的边界（Canvas 分页朗读的核心） */
    pageStartIndex: 0,
    pageEndIndex: 0,
    pageIndex: 0,
    pageCount: 1,
    isLastChapterPage: true,
    pageSignature: "",
    /** 预渲染 DOM 实测到的起止 y 坐标（文档流内），null 表示未定位成功 */
    rangeStartY: null,
    rangeEndY: null,
    /** 朗读开始时已经用文本层真实坐标对齐过的 scrollTop；滚动跟随以此为锚点 */
    rangeStartScrollTop: null,
    /** 是否正在异步定位“从文字”起点（期间滚动保持原位，避免两次跳变） */
    locatePending: false,
    /** 会话序号：每次开始/停止朗读自增，用于丢弃过期的异步定位结果 */
    sessionId: 0,
    /** 跳转序号：每次点击“确定范围”/“清除范围”自增，丢弃过期的定位跳转结果 */
    jumpToken: 0,
    /** L1 检测：当前音色是否支持 boundary 事件（null=未检测，false=不支持） */
    boundarySupported: null,
    /** L2 校准：归一化到 1x 语速的字/秒样本（最近完成 chunk 的真实耗时反推） */
    cpsSamples: [],
    /** L2 当前预测的 1x 字/秒；未校准时为 pace 默认常量 */
    calibratedCps: pace.CHARS_PER_SECOND_AT_1X,
    /** L3 锚点表：[{ charOffset, err }] 升序，err = DOM 实测 y - 线性映射 y */
    scrollAnchors: [],
    /** 是否正在异步测量锚点（防并发重复测量） */
    anchorMeasuring: false,
    /** 锚点源校验缓存：{ node, textLength }，避免每个块边界重复读取 innerText 造成卡顿 */
    anchorSourceCache: { node: null, textLength: 0 },
    /** 当前整章规范化文本与带绝对偏移的语音块 */
    chapterText: "",
    timelineChunks: [],
    /** 连续语音字符时钟。boundary 只作观测，不直接改页面位置。 */
    speechClock: new SpeechClock(),
    /** 播放前建立的真实行 y 表；不可用时降级到线性映射 + 锚点。 */
    layoutMap: null,
    layoutMode: "ratio",
    layoutVersion: 0,
    layoutResizeObserver: null,
    layoutRefreshTimer: null,
    sessionAbortController: null,
    realigning: false,
    autoPausedReason: "",
    manualResumeTimer: null,
    settingResumeTimer: null,
    manualPointerActive: false,
    visibilityShouldResume: false,
    lastDebugSampleAt: 0
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
      apiChapter.ensureHooked();
      extractor.startPreRenderObserver();
      speechEngine.setHandlers({
        onStateChange: () => this.syncPlaybackUI(),
        onChunkStart: (index, event) => {
          voiceState.speechClock.startChunk(index, event?.at || performance.now(), event?.chunk?.startOffset);
          this.scheduleAnchorMeasurement(index);
        },
        onBoundary: (index, event) => {
          voiceState.boundarySupported = true;
          voiceState.speechClock.observeBoundary(index, event?.charIndex, event?.at || performance.now());
        },
        onChunkEnd: (index, event) => {
          voiceState.speechClock.finishChunk(index, event?.at || performance.now());
        },
        onFinish: () => this.handleFinish(),
        onError: (message, retryable) => {
          utils.notificationManager.show(message);
          this.stop({ silent: true, hideBar: !retryable });
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
      $(window).on("resize", () => this.scheduleLayoutRefresh("resize"));
      document.fonts?.addEventListener?.("loadingdone", () => this.scheduleLayoutRefresh("fonts"));
      document.addEventListener("visibilitychange", () => this.handleVisibilityChange());
      document.addEventListener("wheel", () => this.handleManualScroll(), { passive: true });
      document.addEventListener("touchstart", () => {
        voiceState.manualPointerActive = true;
        this.handleManualScroll();
      }, { passive: true });
      document.addEventListener("touchend", () => {
        voiceState.manualPointerActive = false;
        this.handleManualScroll();
      }, { passive: true });
      document.addEventListener("pointerdown", (event) => {
        if (event.target?.closest?.(".voice-quick, .control-panel")) return;
        if (event.clientX < (window.innerWidth || 0) - 24) return;
        voiceState.manualPointerActive = true;
        this.handleManualScroll();
      }, { passive: true });
      document.addEventListener("pointerup", () => {
        if (!voiceState.manualPointerActive) return;
        voiceState.manualPointerActive = false;
        this.handleManualScroll();
      }, { passive: true });
      document.addEventListener("keydown", (event) => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"].includes(event.key)) {
          this.handleManualScroll();
        }
      });
    },
    start(options = {}) {
      if (!speechEngine.available) {
        utils.notificationManager.show("当前浏览器不支持语音合成");
        return Promise.resolve();
      }
      return this.loadAndSpeak(options);
    },
    waitForPageTurn(signal) {
      if (!appState.isPageTurning) return Promise.resolve(true);
      const startedAt = performance.now();
      return new Promise((resolve) => {
        const check = () => {
          if (signal?.aborted) {
            resolve(false);
            return;
          }
          if (!appState.isPageTurning || performance.now() - startedAt > 5e3) {
            resolve(true);
            return;
          }
          window.setTimeout(check, 50);
        };
        check();
      });
    },
    async extractReadableChapter(options, signal) {
      const expectedChapterUid = String(options.expectedChapterUid || "");
      const rejectedText = chunker.normalizeText(options.rejectText || "");
      const attempts = options.continuation ? CHAPTER_LOAD_RETRY_COUNT : Math.max(CHAPTER_LOAD_RETRY_COUNT, 5);
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (signal?.aborted) return null;
        try {
          const result = await extractor.extractCurrentChapterText({ expectedChapterUid });
          const resultUid = String(result?.chapterUid || "");
          const normalizedText = chunker.normalizeText(result?.text);
          const uidMatches = !expectedChapterUid || resultUid === expectedChapterUid;
          const isRejectedText = rejectedText && normalizedText === rejectedText;
          if (uidMatches && !isRejectedText && chunker.isLikelyChapterText(normalizedText)) {
            return { ...result, text: normalizedText };
          }
          if (uidMatches && !resultUid) {
            const legacy = extractor.getLegacyDomText();
            const legacyText = chunker.normalizeText(legacy?.text);
            if (legacy && legacyText !== rejectedText && chunker.isLikelyChapterText(legacyText)) {
              return { ...legacy, chapterUid: resultUid };
            }
          }
        } catch (error) {
          this.debugLog("章节正文提取失败，准备重试", error);
        }
        if (attempt < attempts - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 400 + attempt * 250));
        }
      }
      return null;
    },
    async loadAndSpeak(options = {}) {
      if (voiceState.loading) return;
      this.clearChapterWaitTimer();
      voiceState.loading = true;
      voiceState.waitingForChapter = false;
      voiceState.sessionId += 1;
      const sessionId = voiceState.sessionId;
      voiceState.sessionAbortController?.abort();
      const abortController = new AbortController();
      voiceState.sessionAbortController = abortController;
      try {
        await this.waitForPageTurn(abortController.signal);
        if (abortController.signal.aborted || sessionId !== voiceState.sessionId) return;
        const result = await this.extractReadableChapter(options, abortController.signal);
        if (abortController.signal.aborted || sessionId !== voiceState.sessionId) return;
        if (!result) {
          const message = options.continuation ? "下一章正文加载失败，连续朗读已停止，请重试" : "未找到章节正文，请打开书籍正文页后重试";
          utils.notificationManager.show(message);
          this.stop({ silent: true, hideBar: false });
          return;
        }
        const { text, source, chapterUid = "" } = result;
        const chapterText = chunker.normalizeText(text);
        const pageContext = await extractor.extractCurrentPageContext({ text: chapterText, chapterUid, probe: false });
        if (abortController.signal.aborted || sessionId !== voiceState.sessionId) return;
        const isContinuation = Boolean(options.continuation);
        const rangeResult = isContinuation ? { text: chapterText, rangePolicy: "dynamic", startIndex: 0, endIndex: 0, totalLength: chapterText.length } : chunker.applyRange(chapterText, ttsSettings.rangeStart, ttsSettings.rangeEnd);
        if (!isContinuation && rangeResult.warning === "start-not-found") {
          utils.notificationManager.show("未找到开始文字，将朗读当前页");
        } else if (rangeResult.warning === "end-not-found") {
          utils.notificationManager.show("未找到结束文字，将朗读到当前页末尾");
        }
        let pageStartIndex = Math.max(0, Number(pageContext?.pageStartIndex) || 0);
        const pageEndIndex = Math.min(
          chapterText.length,
          Math.max(pageStartIndex + 1, Number(pageContext?.pageEndIndex) || chapterText.length)
        );
        let continuationBoundary = null;
        if (isContinuation) {
          if (Number.isFinite(options.previousRangeEndIndex) && options.previousRangeEndIndex > 0) {
            pageStartIndex = Math.min(chapterText.length, Math.floor(Number(options.previousRangeEndIndex)));
          } else {
            continuationBoundary = await extractor.findTextLayerBoundary(chapterText);
            if (continuationBoundary && continuationBoundary.offset > pageStartIndex) {
              pageStartIndex = continuationBoundary.offset;
            }
          }
        }
        const userStartOffset = rangeResult.startIndex || 0;
        const userEndOffset = rangeResult.endIndex > 0 ? rangeResult.endIndex : chapterText.length;
        const effectiveStart = Math.max(userStartOffset, pageStartIndex);
        const effectiveEnd = Math.min(pageEndIndex, Math.max(effectiveStart, userEndOffset));
        const rangeText = chapterText.slice(effectiveStart, effectiveEnd);
        const chunks = chunker.chunkTextWithOffsets(rangeText, effectiveStart);
        if (!chunks.length) {
          utils.notificationManager.show("所选范围没有可朗读的文本");
          return;
        }
        const explicitRangeFitsPage = Boolean(
          rangeResult.rangePolicy === "explicit" && userEndOffset > userStartOffset && userStartOffset >= pageStartIndex && userEndOffset <= pageEndIndex
        );
        voiceState.chapterUid = chapterUid || "";
        voiceState.source = source;
        voiceState.rangePolicy = explicitRangeFitsPage ? "explicit" : "dynamic";
        voiceState.textLength = rangeText.length;
        voiceState.chapterText = chapterText;
        voiceState.timelineChunks = chunks;
        voiceState.rangeStartIndex = effectiveStart;
        voiceState.rangeEndIndex = effectiveEnd;
        voiceState.rangeTotalLength = rangeResult.totalLength || chapterText.length;
        voiceState.pageStartIndex = pageStartIndex;
        voiceState.pageEndIndex = pageEndIndex;
        voiceState.pageIndex = Number(pageContext?.pageIndex) || 0;
        voiceState.pageCount = Math.max(1, Number(pageContext?.pageCount) || 1);
        voiceState.isLastChapterPage = Boolean(pageContext?.isLastChapterPage ?? voiceState.pageIndex >= voiceState.pageCount - 1);
        voiceState.pageSignature = String(pageContext?.pageSignature || extractor.getCurrentPageSignature());
        voiceState.rangeStartY = null;
        voiceState.rangeEndY = null;
        voiceState.rangeStartScrollTop = null;
        voiceState.locatePending = true;
        voiceState.scrollAnchors = [];
        voiceState.anchorMeasuring = false;
        voiceState.anchorSourceCache = { node: null, textLength: 0 };
        voiceState.layoutMap = null;
        voiceState.layoutMode = "ratio";
        voiceState.layoutResizeObserver?.disconnect();
        voiceState.layoutResizeObserver = null;
        voiceState.layoutVersion += 1;
        voiceState.calibratedCps = this.loadCpsProfile();
        voiceState.speechClock.configure({
          chunks,
          rate: ttsSettings.rate,
          fallbackCps: this.getEffectiveCps(),
          rangeStart: effectiveStart,
          rangeEnd: effectiveEnd
        });
        await this.prepareLayoutMap(sessionId, abortController.signal);
        if (abortController.signal.aborted || sessionId !== voiceState.sessionId) return;
        let initialLoc = null;
        if (!isContinuation && ttsSettings.rangeStart) {
          initialLoc = await Promise.race([
            extractor.locateTextOffsetInTextLayer(effectiveStart, ttsSettings.rangeStart),
            new Promise((resolve) => window.setTimeout(() => resolve(null), 600))
          ]);
        }
        if (abortController.signal.aborted || sessionId !== voiceState.sessionId) return;
        if (isContinuation) {
          await scrollFollower.alignTo(0, { signal: abortController.signal });
          voiceState.rangeStartScrollTop = 0;
        } else if (initialLoc && Number.isFinite(initialLoc.y)) {
          const target = Math.max(0, initialLoc.y - this.getViewportFocusY());
          const doc = document.scrollingElement || document.documentElement;
          const current = window.scrollY || doc.scrollTop || 0;
          if (Math.abs(current - target) > 40) {
            await scrollFollower.alignTo(target, { signal: abortController.signal });
            voiceState.rangeStartScrollTop = target;
          } else {
            voiceState.rangeStartScrollTop = current;
          }
        } else {
          const layoutMeasured = await extractor.withPreRenderDom((root) => {
            const layout = buildLayoutMap(root, voiceState.chapterText, 0, voiceState.chapterText.length);
            return layout?.points?.length ? { layout } : null;
          }, { probe: false });
          let hiddenTarget = null;
          if (layoutMeasured?.layout) {
            const yStart = getLayoutY(layoutMeasured.layout, voiceState.pageStartIndex);
            const yEnd = getLayoutY(layoutMeasured.layout, voiceState.pageEndIndex);
            const yTarget = getLayoutY(layoutMeasured.layout, effectiveStart);
            if (Number.isFinite(yStart) && Number.isFinite(yEnd) && Number.isFinite(yTarget) && yEnd > yStart) {
              const fraction = Math.min(1, Math.max(0, (yTarget - yStart) / (yEnd - yStart)));
              const raw = this.getScrollDistance() * fraction;
              const viewport = window.innerHeight || document.documentElement?.clientHeight || 800;
              const lastScreenThreshold = Math.max(viewport * 0.5, 120);
              hiddenTarget = raw >= this.getScrollDistance() - lastScreenThreshold ? this.getScrollDistance() : Math.max(0, Math.min(this.getScrollDistance(), raw - this.getViewportFocusY() * 0.5));
            }
          }
          if (hiddenTarget !== null) {
            await scrollFollower.alignTo(hiddenTarget, { signal: abortController.signal });
            voiceState.rangeStartScrollTop = hiddenTarget;
          } else {
            await this.alignToOffset(effectiveStart, abortController.signal);
          }
        }
        if (abortController.signal.aborted || sessionId !== voiceState.sessionId) return;
        voiceState.locatePending = false;
        if (!options.skipAutoRead) {
          if (!appState.isAutoReading) {
            moduleRegistry.autoRead?.start();
          } else {
            moduleRegistry.autoRead?.syncPace();
          }
        }
        const debugTarget = typeof unsafeWindow !== "undefined" && unsafeWindow ? unsafeWindow : window;
        const speechDebug = {
          source,
          chapterUid,
          textLength: text.length,
          head: text.slice(0, 160),
          fullText: text
        };
        window.__wrLastSpeechDebug = speechDebug;
        debugTarget.__wrLastSpeechDebug = speechDebug;
        speechEngine.speak(chunks, ttsSettings.rate, ttsSettings.voiceURI);
        this.startChapterWatcher();
        this.showQuickBar();
        this.syncAllUI();
        this.debugLog("正文提取完成 uid=" + (chapterUid || "unknown") + " source=" + source + " chars=" + text.length);
        utils.notificationManager.show("已提取正文 " + text.length + " 字");
      } catch (error) {
        if (!abortController.signal.aborted && sessionId === voiceState.sessionId) {
          this.debugLog("朗读准备失败", error);
          utils.notificationManager.show("朗读准备失败，请重试");
          this.stop({ silent: true, hideBar: false });
        }
      } finally {
        if (sessionId === voiceState.sessionId) voiceState.loading = false;
      }
    },
    toggle() {
      if (voiceState.loading) {
        this.stop({ silent: true });
        return;
      }
      if (speechEngine.playing && !speechEngine.paused) {
        this.pause();
      } else if (speechEngine.paused) {
        this.resume();
      } else {
        this.start();
      }
    },
    pause(options = {}) {
      if (!speechEngine.playing) return;
      voiceState.speechClock.pause(performance.now());
      speechEngine.pause();
      moduleRegistry.autoRead?.pause();
      voiceState.autoPausedReason = options.reason || "";
      this.syncAllUI();
    },
    async resume() {
      if (!speechEngine.paused) return;
      const sessionId = voiceState.sessionId;
      const signal = voiceState.sessionAbortController?.signal;
      const offset = voiceState.speechClock.getOffset(performance.now());
      await this.alignToOffset(offset, signal);
      if (signal?.aborted || sessionId !== voiceState.sessionId || !speechEngine.paused) return;
      const waitsForRestart = Number.isFinite(speechEngine.pendingRestartOffset);
      if (!waitsForRestart) voiceState.speechClock.resume(performance.now());
      speechEngine.resume();
      moduleRegistry.autoRead?.resume();
      voiceState.autoPausedReason = "";
      this.syncAllUI();
    },
    stop(options = {}) {
      voiceState.sessionAbortController?.abort();
      voiceState.sessionAbortController = null;
      window.clearTimeout(voiceState.layoutRefreshTimer);
      window.clearTimeout(voiceState.manualResumeTimer);
      window.clearTimeout(voiceState.settingResumeTimer);
      scrollFollower.stop();
      speechEngine.stop();
      this.stopChapterWatcher();
      this.clearChapterWaitTimer();
      moduleRegistry.autoRead?.stop();
      voiceState.chapterUid = "";
      voiceState.source = "";
      voiceState.rangePolicy = "dynamic";
      voiceState.waitingForChapter = false;
      voiceState.textLength = 0;
      voiceState.rangeStartIndex = 0;
      voiceState.rangeEndIndex = 0;
      voiceState.rangeTotalLength = 0;
      voiceState.pageStartIndex = 0;
      voiceState.pageEndIndex = 0;
      voiceState.pageIndex = 0;
      voiceState.pageCount = 1;
      voiceState.isLastChapterPage = true;
      voiceState.pageSignature = "";
      voiceState.rangeStartY = null;
      voiceState.rangeEndY = null;
      voiceState.rangeStartScrollTop = null;
      voiceState.locatePending = false;
      voiceState.sessionId += 1;
      voiceState.boundarySupported = null;
      voiceState.cpsSamples = [];
      voiceState.calibratedCps = pace.CHARS_PER_SECOND_AT_1X;
      voiceState.scrollAnchors = [];
      voiceState.anchorMeasuring = false;
      voiceState.anchorSourceCache = { node: null, textLength: 0 };
      voiceState.chapterText = "";
      voiceState.timelineChunks = [];
      voiceState.layoutMap = null;
      voiceState.layoutMode = "ratio";
      voiceState.layoutResizeObserver?.disconnect();
      voiceState.layoutResizeObserver = null;
      voiceState.speechClock.reset();
      voiceState.realigning = false;
      voiceState.autoPausedReason = "";
      voiceState.visibilityShouldResume = false;
      voiceState.manualPointerActive = false;
      voiceState.loading = false;
      if (options.hideBar !== false) {
        this.hideQuickBar();
      }
      this.syncAllUI();
      if (!options.silent) {
        utils.notificationManager.show("语音阅读已停止");
      }
    },
    /**
     * 当前连续朗读进度。boundary 只更新时钟观测，页面位置不会在事件到达时直接跳变。
     */
    getReadingProgress() {
      this.collectCpsSamples();
      this.isBoundaryActive();
      voiceState.speechClock.setRate(ttsSettings.rate);
      voiceState.speechClock.setFallbackCps(this.getEffectiveCps());
      return voiceState.speechClock.getProgress(performance.now());
    },
    /** L1 是否生效：首块 2.5s 内收到过 boundary 事件则确认支持，否则永久降级到 L2 */
    isBoundaryActive() {
      if (voiceState.boundarySupported === false) return false;
      if (voiceState.boundarySupported === true) return true;
      if (voiceState.speechClock.boundarySeen || speechEngine.boundarySeen) {
        voiceState.boundarySupported = true;
        this.debugLog("音色支持 boundary 事件，启用精确进度");
        return true;
      }
      if (speechEngine.playing && !speechEngine.paused && speechEngine.chunkStartTime > 0) {
        const elapsed = (performance.now() - speechEngine.chunkStartTime) / 1e3;
        if (elapsed > 2.5) {
          voiceState.boundarySupported = false;
          this.debugLog("音色不支持 boundary 事件，降级为自适应语速校准");
          utils.notificationManager.show("当前音色无语音边界，已使用自适应同步");
          return false;
        }
      }
      return false;
    },
    /** 当前有效的 1x 字/秒（L2 校准值，未校准时用 pace 默认常量） */
    getEffectiveCps() {
      return voiceState.calibratedCps || pace.CHARS_PER_SECOND_AT_1X;
    },
    getCpsProfileId() {
      const browser = navigator.userAgentData?.brands?.map((item) => item.brand).join(",") || navigator.userAgent || "browser";
      return [ttsSettings.voiceURI || "default", ttsSettings.rate, browser].join("|");
    },
    loadCpsProfile() {
      const profiles = GM_getValue(CPS_PROFILES_KEY, {});
      const value = profiles && typeof profiles === "object" ? Number(profiles[this.getCpsProfileId()]) : NaN;
      return Number.isFinite(value) && value > 0 && value <= 30 ? value : pace.CHARS_PER_SECOND_AT_1X;
    },
    saveCpsProfile(value) {
      if (!Number.isFinite(value) || value <= 0 || value > 30) return;
      const stored = GM_getValue(CPS_PROFILES_KEY, {});
      const profiles = stored && typeof stored === "object" ? { ...stored } : {};
      profiles[this.getCpsProfileId()] = Number(value.toFixed(3));
      const entries = Object.entries(profiles);
      if (entries.length > 40) {
        for (const [key] of entries.slice(0, entries.length - 40)) delete profiles[key];
      }
      GM_setValue(CPS_PROFILES_KEY, profiles);
    },
    /** 消费已完成 chunk 的真实耗时，反推该音色在当前语速下的 1x 字/秒。 */
    collectCpsSamples() {
      const timings = speechEngine.chunkTimings || [];
      if (!timings.length) return;
      speechEngine.chunkTimings = [];
      for (const timing of timings) {
        if (!timing || timing.ms < 200 || timing.chars <= 0) continue;
        const seconds = timing.ms / 1e3;
        const cpsAt1x = timing.chars / seconds / Math.max(0.1, timing.rate || 1);
        if (!Number.isFinite(cpsAt1x) || cpsAt1x <= 0 || cpsAt1x > 30) continue;
        voiceState.cpsSamples.push(cpsAt1x);
        if (voiceState.cpsSamples.length > 8) voiceState.cpsSamples.shift();
      }
      if (voiceState.cpsSamples.length) {
        const sorted = [...voiceState.cpsSamples].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        voiceState.calibratedCps = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
        voiceState.speechClock.setFallbackCps(voiceState.calibratedCps);
        this.saveCpsProfile(voiceState.calibratedCps);
        this.debugLog("校准 cps@1x=" + voiceState.calibratedCps.toFixed(2) + " (样本 " + voiceState.cpsSamples.length + ")");
      }
    },
    /** chunk 边界用预渲染 DOM 实测当前位置，更新 L3 锚点表 */
    scheduleAnchorMeasurement(index) {
      if (!voiceState.textLength) return;
      if (voiceState.layoutMap) return;
      if (voiceState.anchorMeasuring) return;
      const chunks = voiceState.timelineChunks || [];
      if (!chunks.length) return;
      const charOffset = chunks[index]?.startOffset;
      if (!Number.isFinite(charOffset) || charOffset <= voiceState.rangeStartIndex) return;
      if (voiceState.scrollAnchors.some((anchor) => Math.abs(anchor.charOffset - charOffset) < 100)) return;
      const root = extractor.peekPreRenderDom?.();
      if (!root) return;
      const cache2 = voiceState.anchorSourceCache;
      if (!cache2 || cache2.node !== root) {
        const rootText = chunker.normalizeText(root.innerText || root.textContent || "");
        voiceState.anchorSourceCache = { node: root, textLength: rootText.length };
      }
      const total = voiceState.chapterText.length || 0;
      if (!total || Math.abs(voiceState.anchorSourceCache.textLength - total) > Math.max(200, total * 0.2)) return;
      voiceState.anchorMeasuring = true;
      const sessionId = voiceState.sessionId;
      Promise.race([
        extractor.locateTextOffset(charOffset, null, 0, { probe: false }),
        new Promise((resolve) => window.setTimeout(() => resolve(null), 600))
      ]).then((loc) => {
        voiceState.anchorMeasuring = false;
        if (sessionId !== voiceState.sessionId) return;
        if (!loc || !Number.isFinite(loc.y)) return;
        this.addScrollAnchor(charOffset, loc.y);
      });
    },
    /** 插入/更新锚点：err = DOM 实测 y - 线性映射 y（按 charOffset 升序，上限 8 个） */
    addScrollAnchor(charOffset, measuredY) {
      const distance = this.getScrollDistance();
      const linearY = this.linearMapY(charOffset, distance);
      const measuredTop = measuredY - this.getViewportFocusY();
      const err = measuredTop - linearY;
      this.debugLog("锚点 offset=" + charOffset + " linearY=" + Math.round(linearY) + " measuredY=" + Math.round(measuredY) + " err=" + Math.round(err));
      const offset = Math.max(0, Math.round(charOffset));
      const anchors = voiceState.scrollAnchors;
      const pos = anchors.findIndex((a) => a.charOffset >= offset);
      if (pos >= 0 && anchors[pos].charOffset === offset) {
        anchors[pos].err = err;
        return;
      }
      anchors.splice(pos < 0 ? anchors.length : pos, 0, { charOffset: offset, err });
      while (anchors.length > 8) {
        let removeIdx = -1;
        let minGap = Infinity;
        for (let i = 1; i < anchors.length - 1; i += 1) {
          const gap = anchors[i].charOffset - anchors[i - 1].charOffset;
          if (gap < minGap) {
            minGap = gap;
            removeIdx = i;
          }
        }
        if (removeIdx > 0) anchors.splice(removeIdx, 1);
        else break;
      }
    },
    /** 锚点误差插值：区间内线性插值，区间外取最近锚点（恒定修正，无跳变） */
    interpolateAnchorErr(offset) {
      const anchors = voiceState.scrollAnchors;
      if (!anchors.length) return 0;
      if (offset <= anchors[0].charOffset) return anchors[0].err;
      const last = anchors[anchors.length - 1];
      if (offset >= last.charOffset) return last.err;
      for (let i = 1; i < anchors.length; i += 1) {
        const a = anchors[i - 1];
        const b = anchors[i];
        if (offset <= b.charOffset) {
          const span = b.charOffset - a.charOffset;
          if (span <= 0) return b.err;
          return a.err + (offset - a.charOffset) / span * (b.err - a.err);
        }
      }
      return last.err;
    },
    /** 线性基线映射：字符偏移 → 当前页内滚动像素。
     *  微信读书每页是独立滚动容器，必须按“当前页边界”映射，
     *  不能再按整章占比映射，否则页首/页尾会被算到页面中点。 */
    linearMapY(offset, distance) {
      const pageStart = voiceState.pageStartIndex || 0;
      const pageEnd = voiceState.pageEndIndex > pageStart ? voiceState.pageEndIndex : pageStart + Math.max(1, voiceState.textLength || 1);
      const span = Math.max(1, pageEnd - pageStart);
      const t = Math.min(1, Math.max(0, (offset - pageStart) / span));
      return distance * t;
    },
    /** 把页内偏移转成期望的 scrollTop：
     *  普通位置让该行显示在视口中上部（focusY）；
     *  如果已经位于最后一屏，则直接滚动到底部，避免末尾行被顶到屏幕外。
     *  pageStart/pageEnd 可显式传入；未传时使用当前 voiceState 的页边界。 */
    pageOffsetToScrollTop(offset, distance, pageStart = voiceState.pageStartIndex, pageEnd = voiceState.pageEndIndex) {
      const safeStart = Math.max(0, Number(pageStart) || 0);
      const safeEnd = Number(pageEnd) > safeStart ? Number(pageEnd) : safeStart + 1;
      const span = Math.max(1, safeEnd - safeStart);
      const t = Math.min(1, Math.max(0, (Number(offset) || 0) - safeStart) / span);
      const raw = distance * t;
      const viewport = window.innerHeight || document.documentElement?.clientHeight || 800;
      const lastScreenThreshold = Math.max(viewport * 0.5, 120);
      if (raw >= distance - lastScreenThreshold) return distance;
      return Math.max(0, Math.min(distance, raw - this.getViewportFocusY()));
    },
    /** 当前文档可滚动距离（与 autoRead 口径一致） */
    getScrollDistance() {
      const doc = getScrollRoot();
      return Math.max(0, (doc.scrollHeight || 0) - (doc.clientHeight || 0));
    },
    getViewportFocusY() {
      const viewport = window.innerHeight || document.documentElement.clientHeight || 800;
      return Math.max(RANGE_SCROLL_TOP_PADDING, viewport * 0.38);
    },
    mapOffsetToScroll(offset) {
      const distance = this.getScrollDistance();
      const safeOffset = Math.min(
        voiceState.rangeEndIndex || offset,
        Math.max(voiceState.rangeStartIndex || 0, Number(offset) || 0)
      );
      const linearTarget = this.pageOffsetToScrollTop(safeOffset, distance);
      const anchor = voiceState.rangeStartScrollTop;
      if (Number.isFinite(anchor)) {
        const startLinear = this.pageOffsetToScrollTop(voiceState.rangeStartIndex, distance);
        return Math.min(distance, Math.max(0, anchor + (linearTarget - startLinear)));
      }
      return Math.min(distance, Math.max(0, linearTarget));
    },
    getScrollTarget() {
      if (voiceState.locatePending) {
        const doc = getScrollRoot();
        return window.scrollY || doc.scrollTop || 0;
      }
      const progress = this.getReadingProgress();
      const target = this.mapOffsetToScroll(progress.offset);
      const now2 = performance.now();
      if (GM_getValue("weread_tts_debug", false) && now2 - voiceState.lastDebugSampleAt >= 500) {
        const doc = getScrollRoot();
        const actualTop = window.scrollY || doc.scrollTop || 0;
        voiceState.lastDebugSampleAt = now2;
        console.log("[WereadTTS]", {
          spokenOffset: Number(progress.offset.toFixed(2)),
          desiredTop: Number(target.toFixed(2)),
          actualTop: Number(actualTop.toFixed(2)),
          error: Number((target - actualTop).toFixed(2)),
          boundarySupported: voiceState.boundarySupported,
          layoutVersion: voiceState.layoutVersion,
          layoutPoints: voiceState.layoutMap?.points?.length || 0,
          layoutMode: voiceState.layoutMode
        });
      }
      return target;
    },
    async prepareLayoutMap(sessionId, signal) {
      const timeout = new Promise((resolve) => window.setTimeout(() => resolve(null), 1200));
      let measured = null;
      try {
        measured = await Promise.race([
          extractor.withPreRenderDom((root2) => {
            const layout2 = buildLayoutMap(
              root2,
              voiceState.chapterText,
              voiceState.pageStartIndex,
              voiceState.pageEndIndex
            );
            return layout2?.points?.length ? { root: root2, layout: layout2 } : null;
          }),
          timeout
        ]);
      } catch (error) {
        this.debugLog("布局映射失败，降级到锚点模式", error);
      }
      if (signal?.aborted || sessionId !== voiceState.sessionId) return false;
      const root = measured?.root || null;
      const layout = measured?.layout || null;
      this.observeLayoutRoot(root);
      if (layout?.points?.length) {
        voiceState.layoutMap = layout;
        voiceState.layoutMode = "lines";
        voiceState.rangeStartY = getLayoutY(layout, voiceState.rangeStartIndex);
        voiceState.rangeEndY = getLayoutY(layout, voiceState.rangeEndIndex);
        voiceState.locatePending = false;
        this.debugLog("布局映射完成，行数=" + layout.points.length);
        return true;
      }
      const locate = (offset) => Promise.race([
        extractor.locateTextOffset(offset, null, 0),
        new Promise((resolve) => window.setTimeout(() => resolve(null), 600))
      ]);
      const startLoc = await locate(voiceState.rangeStartIndex);
      if (signal?.aborted || sessionId !== voiceState.sessionId) return false;
      const endLoc = await locate(Math.max(voiceState.rangeStartIndex, voiceState.rangeEndIndex - 1));
      if (signal?.aborted || sessionId !== voiceState.sessionId) return false;
      if (Number.isFinite(startLoc?.y)) {
        voiceState.rangeStartY = startLoc.y;
        this.addScrollAnchor(voiceState.rangeStartIndex, startLoc.y);
      }
      if (Number.isFinite(endLoc?.y)) {
        voiceState.rangeEndY = endLoc.y;
        this.addScrollAnchor(voiceState.rangeEndIndex, endLoc.y);
      }
      voiceState.layoutMode = Number.isFinite(startLoc?.y) || Number.isFinite(endLoc?.y) ? "anchors" : "ratio";
      if (voiceState.layoutMode === "ratio") {
        utils.notificationManager.show("正文排版坐标不可用，滚动已降级为比例同步");
      }
      voiceState.locatePending = false;
      return false;
    },
    alignToOffset(offset, signal) {
      return scrollFollower.alignTo(this.mapOffsetToScroll(offset), { signal });
    },
    observeLayoutRoot(root) {
      voiceState.layoutResizeObserver?.disconnect();
      voiceState.layoutResizeObserver = null;
      if (!root || typeof ResizeObserver === "undefined") return;
      let initial = true;
      voiceState.layoutResizeObserver = new ResizeObserver(() => {
        if (initial) {
          initial = false;
          return;
        }
        this.scheduleLayoutRefresh("content-resize");
      });
      voiceState.layoutResizeObserver.observe(root);
    },
    /** 调试输出：GM 值 weread_tts_debug 置 true 时打印校准信息 */
    debugLog(...args) {
      if (GM_getValue("weread_tts_debug", false)) {
        console.log("[WereadTTS]", ...args);
      }
    },
    /** 剩余朗读时长（秒），供 autoRead 计算语音模式下的翻页等待 */
    getRemainingSeconds() {
      if (!voiceState.textLength) return 0;
      const { charsRead, totalChars } = this.getReadingProgress();
      const remainingChars = Math.max(0, totalChars - charsRead);
      if (remainingChars <= 0) return 0;
      return remainingChars / (this.getEffectiveCps() * ttsSettings.rate);
    },
    /** 是否正在等待下一章（本章已读完、开启续读） */
    isWaitingChapter() {
      return Boolean(voiceState.waitingForChapter);
    },
    /** “从文字”在整章中的占比（比例估算用） */
    getRangeStartFraction() {
      if (voiceState.rangeTotalLength > 0) {
        return Math.min(1, Math.max(0, voiceState.rangeStartIndex / voiceState.rangeTotalLength));
      }
      return 0;
    },
    /** “到文字”在整章中的占比；未指定结束文字时为 1（读到章末） */
    getRangeEndFraction() {
      if (voiceState.rangeEndIndex > 0 && voiceState.rangeTotalLength > 0) {
        return Math.min(1, voiceState.rangeEndIndex / voiceState.rangeTotalLength);
      }
      return 1;
    },
    scheduleLayoutRefresh(reason) {
      if (!this.isActive() || !voiceState.chapterText) return;
      window.clearTimeout(voiceState.layoutRefreshTimer);
      voiceState.layoutRefreshTimer = window.setTimeout(() => {
        this.realignDuringPlayback(reason, { rebuildLayout: true });
      }, 300);
    },
    async realignDuringPlayback(reason, options = {}) {
      if (voiceState.realigning || !voiceState.chapterText) return;
      voiceState.realigning = true;
      const sessionId = voiceState.sessionId;
      const signal = voiceState.sessionAbortController?.signal;
      const wasPlaying = speechEngine.playing && !speechEngine.paused;
      const offset = voiceState.speechClock.getOffset(performance.now());
      try {
        if (wasPlaying) {
          voiceState.speechClock.pause(performance.now());
          speechEngine.pause();
          moduleRegistry.autoRead?.pause();
        } else {
          scrollFollower.stop();
        }
        if (options.rebuildLayout) {
          const measured = await extractor.withPreRenderDom((root) => {
            const layout = buildLayoutMap(
              root,
              voiceState.chapterText,
              voiceState.pageStartIndex,
              voiceState.pageEndIndex
            );
            return layout?.points?.length ? { root, layout } : null;
          });
          if (signal?.aborted || sessionId !== voiceState.sessionId) return;
          voiceState.layoutMap = measured?.layout || null;
          voiceState.layoutMode = voiceState.layoutMap ? "lines" : "ratio";
          this.observeLayoutRoot(measured?.root || null);
          voiceState.layoutVersion += 1;
          voiceState.scrollAnchors = [];
          this.debugLog("布局重建 reason=" + reason + " version=" + voiceState.layoutVersion);
        }
        await this.alignToOffset(offset, signal);
        if (signal?.aborted || sessionId !== voiceState.sessionId) return;
      } catch (error) {
        this.debugLog("重新对齐失败 reason=" + reason, error);
      } finally {
        const sessionActive = !signal?.aborted && sessionId === voiceState.sessionId;
        if (sessionActive && wasPlaying && speechEngine.paused) {
          voiceState.speechClock.resume(performance.now());
          speechEngine.resume();
          moduleRegistry.autoRead?.resume();
        }
        voiceState.realigning = false;
      }
    },
    handleHardScrollError() {
      this.realignDuringPlayback("hard-scroll-error");
    },
    handleManualScroll() {
      if (!speechEngine.playing && !speechEngine.paused) return;
      if (speechEngine.playing && !speechEngine.paused && !voiceState.realigning) {
        this.pause({ reason: "manual-scroll" });
      }
      if (voiceState.autoPausedReason !== "manual-scroll") return;
      window.clearTimeout(voiceState.manualResumeTimer);
      if (voiceState.manualPointerActive) return;
      voiceState.manualResumeTimer = window.setTimeout(() => {
        if (speechEngine.paused && voiceState.autoPausedReason === "manual-scroll") this.resume();
      }, 800);
    },
    handleVisibilityChange() {
      if (document.hidden) {
        voiceState.visibilityShouldResume = speechEngine.playing && !speechEngine.paused;
        if (voiceState.visibilityShouldResume) this.pause({ reason: "visibility" });
        return;
      }
      if (voiceState.visibilityShouldResume && speechEngine.paused && voiceState.autoPausedReason === "visibility") {
        voiceState.visibilityShouldResume = false;
        this.resume();
      }
    },
    setRate(rate) {
      const shouldAutoResume = speechEngine.playing && !speechEngine.paused || voiceState.autoPausedReason === "setting-change";
      if (speechEngine.playing && !speechEngine.paused) this.pause({ reason: "setting-change" });
      ttsSettings.rate = pace.clampRate(rate);
      ttsSettings.save();
      pace.applyRate(ttsSettings.rate);
      voiceState.cpsSamples = [];
      voiceState.calibratedCps = this.loadCpsProfile();
      voiceState.speechClock.setRate(ttsSettings.rate);
      voiceState.speechClock.setFallbackCps(voiceState.calibratedCps);
      const resumeOffset = voiceState.speechClock.getConfirmedOffset();
      voiceState.speechClock.resetObservations(resumeOffset, performance.now());
      speechEngine.applyRate(ttsSettings.rate, resumeOffset);
      window.clearTimeout(voiceState.settingResumeTimer);
      if (shouldAutoResume) {
        voiceState.settingResumeTimer = window.setTimeout(() => {
          if (speechEngine.paused && voiceState.autoPausedReason === "setting-change") this.resume();
        }, 250);
      }
      this.syncAllUI();
    },
    setVoice(voiceURI) {
      const shouldAutoResume = speechEngine.playing && !speechEngine.paused || voiceState.autoPausedReason === "setting-change";
      if (speechEngine.playing && !speechEngine.paused) this.pause({ reason: "setting-change" });
      ttsSettings.voiceURI = voiceURI || "";
      ttsSettings.save();
      voiceState.boundarySupported = null;
      voiceState.cpsSamples = [];
      voiceState.calibratedCps = this.loadCpsProfile();
      voiceState.speechClock.boundarySeen = false;
      voiceState.speechClock.setFallbackCps(voiceState.calibratedCps);
      const resumeOffset = voiceState.speechClock.getConfirmedOffset();
      voiceState.speechClock.resetObservations(resumeOffset, performance.now());
      speechEngine.setVoice(ttsSettings.voiceURI, resumeOffset);
      window.clearTimeout(voiceState.settingResumeTimer);
      if (shouldAutoResume) {
        voiceState.settingResumeTimer = window.setTimeout(() => {
          if (speechEngine.paused && voiceState.autoPausedReason === "setting-change") this.resume();
        }, 250);
      }
      this.syncAllUI();
    },
    setFollow(enabled) {
      const wasWaitingForChapter = voiceState.waitingForChapter;
      ttsSettings.follow = Boolean(enabled);
      ttsSettings.save();
      if (!ttsSettings.follow && wasWaitingForChapter) {
        this.stop({ silent: true });
        utils.notificationManager.show("已关闭章节续读，本次朗读已结束");
        return;
      }
      this.syncAllUI();
    },
    setRange(startText, endText) {
      const wasActive = this.isActive();
      ttsSettings.setRange(startText, endText);
      this.syncRangeInputs();
      utils.notificationManager.show("阅读范围已保存");
      if (wasActive) this.stop({ silent: true });
      this.jumpToRangeStart();
    },
    clearRange() {
      ttsSettings.clearRange();
      this.syncRangeInputs();
      voiceState.jumpToken += 1;
      utils.notificationManager.show("阅读范围已清除");
    },
    /**
     * 文本层是虚拟化渲染的，目标行不在当前视口附近时 DOM 里没有对应字符。
     * 这里通过快速滚动扫描整页，直到文本层中出现目标短语，拿到真实 y 坐标。
     */
    async searchTextLayerForPhrase(phrase, text) {
      const normPhrase = chunker.normalizeText(phrase);
      if (!normPhrase) return { loc: null, boundary: null };
      const doc = getScrollRoot();
      const maxScroll = Math.max(0, (doc.scrollHeight || 0) - (doc.clientHeight || 0));
      const prevScroll = window.scrollY || doc.scrollTop || 0;
      const step = Math.max(160, Math.round((window.innerHeight || 800) * 0.25));
      const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
      let result = null;
      let boundary = null;
      const normText = chunker.normalizeText(text || "");
      try {
        for (let y = 0; y <= maxScroll + step; y += step) {
          window.scrollTo(0, Math.min(maxScroll, y));
          await sleep(50);
          const loc = extractor.locateTextOffsetInTextLayer(0, normPhrase);
          if (loc && Number.isFinite(loc.y)) {
            result = loc;
            break;
          }
          if (!boundary && normText) {
            const b = extractor.getFirstTextLayerOffsetAtCurrentScroll(normText);
            if (b && Number.isFinite(b.offset)) {
              boundary = { scroll: Math.min(maxScroll, y), offset: b.offset };
            }
          }
        }
      } catch (error) {
        this.debugLog("文本层扫描定位失败", error);
      }
      if (!result) {
        window.scrollTo(0, prevScroll);
      }
      return { loc: result, boundary };
    },
    /**
     * 立即定位并滚动到“从文字”所在位置（不依赖朗读启动）。
     * 优先级：文本层实测定位 → 整页扫描 → 页内比例估算。
     * 用 jumpToken 丢弃过期结果，防止快速连点/清除时旧结果覆盖新结果。
     */
    async jumpToRangeStart() {
      const startText = String(ttsSettings.rangeStart || "").trim();
      if (!startText) return;
      voiceState.jumpToken += 1;
      const token = voiceState.jumpToken;
      let text = "";
      try {
        const result = await extractor.extractCurrentChapterText();
        text = result.text;
      } catch (error) {
        text = "";
      }
      if (token !== voiceState.jumpToken) return;
      if (!chunker.isPlausibleText(text)) {
        utils.notificationManager.show("未找到章节正文，无法定位");
        return;
      }
      const rangeResult = chunker.applyRange(text, startText, String(ttsSettings.rangeEnd || ""));
      if (rangeResult.warning === "start-not-found") {
        utils.notificationManager.show("未找到开始文字，无法定位");
        return;
      }
      if (rangeResult.startIndex <= 0) {
        await scrollFollower.alignTo(0);
        utils.notificationManager.show("已定位到开始文字");
        return;
      }
      const startIndex = rangeResult.startIndex;
      const totalLength = rangeResult.totalLength || 0;
      const initialPageContext = await extractor.extractCurrentPageContext({
        text: chunker.normalizeText(text),
        chapterUid: extractor.getCurrentChapterUid(),
        probe: false
      });
      if (token !== voiceState.jumpToken) return;
      const layerLocated = await Promise.race([
        extractor.locateTextOffsetInTextLayer(startIndex, startText),
        new Promise((resolve) => window.setTimeout(() => resolve(null), 600))
      ]);
      if (token !== voiceState.jumpToken) return;
      if (layerLocated && Number.isFinite(layerLocated.y)) {
        await scrollFollower.alignTo(Math.max(0, layerLocated.y - this.getViewportFocusY()));
        utils.notificationManager.show("已定位到开始文字");
        return;
      }
      const searched = await this.searchTextLayerForPhrase(startText, text);
      if (token !== voiceState.jumpToken) return;
      if (searched?.loc && Number.isFinite(searched.loc.y)) {
        await scrollFollower.alignTo(Math.max(0, searched.loc.y - this.getViewportFocusY()));
        utils.notificationManager.show("已定位到开始文字");
        return;
      }
      const pageContext = initialPageContext;
      let pageStartIndex = Number(pageContext?.pageStartIndex) || 0;
      let pageEndIndex = Number(pageContext?.pageEndIndex) || totalLength || 0;
      const pageCount = Math.max(1, Number(pageContext?.pageCount) || 1);
      const doc = document.scrollingElement || document.documentElement;
      const distance = Math.max(0, (doc.scrollHeight || 0) - (doc.clientHeight || 0));
      if (startIndex >= pageStartIndex && startIndex < pageEndIndex) {
        const boundary = searched?.boundary;
        if (boundary && startIndex < boundary.offset) {
          const layoutMeasured = await extractor.withPreRenderDom((root) => {
            const layout = buildLayoutMap(root, text, 0, text.length);
            return layout?.points?.length ? { layout } : null;
          }, { probe: false });
          if (layoutMeasured?.layout) {
            const yStart = getLayoutY(layoutMeasured.layout, pageStartIndex);
            const yBoundary = getLayoutY(layoutMeasured.layout, boundary.offset);
            const yTarget = getLayoutY(layoutMeasured.layout, startIndex);
            if (Number.isFinite(yStart) && Number.isFinite(yBoundary) && Number.isFinite(yTarget) && yBoundary > yStart) {
              const fraction = Math.min(1, Math.max(0, (yTarget - yStart) / (yBoundary - yStart)));
              const target2 = Math.max(0, Math.min(distance, boundary.scroll * fraction));
              window.scrollTo(0, target2);
              utils.notificationManager.show("已定位到开始文字附近");
              return;
            }
          }
        }
      }
      if (startIndex >= pageStartIndex && startIndex < pageEndIndex) {
        const layoutMeasured = await extractor.withPreRenderDom((root) => {
          const layout = buildLayoutMap(root, text, 0, text.length);
          return layout?.points?.length ? { layout } : null;
        }, { probe: false });
        if (layoutMeasured?.layout) {
          const yStart = getLayoutY(layoutMeasured.layout, pageStartIndex);
          const yEnd = getLayoutY(layoutMeasured.layout, pageEndIndex);
          const yTarget = getLayoutY(layoutMeasured.layout, startIndex);
          if (Number.isFinite(yStart) && Number.isFinite(yEnd) && Number.isFinite(yTarget) && yEnd > yStart) {
            const fraction = Math.min(1, Math.max(0, (yTarget - yStart) / (yEnd - yStart)));
            const raw = distance * fraction;
            const viewport = window.innerHeight || document.documentElement?.clientHeight || 800;
            const lastScreenThreshold = Math.max(viewport * 0.5, 120);
            const target2 = raw >= distance - lastScreenThreshold ? distance : Math.max(0, Math.min(distance, raw - this.getViewportFocusY() * 0.5));
            window.scrollTo(0, target2);
            utils.notificationManager.show("已定位到开始文字附近");
            return;
          }
        }
      }
      const needPageEndProbe = Boolean(
        !pageContext?.isLastChapterPage && pageCount > 1 && (startIndex < pageStartIndex || startIndex >= pageEndIndex)
      );
      if (needPageEndProbe) {
        const prevScroll = window.scrollY || doc.scrollTop || 0;
        await scrollFollower.alignTo(distance);
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        if (token !== voiceState.jumpToken) return;
        const bottomCtx = await extractor.extractCurrentPageContext({
          text: chunker.normalizeText(text),
          chapterUid: extractor.getCurrentChapterUid(),
          probe: false
        });
        if (bottomCtx && Number(bottomCtx.pageEndIndex) > pageEndIndex) {
          pageStartIndex = 0;
          pageEndIndex = Number(bottomCtx.pageEndIndex) || pageEndIndex;
        }
        if (startIndex >= pageEndIndex && pageCount > 1 && !pageContext?.isLastChapterPage) {
          moduleRegistry.autoPageTurn?.trigger();
          await new Promise((resolve) => window.setTimeout(resolve, 1200));
          if (token !== voiceState.jumpToken) return;
          const nextCtx = await extractor.extractCurrentPageContext({
            text: chunker.normalizeText(text),
            chapterUid: extractor.getCurrentChapterUid(),
            probe: false
          });
          if (nextCtx && Number(nextCtx.pageEndIndex) > pageEndIndex) {
            return this.jumpToRangeStart();
          }
        }
        await scrollFollower.alignTo(prevScroll);
        if (token !== voiceState.jumpToken) return;
      }
      const target = this.pageOffsetToScrollTop(startIndex, distance, pageStartIndex, pageEndIndex);
      await scrollFollower.alignTo(target);
      utils.notificationManager.show("已定位到开始文字附近");
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
        !speechEngine.playing && !speechEngine.paused && !voiceState.waitingForChapter && !voiceState.loading
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
      quickBarController = initQuickBarDrag(bar);
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
        quickBarController?.reset();
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
        const uid = extractor.getCurrentChapterUid({ refresh: voiceState.waitingForChapter });
        if (!uid || !voiceState.chapterUid || uid === voiceState.chapterUid) return;
        if (ttsSettings.follow) {
          utils.notificationManager.show("章节已切换，继续朗读");
          speechEngine.stop();
          this.loadAndSpeak({
            continuation: true,
            expectedChapterUid: uid,
            rejectText: voiceState.chapterText
          });
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
    clearChapterWaitTimer() {
      if (!voiceState.chapterWaitTimer) return;
      window.clearTimeout(voiceState.chapterWaitTimer);
      voiceState.chapterWaitTimer = null;
    },
    startChapterWaitTimer(sessionId) {
      this.clearChapterWaitTimer();
      voiceState.chapterWaitTimer = window.setTimeout(() => {
        voiceState.chapterWaitTimer = null;
        if (sessionId !== voiceState.sessionId || !voiceState.waitingForChapter) return;
        this.stop({ silent: true });
        utils.notificationManager.show("未检测到下一章，连续朗读已结束");
      }, CHAPTER_WAIT_TIMEOUT_MS);
    },
    async handleFinish() {
      const sessionId = voiceState.sessionId;
      moduleRegistry.autoRead?.pause();
      await this.alignToOffset(voiceState.rangeEndIndex, voiceState.sessionAbortController?.signal);
      if (sessionId !== voiceState.sessionId) return;
      if (voiceState.rangePolicy !== "explicit" && ttsSettings.follow) {
        if (voiceState.pageCount > 1 && !voiceState.isLastChapterPage) {
          await this.continueToNextChapterPage(sessionId);
          return;
        }
        voiceState.waitingForChapter = true;
        utils.notificationManager.show("本章朗读完成，等待下一章");
        this.syncAllUI();
        this.startChapterWaitTimer(sessionId);
        moduleRegistry.autoPageTurn?.trigger();
        return;
      }
      const message = voiceState.rangePolicy === "explicit" ? "指定范围朗读完成" : "本章朗读完成";
      utils.notificationManager.show(message);
      this.stop({ silent: true });
    },
    async continueToNextChapterPage(sessionId) {
      const oldPageSignature = voiceState.pageSignature;
      moduleRegistry.autoRead?.pause();
      moduleRegistry.autoPageTurn?.trigger();
      const startedAt = performance.now();
      const waitPageTurn = () => new Promise((resolve) => {
        const check = () => {
          if (sessionId !== voiceState.sessionId) {
            resolve(false);
            return;
          }
          const signature = extractor.getCurrentPageSignature();
          if (signature && signature !== oldPageSignature) {
            resolve(true);
            return;
          }
          if (performance.now() - startedAt > 4e3) {
            resolve(false);
            return;
          }
          window.setTimeout(check, 80);
        };
        check();
      });
      const pageTurned = await waitPageTurn();
      if (sessionId !== voiceState.sessionId) return;
      if (!pageTurned) {
        utils.notificationManager.show("未检测到下一页，连续朗读已结束");
        this.stop({ silent: true });
        return;
      }
      await this.loadAndSpeak({
        continuation: true,
        sameChapterPage: true,
        expectedChapterUid: voiceState.chapterUid,
        rejectText: "",
        previousRangeEndIndex: voiceState.rangeEndIndex
      });
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
  const NAV_INTENT_KEY = "wr_nav_intent";
  function saveNavIntent(text) {
    try {
      sessionStorage.setItem(NAV_INTENT_KEY, JSON.stringify({ text, at: Date.now() }));
    } catch (error) {
    }
  }
  function clearNavIntent() {
    try {
      sessionStorage.removeItem(NAV_INTENT_KEY);
    } catch (error) {
    }
  }
  function applyNavIntent() {
    try {
      const raw = sessionStorage.getItem(NAV_INTENT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || !data.text || Date.now() - data.at > 3e4) {
        clearNavIntent();
        return;
      }
      const text = data.text;
      clearNavIntent();
      const el = Array.from(document.querySelectorAll('button, a, [class*="button"], [class*="HeaderButton"]')).find((node) => (node.textContent || "").trim() === text);
      if (el) el.click();
    } catch (error) {
      clearNavIntent();
    }
  }
  function bindNavIntent() {
    document.addEventListener("click", (event) => {
      const target = event.target;
      const el = target && target.closest ? target.closest('button, a, [class*="button"], [class*="HeaderButton"]') : null;
      if (!el) return;
      const text = (el.textContent || "").trim();
      if (["上一章", "上一页", "下一页", "下一章"].includes(text)) {
        saveNavIntent(text);
        setTimeout(clearNavIntent, 1e4);
      }
    }, true);
  }
  function initialize() {
    setTimeout(applyNavIntent, 1500);
    bindNavIntent();
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
      if (nextThemeIsWhite !== lastThemeIsWhite) {
        lastThemeIsWhite = nextThemeIsWhite;
        utils.handleThemeChange(nextThemeIsWhite);
      }
      controlPanel.updateAutoReadControls?.();
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
