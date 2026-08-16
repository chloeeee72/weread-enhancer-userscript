// ==UserScript==
// @name         微信读书增强脚本
// @version      1.1.0
// @namespace    http://tampermonkey.net/
// @description  增加多功能按钮，内含多种颜色护眼模式、调整页面宽度（状态持久化，页面刷新不变）、自动/挂机阅读（增加定时模式，单双栏阅读通用）、图片复制/下载
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
(function () {
  'use strict';
  // 常量定义
  const DEFAULT_WIDTH = 800;
  const EYE_PROTECTION_COLORS = {
    'white': {
      name: '白色',
      color: 'rgba(255,255,255,1)',
      className: 'eye-protection-white'
    },
    'green': {
      name: '绿色',
      color: 'rgba(216,226,200,1)',
      className: 'eye-protection-green'
    },
    'yellow': {
      name: '黄色',
      color: 'rgba(240,234,214,1)',
      className: 'eye-protection-yellow'
    },
    'blue': {
      name: '蓝色',
      color: 'rgba(200,220,240,1)',
      className: 'eye-protection-blue'
    },
    'pink': {
      name: '粉色',
      color: 'rgba(255,230,230,1)',
      className: 'eye-protection-pink'
    },
    'purple': {
      name: '紫色',
      color: 'rgba(230,220,250,1)',
      className: 'eye-protection-purple'
    },
    'gray': {
      name: '灰色',
      color: 'rgba(240,240,240,1)',
      className: 'eye-protection-gray'
    }
  };
  // 状态变量
  let scrollInterval = null;
  let timerInterval = null;
  let isAutoReading = GM_getValue('weread_auto_reading', false);
  let isPageTurning = false;
  let pageTurnCooldown = false;
  let currentScrollSpeed = GM_getValue('weread_scroll_speed', 1.0);
  let remainingTime = GM_getValue('weread_remaining_time', 0);
  let lastTimerValue = GM_getValue('weread_last_timer', 0);
  let windowTop = 0;
  let bottomReachedTimer = null;
  let isWaitingForPageTurn = false;
  let lastScrollPosition = 0;
  let progressInterval = null;
  const generateEyeProtectionStyles = () => {
    let styles = '';
    Object.keys(EYE_PROTECTION_COLORS).forEach(colorKey => {
      const colorInfo = EYE_PROTECTION_COLORS[colorKey];
      styles += `
        body .app_content.eye-protection-${colorKey},
        body .readerContent .app_content.eye-protection-${colorKey},
        body .wr_whiteTheme .readerContent .app_content.eye-protection-${colorKey},
        body .readerChapterContent.eye-protection-${colorKey},
        body .readerChapterContent_container.eye-protection-${colorKey},
        body .wr_horizontalReader.eye-protection-${colorKey},
        body .wr_horizontalReader_app_content.eye-protection-${colorKey},
        body .readerTopBar.eye-protection-${colorKey},
        body .${colorInfo.className} .app_content,
        body .${colorInfo.className} .readerContent .app_content,
        body .${colorInfo.className} .wr_various_font_provider_wrapper,
        body .${colorInfo.className} .readerChapterContent,
        body .${colorInfo.className} .readerChapterContent_container,
        body .${colorInfo.className} .wr_horizontalReader,
        body .${colorInfo.className} .wr_horizontalReader_app_content,
        body .${colorInfo.className} .wr_whiteTheme .readerContent .app_content,
        body .${colorInfo.className} .readerTopBar {
            background-color: ${colorInfo.color} !important;
        }
        .color-${colorKey} {
            background-color: ${colorInfo.color} !important;
        }
      `;
    });
    return styles;
  };
  // 样式注入 - 更新图片预览面板样式
  GM_addStyle(`
      *{font-family: TsangerJinKai05 !important;}
      .readerTopBar{font-family: SourceHanSerifCN-Bold !important;}
      .bookInfo_title{font-family: SourceHanSerifCN-Bold !important;}
      .readerTopBar_title_link{font-family: SourceHanSerifCN-Bold; !important; font-weight:bold !important;}
      .readerTopBar_title_chapter{font-family: SourceHanSerifCN-Bold !important;}
      .readerChapterContent{color: rgba(0,0,0,100) !important;}
      .readerControls{margin-left: calc(50% - 60px) !important; margin-bottom: -28px !important;}
      /* 控制面板样式 */
      .control-panel {
          position: fixed;
          left: 60px;
          top: 50%;
          transform: translateY(-50%);
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 30px 15px 15px 15px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          z-index: 99998;
          min-width: 150px;
          transition: background-color 0.3s ease;
          cursor: move;
          user-select: none;
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
      .control-item {
          margin: 10px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
      }
      .control-label {
          font-size: 12px;
          color: #666;
          margin-right: 10px;
      }
      .control-slider {
          width: 120px;
          height: 4px;
          background: #ddd;
          outline: none;
          opacity: 0.7;
          transition: opacity .2s;
          border-radius: 2px;
      }
      .control-slider:hover {
          opacity: 1;
      }
      .timer-slider {
          background: linear-gradient(to right,
              #4CAF50 0%, #4CAF50 4.17%,
              #ddd 4.17%, #ddd 12.5%,
              #4CAF50 12.5%, #4CAF50 25%,
              #ddd 25%, #ddd 50%,
              #4CAF50 50%, #4CAF50 100%);
      }
      .speed-slider {
          background: linear-gradient(to right,
              #4CAF50 0%, #4CAF50 10%,
              #ddd 10%, #ddd 20%,
              #4CAF50 20%, #4CAF50 30%,
              #ddd 30%, #ddd 40%,
              #4CAF50 40%, #4CAF50 60%,
              #ddd 60%, #ddd 100%);
      }
      .control-value {
          font-size: 12px;
          color: #333;
          min-width: 40px;
          text-align: center;
          font-family: monospace;
      }
      .control-buttons {
          display: flex;
          gap: 5px;
          margin-top: 10px;
          flex-wrap: wrap;
      }
      /* 操作按钮样式 */
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
      /* 动态生成的护眼模式样式 */
      ${generateEyeProtectionStyles()}
      /* 提示框样式 */
      .custom-notification {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          z-index: 9999999;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.3s ease-in-out;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          max-width: 80%;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
      }
      .custom-notification.fade-out {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
      }
      /* 定时器显示样式 */
      .timer-display {
          font-size: 12px;
          color: #666;
          text-align: center;
          margin-top: 5px;
      }
      /* 分割条样式 */
      .section-divider {
          height: 1px;
          background: linear-gradient(to right, transparent, #ddd, transparent);
          margin: 10px 0;
      }
      /* 自动翻页进度条样式 */
      #auto-turn-progress {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 10px 15px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          z-index: 99997;
          min-width: 160px;
          display: none;
      }
      .progress-text {
          font-size: 12px;
          color: #333;
          margin-bottom: 5px;
          text-align: center;
      }
      .progress-bar {
          width: 100%;
          height: 6px;
          background: #f0f0f0;
          border-radius: 3px;
          overflow: hidden;
      }
      .progress-fill {
          height: 100%;
          background: #2196F3;
          border-radius: 3px;
          transition: width 0.1s linear;
          width: 100%;
      }
      /* 设置按钮图标样式 */
      .settings-icon {
          display: inline-block;
          width: 16px;
          height: 16px;
          background: currentColor;
          mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z'/%3E%3C/svg%3E") no-repeat center;
          -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z'/%3E%3C/svg%3E") no-repeat center;
      }
      /* 图片工具栏样式 - 修复单栏模式定位问题 */
      .image-toolbar-container {
          position: absolute;
          top: 5px;
          right: 5px;
          z-index: 1000;
          display: none;
      }
      .image-toolbar {
          display: flex;
          gap: 3px;
          background: rgba(0,0,0,0.7);
          border-radius: 4px;
          padding: 3px;
          backdrop-filter: blur(5px);
      }
      .image-tool-btn {
          background: none;
          border: none;
          color: white;
          font-size: 12px;
          cursor: pointer;
          padding: 4px;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          transition: all 0.2s ease;
      }
      .image-tool-btn:hover:not(.disabled) {
          background: rgba(255,255,255,0.2);
          transform: scale(1.1);
      }
      .image-tool-btn.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
      }
      .image-tool-btn.loading {
          opacity: 0.7;
          cursor: wait;
      }
      .image-tool-icon {
          font-size: 12px;
          line-height: 1;
      }
      /* 单栏模式图片工具栏特殊处理 */
      .passage-content {
          position: relative !important;
      }
      .passage-content .image-toolbar-container {
          position: absolute;
          top: 5px;
          right: 5px;
          z-index: 1001;
      }
      /* 双栏模式图片工具栏定位 */
      .passageContent_wrapper .image-toolbar-container {
          position: absolute;
          top: 5px;
          right: 5px;
      }
      /* 图片预览面板样式 - 完全重写布局 */
  .image-preview-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 100000;
      display: none;
  }
  .image-preview-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      z-index: 100001;
      width: 95%;
      max-width: 1200px;
      height: 90vh;
      display: none;
      flex-direction: column;
      overflow: hidden;
  }
  .image-preview-panel.theme-dark {
      background: #1d1f24;
      border-color: #3c4048;
      color: #eceff4;
  }
  .image-preview-panel.theme-light {
      background: #ffffff;
      border-color: #ddd;
      color: #222;
  }
  /* 顶部固定区域 */
  .image-preview-header {
      padding: 15px 20px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f9f9f9;
      flex-shrink: 0;
      min-height: 60px;
      box-sizing: border-box;
  }
  .image-preview-panel.theme-dark .image-preview-header,
  .image-preview-panel.theme-dark .image-preview-controls,
  .image-preview-panel.theme-dark .image-preview-actions {
      background: #23262d;
      border-color: #3c4048;
  }
  .image-preview-panel.theme-dark .image-preview-stats,
  .image-preview-panel.theme-dark .image-preview-info div,
  .image-preview-panel.theme-dark .image-preview-title,
  .image-preview-panel.theme-dark .select-all-label,
  .image-preview-panel.theme-dark .image-preview-empty {
      color: #dbe2ea;
  }
  .image-preview-panel.theme-dark .image-preview-content,
  .image-preview-panel.theme-dark .image-preview-item,
  .image-preview-panel.theme-dark .image-preview-info,
  .image-preview-panel.theme-dark .image-preview-thumb {
      background: #1d1f24;
  }
  .image-preview-panel.theme-dark .image-preview-item {
      border-color: #3c4048;
  }
  .image-preview-panel.theme-dark .image-preview-item:hover {
      border-color: #5ea0ff;
      box-shadow: 0 2px 8px rgba(94,160,255,0.18);
  }
  .image-preview-panel.theme-dark .image-preview-item.selected {
      border-color: #5ea0ff;
      box-shadow: 0 0 0 2px rgba(94,160,255,0.35);
  }
  .image-preview-panel.theme-dark .image-action-btn,
  .image-preview-panel.theme-dark .control-btn {
      background: #2e3340;
      color: #e8edf3;
      border-color: #414754;
  }
  .image-preview-panel.theme-dark .image-action-btn:hover,
  .image-preview-panel.theme-dark .control-btn:hover {
      background: #4b87ff;
      color: #fff;
      border-color: #4b87ff;
  }
  .image-preview-panel.theme-dark .image-preview-close {
      color: #dbe2ea;
  }
  .image-preview-panel.theme-dark .image-preview-close:hover {
      background: #2e3340;
      color: #fff;
  }
  .image-preview-title {
      font-size: 16px;
      font-weight: bold;
      color: #333;
  }
  .image-preview-close {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #666;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
  }
  .image-preview-close:hover {
      background: #f0f0f0;
      color: #333;
  }
  /* 中间可滚动区域 */
  .image-preview-content-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
  }
  .image-preview-stats {
      padding: 12px 20px;
      border-bottom: 1px solid #eee;
      background: #f5f5f5;
      font-size: 14px;
      color: #666;
      text-align: center;
      flex-shrink: 0;
      min-height: 44px;
      box-sizing: border-box;
  }
  .image-preview-controls {
      padding: 15px 20px;
      border-bottom: 1px solid #eee;
      background: #fafafa;
      flex-shrink: 0;
      min-height: 60px;
      box-sizing: border-box;
  }
  .select-all-container {
      display: flex;
      align-items: center;
      gap: 8px;
  }
  .select-all-checkbox {
      width: 16px;
      height: 16px;
      cursor: pointer;
  }
  .select-all-label {
      font-size: 14px;
      color: #666;
      cursor: pointer;
      font-weight: 500;
  }
  .image-preview-content {
      flex: 1;
      overflow-y: auto;
      padding: 0px 20px;
      min-height: 68vh;
      max-height: 68vh;
  }
  .image-preview-loading {
      height: 100%;
      min-height: 42vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      text-align: center;
      padding: 40px 20px;
  }
  .image-preview-loading-title {
      font-size: 18px;
      font-weight: 600;
  }
  .image-preview-loading-stats {
      font-size: 14px;
      color: inherit;
      opacity: 0.85;
  }
  .image-preview-loading-bar {
      width: min(520px, 80%);
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: #e8ecf1;
  }
  .image-preview-panel.theme-dark .image-preview-loading-bar {
      background: #343943;
  }
  .image-preview-loading-fill {
      width: 0%;
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #4caf50, #2196f3);
      transition: width 0.12s linear;
  }
  .image-preview-loading-tip {
      font-size: 12px;
      opacity: 0.75;
  }
  .image-preview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 5px;
      align-content: flex-start;
  }
  /* 图片项样式 */
  .image-preview-item {
      height: max-content;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      background: white;
      display: flex;
      flex-direction: column;
      height: fit-content;
  }
  .image-preview-item:hover {
      border-color: #4CAF50;
      box-shadow: 0 2px 8px rgba(76,175,80,0.2);
      transform: translateY(-2px);
  }
  .image-preview-item.selected {
      border-color: #4CAF50;
      box-shadow: 0 0 0 2px rgba(76,175,80,0.5);
  }
  .image-preview-checkbox {
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 2;
      width: 18px;
      height: 18px;
      cursor: pointer;
  }
  .image-preview-thumb {
      width: 100%;
      height: 140px;
      object-fit: cover;
      background: #f5f5f5;
      display: block;
  }
  .image-preview-info {
      padding: 12px;
      font-size: 12px;
      color: #333;
      word-break: break-all;
      border-top: 1px solid #eee;
      text-align: center;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
  }
  .image-preview-info div {
      color: #333;
      margin-bottom: 4px;
  }
  .image-preview-info div:first-child {
      font-weight: bold;
      font-size: 13px;
  }
  .image-action-buttons {
      display: flex;
      gap: 6px;
      margin-top: 8px;
      justify-content: center;
  }
  .image-action-btn {
      padding: 4px 10px;
      font-size: 11px;
      border: 1px solid #ddd;
      background: #f8f8f8;
      color: #333;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
      flex: 1;
      max-width: 70px;
  }
  .image-action-btn:hover {
      background: #4CAF50;
      color: white;
      border-color: #4CAF50;
  }
  .image-action-btn.loading {
      background: #ccc;
      color: #666;
      border-color: #ccc;
      cursor: not-allowed;
  }
  .image-action-btn.disabled {
      background: #ccc;
      color: #666;
      border-color: #ccc;
      cursor: not-allowed;
  }
  /* 底部固定区域 */
  .image-preview-actions {
      padding: 20px;
      border-top: 1px solid #eee;
      display: flex;
      gap: 12px;
      justify-content: center;
      background: #f9f9f9;
      flex-wrap: wrap;
      flex-shrink: 0;
      min-height: 80px;
      box-sizing: border-box;
  }
  /* 滚动条样式 */
  .image-preview-content::-webkit-scrollbar {
      width: 8px;
  }
  .image-preview-content::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
  }
  .image-preview-content::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 4px;
  }
  .image-preview-content::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
  }
  /* 空状态样式 */
  .image-preview-empty {
      text-align: center;
      color: #666;
      padding: 40px;
      font-size: 14px;
  }
  /* 响应式设计 */
  @media (max-height: 800px) {
      .image-preview-panel {
          height: 95vh;
          top: 50%;
      }
      .image-preview-thumb {
          height: 120px;
      }
  }
  @media (max-width: 768px) {
      .image-preview-panel {
          width: 98%;
          height: 95vh;
      }
      .image-preview-grid {
          height: 60vh;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 10px;
      }
      .image-preview-actions {
          flex-direction: column;
          gap: 8px;
      }
      .control-btn {
          min-width: auto;
          width: 100%;
      }
  }
  `);
  // 工具函数
  const utils = {
    // 显示通知
    notificationManager: {
      currentNotification: null,
      timeoutId: null,
      show: function (message, duration = 1000) {
        this.clear();
        this.currentNotification = $(`<div class="custom-notification">${message}</div>`);
        $('body').append(this.currentNotification);
        this.timeoutId = setTimeout(() => this.close(), duration);
      },
      close: function () {
        this.currentNotification?.addClass('fade-out');
        setTimeout(() => {
          this.currentNotification?.remove();
          this.currentNotification = null;
        }, 300);
        this.timeoutId && clearTimeout(this.timeoutId);
        this.timeoutId = null;
      },
      clear: function () {
        this.close();
        $('.custom-notification').remove();
      }
    },
    // 检测DOM元素出现
    waitForElement: function (selector, maxAttempts = 80) {
      return new Promise(resolve => {
        let attempts = 0;
        const checkInterval = setInterval(() => {
          if (document.querySelectorAll(selector).length) {
            clearInterval(checkInterval);
            resolve(true);
          }
          if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            resolve(false);
          }
          attempts++;
        }, 100);
      });
    },
    // 检查当前是否是白色主题
    isWhiteTheme: () => {
      const isWhite = document.body.classList.contains('wr_whiteTheme');
      console.log("检查当前是否是白色主题", isWhite);
      GM_setValue('isWhiteTheme', document.body.classList.contains('wr_whiteTheme'));
      return isWhite;
    },
    isThemeChanged: () => GM_getValue('isWhiteTheme') !== utils.isWhiteTheme(),
    // 新增：保存护眼模式状态
    saveEyeProtectionState: function (enabled, color) {
      let notNullColor = color;
      let colorCode = EYE_PROTECTION_COLORS[notNullColor]?.color ?? 'rgb(255, 255, 255)';
      const isWhite = utils.isWhiteTheme();
      if (isWhite) {
        const rgbaMatch = colorCode.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (rgbaMatch && colorCode.startsWith('rgba')) {
          const r = rgbaMatch[1];
          const g = rgbaMatch[2];
          const b = rgbaMatch[3];
          colorCode = `rgb(${r}, ${g}, ${b})`;
        }
      }
      console.log("保存护眼模式状态", enabled, notNullColor, colorCode);
      if (enabled && isWhite) {
        $('#eyeProtectionBtn').addClass('active').text('护眼模式:开')
      } else {
        $('#eyeProtectionBtn').removeClass('active').text('护眼模式:关')
      }
      GM_setValue('weread_eye_protection', enabled);
      GM_setValue('weread_eye_protection_color', notNullColor);
      GM_setValue('weread_eye_protection_color_code', colorCode);
    },
    // 新增：获取护眼模式状态
    getEyeProtectionState: function () {
      return {
        enabled: GM_getValue('weread_eye_protection', false),
        color: GM_getValue('weread_eye_protection_color', 'green'),
        code: GM_getValue('weread_eye_protection_color_code', EYE_PROTECTION_COLORS['green'].color)
      };
    },
    // 同步控制面板背景色与页面背景色
    syncControlPanelBackground: function () {
      const state = utils.getEyeProtectionState();
      const color = state?.color ?? 'white';
      const colorCode = state?.code ?? "rgb(255, 255, 255)";
      const isWhite = utils.isWhiteTheme();
      const isEnabled = state.enabled;
      console.log("护眼模式状态", isEnabled, color, colorCode, isWhite);
      // 移除所有护眼模式类名
      Object.keys(EYE_PROTECTION_COLORS).forEach(colorKey => {
        $('.app_content').removeClass(`eye-protection-${colorKey}`);
        $('.readerChapterContent').removeClass(`eye-protection-${colorKey}`);
        $('.wr_horizontalReader_app_content').removeClass(`eye-protection-${colorKey}`);
        $('.readerChapterContent_container').removeClass(`eye-protection-${colorKey}`);
      });
      if (isWhite) {
        // 清除暗色主题下的内联样式
        this.resetControlPanelStyle();
        if (isEnabled && color) {
          // 应用当前选择的护眼模式样式
          const className = EYE_PROTECTION_COLORS[color]?.className;
          if (className) {
            $('.app_content').addClass(className);
            $('.readerChapterContent').addClass(className);
            $('.readerChapterContent_container').addClass(className);
            $('.wr_horizontalReader_app_content').addClass(className);
          }
          $('#mainControlPanel').css('background-color', colorCode);
        } else {
          $('#mainControlPanel').css({
            'background-color': 'rgba(255, 255, 255, 1)',
            'border-color': '',
            'color': '',
          });
        }
      } else {
        $('#mainControlPanel').css({
          'background-color': 'rgb(32, 32, 32)',
          'border-color': '#3e3e3e'
        });
        // 在暗色主题下，提高控制面板内文字与按钮的对比度
        $('#mainControlPanel').find('.control-section-title').css('color', '#e6e6e6');
        $('#mainControlPanel').find('.control-btn').css({
          'background': '#444',
          'color': '#f5f5f5',
          'border-color': '#555'
        });
      }
    },
    // 恢复控制面板内元素的默认样式（清除可能的暗色主题内联样式）
    resetControlPanelStyle: function () {
      $('#mainControlPanel').find('.control-section-title').css('color', '');
      $('#mainControlPanel').find('.control-btn').css({
        'background': '',
        'color': '',
        'border-color': ''
      });
    },
    handleThemeChange: function () {
      const isWhite = utils.isWhiteTheme();
      const prevState = utils.getEyeProtectionState();
      console.log("handleThemeChange", prevState);//黑->白 false
      if (isWhite) {
        // 切换回白色主题时，恢复之前的状态
        $('#eyeProtectionBtn').removeClass('disabled');
        if (prevState.enabled) {
          utils.saveEyeProtectionState(true, prevState.color);
          // utils.syncControlPanelBackground();
          eyeProtection.enable(prevState.color);
        }
        // utils.syncControlPanelBackground();
        console.log('白色主题已启用，护眼模式已恢复到之前状态');
      } else {
        // 切换到暗色主题时，保存当前状态但暂时禁用
        $('#eyeProtectionBtn').addClass('disabled');
        // utils.syncControlPanelBackground();
        utils.notificationManager.show('插件提示：护眼模式仅在白色主题下可用');
        console.log('白色主题已关闭，护眼模式已暂时禁用');
      }
      utils.syncControlPanelBackground();
    },
    disableConsoleWithProxy: function () {
      // 使用 Proxy 来拦截所有： console 调用
      window.console = new Proxy(console, {
        get: function (target, prop) {
          if (['log', 'warn', 'info', 'debug'].includes(prop)) {
            return function () { }; // 返回空函数
          }
          return target[prop]; // 其他方法保持原样
        }
      });
    }
  };
  // 控制面板拖拽功能
  const panelDrag = {
    init: function (panel) {
      let isDragging = false;
      let startX, startY, initialLeft, initialTop;
      // 鼠标按下事件
      panel.on('mousedown', function (e) {
        // 排除关闭按钮和滑块
        if ($(e.target).is('button, input, .color-option, .control-btn') ||
          $(e.target).closest('button, input, .color-option, .control-btn').length) {
          return;
        }
        isDragging = true;
        panel.addClass('dragging');
        startX = e.clientX;
        startY = e.clientY;
        const rect = panel[0].getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        e.preventDefault();
      });
      // 鼠标移动事件
      $(document).on('mousemove', function (e) {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const newLeft = initialLeft + deltaX;
        const newTop = initialTop + deltaY;
        // 限制在窗口范围内
        const maxX = window.innerWidth - panel.outerWidth();
        const maxY = window.innerHeight - panel.outerHeight();
        panel.css({
          left: Math.max(0, Math.min(newLeft, maxX)) + 'px',
          top: Math.max(0, Math.min(newTop, maxY)) + 'px',
          transform: 'none'
        });
      });
      // 鼠标释放事件
      $(document).on('mouseup', function () {
        if (isDragging) {
          isDragging = false;
          panel.removeClass('dragging');
          // 保存位置
          const position = {
            left: parseInt(panel.css('left')),
            top: parseInt(panel.css('top'))
          };
          GM_setValue('control_panel_position', position);
        }
      });
      // 恢复保存的位置
      const savedPosition = GM_getValue('control_panel_position');
      if (savedPosition) {
        panel.css({
          left: savedPosition.left + 'px',
          top: savedPosition.top + 'px',
          transform: 'none'
        });
      }
    }
  };
  // 图片预览面板功能 - 采用新的固定布局
  const imagePreviewPanel = {
    selectedImages: new Set(),
    isInitialized: false,
    init: function () {
      if (this.isInitialized) return;
      $('body').append(`
        <div class="image-preview-overlay" id="imagePreviewOverlay"></div>
        <div class="image-preview-panel" id="imagePreviewPanel">
          <!-- 顶部固定区域 -->
          <div class="image-preview-header">
            <div class="image-preview-title">页面图片预览</div>
            <span class="image-preview-stats" id="imagePreviewStats">已选择 0 张图片</span>
            <button class="image-preview-close" id="closeImagePreview">×</button>
          </div>
          <!-- 中间可滚动区域 -->
          <div class="image-preview-content-container">
            <div class="image-preview-controls">
              <div class="select-all-container">
                <input type="checkbox" class="select-all-checkbox" id="selectAllImages">
                <label class="select-all-label" for="selectAllImages">全选</label>
              </div>
            </div>
            <div class="image-preview-content" id="imagePreviewContent">
              <!-- 图片网格将通过JavaScript动态加载 -->
            </div>
          </div>
          <!-- 底部固定区域 -->
          <div class="image-preview-actions">
            <button class="control-btn" id="copySelectedImageUrls">复制选中链接</button>
            <button class="control-btn" id="downloadSelectedImages">下载选中图片</button>
            <button class="control-btn" id="copyAllImageUrls">复制所有链接</button>
            <button class="control-btn" id="downloadAllImages">下载所有图片</button>
          </div>
        </div>
      `);
      this.bindEvents();
      this.isInitialized = true;
    },
    bindEvents: function () {
      $('#closeImagePreview, #imagePreviewOverlay').click(() => this.hide());
      $('#selectAllImages').change((e) => this.toggleSelectAll(e.target.checked));
      $('#copySelectedImageUrls').click(() => this.copySelectedImageUrls());
      $('#downloadSelectedImages').click(() => this.downloadSelectedImages());
      $('#copyAllImageUrls').click(() => this.copyAllImageUrls());
      $('#downloadAllImages').click(() => this.downloadAllImages());
      // 阻止点击内容区域关闭
      $('#imagePreviewPanel').click((e) => e.stopPropagation());
    },
    show: function () {
      this.selectedImages.clear();
      this.loadImages();
      $('#imagePreviewOverlay, #imagePreviewPanel').show();
      this.updateStats();
    },
    hide: function () {
      $('#imagePreviewOverlay, #imagePreviewPanel').hide();
      this.selectedImages.clear();
      // 清理DOM以释放内存
      $('#imagePreviewContent').empty();
    },
    loadImages: function () {
      const content = $('#imagePreviewContent');
      content.empty();
      const images = $('img.wr_readerImage_opacity');
      if (images.length === 0) {
        content.html('<div class="image-preview-empty">当前页面没有找到图片</div>');
        return;
      }
      const grid = $('<div class="image-preview-grid" id="imagePreviewGrid"></div>');
      content.append(grid);
      // 分批加载图片，避免卡顿
      this.loadImagesBatch(images, 0, 20, grid);
    },
    loadImagesBatch: function (images, startIndex, batchSize, grid) {
      const endIndex = Math.min(startIndex + batchSize, images.length);
      for (let i = startIndex; i < endIndex; i++) {
        const img = images[i];
        const $img = $(img);
        const src = $img.attr('src') || $img.attr('data-src');
        if (!src) continue;
        const fileName = src.split('/').pop() || `image_${i + 1}.jpg`;
        const fileSize = this.getImageSizeText($img);
        const item = $(`
          <div class="image-preview-item" data-src="${src}" data-index="${i}">
            <input type="checkbox" class="image-preview-checkbox" id="img-checkbox-${i}">
            <img class="image-preview-thumb" src="${src}" alt="预览图 ${i + 1}" loading="lazy" onerror="this.style.display='none'">
            <div class="image-preview-info">
              <div><strong>图片 ${i + 1}</strong></div>
              <div>${fileName}</div>
              <div>${fileSize}</div>
              <div class="image-action-buttons">
                <button class="image-action-btn copy-btn" data-src="${src}" data-index="${i}">复制链接</button>
                <button class="image-action-btn download-btn" data-src="${src}" data-index="${i}">下载图片</button>
              </div>
            </div>
          </div>
        `);
        const checkbox = item.find('.image-preview-checkbox');
        checkbox.change((e) => {
          e.stopPropagation();
          this.toggleImageSelection(i, src, e.target.checked);
        });
        // 点击项目也可以切换选择状态
        item.click((e) => {
          if (e.target.type !== 'checkbox' && !$(e.target).hasClass('image-action-btn')) {
            checkbox.prop('checked', !checkbox.prop('checked')).trigger('change');
          }
        });
        // 绑定操作按钮事件
        item.find('.copy-btn').click((e) => {
          e.stopPropagation();
          this.copySingleImageUrl(src, i);
        });
        item.find('.download-btn').click((e) => {
          e.stopPropagation();
          this.downloadSingleImage(src, i);
        });
        grid.append(item);
      }
      this.updateSelectAllState();
      // 如果还有更多图片，继续加载下一批
      if (endIndex < images.length) {
        setTimeout(() => {
          this.loadImagesBatch(images, endIndex, batchSize, grid);
        }, 100);
      }
    },
    getImageSizeText: function ($img) {
      const width = $img.width();
      const height = $img.height();
      return width && height ? `${width}×${height}` : '尺寸未知';
    },
    toggleImageSelection: function (index, src, selected) {
      if (selected) {
        this.selectedImages.add(index);
        $(`#img-checkbox-${index}`).closest('.image-preview-item').addClass('selected');
      } else {
        this.selectedImages.delete(index);
        $(`#img-checkbox-${index}`).closest('.image-preview-item').removeClass('selected');
      }
      this.updateStats();
      this.updateSelectAllState();
    },
    toggleSelectAll: function (selected) {
      const checkboxes = $('.image-preview-checkbox');
      checkboxes.prop('checked', selected).trigger('change');
    },
    updateSelectAllState: function () {
      const total = $('.image-preview-checkbox').length;
      const selected = this.selectedImages.size;
      const selectAll = $('#selectAllImages');
      if (selected === 0) {
        selectAll.prop('checked', false);
        selectAll.prop('indeterminate', false);
      } else if (selected === total) {
        selectAll.prop('checked', true);
        selectAll.prop('indeterminate', false);
      } else {
        selectAll.prop('checked', false);
        selectAll.prop('indeterminate', true);
      }
    },
    updateStats: function () {
      const total = $('.image-preview-checkbox').length;
      const selected = this.selectedImages.size;
      $('#imagePreviewStats').text(`已选择 ${selected} 张图片，共 ${total} 张`);
    },
    getSelectedImageUrls: function () {
      const urls = [];
      this.selectedImages.forEach(index => {
        const src = $(`#img-checkbox-${index}`).closest('.image-preview-item').data('src');
        if (src) urls.push(src);
      });
      return urls;
    },
    getAllImageUrls: function () {
      const urls = [];
      $('.image-preview-item').each((index, item) => {
        const src = $(item).data('src');
        if (src) urls.push(src);
      });
      return urls;
    },
    // 复制选中图片链接
    copySelectedImageUrls: function () {
      const urls = this.getSelectedImageUrls();
      if (urls.length === 0) {
        utils.notificationManager.show('请先选择要复制的图片');
        return;
      }
      const text = urls.join('\n');
      const copyPromise = new Promise((resolve, reject) => {
        try {
          const result = GM_setClipboard(text, 'text/plain');
          if (result && typeof result.then === 'function') {
            result.then(resolve).catch(reject);
          } else {
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
      copyPromise
        .then(() => {
          utils.notificationManager.show(`已复制 ${urls.length} 个选中图片链接到剪贴板`);
        })
        .catch(err => {
          console.error('复制失败:', err);
          this.fallbackCopyText(text);
        });
    },
    // 下载选中图片
    downloadSelectedImages: function () {
      const urls = this.getSelectedImageUrls();
      if (urls.length === 0) {
        utils.notificationManager.show('请先选择要下载的图片');
        return;
      }
      const downloadBtn = $('#downloadSelectedImages');
      if (downloadBtn.hasClass('loading')) return;
      downloadBtn.addClass('loading disabled').text('下载中...');
      utils.notificationManager.show(`开始下载 ${urls.length} 张选中图片...`);
      imageTools.downloadImagesByUrls(urls, 'selected', () => {
        downloadBtn.removeClass('loading disabled').text('下载选中图片');
      });
    },
    // 复制所有图片链接
    copyAllImageUrls: function () {
      const urls = this.getAllImageUrls();
      if (urls.length === 0) {
        utils.notificationManager.show('没有找到图片链接');
        return;
      }
      const text = urls.join('\n');
      const copyPromise = new Promise((resolve, reject) => {
        try {
          const result = GM_setClipboard(text, 'text/plain');
          if (result && typeof result.then === 'function') {
            result.then(resolve).catch(reject);
          } else {
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
      copyPromise
        .then(() => {
          utils.notificationManager.show(`已复制 ${urls.length} 个图片链接到剪贴板`);
        })
        .catch(err => {
          console.error('复制失败:', err);
          this.fallbackCopyText(text);
        });
    },
    // 下载所有图片
    downloadAllImages: function () {
      const urls = this.getAllImageUrls();
      if (urls.length === 0) {
        utils.notificationManager.show('当前页面没有找到图片');
        return;
      }
      const downloadBtn = $('#downloadAllImages');
      if (downloadBtn.hasClass('loading')) return;
      downloadBtn.addClass('loading disabled').text('下载中...');
      utils.notificationManager.show(`开始下载 ${urls.length} 张图片...`);
      imageTools.downloadImagesByUrls(urls, 'all', () => {
        downloadBtn.removeClass('loading disabled').text('下载所有图片');
      });
    },
    // 复制单个图片链接
    copySingleImageUrl: function (src, index) {
      if (!src) {
        utils.notificationManager.show('获取图片链接失败');
        return;
      }
      const copyPromise = new Promise((resolve, reject) => {
        try {
          const result = GM_setClipboard(src, 'text/plain');
          if (result && typeof result.then === 'function') {
            result.then(resolve).catch(reject);
          } else {
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
      copyPromise
        .then(() => {
          utils.notificationManager.show('图片链接已复制到剪贴板');
        })
        .catch(err => {
          console.error('复制失败:', err);
          this.fallbackCopyText(src);
        });
    },
    // 下载单个图片
    downloadSingleImage: function (src, index) {
      if (!src) {
        utils.notificationManager.show('获取图片链接失败');
        return;
      }
      const downloadBtn = $(`.image-action-btn.download-btn[data-index="${index}"]`);
      if (downloadBtn.hasClass('loading')) return;
      downloadBtn.addClass('loading disabled').text('下载中...');
      utils.notificationManager.show('开始下载单个图片...');
      imageTools.downloadSingleImageByUrl(src, index, () => {
        downloadBtn.removeClass('loading disabled').text('下载图片');
      });
    },
    // 备用复制方法
    fallbackCopyText: function (text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(() => {
            utils.notificationManager.show('已复制到剪贴板');
          }).catch(() => {
            this.fallbackCopyText2(text);
          });
        } else {
          this.fallbackCopyText2(text);
        }
      } catch (error) {
        console.error('备用复制方法1失败:', error);
        this.fallbackCopyText2(text);
      }
    },
    // 备用复制方法2
    fallbackCopyText2: function (text) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          utils.notificationManager.show('已复制到剪贴板');
        } else {
          utils.notificationManager.show('复制失败，请手动复制');
        }
      } catch (error) {
        console.error('备用复制方法2失败:', error);
        utils.notificationManager.show('复制失败，请手动复制');
      }
    }
  };
  // 图片工具功能
  Object.assign(imagePreviewPanel, { bindEvents () { $('#closeImagePreview, #imagePreviewOverlay').off('click.imagePreview').on('click.imagePreview', () => this.hide()); $('#selectAllImages').off('change.imagePreview').on('change.imagePreview', e => this.toggleSelectAll(e.target.checked)); $('#copySelectedImageUrls').off('click.imagePreview').on('click.imagePreview', () => this.copySelectedImageUrls()); $('#downloadSelectedImages').off('click.imagePreview').on('click.imagePreview', () => this.downloadSelectedImages()); $('#copyAllImageUrls').off('click.imagePreview').on('click.imagePreview', () => this.copyAllImageUrls()); $('#downloadAllImages').off('click.imagePreview').on('click.imagePreview', () => this.downloadAllImages()); $('#imagePreviewPanel').off('click.imagePreview').on('click.imagePreview', e => e.stopPropagation()); }, observeThemeChange () { if (this.themeObserver) return; this.themeObserver = new MutationObserver(() => this.applyTheme()); this.themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] }); }, getThemeMode () { return utils.isWhiteTheme() ? 'light' : 'dark'; }, applyTheme () { this.currentTheme = this.getThemeMode(); $('#imagePreviewPanel').removeClass('theme-light theme-dark').addClass(`theme-${this.currentTheme}`); $('#imagePreviewOverlay').removeClass('theme-light theme-dark').addClass(`theme-${this.currentTheme}`); }, getTimeText (seconds) { const safe = Math.max(0, Math.round(seconds || 0)); return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`; }, getCurrentChapterLabel () { return ($('.readerTopBar_title_chapter').text() || $('.readerTopBar_title_link').text() || '').trim() || '未命名章节'; }, isBlankImage ($img, src) { if (!src || src.startsWith('data:image/gif')) return true; if ($img.is(':hidden')) return true; const width = $img[0]?.naturalWidth || $img.width() || 0; const height = $img[0]?.naturalHeight || $img.height() || 0; return !width || !height || width <= 4 || height <= 4; }, collectImageNodes (visitedNodes, imageList, chapterState) { $('img.wr_readerImage_opacity').each((_, img) => { if (visitedNodes.has(img)) return; visitedNodes.add(img); const $img = $(img); const src = $img.attr('src') || $img.attr('data-src'); if (this.isBlankImage($img, src)) return; const chapter = this.getCurrentChapterLabel(); if (chapter && chapter !== chapterState.lastChapter) { chapterState.lastChapter = chapter; chapterState.chapterCount += 1; } imageList.push({ src, width: $img[0]?.naturalWidth || $img.width() || 0, height: $img[0]?.naturalHeight || $img.height() || 0, chapter: chapter || `章节 ${chapterState.chapterCount || 1}`, order: imageList.length, fileName: src.split('/').pop() || `image_${imageList.length + 1}.jpg` }); }); }, wait (ms) { return new Promise(resolve => setTimeout(resolve, ms)); }, setLoadingView (chapterCount, imageCount, estimatedText, progress) { $('#imagePreviewContent').html(`<div class="image-preview-loading"><div class="image-preview-loading-title">正在加载全书图片</div><div class="image-preview-loading-stats" id="imagePreviewLoadingStats">章节 ${chapterCount} | 图片 ${imageCount} | 预计 ${estimatedText}</div><div class="image-preview-loading-bar"><div class="image-preview-loading-fill" id="imagePreviewLoadingFill" style="width:${progress}%"></div></div><div class="image-preview-loading-tip">可关闭面板取消加载</div></div>`); this.updateStats(chapterCount, imageCount); }, updateLoadingView (chapterCount, imageCount, estimatedText, progress) { $('#imagePreviewLoadingStats').text(`章节 ${chapterCount} | 图片 ${imageCount} | 预计 ${estimatedText}`); $('#imagePreviewLoadingFill').css('width', `${Math.max(0, Math.min(100, progress))}%`); this.updateStats(chapterCount, imageCount); }, async startBookImageCollection (token) { const visitedNodes = new WeakSet(); const imageList = []; const chapterState = { chapterCount: 0, lastChapter: '' }; const startScrollTop = this.originalScrollTop; const step = Math.max(280, Math.floor(window.innerHeight * 0.8)); let round = 0; let stableBottomRounds = 0; let lastScrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight); const startTime = Date.now(); const updateProgress = () => { const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0; const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight); const maxScroll = Math.max(1, scrollHeight - window.innerHeight); const progress = Math.min(99, Math.max(0, (scrollTop / maxScroll) * 100)); const elapsed = (Date.now() - startTime) / 1000; const eta = progress > 0 ? Math.max(1, elapsed * (100 / progress - 1)) : 0; this.updateLoadingView(chapterState.chapterCount, imageList.length, progress > 0 ? this.getTimeText(eta) : '--:--', progress); }; this.collectImageNodes(visitedNodes, imageList, chapterState); updateProgress(); while (round < 800 && !this.loadCancelled && this.loadToken === token) { const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0; const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight); const maxScroll = Math.max(1, scrollHeight - window.innerHeight); const nextTop = Math.min(maxScroll, scrollTop + step); stableBottomRounds = nextTop >= maxScroll - 4 ? stableBottomRounds + 1 : 0; if (stableBottomRounds >= 3) break; window.scrollTo(0, nextTop); await this.wait(260); this.collectImageNodes(visitedNodes, imageList, chapterState); updateProgress(); const newScrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight); if (newScrollHeight > lastScrollHeight + 6) { stableBottomRounds = 0; lastScrollHeight = newScrollHeight; } round += 1; } await this.wait(220); this.collectImageNodes(visitedNodes, imageList, chapterState); updateProgress(); window.scrollTo(0, startScrollTop); return imageList; }, renderImages (images) { const content = $('#imagePreviewContent').empty(); if (!images || !images.length) return this.renderEmpty('当前页面没有找到图片'); const grid = $('<div class="image-preview-grid" id="imagePreviewGrid"></div>'); content.append(grid); this.renderImagesBatch(images, 0, 30, grid); }, renderImagesBatch (images, startIndex, batchSize, grid) { const endIndex = Math.min(startIndex + batchSize, images.length); for (let i = startIndex; i < endIndex; i++) { const image = images[i]; const fileSize = image.width && image.height ? `${image.width}×${image.height}` : '尺寸未知'; const item = $(`<div class="image-preview-item" data-src="${image.src}" data-index="${i}" data-chapter="${image.chapter}"><input type="checkbox" class="image-preview-checkbox" id="img-checkbox-${i}"><img class="image-preview-thumb" src="${image.src}" alt="预览图 ${i + 1}" loading="lazy" onerror="this.style.display='none'"><div class="image-preview-info"><div><strong>图片 ${i + 1}</strong></div><div>${image.chapter}</div><div>${image.fileName}</div><div>${fileSize}</div><div class="image-action-buttons"><button class="image-action-btn copy-btn" data-src="${image.src}" data-index="${i}">复制链接</button><button class="image-action-btn download-btn" data-src="${image.src}" data-index="${i}">下载图片</button></div></div></div>`); const checkbox = item.find('.image-preview-checkbox'); checkbox.change(e => { e.stopPropagation(); this.toggleImageSelection(i, image.src, e.target.checked); }); item.click(e => { if (e.target.type !== 'checkbox' && !$(e.target).hasClass('image-action-btn')) { checkbox.prop('checked', !checkbox.prop('checked')).trigger('change'); } }); item.find('.copy-btn').click(e => { e.stopPropagation(); this.copySingleImageUrl(image.src, i); }); item.find('.download-btn').click(e => { e.stopPropagation(); this.downloadSingleImage(image.src, i); }); grid.append(item); } this.updateSelectAllState(); this.updateStats(); if (endIndex < images.length && !this.loadCancelled) setTimeout(() => this.renderImagesBatch(images, endIndex, batchSize, grid), 80); }, renderEmpty (message) { $('#imagePreviewContent').html(`<div class="image-preview-empty">${message}</div>`); this.updateStats(); }, show () { this.selectedImages.clear(); this.allImages = []; this.originalScrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0; this.loadCancelled = false; this.isLoading = true; this.applyTheme(); $('#imagePreviewOverlay, #imagePreviewPanel').show(); this.setLoadingView(0, 0, '--:--', 0); const token = ++this.loadToken; Promise.resolve().then(() => this.startBookImageCollection(token)).then(images => { if (this.loadToken !== token || this.loadCancelled) return; this.isLoading = false; this.allImages = images; this.renderImages(images); }).catch(err => { if (this.loadToken !== token) return; this.isLoading = false; console.error('图片预览加载失败:', err); this.renderEmpty('图片加载失败，请稍后重试'); }); }, hide () { this.loadCancelled = true; this.loadToken += 1; this.isLoading = false; $('#imagePreviewOverlay, #imagePreviewPanel').hide(); this.selectedImages.clear(); $('#imagePreviewContent').empty(); window.scrollTo(0, this.originalScrollTop || 0); }, getChapterCountFromImages () { return this.allImages.length ? new Set(this.allImages.map(item => item.chapter).filter(Boolean)).size : 0; }, updateStats (chapterCount = 0, imageCount = 0) { const selected = this.selectedImages.size; const total = imageCount || this.allImages.length || $('.image-preview-checkbox').length; const chapters = this.isLoading ? chapterCount : this.getChapterCountFromImages(); $('#imagePreviewStats').text(`已选择 ${selected} 张图片 | 章节 ${chapters} | 共 ${total} 张`); }, getAllImageUrls () { return this.allImages.length ? this.allImages.map(item => item.src).filter(Boolean) : $('.image-preview-item').map((_, item) => $(item).data('src')).get().filter(Boolean); }, confirmDownloadAll (count) { return window.confirm(`将下载 ${count} 张图片，继续吗？`); }, downloadAllImages () { const urls = this.getAllImageUrls(); if (!urls.length) return utils.notificationManager.show('当前页面没有找到图片'); if (!this.confirmDownloadAll(urls.length)) return; const downloadBtn = $('#downloadAllImages'); if (downloadBtn.hasClass('loading')) return; downloadBtn.addClass('loading disabled').text('下载中...'); utils.notificationManager.show(`开始下载 ${urls.length} 张图片...`); imageTools.downloadImagesByUrls(urls, 'all', () => downloadBtn.removeClass('loading disabled').text('下载所有图片')); } });
  Object.assign(imagePreviewPanel, {
    allImages: [],
    isLoading: false,
    loadCancelled: false,
    loadToken: 0,
    originalScrollTop: 0,
    currentTheme: 'light',
    pendingAction: null,
    themeObserver: null,
    directDownloadTrigger: null,
    pendingTimeouts: new Set(),
    pendingWaits: new Set(),
    init: function () {
      if (this.isInitialized) return;
      $('#imagePreviewOverlay, #imagePreviewPanel').remove();
      $('body').append(`
        <div class="image-preview-overlay" id="imagePreviewOverlay"></div>
        <div class="image-preview-panel" id="imagePreviewPanel">
          <div class="image-preview-header">
            <div class="image-preview-title">全书图片预览</div>
            <span class="image-preview-stats" id="imagePreviewStats">已选择 0 张图片 | 章节 0 | 共 0 张</span>
            <button class="image-preview-close" id="closeImagePreview">×</button>
          </div>
          <div class="image-preview-content-container">
            <div class="image-preview-controls">
              <div class="select-all-container">
                <input type="checkbox" class="select-all-checkbox" id="selectAllImages">
                <label class="select-all-label" for="selectAllImages">全选</label>
              </div>
            </div>
            <div class="image-preview-content" id="imagePreviewContent"></div>
          </div>
          <div class="image-preview-actions">
            <button class="control-btn" id="copySelectedImageUrls">复制选中链接</button>
            <button class="control-btn" id="downloadSelectedImages">下载选中图片</button>
            <button class="control-btn" id="copyAllImageUrls">复制全部链接</button>
            <button class="control-btn" id="downloadAllImages">下载所有图片</button>
          </div>
        </div>
      `);
      this.bindEvents();
      this.observeThemeChange();
      this.applyTheme();
      this.isInitialized = true;
    },
    bindEvents: function () {
      $('#closeImagePreview, #imagePreviewOverlay').off('click.imagePreview').on('click.imagePreview', () => this.hide());
      $('#selectAllImages').off('change.imagePreview').on('change.imagePreview', (e) => this.toggleSelectAll(e.target.checked));
      $('#copySelectedImageUrls').off('click.imagePreview').on('click.imagePreview', () => this.copySelectedImageUrls());
      $('#downloadSelectedImages').off('click.imagePreview').on('click.imagePreview', () => this.downloadSelectedImages());
      $('#copyAllImageUrls').off('click.imagePreview').on('click.imagePreview', () => this.copyAllImageUrls());
      $('#downloadAllImages').off('click.imagePreview').on('click.imagePreview', () => this.downloadAllImages());
      $('#imagePreviewPanel').off('click.imagePreview').on('click.imagePreview', (e) => e.stopPropagation());
    },
    observeThemeChange: function () {
      if (this.themeObserver) return;
      this.themeObserver = new MutationObserver(() => this.applyTheme());
      this.themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
      });
    },
    getThemeMode: function () {
      return utils.isWhiteTheme() ? 'light' : 'dark';
    },
    applyTheme: function () {
      this.currentTheme = this.getThemeMode();
      $('#imagePreviewPanel').removeClass('theme-light theme-dark').addClass(`theme-${this.currentTheme}`);
      $('#imagePreviewOverlay').removeClass('theme-light theme-dark').addClass(`theme-${this.currentTheme}`);
    },
    createCancelError: function () {
      const error = new Error('IMAGE_PREVIEW_CANCELLED');
      error.code = 'IMAGE_PREVIEW_CANCELLED';
      return error;
    },
    isCancelError: function (error) {
      return error && (error.code === 'IMAGE_PREVIEW_CANCELLED' || error.message === 'IMAGE_PREVIEW_CANCELLED');
    },
    isActiveToken: function (token) {
      return !this.loadCancelled && this.loadToken === token;
    },
    queueTimeout: function (handler, delay) {
      const timerId = setTimeout(() => {
        this.pendingTimeouts.delete(timerId);
        handler();
      }, delay);
      this.pendingTimeouts.add(timerId);
      return timerId;
    },
    clearPendingWork: function () {
      this.pendingTimeouts.forEach((timerId) => clearTimeout(timerId));
      this.pendingTimeouts.clear();
      this.pendingWaits.forEach((task) => {
        clearTimeout(task.timerId);
        task.reject(this.createCancelError());
      });
      this.pendingWaits.clear();
    },
    wait: function (ms, token) {
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
    getScrollRoot: function () {
      return document.scrollingElement || document.documentElement || document.body;
    },
    getScrollMetrics: function () {
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
    setScrollTop: function (top) {
      const nextTop = Math.max(0, Math.round(top || 0));
      window.scrollTo(0, nextTop);
      const root = this.getScrollRoot();
      if (root) root.scrollTop = nextTop;
    },
    triggerReaderLoad: function () {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('resize'));
      document.dispatchEvent(new Event('scroll'));
    },
    getTimeText: function (seconds) {
      const safe = Math.max(0, Math.round(seconds || 0));
      return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
    },
    getCurrentChapterLabel: function () {
      return ($('.readerTopBar_title_chapter').text() || $('.readerTopBar_title_link').text() || $('.readerCatalog_currentChapter').text() || '').trim() || '未命名章节';
    },
    getImageSelectors: function () {
      return [
        '.readerChapterContent img',
        '.readerChapterContent_container img',
        '.wr_horizontalReader_app_content img',
        '.app_content img'
      ].join(', ');
    },
    getCandidateImages: function () {
      return $(this.getImageSelectors()).filter((_, img) => {
        const $img = $(img);
        return !$img.closest('.image-preview-panel, .image-toolbar-container, .control-panel, .readerControls, .readerTopBar').length;
      });
    },
    getImageDimensions: function ($img) {
      const el = $img[0];
      return {
        width: el?.naturalWidth || $img.width() || el?.width || Number($img.attr('width')) || 0,
        height: el?.naturalHeight || $img.height() || el?.height || Number($img.attr('height')) || 0
      };
    },
    getImageSizeText: function (image) {
      const width = image?.width || 0;
      const height = image?.height || 0;
      return width && height ? `${width}×${height}` : '尺寸未知';
    },
    isBlankImage: function ($img, src) {
      if (!src || src.startsWith('data:image/gif')) return true;
      const dimensions = this.getImageDimensions($img);
      return !dimensions.width || !dimensions.height || dimensions.width <= 4 || dimensions.height <= 4;
    },
    extractFileName: function (src, fallbackIndex) {
      try {
        const url = new URL(src, window.location.origin);
        const lastSegment = decodeURIComponent(url.pathname.split('/').pop() || '');
        if (lastSegment) return lastSegment;
      } catch (error) {
        console.error('图片文件名解析失败:', src, error);
      }
      return `image_${fallbackIndex}.jpg`;
    },
    buildImageEntry: function ($img, src, chapter, state) {
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
    collectImageNodes: function (state) {
      const chapter = this.getCurrentChapterLabel();
      if (chapter) state.chapterSet.add(chapter);
      this.getCandidateImages().each((_, img) => {
        if (state.visitedNodes.has(img)) return;
        state.visitedNodes.add(img);
        const $img = $(img);
        const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original');
        if (this.isBlankImage($img, src)) return;
        const entry = this.buildImageEntry($img, src, chapter || '未命名章节', state);
        const existing = state.imageMap.get(entry.src);
        if (existing) {
          existing.duplicateCount += 1;
          if (entry.chapter && !existing.chapters.includes(entry.chapter)) {
            existing.chapters.push(entry.chapter);
          }
          existing.lastOrder = Math.max(existing.lastOrder || existing.order, entry.order);
          return;
        }
        state.imageMap.set(entry.src, entry);
        state.images.push(entry);
      });
      state.chapterCount = state.chapterSet.size;
    },
    estimateProgress: function () {
      const metrics = this.getScrollMetrics();
      if (metrics.maxScrollTop <= 0) return 0;
      return Math.min(99, Math.max(0, (metrics.scrollTop / metrics.maxScrollTop) * 100));
    },
    setLoadingView: function (chapterCount, imageCount, estimatedText, progress, statusText = '正在准备扫描全书内容...') {
      $('#imagePreviewContent').html(`
        <div class="image-preview-loading">
          <div class="image-preview-loading-title">正在加载全书图片</div>
          <div class="image-preview-loading-stats" id="imagePreviewLoadingStats">章节 ${chapterCount} | 图片 ${imageCount} | 预计 ${estimatedText}</div>
          <div class="image-preview-loading-bar">
            <div class="image-preview-loading-fill" id="imagePreviewLoadingFill" style="width:${progress}%"></div>
          </div>
          <div class="image-preview-loading-status" id="imagePreviewLoadingStatus">${statusText}</div>
          <div class="image-preview-loading-tip">关闭面板即可取消抓取与渲染</div>
        </div>
      `);
      this.updateStats(chapterCount, imageCount);
    },
    updateLoadingView: function (chapterCount, imageCount, estimatedText, progress, statusText = '') {
      $('#imagePreviewLoadingStats').text(`章节 ${chapterCount} | 图片 ${imageCount} | 预计 ${estimatedText}`);
      $('#imagePreviewLoadingFill').css('width', `${Math.max(0, Math.min(100, progress))}%`);
      $('#imagePreviewLoadingStatus').text(statusText || '正在扫描...');
      this.updateStats(chapterCount, imageCount);
    },
    updateCollectionProgress: function (state, progress, statusText) {
      const elapsed = (Date.now() - state.startTime) / 1000;
      const eta = progress > 0 ? Math.max(1, elapsed * (100 / progress - 1)) : 0;
      this.updateLoadingView(state.chapterCount, state.images.length, progress > 0 ? this.getTimeText(eta) : '--:--', progress, statusText);
    },
    waitForGrowth: async function (token, state, baseline) {
      let hasGrowth = false;
      for (let attempt = 0; attempt < 6; attempt++) {
        await this.wait(220 + attempt * 40, token);
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
        this.updateCollectionProgress(state, this.estimateProgress(), `已扫描 ${state.chapterCount} 章，发现 ${state.images.length} 张图片`);
        if (hasGrowth && attempt >= 1) break;
      }
      return hasGrowth;
    },
    startBookImageCollection: async function (token) {
      const state = {
        visitedNodes: new WeakSet(),
        imageMap: new Map(),
        images: [],
        chapterSet: new Set(),
        chapterCount: 0,
        sequence: 1,
        startTime: Date.now()
      };
      const startScrollTop = this.originalScrollTop;
      const step = Math.max(320, Math.floor((window.innerHeight || 900) * 0.85));
      let round = 0;
      let stableBottomRounds = 0;
      let stalledRounds = 0;
      let lastImageCount = 0;
      let lastScrollHeight = this.getScrollMetrics().scrollHeight;
      try {
        this.collectImageNodes(state);
        this.updateCollectionProgress(state, this.estimateProgress(), '正在扫描封面与当前章节...');
        while (round < 1200 && this.isActiveToken(token)) {
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
          stalledRounds = (!hasNewImages && !hasNewHeight && !hasGrowth) ? stalledRounds + 1 : 0;
          lastImageCount = state.images.length;
          lastScrollHeight = afterMetrics.scrollHeight;
          if (stableBottomRounds >= 4 && stalledRounds >= 3) break;
          round += 1;
        }
        this.setScrollTop(this.getScrollMetrics().maxScrollTop);
        await this.waitForGrowth(token, state, {
          imageCount: lastImageCount,
          scrollHeight: lastScrollHeight
        });
        this.collectImageNodes(state);
        this.updateCollectionProgress(state, 100, `扫描完成，共整理 ${state.images.length} 张去重图片`);
        return state.images.sort((a, b) => a.order - b.order).map((item, index) => ({
          ...item,
          displayIndex: index + 1
        }));
      } finally {
        this.setScrollTop(startScrollTop);
      }
    },
    getImageChapterText: function (image) {
      const chapters = image.chapters || [];
      if (!chapters.length) return image.chapter || '未命名章节';
      if (chapters.length === 1) return chapters[0];
      return `${chapters[0]} 等 ${chapters.length} 章`;
    },
    renderImages: function (images) {
      const content = $('#imagePreviewContent').empty();
      if (!images || !images.length) {
        this.renderEmpty('全书未找到可用图片');
        return;
      }
      const grid = $('<div class="image-preview-grid" id="imagePreviewGrid"></div>');
      content.append(grid);
      this.renderImagesBatch(images, 0, 24, grid, this.loadToken);
    },
    renderImagesBatch: function (images, startIndex, batchSize, grid, token) {
      if (!this.isActiveToken(token)) return;
      const endIndex = Math.min(startIndex + batchSize, images.length);
      for (let i = startIndex; i < endIndex; i++) {
        const image = images[i];
        const item = $(`
          <div class="image-preview-item" data-src="${image.src}" data-index="${i}" data-chapter="${this.getImageChapterText(image)}">
            <input type="checkbox" class="image-preview-checkbox" id="img-checkbox-${i}" data-index="${i}">
            <img class="image-preview-thumb" src="${image.src}" alt="预览图 ${i + 1}" loading="lazy" onerror="this.style.display='none'">
            <div class="image-preview-info">
              <div><strong>图片 ${i + 1}</strong></div>
              <div class="image-preview-meta">${this.getImageChapterText(image)}</div>
              <div class="image-preview-meta">${image.fileName}</div>
              <div class="image-preview-meta">${this.getImageSizeText(image)}</div>
              <div class="image-preview-meta">${image.duplicateCount > 1 ? `重复 ${image.duplicateCount} 次` : '唯一图片'}</div>
              <div class="image-action-buttons">
                <button class="image-action-btn copy-btn" data-src="${image.src}" data-index="${i}">复制链接</button>
                <button class="image-action-btn download-btn" data-src="${image.src}" data-index="${i}">下载图片</button>
              </div>
            </div>
          </div>
        `);
        const checkbox = item.find('.image-preview-checkbox');
        checkbox.on('change', (e) => {
          e.stopPropagation();
          this.toggleImageSelection(i, e.target.checked);
        });
        item.on('click', (e) => {
          if (e.target.type !== 'checkbox' && !$(e.target).hasClass('image-action-btn')) {
            checkbox.prop('checked', !checkbox.prop('checked')).trigger('change');
          }
        });
        item.find('.copy-btn').on('click', (e) => {
          e.stopPropagation();
          this.copySingleImageUrl(image.src);
        });
        item.find('.download-btn').on('click', (e) => {
          e.stopPropagation();
          this.downloadSingleImage(image, i);
        });
        grid.append(item);
      }
      this.updateSelectAllState();
      this.updateStats();
      if (endIndex < images.length && this.isActiveToken(token)) {
        this.queueTimeout(() => this.renderImagesBatch(images, endIndex, batchSize, grid, token), 60);
      }
    },
    renderEmpty: function (message) {
      $('#imagePreviewContent').html(`<div class="image-preview-empty">${message}</div>`);
      this.updateStats();
    },
    resetExternalTriggerButton: function () {
      if (this.directDownloadTrigger && this.directDownloadTrigger.length) {
        this.directDownloadTrigger.removeClass('loading disabled').text(this.directDownloadTrigger.data('original-text') || '下载所有图片');
      }
      this.directDownloadTrigger = null;
    },
    show: function (options = {}) {
      this.clearPendingWork();
      this.selectedImages.clear();
      this.allImages = [];
      this.pendingAction = options.autoDownload ? { type: 'downloadAll' } : null;
      this.originalScrollTop = this.getScrollMetrics().scrollTop;
      this.loadCancelled = false;
      this.isLoading = true;
      this.applyTheme();
      $('#selectAllImages').prop('checked', false).prop('indeterminate', false);
      $('#imagePreviewOverlay, #imagePreviewPanel').show();
      this.setLoadingView(0, 0, '--:--', 0, '正在准备扫描全书图片...');
      const token = ++this.loadToken;
      Promise.resolve()
        .then(() => this.startBookImageCollection(token))
        .then((images) => {
          if (!this.isActiveToken(token)) return;
          this.isLoading = false;
          this.allImages = images;
          if (!images.length) {
            this.renderEmpty('全书未找到可用图片');
            return;
          }
          this.renderImages(images);
          if (this.pendingAction?.type === 'downloadAll') {
            this.pendingAction = null;
            this.downloadAllImages();
          }
        })
        .catch((error) => {
          if (this.isCancelError(error) || this.loadToken !== token) return;
          this.isLoading = false;
          console.error('图片预览加载失败:', error);
          this.renderEmpty('图片加载失败，请稍后重试');
        })
        .finally(() => {
          if (this.loadToken === token) {
            this.isLoading = false;
            this.updateStats();
            this.resetExternalTriggerButton();
          }
        });
    },
    hide: function () {
      const wasLoading = this.isLoading;
      this.loadCancelled = true;
      this.loadToken += 1;
      this.isLoading = false;
      this.pendingAction = null;
      this.clearPendingWork();
      $('#imagePreviewOverlay, #imagePreviewPanel').hide();
      $('#imagePreviewContent').empty();
      $('#selectAllImages').prop('checked', false).prop('indeterminate', false);
      this.selectedImages.clear();
      this.resetExternalTriggerButton();
      this.setScrollTop(this.originalScrollTop || 0);
      if (wasLoading) utils.notificationManager.show('已取消全书图片加载');
    },
    openForBulkDownload: function (triggerButton) {
      const button = triggerButton && triggerButton.length ? triggerButton : $('#downloadAllImagesFromPanel');
      if (button.length && button.hasClass('loading')) return;
      if (button.length) button.addClass('loading disabled').text('准备中...');
      this.directDownloadTrigger = button.length ? button : null;
      this.show({ autoDownload: true });
    },
    getChapterCountFromImages: function () {
      return this.allImages.length ? new Set(this.allImages.map((item) => this.getImageChapterText(item))).size : 0;
    },
    updateStats: function (chapterCount = 0, imageCount = 0) {
      const selected = this.selectedImages.size;
      const total = imageCount || this.allImages.length || $('.image-preview-checkbox').length;
      const chapters = this.isLoading ? chapterCount : this.getChapterCountFromImages();
      $('#imagePreviewStats').text(`已选择 ${selected} 张图片 | 章节 ${chapters} | 共 ${total} 张`);
    },
    toggleImageSelection: function (index, selected) {
      if (selected) {
        this.selectedImages.add(index);
        $(`#img-checkbox-${index}`).closest('.image-preview-item').addClass('selected');
      } else {
        this.selectedImages.delete(index);
        $(`#img-checkbox-${index}`).closest('.image-preview-item').removeClass('selected');
      }
      this.updateStats();
      this.updateSelectAllState();
    },
    toggleSelectAll: function (selected) {
      const checkboxes = $('.image-preview-checkbox');
      this.selectedImages.clear();
      checkboxes.each((_, checkbox) => {
        const index = Number(checkbox.dataset.index);
        checkbox.checked = selected;
        $(checkbox).closest('.image-preview-item').toggleClass('selected', selected);
        if (selected) this.selectedImages.add(index);
      });
      this.updateStats();
      this.updateSelectAllState();
    },
    updateSelectAllState: function () {
      const total = $('.image-preview-checkbox').length;
      const selected = this.selectedImages.size;
      const selectAll = $('#selectAllImages');
      if (!total || selected === 0) {
        selectAll.prop('checked', false).prop('indeterminate', false);
      } else if (selected === total) {
        selectAll.prop('checked', true).prop('indeterminate', false);
      } else {
        selectAll.prop('checked', false).prop('indeterminate', true);
      }
    },
    getSelectedImageItems: function () {
      return [...this.selectedImages].map((index) => this.allImages[index]).filter((item) => item && item.src);
    },
    getSelectedImageUrls: function () {
      return this.getSelectedImageItems().map((item) => item.src);
    },
    getAllImageItems: function () {
      return this.allImages.filter((item) => item && item.src);
    },
    getAllImageUrls: function () {
      return this.getAllImageItems().map((item) => item.src);
    },
    copyTextWithGM: function (text) {
      return new Promise((resolve, reject) => {
        try {
          const result = GM_setClipboard(text, 'text/plain');
          if (result && typeof result.then === 'function') {
            result.then(resolve).catch(reject);
          } else {
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
    },
    copySelectedImageUrls: function () {
      const urls = this.getSelectedImageUrls();
      if (!urls.length) {
        utils.notificationManager.show('请先选择要复制的图片');
        return;
      }
      const text = urls.join('\n');
      this.copyTextWithGM(text)
        .then(() => utils.notificationManager.show(`已复制 ${urls.length} 个选中图片链接到剪贴板`))
        .catch((error) => {
          console.error('复制失败:', error);
          this.fallbackCopyText(text);
        });
    },
    downloadSelectedImages: function () {
      const items = this.getSelectedImageItems();
      if (!items.length) {
        utils.notificationManager.show('请先选择要下载的图片');
        return;
      }
      const downloadBtn = $('#downloadSelectedImages');
      if (downloadBtn.hasClass('loading')) return;
      downloadBtn.addClass('loading disabled').text('下载中...');
      utils.notificationManager.show(`开始下载 ${items.length} 张选中图片...`);
      imageTools.downloadImagesByUrls(items, 'selected', () => {
        downloadBtn.removeClass('loading disabled').text('下载选中图片');
      });
    },
    copyAllImageUrls: function () {
      const urls = this.getAllImageUrls();
      if (!urls.length) {
        utils.notificationManager.show('没有找到图片链接');
        return;
      }
      const text = urls.join('\n');
      this.copyTextWithGM(text)
        .then(() => utils.notificationManager.show(`已复制 ${urls.length} 个图片链接到剪贴板`))
        .catch((error) => {
          console.error('复制失败:', error);
          this.fallbackCopyText(text);
        });
    },
    confirmDownloadAll: function (count) {
      return window.confirm(`将下载 ${count} 张图片，继续吗？`);
    },
    downloadAllImages: function () {
      const items = this.getAllImageItems();
      if (!items.length) {
        utils.notificationManager.show('当前页面没有找到图片');
        return;
      }
      if (!this.confirmDownloadAll(items.length)) return;
      const downloadBtn = $('#downloadAllImages');
      if (downloadBtn.hasClass('loading')) return;
      downloadBtn.addClass('loading disabled').text('下载中...');
      utils.notificationManager.show(`开始下载 ${items.length} 张图片...`);
      imageTools.downloadImagesByUrls(items, 'all', () => {
        downloadBtn.removeClass('loading disabled').text('下载所有图片');
      });
    },
    copySingleImageUrl: function (src) {
      if (!src) {
        utils.notificationManager.show('获取图片链接失败');
        return;
      }
      this.copyTextWithGM(src)
        .then(() => utils.notificationManager.show('图片链接已复制到剪贴板'))
        .catch((error) => {
          console.error('复制失败:', error);
          this.fallbackCopyText(src);
        });
    },
    downloadSingleImage: function (image, index) {
      if (!image?.src) {
        utils.notificationManager.show('获取图片链接失败');
        return;
      }
      const downloadBtn = $(`.image-action-btn.download-btn[data-index="${index}"]`);
      if (downloadBtn.hasClass('loading')) return;
      downloadBtn.addClass('loading disabled').text('下载中...');
      utils.notificationManager.show('开始下载单张图片...');
      imageTools.downloadSingleImageByUrl(image, index, () => {
        downloadBtn.removeClass('loading disabled').text('下载图片');
      });
    },
    fallbackCopyText: function (text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(() => {
            utils.notificationManager.show('已复制到剪贴板');
          }).catch(() => {
            this.fallbackCopyText2(text);
          });
        } else {
          this.fallbackCopyText2(text);
        }
      } catch (error) {
        console.error('备用复制方法1失败:', error);
        this.fallbackCopyText2(text);
      }
    },
    fallbackCopyText2: function (text) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          utils.notificationManager.show('已复制到剪贴板');
        } else {
          utils.notificationManager.show('复制失败，请手动复制');
        }
      } catch (error) {
        console.error('备用复制方法2失败:', error);
        utils.notificationManager.show('复制失败，请手动复制');
      }
    }
  });
  const imageTools = {
    init: function () {
      this.observeImages();
    },
    // 观察图片变化
    observeImages: function () {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) {
                this.processImageNode(node);
              }
            });
          }
        });
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      // 初始处理已存在的图片
      setTimeout(() => {
        $('img.wr_readerImage_opacity').each((i, img) => this.addImageToolbar(img));
      }, 1000);
    },
    // 处理图片节点
    processImageNode: function (node) {
      // 处理直接添加的图片
      if (node.tagName === 'IMG' && node.classList.contains('wr_readerImage_opacity')) {
        this.addImageToolbar(node);
      }
      // 处理子元素中的图片
      $(node).find('img.wr_readerImage_opacity').each((i, img) => {
        this.addImageToolbar(img);
      });
    },
    // 为图片添加工具栏
    addImageToolbar: function (img) {
      const $img = $(img);
      const src = $img.attr('src') || $img.attr('data-src');
      if (!src || $img.data('toolbar-added')) return;
      $img.data('toolbar-added', true);
      // 创建工具栏容器
      const toolbarContainer = $(`
        <div class="image-toolbar-container">
          <div class="image-toolbar">
            <button class="image-tool-btn download-btn" title="下载图片">
              <span class="image-tool-icon">⬇️</span>
            </button>
            <button class="image-tool-btn copy-btn" title="复制链接">
              <span class="image-tool-icon">📋</span>
            </button>
            <button class="image-tool-btn open-btn" title="新标签页打开">
              <span class="image-tool-icon">🔗</span>
            </button>
          </div>
        </div>
      `);
      // 检测是双栏还是单栏模式
      const isDoubleColumn = $img.closest('.passageContent_wrapper').length > 0;
      const isSingleColumn = $img.closest('.passage-content').length > 0;
      let parentContainer;
      // 双栏模式：添加到passageContent_wrapper
      if (isDoubleColumn) {
        parentContainer = $img.closest('.passageContent_wrapper');
        parentContainer.append(toolbarContainer);
      }
      // 单栏模式：添加到passage-content
      else if (isSingleColumn) {
        parentContainer = $img.closest('.passage-content');
        // 确保passage-content有相对定位
        parentContainer.css('position', 'relative');
        // 在单栏模式下，需要复制图片的定位信息到工具栏
        const imgRect = img.getBoundingClientRect();
        // 计算相对于父容器的位置
        const relativeLeft = imgRect.width
        // 设置工具栏容器的位置和图片一致
        toolbarContainer.css({
          position: 'absolute',
          left: relativeLeft + 'px',
          display: 'flex',
          transform: $img.css('transform')
        });
        parentContainer.append(toolbarContainer);
      }
      // 其他情况：直接添加到图片后面
      else {
        $img.after(toolbarContainer);
      }
      // 绑定事件
      this.bindToolbarEvents(toolbarContainer, src);
    },
    // 绑定工具栏事件
    bindToolbarEvents: function (toolbarContainer, src) {
      const downloadBtn = toolbarContainer.find('.download-btn');
      const copyBtn = toolbarContainer.find('.copy-btn');
      const openBtn = toolbarContainer.find('.open-btn');
      // 下载事件
      downloadBtn.click(() => {
        if (downloadBtn.hasClass('disabled') || downloadBtn.hasClass('loading')) {
          return;
        }
        // 设置加载状态
        downloadBtn.addClass('loading disabled')
          .attr('title', '下载中...')
          .find('.image-tool-icon').text('⏳');
        this.downloadImage(src, () => {
          // 恢复按钮状态
          setTimeout(() => {
            downloadBtn.removeClass('loading disabled')
              .attr('title', '下载图片')
              .find('.image-tool-icon').text('⬇️');
          }, 1000);
        });
      });
      // 复制事件
      copyBtn.click(() => {
        this.copyImageUrl(src);
      });
      // 打开事件
      openBtn.click(() => {
        this.openImage(src);
      });
      // 鼠标悬停显示工具栏
      const $img = toolbarContainer.prev('img.wr_readerImage_opacity');
      if ($img.length) {
        $img.hover(
          () => toolbarContainer.show(),
          () => setTimeout(() => !toolbarContainer.is(':hover') && toolbarContainer.hide(), 100)
        );
      }
      // 工具栏自身悬停
      toolbarContainer.hover(
        () => toolbarContainer.show(),
        () => toolbarContainer.hide()
      );
    },
    // 下载图片
    downloadImage: function (src, callback) {
      if (!src) {
        callback && callback();
        return;
      }
      const fileName = src.split('/').pop() || 'image.jpg';
      try {
        GM_download({
          url: src,
          name: fileName,
          onload: () => {
            utils.notificationManager.show('图片下载成功');
            callback && callback();
          },
          onerror: (e) => {
            utils.notificationManager.show('图片下载失败: ' + e.error);
            callback && callback();
          }
        });
      } catch (error) {
        this.downloadImageFallback(src, fileName);
        callback && callback();
      }
    },
    // 备用下载方法
    downloadImageFallback: function (src, fileName) {
      const link = document.createElement('a');
      link.href = src;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      utils.notificationManager.show('图片下载成功');
    },
    // 在新标签页打开图片
    openImage: (src) => src && window.open(src, '_blank'),
    // 复制图片链接
    copyImageUrl: function (src) {
      if (!src) return;
      const copyPromise = new Promise((resolve, reject) => {
        try {
          const result = GM_setClipboard(src, 'text/plain');
          if (result && typeof result.then === 'function') {
            result.then(resolve).catch(reject);
          } else {
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
      copyPromise
        .then(() => utils.notificationManager.show('图片链接已复制到剪贴板'))
        .catch(err => {
          console.error('复制失败:', err);
          this.fallbackCopyText(src);
        });
    },
    // 备用复制方法
    fallbackCopyText: function (text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(() => {
            utils.notificationManager.show('图片链接已复制到剪贴板 (现代API)');
          }).catch(() => {
            this.fallbackCopyText2(text);
          });
        } else {
          this.fallbackCopyText2(text);
        }
      } catch (error) {
        console.error('备用复制方法1失败:', error);
        this.fallbackCopyText2(text);
      }
    },
    // 备用复制方法2
    fallbackCopyText2: function (text) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          utils.notificationManager.show('图片链接已复制到剪贴板 (传统方法)');
        } else {
          utils.notificationManager.show('复制失败，请手动复制链接');
        }
      } catch (error) {
        console.error('备用复制方法2失败:', error);
        utils.notificationManager.show('复制失败，请手动复制链接');
      }
    },
    // 下载页面所有图片
    downloadAllImages: function () {
      const downloadBtn = $('#downloadAllImagesFromPanel');
      // 防止重复点击
      if (downloadBtn.hasClass('loading')) {
        return;
      }
      const images = $('img.wr_readerImage_opacity');
      if (images.length === 0) {
        utils.notificationManager.show('当前页面没有找到图片');
        return;
      }
      // 设置加载状态
      downloadBtn.addClass('loading disabled').text('下载中...');
      utils.notificationManager.show(`开始下载 ${images.length} 张图片...`);
      this.downloadImagesBatch(images, () => {
        // 恢复按钮状态
        setTimeout(() => {
          downloadBtn.removeClass('loading disabled').text('下载所有图片');
        }, 1000);
      });
    },
    // 通过URL列表下载图片
    downloadImagesByUrls: function (urls, type = 'all', callback) {
      if (urls.length === 0) return;
      let downloaded = 0;
      const total = urls.length;
      let hasError = false;
      urls.forEach((src, index) => {
        setTimeout(() => {
          this.downloadSingleImageByUrl(src, index, (success) => {
            if (!success) {
              hasError = true;
            }
            downloaded++;
            if (downloaded === total) {
              // 恢复按钮状态
              if (callback) callback();
              if (hasError) {
                utils.notificationManager.show(`图片下载完成，部分图片下载失败 (${downloaded}/${total})`);
              } else {
                utils.notificationManager.show(`所有图片下载完成 (${downloaded}/${total})`);
              }
            }
          });
        }, index * 1000); // 间隔1秒下载，避免同时下载太多
      });
    },
    // 下载单张图片通过URL
    downloadSingleImageByUrl: function (src, index, callback) {
      const fileName = src.split('/').pop() || `image_${index + 1}.jpg`;
      try {
        GM_download({
          url: src,
          name: fileName,
          onload: () => callback && callback(true),
          onerror: (e) => {
            console.error('下载失败:', src, e);
            callback && callback(false);
          }
        });
      } catch (error) {
        this.downloadImageFallback(src, fileName);
        callback && callback(true);
      }
    },
    // 批量下载图片
    downloadImagesBatch: function (images, callback) {
      let downloaded = 0;
      const total = images.length;
      let hasError = false;
      images.each((i, img) => {
        const src = $(img).attr('src') || $(img).attr('data-src');
        if (src) {
          setTimeout(() => {
            this.downloadSingleImageByUrl(src, i, (success) => {
              if (!success) {
                hasError = true;
              }
              downloaded++;
              if (downloaded === total) {
                if (hasError) {
                  utils.notificationManager.show(`图片下载完成，部分图片下载失败 (${downloaded}/${total})`);
                } else {
                  utils.notificationManager.show(`所有图片下载完成 (${downloaded}/${total})`);
                }
                callback && callback();
              }
            });
          }, i * 1000); // 间隔1秒下载，避免同时下载太多
        } else {
          downloaded++;
          if (downloaded === total) {
            callback && callback();
          }
        }
      });
    }
  };
  Object.assign(imageTools, {
    sanitizeFileSegment: function (text, fallback = 'image') {
      return String(text || fallback)
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80) || fallback;
    },
    getFileExtension: function (src) {
      try {
        const url = new URL(src, window.location.origin);
        const match = (url.pathname || '').match(/\.([a-zA-Z0-9]{2,5})$/);
        return match ? match[1].toLowerCase() : 'jpg';
      } catch (error) {
        return 'jpg';
      }
    },
    buildFileNameFromItem: function (item, index) {
      const chapter = this.sanitizeFileSegment(item.chapter || item.chapters?.[0] || 'book');
      const baseName = this.sanitizeFileSegment(item.fileName || `image_${index + 1}`);
      const ext = baseName.includes('.') ? '' : `.${this.getFileExtension(item.src || '')}`;
      return `${String(index + 1).padStart(4, '0')}_${chapter}_${baseName}${ext}`;
    },
    buildDownloadItem: function (item, index) {
      if (typeof item === 'string') {
        return {
          src: item,
          chapter: 'book',
          fileName: this.buildFileNameFromItem({ src: item }, index)
        };
      }
      return {
        ...item,
        fileName: this.buildFileNameFromItem(item, index)
      };
    },
    downloadAllImages: function () {
      imagePreviewPanel.openForBulkDownload($('#downloadAllImagesFromPanel'));
    },
    downloadImagesByUrls: function (items, type = 'all', callback) {
      if (!items.length) return;
      const normalizedItems = items.map((item, index) => this.buildDownloadItem(item, index));
      const total = normalizedItems.length;
      let completed = 0;
      let successCount = 0;
      let failureCount = 0;
      normalizedItems.forEach((item, index) => {
        setTimeout(() => {
          this.downloadSingleImageByUrl(item, index, (success) => {
            completed += 1;
            if (success) {
              successCount += 1;
            } else {
              failureCount += 1;
            }
            if (completed === total) {
              callback && callback();
              if (failureCount > 0) {
                utils.notificationManager.show(`图片下载完成，成功 ${successCount} 张，失败 ${failureCount} 张`);
              } else {
                utils.notificationManager.show(`所有图片下载完成 (${successCount}/${total})`);
              }
            }
          });
        }, index * 800);
      });
    },
    downloadSingleImageByUrl: function (item, index, callback, attempt = 0) {
      const normalizedItem = this.buildDownloadItem(item, index);
      const maxRetry = 2;
      try {
        GM_download({
          url: normalizedItem.src,
          name: normalizedItem.fileName,
          onload: () => callback && callback(true),
          onerror: (e) => {
            console.error('下载失败:', normalizedItem.src, e);
            if (attempt < maxRetry) {
              setTimeout(() => this.downloadSingleImageByUrl(normalizedItem, index, callback, attempt + 1), 500 * (attempt + 1));
            } else {
              callback && callback(false);
            }
          }
        });
      } catch (error) {
        console.error('下载异常:', normalizedItem.src, error);
        try {
          this.downloadImageFallback(normalizedItem.src, normalizedItem.fileName);
          callback && callback(true);
        } catch (fallbackError) {
          console.error('备用下载失败:', normalizedItem.src, fallbackError);
          callback && callback(false);
        }
      }
    }
  });
  // 宽度控制功能
  GM_addStyle(`
    .image-preview-overlay {
      background: rgba(17, 24, 39, 0.45) !important;
      backdrop-filter: blur(2px);
    }
    .image-preview-overlay.theme-dark {
      background: rgba(0, 0, 0, 0.62) !important;
    }
    .image-preview-panel {
      --ip-panel-bg: #ffffff;
      --ip-subtle-bg: #f7f8fa;
      --ip-surface-bg: #ffffff;
      --ip-thumb-bg: #eef2f6;
      --ip-border: #d9dee7;
      --ip-text: #1f2937;
      --ip-muted: #667085;
      --ip-hover: #f0f7f2;
      --ip-shadow: 0 18px 50px rgba(15, 23, 42, 0.18);
      --ip-accent: #2f9e44;
      --ip-accent-soft: rgba(47, 158, 68, 0.18);
      background: var(--ip-panel-bg) !important;
      border-color: var(--ip-border) !important;
      color: var(--ip-text) !important;
      box-shadow: var(--ip-shadow) !important;
    }
    .image-preview-panel.theme-dark {
      --ip-panel-bg: #171a21;
      --ip-subtle-bg: #1f2430;
      --ip-surface-bg: #202632;
      --ip-thumb-bg: #262d3a;
      --ip-border: #353d4c;
      --ip-text: #edf2f7;
      --ip-muted: #aab4c3;
      --ip-hover: #263241;
      --ip-shadow: 0 18px 50px rgba(0, 0, 0, 0.42);
      --ip-accent: #63b3ed;
      --ip-accent-soft: rgba(99, 179, 237, 0.22);
    }
    .image-preview-header,
    .image-preview-controls,
    .image-preview-actions,
    .image-preview-stats {
      background: var(--ip-subtle-bg) !important;
      border-color: var(--ip-border) !important;
      color: var(--ip-text) !important;
    }
    .image-preview-title,
    .image-preview-stats,
    .select-all-label,
    .image-preview-empty,
    .image-preview-meta,
    .image-preview-loading-title,
    .image-preview-loading-stats,
    .image-preview-loading-tip,
    .image-preview-loading-status,
    .image-preview-info,
    .image-preview-info div {
      color: var(--ip-text) !important;
    }
    .image-preview-meta,
    .image-preview-loading-tip,
    .image-preview-loading-status,
    .image-preview-panel .image-preview-info div:not(:first-child) {
      color: var(--ip-muted) !important;
    }
    .image-preview-content,
    .image-preview-item,
    .image-preview-info {
      background: var(--ip-panel-bg) !important;
    }
    .image-preview-thumb {
      background: var(--ip-thumb-bg) !important;
    }
    .image-preview-item {
      border-color: var(--ip-border) !important;
    }
    .image-preview-item:hover {
      background: var(--ip-hover) !important;
      border-color: var(--ip-accent) !important;
      box-shadow: 0 4px 16px var(--ip-accent-soft) !important;
    }
    .image-preview-item.selected {
      border-color: var(--ip-accent) !important;
      box-shadow: 0 0 0 2px var(--ip-accent-soft) !important;
    }
    .image-action-btn,
    .image-preview-panel .control-btn {
      background: var(--ip-surface-bg) !important;
      color: var(--ip-text) !important;
      border-color: var(--ip-border) !important;
    }
    .image-action-btn:hover,
    .image-preview-panel .control-btn:hover {
      background: var(--ip-accent) !important;
      border-color: var(--ip-accent) !important;
      color: #fff !important;
    }
    .image-preview-close {
      color: var(--ip-muted) !important;
    }
    .image-preview-close:hover {
      background: var(--ip-hover) !important;
      color: var(--ip-text) !important;
    }
    .image-preview-loading-bar {
      background: var(--ip-thumb-bg) !important;
    }
  `);
  const widthControl = {
    init: function () {
      const savedWidth = GM_getValue('weread_max_width', DEFAULT_WIDTH);
      this.applyWidth(savedWidth);
      return savedWidth;
    },
    applyWidth: function (width) {
      const content = document.querySelector(".readerContent .app_content");
      const topBar = document.querySelector('.readerTopBar');
      if (content && topBar) {
        content.style.maxWidth = width + 'px';
        topBar.style.maxWidth = width + 'px';
        GM_setValue('weread_max_width', width);
        if ($('#widthSlider').length) {
          $('#widthSlider').val(width);
          $('#widthValue').text(width + 'px');
        }
        window.dispatchEvent(new Event('resize'));
      }
    },
    reset: function () {
      this.applyWidth(DEFAULT_WIDTH);
    }
  };
  // 护眼模式功能
  const eyeProtection = {
    init: function () {
      const enabled = utils.getEyeProtectionState().enabled;
      const color = utils.getEyeProtectionState().color;
      if (enabled) {
        this.enable(color);
      } else {
        this.disable();
      }
      return enabled;
    },
    enable: function (color) {
      console.log('改变enable', color);
      // 保存状态到内存
      utils.saveEyeProtectionState(true, color);
      // 同步控制面板背景
      utils.syncControlPanelBackground();
    },
    disable: function () {
      // 移除所有护眼模式类名
      Object.keys(EYE_PROTECTION_COLORS).forEach(colorKey => {
        document.body.classList.remove(EYE_PROTECTION_COLORS[colorKey].className);
      });
      // 更新按钮状态
      utils.saveEyeProtectionState(false, utils.getEyeProtectionState().color);
      // 同步控制面板背景
      utils.syncControlPanelBackground();
    },
    // 等待
    changeColor: function (color) {
      console.log('改变changeColor', color);
      const enabled = utils.getEyeProtectionState().enabled;
      utils.saveEyeProtectionState(enabled, color);
      utils.syncControlPanelBackground();
    },
    // 修改：强制恢复护眼模式状态（用于页面刷新或布局切换后）
    restoreState: function () {
      const state = utils.getEyeProtectionState();
      if (state.enabled) {
        setTimeout(() => {
          this.enable(state.color, true);
          // const colorOptionContainers = document.querySelectorAll('.color-option-container');
          // colorOptionContainers.forEach(colorOptionContainer => {
          //   const colorOptions = colorOptionContainer.querySelectorAll('.color-option');
          //   colorOptions.forEach(colorOption => {
          //     const colorKey = colorOption.getAttribute('data-color');
          //     if (colorKey === utils.getEyeProtectionState().color) {
          //       colorOption.classList.add('active');
          //     }
          //   });
          // });
          // // 遍历.color-option-container下的含有color-${colorKey}类名的元素，如果colorKey === utils.getEyeProtectionState().color，然后添加.active类名
          // 获取所有颜色选项容器
          const colorContainers = document.querySelectorAll('.color-option-container');
          // 获取当前眼保护状态的颜色
          const currentColor = utils.getEyeProtectionState().color;
          // 遍历所有颜色选项容器
          colorContainers.forEach(container => {
            // 获取颜色选项元素
            const colorOption = container.querySelector('.color-option');
            // 获取该选项对应的colorKey（从data-color属性）
            const colorKey = container.getAttribute('data-color');
            // 如果colorKey与当前颜色匹配，则添加active类，否则移除
            if (colorKey === currentColor) {
              colorOption.classList.add('active');
            } else {
              colorOption.classList.remove('active');
            }
          });
          console.log('护眼模式状态已恢复:', state.color);
        }, 50);
      }
    },
    syncButtonState: function () {
      const state = utils.getEyeProtectionState();
      if (state.enabled) {
        $('#eyeProtectionBtn').removeClass('disabled').addClass('active').text('护眼模式:开');
      } else {
        $('#eyeProtectionBtn').removeClass('disabled active').text('护眼模式:关');
      }
    },
  };
  // 自动翻页功能
  const autoPageTurn = {
    trigger: function () {
      if (isPageTurning || pageTurnCooldown) return;
      isPageTurning = true;
      pageTurnCooldown = true;
      // 触发键盘右键事件
      ['keydown', 'keyup'].forEach(eventType =>
        document.dispatchEvent(new KeyboardEvent(eventType, {
          bubbles: true, cancelable: true, key: 'ArrowRight', code: 'ArrowRight', keyCode: 39
        }))
      );
      setTimeout(() => pageTurnCooldown = false, 2000);
      setTimeout(() => (isPageTurning = false, window.scrollTo(0, 100)), 1500);
    }
  };
  // 自动翻页进度条
  const progressBar = {
    init: function () {
      $('body').append(`
        <div id="auto-turn-progress">
          <div class="progress-text">0秒后自动翻页</div>
          <div class="progress-bar"><div class="progress-fill"></div></div>
        </div>
      `);
    },
    show: function (waitTime) {
      this.waitTime = waitTime;
      this.startTime = Date.now();
      $('#auto-turn-progress').show();
      this.update();
      progressInterval = setInterval(() => this.update(), 100);
    },
    update: function () {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const remaining = Math.max(0, this.waitTime - elapsed);
      const percentage = (remaining / this.waitTime) * 100;
      $('.progress-text').text(`${remaining.toFixed(1)}秒后自动翻页`);
      $('.progress-fill').css('width', percentage + '%');
      remaining <= 0 && this.hide();
    },
    hide: function () {
      $('#auto-turn-progress').hide();
      progressInterval && (clearInterval(progressInterval), progressInterval = null);
    }
  };
  // 自动阅读功能
  const autoRead = {
    calculateWaitTime: () => currentScrollSpeed <= 0.5 ? 10 :
      currentScrollSpeed <= 1 ? 8 :
        currentScrollSpeed <= 2 ? 6 :
          currentScrollSpeed <= 3 ? 4 : 2,
    start: function () {
      scrollInterval && (clearInterval(scrollInterval), scrollInterval = null);
      this.clearBottomTimer();
      const timerMinutes = parseInt($('#timerSlider').val());
      timerMinutes > 0 && (lastTimerValue = timerMinutes, GM_setValue('weread_last_timer', lastTimerValue), this.updateLastTimerButton());
      const baseSpeed = 1;
      const speedMultiplier = currentScrollSpeed;
      let lastScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      let stuckCount = 0;
      scrollInterval = setInterval(() => {
        if (isPageTurning) return;
        const currentScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
        const clientHeight = document.documentElement.clientHeight || document.body.clientHeight;
        if (currentScrollTop + clientHeight >= scrollHeight - 10) {
          !isWaitingForPageTurn && this.schedulePageTurn();
          return;
        }
        currentScrollTop === lastScrollTop ?
          (stuckCount++, window.scrollBy(0, baseSpeed * speedMultiplier * (stuckCount > 5 ? 3 : 1))) :
          (stuckCount = 0, window.scrollBy(0, baseSpeed * speedMultiplier));
        lastScrollTop = lastScrollPosition = currentScrollTop;
      }, 20);
      isAutoReading = true;
      this.updateButton();
      this.startTimer();
      this.saveState();
    },
    stop: function () {
      scrollInterval && (clearInterval(scrollInterval), scrollInterval = null);
      isAutoReading = isPageTurning = isWaitingForPageTurn = false;
      this.updateButton();
      this.clearBottomTimer();
      progressBar.hide();
      this.stopTimer();
      this.saveState();
    },
    toggle: function () {
      isAutoReading ? this.stop() : this.start();
    },
    schedulePageTurn: function () {
      isWaitingForPageTurn = true;
      const waitTime = this.calculateWaitTime();
      progressBar.show(waitTime);
      bottomReachedTimer = setTimeout(() => {
        isWaitingForPageTurn && (autoPageTurn.trigger(), isWaitingForPageTurn = false, progressBar.hide());
        setTimeout(() => isAutoReading && (lastScrollPosition = 0), 2000);
      }, waitTime * 1000);
    },
    clearBottomTimer: function () {
      bottomReachedTimer && (clearTimeout(bottomReachedTimer), bottomReachedTimer = null);
      isWaitingForPageTurn = false;
      progressBar.hide();
    },
    checkManualPageTurn: function () {
      if (!isWaitingForPageTurn) return;
      const currentScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      Math.abs(currentScrollTop - lastScrollPosition) > 50 &&
        (this.clearBottomTimer(), this.schedulePageTurn());
      lastScrollPosition = currentScrollTop;
    },
    startTimer: function () {
      const timerMinutes = parseInt($('#timerSlider').val());
      if (timerMinutes > 0) {
        remainingTime <= 0 && (remainingTime = timerMinutes * 60);
        this.updateTimerDisplay();
        timerInterval = setInterval(() => {
          remainingTime--;
          this.updateTimerDisplay();
          GM_setValue('weread_remaining_time', remainingTime);
          remainingTime <= 0 && (this.stop(), utils.notificationManager.show('定时时间到，自动阅读已停止'));
        }, 1000);
      }
    },
    stopTimer: function () {
      timerInterval && (clearInterval(timerInterval), timerInterval = null);
      remainingTime = 0;
      GM_setValue('weread_remaining_time', 0);
      this.updateTimerDisplay();
    },
    updateTimerDisplay: function () {
      $('#timerDisplay').text(remainingTime > 0 ?
        `剩余: ${Math.floor(remainingTime / 60)}:${(remainingTime % 60).toString().padStart(2, '0')}` : '');
    },
    updateButton: function () {
      const button = $('#toggleAutoRead');
      button.text(isAutoReading ? '停止阅读' : '开始阅读');
      isAutoReading ? button.addClass('active') : button.removeClass('active');
    },
    updateLastTimerButton: function () {
      const lastTimerBtn = $('#lastTimerBtn');
      lastTimerValue > 0 ?
        lastTimerBtn.removeClass('disabled').css('background', '#e0e0e0') :
        lastTimerBtn.addClass('disabled').css('background', '#cccccc');
    },
    applyLastTimer: function () {
      lastTimerValue > 0 ?
        ($('#timerSlider').val(lastTimerValue), $('#timerValue').text(lastTimerValue + '分钟'),
          utils.notificationManager.show(`已设置为上次定时时间: ${lastTimerValue}分钟`)) :
        utils.notificationManager.show('没有找到上次定时时间');
    },
    saveState: function () {
      GM_setValue('weread_auto_reading', isAutoReading);
      GM_setValue('weread_scroll_speed', currentScrollSpeed);
    },
    restoreState: function () {
      if (isAutoReading) {
        $('#speedSlider').val(currentScrollSpeed);
        $('#speedValue').text(currentScrollSpeed.toFixed(1) + 'x');
        const timerMinutes = Math.ceil(remainingTime / 60);
        timerMinutes > 0 && ($('#timerSlider').val(timerMinutes), $('#timerValue').text(timerMinutes + '分钟'));
        this.updateButton();
        this.start();
        utils.notificationManager.show('已恢复自动阅读状态');
      }
    }
  };
  // 控制面板功能
  const controlPanel = {
    init: function () {
      const savedWidth = GM_getValue('weread_max_width', DEFAULT_WIDTH);
      $("body").append(`
        <div class="control-panel" style="display: none;" id="mainControlPanel">
          <button class="control-panel-close" id="closeControlPanel">×</button>
          <div class="control-section">
            <div class="control-section-title">宽度控制</div>
            <div class="control-item">
              <span class="control-label">页面宽度</span>
              <input type="range" class="control-slider" id="widthSlider" min="600" max="1400" value="${savedWidth}">
              <span class="control-value" id="widthValue">${savedWidth}px</span>
            </div>
            <div class="control-buttons">
              <button class="control-btn reset" id="resetWidth">恢复默认</button>
            </div>
          </div>
          <div class="section-divider"></div>
          <div class="control-section">
            <div class="control-section-title">自动阅读</div>
            <div class="control-item">
              <span class="control-label">阅读速度</span>
              <input type="range" class="control-slider speed-slider" id="speedSlider" min="0.5" max="4" step="0.1" value="${currentScrollSpeed}">
              <span class="control-value" id="speedValue">${currentScrollSpeed.toFixed(1)}x</span>
            </div>
            <div class="control-item">
              <span class="control-label">定时关闭</span>
              <input type="range" class="control-slider timer-slider" id="timerSlider" min="0" max="120" step="1" value="0">
              <span class="control-value" id="timerValue">0分钟</span>
            </div>
            <div class="timer-display" id="timerDisplay"></div>
            <div class="control-buttons">
              <button class="control-btn" id="toggleAutoRead">${isAutoReading ? '停止阅读' : '开始阅读'}</button>
              <button class="control-btn secondary" id="lastTimerBtn">上次定时</button>
            </div>
          </div>
          <div class="section-divider"></div>
          <div class="control-section">
            <div class="control-section-title">显示设置</div>
            <div class="color-options" id="colorOptionsContainer"></div>
            <div class="control-buttons">
              <button class="control-btn" id="eyeProtectionBtn">护眼模式:关</button>
            </div>
          </div>
          <div class="section-divider"></div>
          <div class="control-section">
            <div class="control-section-title">图片工具</div>
            <div class="control-buttons">
              <button class="control-btn" id="previewAllImages">预览页面图片</button>
              <button class="control-btn" id="downloadAllImagesFromPanel" data-original-text="下载所有图片">下载所有图片</button>
            </div>
          </div>
        </div>
      `);
      this.generateColorOptions();
      this.addControlButton();
      this.bindEvents();
      // 初始化拖拽功能
      panelDrag.init($('#mainControlPanel'));
    },
    generateColorOptions: function () {
      const container = $('#colorOptionsContainer');
      container.empty();
      // 添加默认状态和颜色选项
      utils.saveEyeProtectionState(false, 'green');
      Object.keys(EYE_PROTECTION_COLORS).forEach(colorKey => {
        const colorInfo = EYE_PROTECTION_COLORS[colorKey];
        const isActive = colorKey === utils.getEyeProtectionState().color;
        const colorOption = $(`
                    <div class="color-option-container" data-color="${colorKey}">
                        <div class="color-option color-${colorKey} ${isActive ? 'active' : ''}"></div>
                        <div class="color-name">${colorInfo.name}</div>
                    </div>
                `);
        container.append(colorOption);
      });
    },
    addControlButton: function () {
      $('.readerControls').append(`
        <div class="wr_tooltip_container" style="--offset: 6px;">
          <button class="readerControls_item" id="mainControl" style="color:#6a6c6c;cursor:pointer;">
            <span class="settings-icon"></span>
          </button>
          <div class="wr_tooltip_item wr_tooltip_item--right" style="display: none;">设置</div>
        </div>
      `);
    },
    bindEvents: function () {
      // const isWhite = utils.isWhiteTheme();// 失效
      // 控制面板显示/隐藏
      $('#mainControl').click(() => $('#mainControlPanel').toggle());
      // 工具提示
      $('#mainControl').hover(
        function () { $(this).siblings('.wr_tooltip_item').show(); },
        function () { $(this).siblings('.wr_tooltip_item').hide(); }
      );
      // 关闭按钮
      $(document).on('click', '#closeControlPanel', (e) => (e.stopPropagation(), $('#mainControlPanel').hide()));
      // 宽度控制
      $('#widthSlider').on('input', function () {
        const newWidth = parseInt($(this).val());
        $('#widthValue').text(newWidth + 'px');
        widthControl.applyWidth(newWidth);
      });
      $('#resetWidth').click(() => {
        $('#widthSlider').val(DEFAULT_WIDTH);
        $('#widthValue').text(DEFAULT_WIDTH + 'px');
        widthControl.reset();
      });
      // 颜色选择
      $(document).on('click', '.color-option-container', function () {
        const color = $(this).data('color');
        $('.color-option').removeClass('active');
        $(this).find('.color-option').addClass('active');
        eyeProtection.changeColor(color);
      });
      // 护眼模式切换
      $(document).on('click', '#eyeProtectionBtn', (state, c, a) => {
        const isWhite = utils.isWhiteTheme();
        const isEnabled = utils.getEyeProtectionState().enabled;
        if (isWhite) {
          if (isEnabled) {
            eyeProtection.disable();
          } else {
            eyeProtection.enable(utils.getEyeProtectionState().color);
          }
        } else {
          utils.notificationManager.show('护眼模式仅在白色主题下可用');
        }
      });
      // 自动阅读控制
      $('#speedSlider').on('input', function () {
        currentScrollSpeed = parseFloat($(this).val());
        $('#speedValue').text(currentScrollSpeed.toFixed(1) + 'x');
        GM_setValue('weread_scroll_speed', currentScrollSpeed);
        isAutoReading && (autoRead.stop(), autoRead.start());
      });
      $('#timerSlider').on('input', function () {
        $('#timerValue').text($(this).val() + '分钟');
      });
      $('#lastTimerBtn').click(() => autoRead.applyLastTimer());
      $('#toggleAutoRead').click(() => autoRead.toggle());
      // 图片工具
      $('#previewAllImages').click(() => imagePreviewPanel.show());
      $('#downloadAllImagesFromPanel').click(() => imagePreviewPanel.openForBulkDownload($('#downloadAllImagesFromPanel')));
      // 点击页面其他地方隐藏控制面板
      $(document).on('click', (e) => {
        !$(e.target).closest('.control-panel, #mainControl, #closeControlPanel').length &&
          $('.control-panel').hide();
      });
    },
  };
  // 头部隐藏功能
  const headerControl = {
    init: function () {
      $(window).scroll(function () {
        const scrollS = $(this).scrollTop();
        const selBtn = document.querySelector('.readerTopBar');
        $('.readerControls').hover(
          () => $('.readerControls').css('opacity', '1'),
          () => $('.readerControls').css('opacity', '0')
        );
        selBtn.style.opacity = scrollS >= windowTop ? 0 : 1;
        windowTop = scrollS;
        isAutoReading && autoRead.checkManualPageTurn();
      });
    }
  };
  // 初始化函数
  function initialize () {
    // // 强制恢复护眼模式状态
    const state = utils.getEyeProtectionState();
    if (state.enabled && utils.isWhiteTheme()) {
      eyeProtection.restoreState();
    }
    // 如果自动阅读状态为开启，恢复自动阅读
    if (isAutoReading) {
      setTimeout(() => {
        autoRead.restoreState();
      }, 1000);
    }
    console.log("1111111111111111111111初始化函数");
    console.log(
      '重新加载',
      utils.isWhiteTheme(),
      utils.getEyeProtectionState().enabled
    );
    progressBar.init();
    imageTools.init();
    imagePreviewPanel.init();
    autoRead.updateLastTimerButton();
    controlPanel.init();
    headerControl.init();
    // 初始化各模块
    const currentWidth = widthControl.init();
    $('#widthSlider').val(currentWidth);
    $('#widthValue').text(currentWidth + 'px');
    eyeProtection.syncButtonState();
    utils.syncControlPanelBackground();
    // 创建一个 MutationObserver 实例
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          utils.handleThemeChange();
        }
      });
    });
    // 开始观察body元素的属性变化
    observer.observe(document.body, {
      attributes: true, // 监听属性变化
      attributeFilter: ['class'] // 只监听class属性
    });
    // 禁用控制台
    // utils.disableConsoleWithProxy();
  }
  // 页面加载完成后初始化
  $(window).on('load', initialize);
})();
