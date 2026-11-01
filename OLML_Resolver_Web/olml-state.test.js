const assert = require("assert");
const OLMLState = require("./olml-state.js");

function bytes(text) {
  return new TextEncoder().encode(text);
}

function fixture() {
  return {
    olml: { id: "Olml:11111111-1111-4111-8111-111111111111", version: "1.0.0", title: "Collection" },
    object: { id: "Object:22222222-2222-4222-8222-222222222222", title: "Object A", description: "Stable object" },
    memories: [
      { id: "Memory:33333333-3333-4333-8333-333333333333", title: "Memory A", note: "A note", assets: ["assets/a.txt"] },
      { id: "Memory:44444444-4444-4444-8444-444444444444", title: "Memory B", note: "B note", assets: ["assets/b.txt"] }
    ],
    links: [
      { object: "Object:22222222-2222-4222-8222-222222222222", memory: "Memory:33333333-3333-4333-8333-333333333333" },
      { object: "Object:22222222-2222-4222-8222-222222222222", memory: "Memory:44444444-4444-4444-8444-444444444444" }
    ],
    assets: [
      { path: "assets/a.txt", name: "a.txt", mediaType: "text/plain", size: 5 },
      { path: "assets/b.txt", name: "b.txt", mediaType: "text/plain", size: 5 }
    ],
    objectMarkers: [
      { markerType: "nfc", object: "Object:22222222-2222-4222-8222-222222222222", markerEvidence: { type: "ndef", value: "olml:nfc:a" } }
    ]
  };
}

async function semantic(manifest, assetText = "alpha") {
  return OLMLState.computeSemanticState(
    manifest,
    new Map([["assets/a.txt", bytes(assetText)], ["assets/b.txt", bytes("bravo")]]),
    new Map()
  );
}

(async function run() {
  const base = fixture();
  const baseHashes = await semantic(base);

  const retitled = fixture();
  retitled.object.title = "Renamed Object";
  assert.strictEqual(retitled.object.id, base.object.id, "title edits do not change object.id");
  assert.strictEqual(retitled.memories[0].id, base.memories[0].id, "title edits do not change memory.id");
  assert.strictEqual(retitled.olml.id, base.olml.id, "title edits do not change olml.id");

  assert.ok(base.links.every((link) => !("id" in link)), "V1 writers emit no link.id");

  const missing = OLMLState.normalizeManifest({ olml: {}, object: {}, memories: [{ title: "No id" }] });
  assert.ok(missing.errors.some((message) => message.includes("Missing olml.id")), "missing olml.id is a structural error");
  assert.ok(missing.errors.some((message) => message.includes("Missing object.id")), "missing object.id is a structural error");
  assert.ok(missing.errors.some((message) => message.includes("Missing memory.id")), "missing memory.id is a structural error");
  assert.strictEqual(missing.manifest.object.id, "", "missing IDs are not generated while reading");

  const reordered = {
    objectMarkers: base.objectMarkers,
    assets: base.assets,
    links: base.links,
    memories: base.memories,
    object: { description: base.object.description, title: base.object.title, id: base.object.id },
    olml: { title: base.olml.title, version: base.olml.version, id: base.olml.id }
  };
  const reorderedHashes = await semantic(reordered);
  assert.strictEqual(reorderedHashes.collectionStateHash, baseHashes.collectionStateHash, "JSON key order does not affect collection hash");
  assert.strictEqual(reorderedHashes.packageStateHash, baseHashes.packageStateHash, "JSON key order does not affect package hash");

  const containerNoise = fixture();
  containerNoise.olml.integrity = { profile: OLMLState.HASH_PROFILE, collectionStateHash: "sha256:not-semantic", zipSha256: "sha256:transport" };
  containerNoise.olml.history = [{ type: "exported", at: "2026-08-19T00:00:00Z" }];
  containerNoise.olml.exportedAt = "2026-08-19T00:00:00Z";
  containerNoise.object.updatedAt = "2026-08-19T00:00:00Z";
  containerNoise.memories[0].importedAt = "2026-08-19T00:00:00Z";
  containerNoise.links[0].id = "legacy-link-id";
  const containerNoiseHashes = await semantic(containerNoise);
  assert.strictEqual(containerNoiseHashes.collectionStateHash, baseHashes.collectionStateHash, "portable history, declared hashes, timestamps, transport hash, and link.id do not affect collection hash");
  assert.strictEqual(containerNoiseHashes.packageStateHash, baseHashes.packageStateHash, "portable history, declared hashes, timestamps, transport hash, and link.id do not affect package hash");

  const versionEdit = fixture();
  versionEdit.olml.version = "1.0.1";
  const versionEditHashes = await semantic(versionEdit);
  assert.strictEqual(versionEditHashes.collectionStateHash, baseHashes.collectionStateHash, "olml.version does not change collection hash");
  assert.strictEqual(versionEditHashes.packageStateHash, baseHashes.packageStateHash, "olml.version does not change package hash");

  const differentAsset = await semantic(fixture(), "bravo");
  assert.notStrictEqual(differentAsset.memoryStateHashes[0].memoryStateHash, baseHashes.memoryStateHashes[0].memoryStateHash, "same-name same-size different bytes changes memory hash");
  assert.strictEqual(differentAsset.memoryStateHashes[1].memoryStateHash, baseHashes.memoryStateHashes[1].memoryStateHash, "unrelated memory hash is stable when another memory asset changes");
  assert.strictEqual(differentAsset.collectionStateHash, baseHashes.collectionStateHash, "asset byte changes do not roll up to collection hash");
  assert.notStrictEqual(differentAsset.packageStateHash, baseHashes.packageStateHash, "asset byte changes roll up to package hash");

  const memoryEdit = fixture();
  memoryEdit.memories[0].note = "Changed note";
  const memoryEditHashes = await semantic(memoryEdit);
  assert.strictEqual(memoryEditHashes.objectStateHash, baseHashes.objectStateHash, "memory edit does not change object hash");
  assert.notStrictEqual(memoryEditHashes.memoryStateHashes[0].memoryStateHash, baseHashes.memoryStateHashes[0].memoryStateHash, "memory edit changes memory hash");
  assert.strictEqual(memoryEditHashes.collectionStateHash, baseHashes.collectionStateHash, "memory edit does not change collection hash");
  assert.notStrictEqual(memoryEditHashes.packageStateHash, baseHashes.packageStateHash, "memory edit changes package hash");

  const objectEdit = fixture();
  objectEdit.object.description = "Changed object";
  const objectEditHashes = await semantic(objectEdit);
  assert.notStrictEqual(objectEditHashes.objectStateHash, baseHashes.objectStateHash, "object edit changes object hash");
  assert.strictEqual(objectEditHashes.memoryStateHashes[0].memoryStateHash, baseHashes.memoryStateHashes[0].memoryStateHash, "object edit does not change memory hash");
  assert.strictEqual(objectEditHashes.collectionStateHash, baseHashes.collectionStateHash, "object edit does not change collection hash");
  assert.notStrictEqual(objectEditHashes.packageStateHash, baseHashes.packageStateHash, "object edit changes package hash");

  const markerEdit = fixture();
  markerEdit.objectMarkers[0].markerEvidence.value = "olml:nfc:b";
  const markerEditHashes = await semantic(markerEdit);
  assert.notStrictEqual(markerEditHashes.objectStateHash, baseHashes.objectStateHash, "marker evidence value changes object hash");
  assert.strictEqual(markerEditHashes.collectionStateHash, baseHashes.collectionStateHash, "marker evidence value does not change collection hash");
  assert.notStrictEqual(markerEditHashes.packageStateHash, baseHashes.packageStateHash, "marker evidence value changes package hash");

  const collectionEdit = fixture();
  collectionEdit.olml.title = "Collection renamed";
  const collectionEditHashes = await semantic(collectionEdit);
  assert.strictEqual(collectionEditHashes.objectStateHash, baseHashes.objectStateHash, "collection metadata edit does not change object hash");
  assert.strictEqual(collectionEditHashes.memoryStateHashes[0].memoryStateHash, baseHashes.memoryStateHashes[0].memoryStateHash, "collection metadata edit does not change memory hash");
  assert.notStrictEqual(collectionEditHashes.collectionStateHash, baseHashes.collectionStateHash, "collection metadata edit changes collection hash");
  assert.notStrictEqual(collectionEditHashes.packageStateHash, baseHashes.packageStateHash, "collection metadata edit changes package hash");

  const collectionDescriptionEdit = fixture();
  collectionDescriptionEdit.olml.note = "Collection description changed";
  const collectionDescriptionEditHashes = await semantic(collectionDescriptionEdit);
  assert.notStrictEqual(collectionDescriptionEditHashes.collectionStateHash, baseHashes.collectionStateHash, "collection description edit changes collection hash");
  assert.notStrictEqual(collectionDescriptionEditHashes.packageStateHash, baseHashes.packageStateHash, "collection description edit changes package hash");

  const membershipEdit = fixture();
  membershipEdit.memories = membershipEdit.memories.slice(0, 1);
  membershipEdit.links = membershipEdit.links.slice(0, 1);
  membershipEdit.assets = membershipEdit.assets.slice(0, 1);
  const membershipEditHashes = await semantic(membershipEdit);
  assert.strictEqual(membershipEditHashes.objectStateHash, baseHashes.objectStateHash, "membership edit does not change object hash");
  assert.notStrictEqual(membershipEditHashes.collectionStateHash, baseHashes.collectionStateHash, "membership edit changes collection hash");
  assert.notStrictEqual(membershipEditHashes.packageStateHash, baseHashes.packageStateHash, "membership edit changes package hash");

  const markerBytes = fixture();
  markerBytes.objectMarkers[0] = {
    markerType: "image-reference",
    object: markerBytes.object.id,
    markerEvidence: { type: "image", path: "marker-evidence/ref.png", name: "ref.png", mediaType: "image/png", size: 4 }
  };
  const markerBytesA = await OLMLState.computeSemanticState(markerBytes, new Map([["assets/a.txt", bytes("alpha")], ["assets/b.txt", bytes("bravo")]]), new Map([["marker-evidence/ref.png", bytes("aaaa")]]));
  const markerBytesB = await OLMLState.computeSemanticState(markerBytes, new Map([["assets/a.txt", bytes("alpha")], ["assets/b.txt", bytes("bravo")]]), new Map([["marker-evidence/ref.png", bytes("bbbb")]]));
  assert.notStrictEqual(markerBytesA.objectStateHash, markerBytesB.objectStateHash, "marker evidence bytes change object hash");

  const noParent = await OLMLState.computeSemanticState(fixture(), new Map([["assets/a.txt", bytes("alpha")]]), new Map(), "");
  assert.ok(!noParent.parentPackageStateHash, "no-op/new export creates no parent edge when no semantic parent exists");
  const withParent = await OLMLState.computeSemanticState(fixture(), new Map([["assets/a.txt", bytes("alpha")], ["assets/b.txt", bytes("bravo")]]), new Map(), baseHashes.packageStateHash);
  assert.strictEqual(withParent.collectionStateHash, baseHashes.collectionStateHash, "parent hash is excluded from collection hash");
  assert.strictEqual(withParent.packageStateHash, baseHashes.packageStateHash, "parent hash is excluded from package hash");
  assert.strictEqual(withParent.parentPackageStateHash, baseHashes.packageStateHash, "parentPackageStateHash records previous accepted portable hash");

  const envelope = OLMLState.withIntegrityEnvelope(fixture(), baseHashes);
  const verified = OLMLState.verifyDeclaredIntegrity(envelope, baseHashes);
  assert.strictEqual(verified.status, "verified", "declared matching hashes verify");
  const badEnvelope = OLMLState.withIntegrityEnvelope(fixture(), { ...baseHashes, collectionStateHash: "sha256:bad" });
  const mismatch = OLMLState.verifyDeclaredIntegrity(badEnvelope, baseHashes);
  assert.strictEqual(mismatch.status, "mismatch", "incorrect declared hash is detected");
  assert.ok(mismatch.mismatches.includes("collectionStateHash"), "collection hash mismatch is named");
  const legacy = OLMLState.verifyDeclaredIntegrity(fixture(), baseHashes);
  assert.strictEqual(legacy.status, "missing", "missing legacy hashes are not classified as mismatch");

  const conflicts = OLMLState.classifyImport({
    olmlId: base.olml.id,
    objectId: "Object:other",
    objectStateHash: "sha256:x",
    collectionStateHash: "sha256:y",
    packageStateHash: "sha256:z",
    memoryStateHashes: []
  }, [{ olmlId: base.olml.id, objectId: base.object.id, collectionStateHash: baseHashes.collectionStateHash, packageStateHash: baseHashes.packageStateHash }]);
  assert.strictEqual(conflicts.type, "malformed-colliding-identity", "same olml.id + different object.id is blocked");

  const packageConflict = OLMLState.classifyImport({
    olmlId: base.olml.id,
    objectId: base.object.id,
    objectStateHash: "sha256:x",
    collectionStateHash: baseHashes.collectionStateHash,
    packageStateHash: "sha256:different",
    memoryStateHashes: []
  }, [{ olmlId: base.olml.id, objectId: base.object.id, collectionStateHash: baseHashes.collectionStateHash, packageStateHash: baseHashes.packageStateHash }]);
  assert.strictEqual(packageConflict.type, "same-file-version-conflict", "same olml.id + package hash mismatch is a version conflict");

  const catalogPlaceholder = OLMLState.classifyImport({
    olmlId: base.olml.id,
    objectId: base.object.id,
    objectStateHash: baseHashes.objectStateHash,
    collectionStateHash: baseHashes.collectionStateHash,
    packageStateHash: baseHashes.packageStateHash,
    memoryStateHashes: baseHashes.memoryStateHashes
  }, [{ olmlId: base.olml.id, objectId: base.object.id }]);
  assert.strictEqual(catalogPlaceholder.type, "catalog-placeholder", "thin catalog records are repaired on read instead of treated as conflicts");

  console.log("olml-state tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
