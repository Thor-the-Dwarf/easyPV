import { promises as fs } from 'node:fs';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const DATABASES_DIR = path.join(WORKSPACE_ROOT, 'databases');
const OUTPUT_PATH = path.join(WORKSPACE_ROOT, 'index.json');

const FILE_KIND_MAP = {
  '.json': 'json',
  '.txt': 'txt',
  '.md': 'txt',
  '.html': 'html',
  '.js': 'js',
  '.css': 'css',
  '.mjs': 'mjs',
  '.cjs': 'js',
  '.pdf': 'pdf',
  '.ppt': 'pptx',
  '.pptx': 'pptx'
};

function toPosix(value) {
  return String(value || '').split(path.sep).join('/');
}

function toId(parts) {
  return parts
    .join('__')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

function fileKind(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return FILE_KIND_MAP[ext] || 'file';
}

function isIgnoredName(name) {
  return name.startsWith('.') || name === 'node_modules';
}

async function walkDirectory(absDir, relParts = []) {
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  const directories = [];
  const files = [];

  for (const entry of entries) {
    if (isIgnoredName(entry.name)) continue;
    if (entry.isDirectory()) {
      directories.push(entry);
      continue;
    }
    if (entry.isFile()) {
      files.push(entry);
    }
  }

  directories.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  files.sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const children = [];

  for (const dir of directories) {
    const nextParts = [...relParts, dir.name];
    const folderChildren = await walkDirectory(path.join(absDir, dir.name), nextParts);
    children.push({
      id: `folder_${toId(nextParts)}`,
      name: dir.name,
      isFolder: true,
      children: folderChildren
    });
  }

  for (const file of files) {
    const nextParts = [...relParts, file.name];
    children.push({
      id: `file_${toId(nextParts)}`,
      name: file.name,
      isFolder: false,
      kind: fileKind(file.name),
      relPath: toPosix(nextParts.join(path.sep))
    });
  }

  return children;
}

function countFiles(nodes) {
  let total = 0;
  for (const node of nodes) {
    if (node && node.isFolder) {
      total += countFiles(node.children || []);
      continue;
    }
    total += 1;
  }
  return total;
}

async function main() {
  const tree = await walkDirectory(DATABASES_DIR, ['databases']);
  const payload = {
    rootName: 'databases',
    generatedAt: new Date().toISOString(),
    totalFiles: countFiles(tree),
    tree
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`index.json rebuilt with ${payload.totalFiles} files.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
