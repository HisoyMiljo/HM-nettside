import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "customer-file-delivery";
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const CHUNK_SIZE = 3 * 1024 * 1024;
const MAX_EXPIRY_DAYS = 90;
const UPLOAD_SESSION_HOURS = 6;

class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function sameSecret(left, right) {
  const a = Buffer.from(left || "");
  const b = Buffer.from(right || "");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function requireAdmin(req) {
  const expected = process.env.FILE_PORTAL_ADMIN_TOKEN;
  if (!expected) {
    throw new ApiError("Filportalen er ikke ferdig konfigurert.", 503);
  }

  if (!sameSecret(req.headers.get("x-file-portal-token"), expected)) {
    throw new ApiError("Ugyldig administrasjonspassord.", 401);
  }
}

function readId(value) {
  if (!/^[a-f0-9-]{36}$/i.test(value || "")) {
    throw new ApiError("Ugyldig filreferanse.");
  }
  return value;
}

function readIndex(value, totalChunks) {
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0 || index >= totalChunks) {
    throw new ApiError("Ugyldig fildel.");
  }
  return index;
}

function safeFileName(value) {
  const name = String(value || "")
    .trim()
    .replace(/[\u0000-\u001F\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 160);

  if (!name) {
    throw new ApiError("Filen må ha et navn.");
  }
  return name;
}

function fileKey(id) {
  return `files/${id}/manifest`;
}

function sessionKey(id) {
  return `uploads/${id}/session`;
}

function chunkKey(id, index) {
  return `chunks/${id}/${index}`;
}

function activeFilesKey() {
  return "indexes/active-files";
}

async function getJson(store, key) {
  return store.get(key, { type: "json", consistency: "strong" });
}

async function readActiveFileIds(store) {
  const ids = await getJson(store, activeFilesKey());
  return Array.isArray(ids) ? ids.filter((id) => /^[a-f0-9-]{36}$/i.test(id)) : [];
}

async function writeActiveFileIds(store, ids) {
  await store.setJSON(activeFilesKey(), [...new Set(ids)]);
}

async function addActiveFile(store, id) {
  const ids = await readActiveFileIds(store);
  await writeActiveFileIds(store, [id, ...ids.filter((item) => item !== id)]);
}

async function removeActiveFile(store, id) {
  const ids = await readActiveFileIds(store);
  await writeActiveFileIds(store, ids.filter((item) => item !== id));
}

async function getSession(store, id) {
  const session = await getJson(store, sessionKey(id));
  if (!session || session.uploadExpiresAt < Date.now()) {
    throw new ApiError("Opplastingsøkten er utløpt. Start opplastingen på nytt.", 410);
  }
  return session;
}

async function deleteFile(store, manifest) {
  const keys = [fileKey(manifest.id)];
  for (let index = 0; index < manifest.totalChunks; index += 1) {
    keys.push(chunkKey(manifest.id, index));
  }
  await Promise.all(keys.map((key) => store.delete(key)));
  await removeActiveFile(store, manifest.id);
}

async function getSharedFile(store, id, downloadToken) {
  const manifest = await getJson(store, fileKey(id));
  if (!manifest || !sameSecret(downloadToken, manifest.downloadToken)) {
    throw new ApiError("Nedlastingslenken er ikke gyldig.", 404);
  }

  if (manifest.expiresAt < Date.now()) {
    await deleteFile(store, manifest);
    throw new ApiError("Nedlastingslenken er utløpt.", 410);
  }

  return manifest;
}

function publicFile(manifest) {
  return {
    id: manifest.id,
    filename: manifest.filename,
    size: manifest.size,
    mime: manifest.mime,
    totalChunks: manifest.totalChunks,
    expiresAt: manifest.expiresAt,
  };
}

function createShareUrl(req, manifest) {
  const url = new URL(manifest.downloadPath || "/filnedlasting.html", req.url);
  url.searchParams.set("file", manifest.id);
  url.searchParams.set("token", manifest.downloadToken);
  return url.toString();
}

async function startUpload(req, store) {
  requireAdmin(req);
  const payload = await req.json();
  const size = Number(payload.size);
  const expiryDays = Number(payload.expiryDays || 30);

  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_FILE_SIZE) {
    throw new ApiError("Velg en fil på maksimalt 100 MB.");
  }
  if (!Number.isInteger(expiryDays) || expiryDays < 1 || expiryDays > MAX_EXPIRY_DAYS) {
    throw new ApiError("Velg en gyldig tilgjengelighetsperiode.");
  }

  const id = randomUUID();
  const now = Date.now();
  const session = {
    id,
    filename: safeFileName(payload.filename),
    size,
    mime: String(payload.mime || "application/octet-stream").slice(0, 150),
    totalChunks: Math.ceil(size / CHUNK_SIZE),
    downloadPath:
      payload.downloadPath === "/en/file-download.html"
        ? "/en/file-download.html"
        : "/filnedlasting.html",
    expiresAt: now + expiryDays * 24 * 60 * 60 * 1000,
    uploadExpiresAt: now + UPLOAD_SESSION_HOURS * 60 * 60 * 1000,
    createdAt: now,
  };

  await store.setJSON(sessionKey(id), session, { onlyIfNew: true });
  return response({
    id,
    chunkSize: CHUNK_SIZE,
    totalChunks: session.totalChunks,
  });
}

async function uploadChunk(req, store, url) {
  requireAdmin(req);
  const id = readId(url.searchParams.get("file"));
  const session = await getSession(store, id);
  const index = readIndex(url.searchParams.get("index"), session.totalChunks);
  const body = await req.arrayBuffer();
  const expectedSize =
    index === session.totalChunks - 1
      ? session.size - index * CHUNK_SIZE
      : CHUNK_SIZE;

  if (body.byteLength !== expectedSize) {
    throw new ApiError("Fildelen har feil størrelse.");
  }

  await store.set(chunkKey(id, index), body);
  return response({ saved: true, index });
}

async function finalizeUpload(req, store) {
  requireAdmin(req);
  const payload = await req.json();
  const id = readId(payload.file);
  const session = await getSession(store, id);
  const manifest = {
    ...session,
    downloadToken: randomBytes(24).toString("base64url"),
    readyAt: Date.now(),
  };

  await store.setJSON(fileKey(id), manifest, { onlyIfNew: true });
  await addActiveFile(store, id);
  await store.delete(sessionKey(id));

  return response({
    file: publicFile(manifest),
    shareUrl: createShareUrl(req, manifest),
  });
}

async function listFiles(req, store) {
  requireAdmin(req);
  const { blobs } = await store.list({ prefix: "files/" });
  const scannedIds = blobs
    .filter(({ key }) => /^files\/[a-f0-9-]{36}\/manifest$/i.test(key))
    .map(({ key }) => key.split("/")[1]);
  const ids = [...new Set([...await readActiveFileIds(store), ...scannedIds])];
  const manifests = await Promise.all(ids.map((id) => getJson(store, fileKey(id))));
  const activeManifests = [];

  for (const manifest of manifests.filter(Boolean)) {
    if (manifest.expiresAt < Date.now()) {
      await deleteFile(store, manifest);
      continue;
    }
    activeManifests.push(manifest);
  }

  await writeActiveFileIds(store, activeManifests.map((manifest) => manifest.id));

  const files = activeManifests
    .map((manifest) => ({
      ...publicFile(manifest),
      shareUrl: createShareUrl(req, manifest),
    }))
    .sort((left, right) => right.createdAt - left.createdAt);

  return response({ files });
}

async function removeFile(req, store) {
  requireAdmin(req);
  const payload = await req.json();
  const id = readId(payload.file);
  const manifest = await getJson(store, fileKey(id));
  if (!manifest) {
    throw new ApiError("Filen finnes ikke.", 404);
  }

  await deleteFile(store, manifest);
  return response({ deleted: true });
}

async function downloadManifest(store, url) {
  const id = readId(url.searchParams.get("file"));
  const manifest = await getSharedFile(store, id, url.searchParams.get("token"));
  return response({ file: publicFile(manifest) });
}

async function downloadChunk(store, url) {
  const id = readId(url.searchParams.get("file"));
  const manifest = await getSharedFile(store, id, url.searchParams.get("token"));
  const index = readIndex(url.searchParams.get("index"), manifest.totalChunks);
  const chunk = await store.get(chunkKey(id, index), {
    type: "arrayBuffer",
    consistency: "strong",
  });

  if (!chunk) {
    throw new ApiError("Filen er ikke komplett. Be avsenderen laste den opp på nytt.", 409);
  }

  return new Response(chunk, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}

export default async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const store = getStore({
    name: STORE_NAME,
    consistency: "strong",
    region: "eu-central-1",
  });

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }

    if (action === "start" && req.method === "POST") {
      return await startUpload(req, store);
    }
    if (action === "chunk" && req.method === "POST") {
      return await uploadChunk(req, store, url);
    }
    if (action === "finalize" && req.method === "POST") {
      return await finalizeUpload(req, store);
    }
    if (action === "list" && req.method === "GET") {
      return await listFiles(req, store);
    }
    if (action === "delete" && req.method === "POST") {
      return await removeFile(req, store);
    }
    if (action === "download-manifest" && req.method === "GET") {
      return await downloadManifest(store, url);
    }
    if (action === "download-chunk" && req.method === "GET") {
      return await downloadChunk(store, url);
    }

    throw new ApiError("Ukjent forespørsel.", 404);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    if (status === 500) {
      console.error("File portal failed", error);
    }
    return response(
      { error: error instanceof ApiError ? error.message : "Noe gikk galt i filportalen." },
      status
    );
  }
};
