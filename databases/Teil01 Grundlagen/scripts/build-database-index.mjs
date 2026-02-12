import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const DATABASE_DIR = path.join(ROOT_DIR, 'database');
const OUTPUT_PATH = path.join(ROOT_DIR, 'database-index.json');

const FILE_KIND_MAP = {
  '.json': 'json',
  '.txt': 'txt',
  '.md': 'txt',
  '.html': 'html',
  '.js': 'js',
  '.css': 'css',
  '.pdf': 'pdf',
  '.ppt': 'pptx',
  '.pptx': 'pptx'
};

function toId(parts) {
  return parts
    .join('__')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

function fileKind(name) {
  const ext = path.extname(name).toLowerCase();
  return FILE_KIND_MAP[ext] || 'file';
}

async function walkDirectory(absDir, relParts = []) {
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  const directories = [];
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

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
    const parts = [...relParts, dir.name];
    const folderChildren = await walkDirectory(path.join(absDir, dir.name), parts);

    children.push({
      id: `folder_${toId(parts)}`,
      name: dir.name,
      isFolder: true,
      children: folderChildren
    });
  }

  for (const file of files) {
    const parts = [...relParts, file.name];

    children.push({
      id: `file_${toId(parts)}`,
      name: file.name,
      isFolder: false,
      kind: fileKind(file.name),
      relPath: parts.join('/'),
      ext: path.extname(file.name).toLowerCase()
    });
  }

  return children;
}

async function main() {
  const rootNodes = await walkDirectory(DATABASE_DIR, []);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'database',
    totalFiles: countFiles(rootNodes),
    tree: rootNodes
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${OUTPUT_PATH} (${payload.totalFiles} files)`);
}

function countFiles(nodes) {
  let count = 0;
  for (const node of nodes) {
    if (node.isFolder) {
      count += countFiles(node.children || []);
    } else {
      count += 1;
    }
  }
  return count;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
