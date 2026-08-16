import fs from 'node:fs';
import path from 'node:path';

export function greasyForkUserscriptPlugin(options = {}) {
  const {
    metadataPath = path.resolve(process.cwd(), 'src/metadata.txt')
  } = options;

  return {
    name: 'greasyfork-userscript-plugin',
    generateBundle(_outputOptions, bundle) {
      const metadata = fs.readFileSync(metadataPath, 'utf8').trim();

      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.fileName.endsWith('.js')) {
          continue;
        }

        chunk.code = `${metadata}\n\n${chunk.code}`;
      }
    }
  };
}
