export const moduleRegistry = {
  autoPageTurn: null,
  autoRead: null,
  controlPanel: null,
  eyeProtection: null,
  imagePreviewPanel: null,
  imageTools: null,
  progressBar: null,
  voiceRead: null
};

export function registerModules(modules) {
  Object.assign(moduleRegistry, modules);
}
