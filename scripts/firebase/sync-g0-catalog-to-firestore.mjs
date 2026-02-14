import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');
const defaultCatalogPath = path.join(workspaceRoot, 'databases', 'metadata', 'g0-catalog.normalized.json');

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

async function loadFirebaseAdmin() {
  try {
    const app = await import('firebase-admin/app');
    const firestore = await import('firebase-admin/firestore');
    return { app, firestore };
  } catch (error) {
    throw new Error(
      'firebase-admin is not installed. Run `npm install firebase-admin` before syncing. Original error: '
      + (error instanceof Error ? error.message : String(error))
    );
  }
}

function parsePrivateKey(value) {
  return value.replace(/\\n/g, '\n');
}

async function readServiceAccountFromFile(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid service account JSON in ${filePath}`);
  }
  return parsed;
}

async function resolveServiceAccount() {
  const fileRef = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
  if (fileRef && fileRef.trim()) {
    const resolvedPath = path.resolve(workspaceRoot, fileRef.trim());
    const serviceAccount = await readServiceAccountFromFile(resolvedPath);
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error(
        `Service account file is missing required fields (project_id, client_email, private_key): ${resolvedPath}`
      );
    }
    return {
      projectId: String(serviceAccount.project_id).trim(),
      clientEmail: String(serviceAccount.client_email).trim(),
      privateKey: parsePrivateKey(String(serviceAccount.private_key))
    };
  }

  return {
    projectId: requiredEnv('FIREBASE_PROJECT_ID'),
    clientEmail: requiredEnv('FIREBASE_CLIENT_EMAIL'),
    privateKey: parsePrivateKey(requiredEnv('FIREBASE_PRIVATE_KEY'))
  };
}

async function readCatalog(catalogPath) {
  const raw = await readFile(catalogPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.games)) {
    throw new Error(`Invalid catalog format in ${catalogPath}`);
  }
  return parsed;
}

async function main() {
  const catalogPath = process.env.G0_CATALOG_PATH
    ? path.resolve(workspaceRoot, process.env.G0_CATALOG_PATH)
    : defaultCatalogPath;

  const { projectId, clientEmail, privateKey } = await resolveServiceAccount();

  const gamesCollection = process.env.FIREBASE_GAMES_COLLECTION || 'game_catalog';
  const syncMetaCollection = process.env.FIREBASE_SYNC_META_COLLECTION || 'sync_meta';

  const catalog = await readCatalog(catalogPath);
  const { app, firestore } = await loadFirebaseAdmin();
  const { initializeApp, cert, getApps } = app;
  const { getFirestore, FieldValue } = firestore;

  if (!getApps().length) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId
    });
  }

  const db = getFirestore();
  const nowIso = new Date().toISOString();
  const batchSize = 400;

  let currentBatch = db.batch();
  let batchCount = 0;
  let writeCount = 0;

  for (let i = 0; i < catalog.games.length; i += 1) {
    const game = catalog.games[i];
    const ref = db.collection(gamesCollection).doc(game.gameId);
    currentBatch.set(
      ref,
      {
        ...game,
        syncMeta: {
          syncedAt: FieldValue.serverTimestamp(),
          syncedAtIso: nowIso,
          sourceCatalogVersion: catalog.schemaVersion
        }
      },
      { merge: true }
    );
    writeCount += 1;

    if (writeCount % batchSize === 0) {
      await currentBatch.commit();
      batchCount += 1;
      currentBatch = db.batch();
      console.log(`Committed batch ${batchCount} (${writeCount} game docs).`);
    }
  }

  if (writeCount % batchSize !== 0) {
    await currentBatch.commit();
    batchCount += 1;
    console.log(`Committed final batch ${batchCount} (${writeCount} game docs total).`);
  }

  await db.collection(syncMetaCollection).doc('g0_catalog').set(
    {
      schemaVersion: catalog.schemaVersion,
      generatedAt: catalog.generatedAt,
      totalGames: catalog.totalGames,
      sourceCatalogPath: path.relative(workspaceRoot, catalogPath),
      syncedAt: FieldValue.serverTimestamp(),
      syncedAtIso: nowIso
    },
    { merge: true }
  );

  console.log(`Sync finished: ${writeCount} games -> Firestore collection "${gamesCollection}".`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
