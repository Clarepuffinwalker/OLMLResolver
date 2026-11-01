(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OLMLState = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const HASH_PROFILE = "olml-semantic-state-v1-draft-2";
  const INTEGRITY_KEY = "integrity";
  const HASH_FIELDS = new Set([
    "hashProfile",
    "objectStateHash",
    "memoryStateHash",
    "memoryStateHashes",
    "collectionStateHash",
    "packageStateHash",
    "parentCollectionStateHash",
    "parentPackageStateHash",
    "zipSha256",
    INTEGRITY_KEY
  ]);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function stripEmpty(value) {
    if (Array.isArray(value)) return value.map(stripEmpty);
    if (value && typeof value === "object") {
      const out = {};
      for (const [key, item] of Object.entries(value)) {
        if (key === INTEGRITY_KEY || key === "history") continue;
        if (item === "" || item == null) continue;
        if (Array.isArray(item) && item.length === 0) continue;
        const next = stripEmpty(item);
        if (next && typeof next === "object" && !Array.isArray(next) && Object.keys(next).length === 0) continue;
        out[key] = next;
      }
      return out;
    }
    return value;
  }

  function sortJson(value) {
    if (Array.isArray(value)) return value.map(sortJson);
    if (value && typeof value === "object") {
      return Object.keys(value).sort().reduce((out, key) => {
        out[key] = sortJson(value[key]);
        return out;
      }, {});
    }
    return value;
  }

  function canonicalJson(value) {
    return JSON.stringify(sortJson(stripEmpty(value)));
  }

  async function sha256Digest(bytes) {
    const input = bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(String(bytes));
    if (globalThis.crypto && globalThis.crypto.subtle) {
      const hash = await globalThis.crypto.subtle.digest("SHA-256", input);
      return `sha256:${Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    }
    if (typeof require === "function") {
      const nodeCrypto = require("crypto");
      return `sha256:${nodeCrypto.createHash("sha256").update(Buffer.from(input)).digest("hex")}`;
    }
    throw new Error("SHA-256 is unavailable in this runtime.");
  }

  async function hashCanonical(value) {
    return sha256Digest(new TextEncoder().encode(canonicalJson(value)));
  }

  function normalizePath(path) {
    const raw = String(path || "");
    if (!raw || raw.includes("\\") || raw.startsWith("/") || raw.includes("\0")) return "";
    const parts = [];
    for (const part of raw.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") return "";
      parts.push(part);
    }
    return parts.join("/");
  }

  function validateZipEntryNames(names) {
    const issues = [];
    const normalized = new Map();
    const lower = new Map();
    let manifestCount = 0;
    for (const name of names) {
      const path = normalizePath(name);
      if (!path) {
        issues.push(`Unsafe ZIP path: ${name || "(blank)"}`);
        continue;
      }
      if (path === "olml.json") manifestCount += 1;
      if (normalized.has(path)) issues.push(`Duplicate normalized ZIP path: ${path}`);
      normalized.set(path, name);
      const folded = path.toLowerCase();
      if (lower.has(folded) && lower.get(folded) !== path) issues.push(`Case-colliding ZIP paths: ${lower.get(folded)} and ${path}`);
      lower.set(folded, path);
    }
    if (manifestCount !== 1) issues.push(`Expected exactly one olml.json, found ${manifestCount}.`);
    return issues;
  }

  function normalizeManifest(raw) {
    const errors = [];
    const object = raw.object || raw.primaryObject || {};
    const olml = raw.olml || raw.package || {};
    const memories = Array.isArray(raw.memories) ? raw.memories : [];
    const manifest = {
      olml: {
        id: olml.id || "",
        version: olml.version || raw.olmlVersion || "1.0.0",
        title: olml.title || raw.collectionTitle || "",
        note: olml.note || raw.packageNote || ""
      },
      object: {
        id: object.id || "",
        title: object.title || object.label || "",
        description: object.description || ""
      },
      memories: memories.map((memory) => ({
        id: memory.id || "",
        title: memory.title || "",
        time: memory.time || memory.memoryTime || "",
        place: memory.place || "",
        note: memory.note || memory.story || "",
        assets: Array.isArray(memory.assets)
          ? memory.assets.slice()
          : Array.isArray(memory.mediaReferences)
            ? memory.mediaReferences.slice()
            : []
      })),
      links: Array.isArray(raw.links) ? raw.links.map((link) => ({
        object: link.object || "",
        memory: link.memory || ""
      })) : [],
      assets: Array.isArray(raw.assets) ? raw.assets.map((asset) => ({ ...asset })) : [],
      objectMarkers: Array.isArray(raw.objectMarkers)
        ? raw.objectMarkers.map(normalizeObjectMarker)
        : []
    };
    if (!manifest.olml.id) errors.push("Missing olml.id.");
    if (!manifest.object.id) errors.push("Missing object.id.");
    manifest.memories.forEach((memory, index) => {
      if (!memory.id) errors.push(`Missing memory.id at memories[${index}].`);
    });
    return { manifest, errors };
  }

  async function digestAsset(asset, assetBytes) {
    const path = normalizePath(asset && asset.path);
    const external = Boolean(asset && (asset.external || asset.url));
    if (external) {
      return stripEmpty({
        path,
        name: asset.name || "",
        mediaType: asset.mediaType || asset.type || "",
        size: asset.size || 0,
        url: asset.url || "",
        expectedDigest: asset.expectedDigest || asset.digest || ""
      });
    }
    const bytes = assetBytes && assetBytes.get(path);
    return stripEmpty({
      path,
      name: asset.name || "",
      mediaType: asset.mediaType || asset.type || "",
      size: bytes ? bytes.byteLength : asset.size || 0,
      digest: bytes ? await sha256Digest(bytes) : asset.digest || ""
    });
  }

  function normalizeObjectMarker(marker) {
    const markerEvidence = marker.markerEvidence || marker.evidence || {};
    return stripEmpty({
      markerType: marker.markerType || marker.type || "",
      object: marker.object || "",
      markerEvidence,
      note: marker.note || ""
    });
  }

  async function objectProjection(manifest, markerBytes) {
    const markers = [];
    for (const marker of manifest.objectMarkers || []) {
      const evidence = marker.markerEvidence || {};
      let evidenceProjection = evidence;
      if (evidence && evidence.path) {
        const path = normalizePath(evidence.path);
        const bytes = markerBytes && markerBytes.get(path);
        evidenceProjection = stripEmpty({
          type: evidence.type || "",
          path,
          name: evidence.name || "",
          mediaType: evidence.mediaType || evidence.type || "",
          size: bytes ? bytes.byteLength : evidence.size || 0,
          digest: bytes ? await sha256Digest(bytes) : evidence.digest || ""
        });
      }
      markers.push(stripEmpty({
        markerType: marker.markerType,
        object: manifest.object.id,
        markerEvidence: evidenceProjection,
        note: marker.note || ""
      }));
    }
    markers.sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
    return {
      hashProfile: HASH_PROFILE,
      object: stripEmpty({
        id: manifest.object && manifest.object.id,
        title: manifest.object && manifest.object.title,
        description: manifest.object && manifest.object.description
      }),
      markers
    };
  }

  async function memoryProjection(memory, manifest, assetBytes) {
    const records = new Map((manifest.assets || []).map((asset) => [asset.path, asset]));
    const assets = [];
    for (const path of memory.assets || []) {
      const record = records.get(path) || { path };
      assets.push(await digestAsset(record, assetBytes));
    }
    assets.sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
    return {
      hashProfile: HASH_PROFILE,
      memory: stripEmpty({
        id: memory.id,
        title: memory.title,
        time: memory.time,
        place: memory.place,
        note: memory.note,
        assets
      })
    };
  }

  async function computeSemanticState(manifest, assetBytes, markerBytes, parentPackageStateHash) {
    const objectStateHash = await hashCanonical(await objectProjection(manifest, markerBytes));
    const memoryStateHashes = [];
    for (const memory of manifest.memories || []) {
      memoryStateHashes.push({
        memory: memory.id,
        memoryStateHash: await hashCanonical(await memoryProjection(memory, manifest, assetBytes))
      });
    }
    memoryStateHashes.sort((a, b) => a.memory.localeCompare(b.memory));
    const linkPairs = (manifest.links || []).map((link) => ({
      object: link.object,
      memory: link.memory
    })).sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
    const collectionStateHash = await hashCanonical({
      hashProfile: HASH_PROFILE,
      olml: stripEmpty({
        id: manifest.olml && manifest.olml.id,
        title: manifest.olml && manifest.olml.title,
        note: manifest.olml && manifest.olml.note
      }),
      links: linkPairs
    });
    const packageStateHash = await hashCanonical({
      hashProfile: HASH_PROFILE,
      collectionStateHash,
      objectStateHash,
      memories: memoryStateHashes
    });
    return stripEmpty({
      hashProfile: HASH_PROFILE,
      objectStateHash,
      memoryStateHashes,
      collectionStateHash,
      packageStateHash,
      parentPackageStateHash: parentPackageStateHash || ""
    });
  }

  function withIntegrityEnvelope(manifest, semanticState, zipSha256) {
    const next = clone(manifest);
    next.olml = next.olml || {};
    next.olml[INTEGRITY_KEY] = stripEmpty({
      profile: HASH_PROFILE,
      objectStateHash: semanticState.objectStateHash,
      memoryStateHashes: semanticState.memoryStateHashes,
      collectionStateHash: semanticState.collectionStateHash,
      packageStateHash: semanticState.packageStateHash,
      parentPackageStateHash: semanticState.parentPackageStateHash,
      zipSha256
    });
    return next;
  }

  function declaredIntegrity(manifest) {
    return manifest && manifest.olml && (manifest.olml.integrity || {
      profile: manifest.olml.hashProfile,
      objectStateHash: manifest.olml.objectStateHash,
      memoryStateHashes: manifest.olml.memoryStateHashes,
      collectionStateHash: manifest.olml.collectionStateHash,
      packageStateHash: manifest.olml.packageStateHash,
      parentPackageStateHash: manifest.olml.parentPackageStateHash || manifest.olml.parentCollectionStateHash
    });
  }

  function verifyDeclaredIntegrity(manifest, semanticState) {
    const declared = declaredIntegrity(manifest);
    const present = Boolean(declared && (
      declared.profile ||
      declared.objectStateHash ||
      declared.collectionStateHash ||
      declared.packageStateHash ||
      Array.isArray(declared.memoryStateHashes) ||
      declared.parentPackageStateHash ||
      declared.parentCollectionStateHash
    ));
    if (!present) {
      return { present: false, mismatches: [], status: "missing" };
    }
    const mismatches = [];
    if (declared.profile && declared.profile !== HASH_PROFILE) mismatches.push("hashProfile");
    if (declared.objectStateHash && declared.objectStateHash !== semanticState.objectStateHash) mismatches.push("objectStateHash");
    if (declared.collectionStateHash && declared.collectionStateHash !== semanticState.collectionStateHash) mismatches.push("collectionStateHash");
    if (declared.packageStateHash && declared.packageStateHash !== semanticState.packageStateHash) mismatches.push("packageStateHash");
    if (Array.isArray(declared.memoryStateHashes)) {
      const actual = new Map((semanticState.memoryStateHashes || []).map((item) => [item.memory, item.memoryStateHash]));
      for (const item of declared.memoryStateHashes) {
        if (!item || !item.memory) continue;
        if (item.memoryStateHash && actual.get(item.memory) !== item.memoryStateHash) mismatches.push(`memoryStateHash:${item.memory}`);
      }
    }
    return { present: true, mismatches, status: mismatches.length ? "mismatch" : "verified" };
  }

  function classifyImport(incoming, currentRecords) {
    const current = Array.isArray(currentRecords) ? currentRecords : [];
    const sameCollection = current.find((record) => record.olmlId === incoming.olmlId);
    if (sameCollection && sameCollection.objectId && sameCollection.objectId !== incoming.objectId) {
      return { type: "malformed-colliding-identity", blocking: true, message: "same olml.id + different object.id is malformed/colliding input. Library mutation is blocked." };
    }
    for (const candidate of incoming.memoryStateHashes || []) {
      const collision = current.find((record) => record.olmlId !== incoming.olmlId && (record.memoryStateHashes || []).some((item) => item.memory === candidate.memory));
      if (collision && (collision.olmlId !== incoming.olmlId || collision.objectId !== incoming.objectId)) {
        return { type: "malformed-memory-identity", blocking: true, message: "same memory.id appears under a different olml.id or object.id. Library mutation is blocked." };
      }
    }
    if (sameCollection && !sameCollection.packageStateHash) {
      return { type: "catalog-placeholder", message: "Catalog placeholder matched. Reading the file will restore the full local Library record." };
    }
    if (sameCollection && sameCollection.packageStateHash === incoming.packageStateHash) {
      return { type: "equivalent", message: "Equivalent Collection state." };
    }
    if (sameCollection && sameCollection.objectId === incoming.objectId && sameCollection.packageStateHash !== incoming.packageStateHash) {
      return { type: "same-file-version-conflict", decision: true, message: "There seems to be some conflict between the file to read and our file record in Library. Please see the diff below and choose one to load." };
    }
    const sameObject = current.filter((record) => record.objectId === incoming.objectId && record.olmlId !== incoming.olmlId);
    if (sameObject.length) return { type: "sibling-collection", message: "Normal sibling Collection for the same object.id." };
    return { type: "new-collection", message: "New Collection candidate." };
  }

  return {
    HASH_PROFILE,
    canonicalJson,
    classifyImport,
    computeSemanticState,
    declaredIntegrity,
    normalizeManifest,
    normalizePath,
    sha256Digest,
    stripEmpty,
    validateZipEntryNames,
    verifyDeclaredIntegrity,
    withIntegrityEnvelope
  };
});
