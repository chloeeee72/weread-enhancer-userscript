import { EYE_PROTECTION_COLORS } from '../constants.js';

export const generateEyeProtectionStyles = () => {
  let styles = '';

  Object.keys(EYE_PROTECTION_COLORS).forEach(colorKey => {
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
