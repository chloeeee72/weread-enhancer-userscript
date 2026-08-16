import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const metadataPath = path.resolve(__dirname, '../src/metadata.txt');

let metadata = fs.readFileSync(metadataPath, 'utf8');
const versionMatch = metadata.match(/@version\s+([^\s]+)/);

if (!versionMatch) {
  console.error('[version-bump] 未在 metadata.txt 中找到 @version');
  process.exit(1);
}

const oldVersion = versionMatch[1];
const parts = oldVersion.split('.').map(Number);

if (!parts.every(Number.isFinite) || parts.length === 0) {
  console.error(`[version-bump] 无法解析版本号: ${oldVersion}`);
  process.exit(1);
}

// 递增"尾号"位（最后一段）
// 示例: 1.29.25 → 1.29.26,  1.0 → 1.1,  2 → 3
const bumpIndex = parts.length - 1;
parts[bumpIndex] += 1;

const newVersion = parts.join('.');

metadata = metadata.replace(
  /(@version\s+)[^\s]+/,
  `$1${newVersion}`
);

fs.writeFileSync(metadataPath, metadata, 'utf8');
console.log(`[version-bump] ${oldVersion} → ${newVersion}`);