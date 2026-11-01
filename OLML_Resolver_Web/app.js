(function () {
  "use strict";

  const DB_NAME = "olml-solver-library";
  const DB_VERSION = 4;
  const STORE_NAME = "packages";
  const STORE_OBJECTS = "currentObjects";
  const STORE_MEMORIES = "currentMemories";
  const STORE_COLLECTIONS = "currentCollections";
  const STORE_SNAPSHOTS = "snapshots";
  const STORE_OBJECT_SNAPSHOTS = "objectSnapshots";
  const STORE_ACTIONS = "actions";
  const STORE_CONFLICTS = "pendingConflicts";
  const CATALOG_VERSION = "1.1";
  const OLML_VERSION = "1.0.0";
  const HASH_PROFILE = window.OLMLState.HASH_PROFILE;
  const SCAN_CODE_FORMATS = ["qr_code", "code_128", "code_39", "code_93", "codabar", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "pdf417", "data_matrix", "aztec"];
  const SUPPORTED_OBJECT_MARKERS = new Set(["qr", "nfc", "image-reference", "text-marker"]);
  const MARKER_HELP = {
    qr: "Please save the QR code image and attach to the object.",
    nfc: "NFC uses an NDEF value from a nearby tag. In this MVP the Object Marker belongs to the current object.id.",
    "image-reference": "Please choose the reference image of the object itself.",
    "text-marker": "OCR text marker reads visible text on or near the object. Record the exact printed or engraved text here."
  };

  const state = {
    mode: "empty",
    manifest: null,
    assets: new Map(),
    markerEvidenceFiles: new Map(),
    editingAssetPaths: new Set(),
    assetUrls: new Map(),
    sourceName: "",
    sourceBytes: null,
    validation: [],
    activeTab: "memories",
    editorPurpose: "package",
    editingMemoryIndex: 0,
    editingMarkerIndex: 0,
    selectedExistingOlmlId: "",
    selectedExistingObjectId: "",
    editSnapshot: null,
    preserveObjectId: false,
    readerUnlocks: {
      object: false,
      collection: false,
      markers: false,
      memories: false
    },
    readerEditing: false,
    readerBaseline: null,
    readerAssetTargetIndex: 0,
    readerMarkerTargetIndex: 0,
    selectedMarkerDeletes: new Set(),
    selectedAssetDeletes: new Set(),
    markerAddDraft: null,
    assetAddMemoryIndex: null,
    librarySearch: "",
    libraryPanel: "library",
    sourceHash: "",
    structuralReadOnly: false,
    sharedObjectSiblingCount: 0,
    activeConflict: null,
    conflictMode: "compare",
    detachedFromLibrary: false,
    detachedExport: false,
    candidateSemanticState: null,
    assetPreviewPath: "",
    cameraStream: null,
    barcodeDetector: null,
    scanFrameHandle: 0,
    ocrScanTimer: 0,
    scanActive: false,
    scanMode: "",
    zxingControls: null,
    zxingLoading: null,
    codeScannerFailure: "",
    ocrWorker: null,
    ocrLoading: null,
    ocrInFlight: false,
    lastScanCandidate: "",
    lastScanAt: 0
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    openButton: $("openButton"),
    newButton: $("newButton"),
    scanButton: $("scanButton"),
    emptyNewButton: $("emptyNewButton"),
    emptyScanButton: $("emptyScanButton"),
    emptyDropButton: $("emptyDropButton"),
    exportButton: $("exportButton"),
    fileInput: $("fileInput"),
    dropZone: $("dropZone"),
    emptyState: $("emptyState"),
    newFlow: $("newFlow"),
    newObjectChoiceButton: $("newObjectChoiceButton"),
    existingObjectChoiceButton: $("existingObjectChoiceButton"),
    existingObjectPicker: $("existingObjectPicker"),
    existingObjectSelect: $("existingObjectSelect"),
    confirmExistingObjectButton: $("confirmExistingObjectButton"),
    newFlowBackButton: $("newFlowBackButton"),
    existingObjectPackageList: $("existingObjectPackageList"),
    editor: $("editor"),
    reader: $("reader"),
    scanner: $("scanner"),
    scanBackButton: $("scanBackButton"),
    startCodeScanButton: $("startCodeScanButton"),
    startOcrScanButton: $("startOcrScanButton"),
    stopScanButton: $("stopScanButton"),
    scanVideo: $("scanVideo"),
    scanCanvas: $("scanCanvas"),
    scanStatus: $("scanStatus"),
    scanResult: $("scanResult"),
    packageForm: $("packageForm"),
    olmlId: $("olmlId"),
    objectId: $("objectId"),
    memoryId: $("memoryId"),
    objectTitle: $("objectTitle"),
    objectDescription: $("objectDescription"),
    collectionTitle: $("collectionTitle"),
    collectionDescription: $("collectionDescription"),
    memoryTitle: $("memoryTitle"),
    memoryTime: $("memoryTime"),
    memoryPlace: $("memoryPlace"),
    memoryNote: $("memoryNote"),
    assetDropZone: $("assetDropZone"),
    assetInput: $("assetInput"),
    onlineAssetUrl: $("onlineAssetUrl"),
    addOnlineAssetButton: $("addOnlineAssetButton"),
    assetDetailsPanel: $("assetDetailsPanel"),
    assetSizeSummary: $("assetSizeSummary"),
    assetList: $("assetList"),
    jsonPreview: $("jsonPreview"),
    generateIdsButton: $("generateIdsButton"),
    discardButton: $("discardButton"),
    editorExportButton: $("editorExportButton"),
    saveButton: $("saveButton"),
    readerContent: $("readerContent"),
    readerAssetInput: $("readerAssetInput"),
    readerMarkerImageInput: $("readerMarkerImageInput"),
    validationList: $("validationList"),
    validationSummary: $("validationSummary"),
    statusAxisGrid: $("statusAxisGrid"),
    postponeConflictButton: $("postponeConflictButton"),
    warningCount: $("warningCount"),
    errorCount: $("errorCount"),
    infoCount: $("infoCount"),
    validateButton: $("validateButton"),
    lastRun: $("lastRun"),
    markerType: $("markerType"),
    markerTarget: $("markerTarget"),
    markerEvidenceTextGroup: $("markerEvidenceTextGroup"),
    markerEvidenceTextLabel: $("markerEvidenceTextLabel"),
    markerEvidence: $("markerEvidence"),
    markerEvidenceFileGroup: $("markerEvidenceFileGroup"),
    markerEvidenceFileLabel: $("markerEvidenceFileLabel"),
    markerEvidenceFileDropZone: $("markerEvidenceFileDropZone"),
    markerEvidenceFileInput: $("markerEvidenceFileInput"),
    markerEvidenceFileTitle: $("markerEvidenceFileTitle"),
    markerEvidenceFileHint: $("markerEvidenceFileHint"),
    markerEvidenceFileSummary: $("markerEvidenceFileSummary"),
    qrAutoPanel: $("qrAutoPanel"),
    qrAutoPreview: $("qrAutoPreview"),
    additionalMarkerEditors: $("additionalMarkerEditors"),
    writerObjectWarning: $("writerObjectWarning"),
    writerMarkerWarning: $("writerMarkerWarning"),
    markerHelp: $("markerHelp"),
    markerPayload: $("markerPayload"),
    resolveInput: $("resolveInput"),
    resolveButton: $("resolveButton"),
    resolveResult: $("resolveResult"),
    libraryList: $("libraryList"),
    refreshLibraryButton: $("refreshLibraryButton"),
    publicationUrl: $("publicationUrl"),
    savePublicationButton: $("savePublicationButton"),
    exportCatalogButton: $("exportCatalogButton"),
    importCatalogButton: $("importCatalogButton"),
    catalogInput: $("catalogInput"),
    historyCreated: $("historyCreated"),
    historyUpdated: $("historyUpdated"),
    historyRevision: $("historyRevision"),
    historyStorageStatus: $("historyStorageStatus"),
    historyLibraryList: $("historyLibraryList"),
    libraryActivityList: $("libraryActivityList"),
    pendingConflictsList: $("pendingConflictsList"),
    libraryTabPanel: $("libraryTabPanel"),
    activityTabPanel: $("activityTabPanel"),
    librarySearch: $("librarySearch"),
    libraryObjectProfile: $("libraryObjectProfile"),
    importCatalogFromLibraryButton: $("importCatalogFromLibraryButton"),
    exportCatalogFromLibraryButton: $("exportCatalogFromLibraryButton")
  };
  els.addObjectMarkerButton = $("addObjectMarkerButton");

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindEvents();
    showMode("empty");
    setLibraryPanel("library");
    refreshLibrary();
  }

  function bindEvents() {
    els.openButton.addEventListener("click", () => els.fileInput.click());
    els.fileInput.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      event.target.value = "";
      if (file) await openOlmlFile(file);
    });
    els.newButton.addEventListener("click", () => showNewFileFlow("new"));
    els.scanButton.addEventListener("click", openScanner);
    els.emptyNewButton.addEventListener("click", () => showNewFileFlow("new"));
    els.emptyScanButton.addEventListener("click", openScanner);
    els.emptyDropButton.addEventListener("click", () => els.fileInput.click());
    els.scanBackButton.addEventListener("click", goHome);
    els.startCodeScanButton.addEventListener("click", () => startScanner("code"));
    els.startOcrScanButton.addEventListener("click", () => startScanner("ocr"));
    els.stopScanButton.addEventListener("click", stopScanner);
    els.exportButton.addEventListener("click", saveAndExportCurrentCollection);
    if (els.editorExportButton) els.editorExportButton.addEventListener("click", saveAndExportCurrentCollection);
    if (els.generateIdsButton) els.generateIdsButton.remove();
    els.discardButton.addEventListener("click", discardEditorWork);
    els.saveButton.addEventListener("click", handleEditorSave);
    els.newObjectChoiceButton.addEventListener("click", () => createNewPackage());
    els.existingObjectChoiceButton.addEventListener("click", () => showNewFileFlow("existing"));
    els.existingObjectSelect.addEventListener("change", () => previewExistingObject(els.existingObjectSelect.value));
    els.confirmExistingObjectButton.addEventListener("click", createPackageForExistingObject);
    els.newFlowBackButton.addEventListener("click", goHome);
    els.addObjectMarkerButton.addEventListener("click", addNewObjectMarker);
    els.additionalMarkerEditors.addEventListener("click", handleAdditionalMarkerClick);
    els.additionalMarkerEditors.addEventListener("input", handleAdditionalMarkerInput);
    els.additionalMarkerEditors.addEventListener("change", handleAdditionalMarkerChange);
    els.assetInput.addEventListener("change", addSelectedAssets);
    els.addOnlineAssetButton.addEventListener("click", addOnlineAssetFromInput);
    els.markerEvidenceFileInput.addEventListener("change", addSelectedMarkerEvidenceFile);
    els.validateButton.addEventListener("click", () => validateAndRender(true));
    els.postponeConflictButton.addEventListener("click", postponeActiveConflict);
    els.resolveButton.addEventListener("click", searchObjectMarkerInLibrary);
    els.refreshLibraryButton.addEventListener("click", refreshLibrary);
    els.savePublicationButton.addEventListener("click", savePublicationLocation);
    els.exportCatalogButton.addEventListener("click", exportCatalog);
    els.importCatalogButton.addEventListener("click", () => els.catalogInput.click());
    els.exportCatalogFromLibraryButton.addEventListener("click", exportCatalog);
    els.importCatalogFromLibraryButton.addEventListener("click", () => els.catalogInput.click());
    els.catalogInput.addEventListener("change", importCatalogFile);
    els.readerContent.addEventListener("click", handleReaderClick);
    els.readerContent.addEventListener("input", handleReaderInput);
    els.readerContent.addEventListener("change", handleReaderChange);
    els.readerContent.addEventListener("dragover", handleReaderDragOver);
    els.readerContent.addEventListener("dragleave", handleReaderDragLeave);
    els.readerContent.addEventListener("drop", handleReaderDrop);
    els.readerAssetInput.addEventListener("change", addReaderAssets);
    els.readerMarkerImageInput.addEventListener("change", addReaderMarkerImage);
    els.librarySearch.addEventListener("input", () => {
      state.librarySearch = els.librarySearch.value.trim();
      refreshLibrary();
    });

    ["objectTitle", "objectDescription", "collectionTitle", "collectionDescription", "memoryTitle", "memoryTime", "memoryPlace", "memoryNote"].forEach((id) => {
      $(id).addEventListener("input", updatePreviewFromForm);
    });
    ["markerType", "markerEvidence"].forEach((id) => {
      $(id).addEventListener("input", syncObjectMarkerFromInspector);
      $(id).addEventListener("change", syncObjectMarkerFromInspector);
    });

    els.markerEvidenceFileDropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.stopPropagation();
      els.markerEvidenceFileDropZone.classList.add("dragging");
    });
    els.markerEvidenceFileDropZone.addEventListener("dragleave", (event) => {
      event.stopPropagation();
      els.markerEvidenceFileDropZone.classList.remove("dragging");
    });
    els.markerEvidenceFileDropZone.addEventListener("drop", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      els.markerEvidenceFileDropZone.classList.remove("dragging");
      await addMarkerEvidenceFiles(Array.from(event.dataTransfer.files || []).slice(0, 1));
    });

    els.assetDropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.stopPropagation();
      els.assetDropZone.classList.add("dragging");
    });
    els.assetDropZone.addEventListener("dragleave", (event) => {
      event.stopPropagation();
      els.assetDropZone.classList.remove("dragging");
    });
    els.assetDropZone.addEventListener("drop", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      els.assetDropZone.classList.remove("dragging");
      await addAssetFiles(Array.from(event.dataTransfer.files || []));
    });

    els.dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      els.emptyState.classList.add("dragging");
      els.emptyDropButton.classList.add("dragging");
    });
    els.dropZone.addEventListener("dragleave", () => {
      els.emptyState.classList.remove("dragging");
      els.emptyDropButton.classList.remove("dragging");
    });
    els.dropZone.addEventListener("drop", async (event) => {
      event.preventDefault();
      els.emptyState.classList.remove("dragging");
      els.emptyDropButton.classList.remove("dragging");
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) await openOlmlFile(file);
    });

    els.newFlow.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-existing-object]");
      if (!button) return;
      els.existingObjectSelect.value = button.dataset.existingObject;
      await previewExistingObject(button.dataset.existingObject);
    });

    document.querySelectorAll("[data-library-tab]").forEach((button) => {
      button.addEventListener("click", () => setLibraryPanel(button.dataset.libraryTab));
    });
    els.libraryTabButton = $("libraryTabButton");
    els.activityTabButton = $("activityTabButton");
    els.libraryTabButton.addEventListener("click", () => setLibraryPanel("library"));
    els.activityTabButton.addEventListener("click", () => setLibraryPanel("activity"));

    els.historyLibraryList.addEventListener("click", async (event) => {
      const removeCollection = event.target.closest("[data-remove-olml]");
      if (removeCollection) {
        await removeCollectionRecord(removeCollection.dataset.removeOlml);
        return;
      }
      const button = event.target.closest("[data-open-olml]");
      if (!button) return;
      await loadRecord(button.dataset.openOlml);
    });
    els.libraryObjectProfile.addEventListener("click", async (event) => {
      const removeCollection = event.target.closest("[data-remove-olml]");
      if (removeCollection) {
        await removeCollectionRecord(removeCollection.dataset.removeOlml);
        return;
      }
      const removeObject = event.target.closest("[data-remove-object]");
      if (removeObject) {
        await removeObjectRecords(removeObject.dataset.removeObject);
        return;
      }
      const button = event.target.closest("[data-open-olml]");
      if (!button) return;
      await loadRecord(button.dataset.openOlml);
    });
    els.pendingConflictsList.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-dismiss-conflict]");
      if (!button) return;
      await dismissPendingConflict(button.dataset.dismissConflict);
    });
  }

  function showMode(mode) {
    if (mode !== "scanner") stopScanner();
    state.mode = mode;
    els.emptyState.classList.toggle("hidden", mode !== "empty");
    els.newFlow.classList.toggle("hidden", mode !== "new-flow");
    els.editor.classList.toggle("hidden", mode !== "editor");
    els.reader.classList.toggle("hidden", mode !== "reader");
    els.scanner.classList.toggle("hidden", mode !== "scanner");
    if (mode === "reader") renderReader();
    renderHistoryPanel();
    validateAndRender(false);
    updateExportButtons();
  }

  function goHome() {
    stopScanner();
    resetReaderEditState();
    cleanupAssetUrls();
    state.manifest = null;
    state.assets = new Map();
    state.markerEvidenceFiles = new Map();
    state.editingAssetPaths = new Set();
    state.sourceName = "";
    state.sourceBytes = null;
    state.selectedExistingOlmlId = "";
    state.selectedExistingObjectId = "";
    state.activeConflict = null;
    state.conflictMode = "compare";
    state.detachedFromLibrary = false;
    state.detachedExport = false;
    state.candidateSemanticState = null;
    state.assetPreviewPath = "";
    if (els.fileInput) els.fileInput.value = "";
    if (els.readerContent) els.readerContent.innerHTML = "";
    if (els.existingObjectPackageList) els.existingObjectPackageList.innerHTML = "";
    showMode("empty");
  }

  function openScanner() {
    state.lastScanCandidate = "";
    state.lastScanAt = 0;
    els.scanResult.innerHTML = "";
    els.scanStatus.textContent = "Choose QR / Barcode or OCR Text, then hold that marker inside the frame.";
    showMode("scanner");
  }

  async function startScanner(mode) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      els.scanStatus.textContent = "This browser cannot access a camera. Open the resolver in a current secure browser (HTTPS or localhost).";
      return;
    }
    try {
      stopScanner();
      state.scanMode = mode === "ocr" ? "ocr" : "code";
      state.codeScannerFailure = "";
      els.scanStatus.textContent = "Requesting camera access…";
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      state.cameraStream = stream;
      els.scanVideo.srcObject = stream;
      await els.scanVideo.play();
      state.scanActive = true;
      els.startCodeScanButton.disabled = true;
      els.startOcrScanButton.disabled = true;
      els.stopScanButton.disabled = false;
      if (state.scanMode === "ocr") {
        els.scanStatus.textContent = "OCR text scan is live. Looking for readable object-marker text.";
        scheduleOcrScan(0);
        return;
      }
      if ("BarcodeDetector" in window) {
        state.barcodeDetector = await createCodeDetector();
      }
      if (state.barcodeDetector) scanBarcodeFrames();
      const zxingReady = await startZxingScanner();
      const hasStructuredCodeScanner = Boolean(state.barcodeDetector || zxingReady);
      if (hasStructuredCodeScanner) {
        els.scanStatus.textContent = "QR / barcode scan is live. OCR text scanning is off in this mode.";
      } else {
        els.scanStatus.textContent = "QR/barcode detection could not start in this browser. Choose Scan OCR Text to scan readable text instead.";
      }
    } catch (error) {
      const message = error && error.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in the browser, then try again."
        : `Could not start the camera: ${error && error.message || "unknown error"}`;
      els.scanStatus.textContent = message;
      stopScanner();
    }
  }

  function stopScanner() {
    state.scanActive = false;
    state.scanMode = "";
    if (state.scanFrameHandle) cancelAnimationFrame(state.scanFrameHandle);
    state.scanFrameHandle = 0;
    if (state.ocrScanTimer) clearTimeout(state.ocrScanTimer);
    state.ocrScanTimer = 0;
    state.barcodeDetector = null;
    if (state.zxingControls && typeof state.zxingControls.stop === "function") state.zxingControls.stop();
    state.zxingControls = null;
    if (state.cameraStream) state.cameraStream.getTracks().forEach((track) => track.stop());
    state.cameraStream = null;
    if (els.scanVideo) els.scanVideo.srcObject = null;
    if (els.startCodeScanButton) els.startCodeScanButton.disabled = false;
    if (els.startOcrScanButton) els.startOcrScanButton.disabled = false;
    if (els.stopScanButton) els.stopScanButton.disabled = true;
  }

  async function scanBarcodeFrames() {
    if (!state.scanActive || state.scanMode !== "code" || !state.barcodeDetector) return;
    try {
      if (els.scanVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const codes = await state.barcodeDetector.detect(els.scanVideo);
        if (codes.length) {
          const qrCodes = codes.filter((code) => code.format === "qr_code");
          const barcodeCodes = codes.filter((code) => code.format !== "qr_code");
          // Prefer QR when a frame has more than one readable symbol; it is
          // normally the intended object-marker carrier in this resolver.
          if (qrCodes.length) await resolveScannedCandidates(qrCodes.map((code) => code.rawValue), "QR code");
          if (state.scanActive && barcodeCodes.length) await resolveScannedCandidates(barcodeCodes.map((code) => code.rawValue), "barcode");
        }
      }
    } catch (_) {
      // A transient frame decoding failure should not interrupt the camera session.
    }
    if (state.scanActive) state.scanFrameHandle = requestAnimationFrame(scanBarcodeFrames);
  }

  async function createCodeDetector() {
    const Detector = window.BarcodeDetector;
    try {
      // Some implementations reject a detector when even one requested format
      // is unsupported. Ask which formats exist before constructing it.
      if (typeof Detector.getSupportedFormats === "function") {
        const supported = await Detector.getSupportedFormats();
        const formats = SCAN_CODE_FORMATS.filter((format) => supported.includes(format));
        if (!formats.length) return null;
        return new Detector({ formats });
      }
      // Without capability reporting, the default detector is more compatible
      // than passing a long format list that an older browser may reject.
      return new Detector();
    } catch (_) {
      return null;
    }
  }

  async function startZxingScanner() {
    try {
      const ZXingBrowser = await getZxingBrowser();
      if (!state.scanActive || !ZXingBrowser || !ZXingBrowser.BrowserMultiFormatReader) return false;
      const reader = new ZXingBrowser.BrowserMultiFormatReader();
      state.zxingControls = await reader.decodeFromVideoElement(els.scanVideo, (result) => {
        if (!state.scanActive || state.scanMode !== "code" || !result) return;
        const format = typeof result.getBarcodeFormat === "function" ? String(result.getBarcodeFormat()) : "";
        const value = typeof result.getText === "function" ? result.getText() : "";
        resolveScannedCandidates([value], format === "QR_CODE" ? "QR code" : "barcode");
      });
      return true;
    } catch (error) {
      state.codeScannerFailure = error && error.message || "The QR/barcode compatibility decoder did not start";
      return false;
    }
  }

  async function getZxingBrowser() {
    if (window.ZXingBrowser) return window.ZXingBrowser;
    if (!state.zxingLoading) {
      state.zxingLoading = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        // Use a pinned browser UMD bundle, from the same CDN family used for
        // Tesseract below. Loading a package default can return CommonJS rather
        // than the window.ZXingBrowser bundle this static app requires.
        script.src = "https://cdn.jsdelivr.net/npm/@zxing/browser@0.2.1/umd/zxing-browser.min.js";
        script.onload = () => window.ZXingBrowser ? resolve(window.ZXingBrowser) : reject(new Error("ZXing did not initialize"));
        script.onerror = () => reject(new Error("The QR/barcode decoder could not be loaded"));
        document.head.appendChild(script);
      });
    }
    return state.zxingLoading;
  }

  async function readTextFromCamera() {
    if (!state.scanActive || state.scanMode !== "ocr" || state.ocrInFlight) return;
    state.ocrInFlight = true;
    try {
      const worker = await getOcrWorker();
      if (!state.scanActive) return;
      const video = els.scanVideo;
      const width = Math.min(video.videoWidth || 1280, 1280);
      const height = Math.max(1, Math.round((video.videoHeight || 720) * (width / (video.videoWidth || 1280))));
      els.scanCanvas.width = width;
      els.scanCanvas.height = height;
      els.scanCanvas.getContext("2d", { willReadFrequently: true }).drawImage(video, 0, 0, width, height);
      const result = await worker.recognize(els.scanCanvas);
      if (!state.scanActive) return;
      const text = result && result.data && result.data.text || "";
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length >= 2);
      if (!lines.length) {
        els.scanStatus.textContent = "No readable text found. Improve focus or lighting and try again.";
      } else {
        await resolveScannedCandidates(lines, "OCR text");
      }
    } catch (error) {
      els.scanStatus.textContent = `OCR could not run: ${error && error.message || "unknown error"}. Check the network once so its language data can load, then retry.`;
      state.ocrLoading = null;
    } finally {
      state.ocrInFlight = false;
      if (state.scanActive && state.scanMode === "ocr") scheduleOcrScan(2200);
    }
  }

  function scheduleOcrScan(delay) {
    if (!state.scanActive || state.ocrScanTimer) return;
    state.ocrScanTimer = window.setTimeout(() => {
      state.ocrScanTimer = 0;
      readTextFromCamera();
    }, delay);
  }

  async function getOcrWorker() {
    if (state.ocrWorker) return state.ocrWorker;
    if (!state.ocrLoading) {
      state.ocrLoading = new Promise((resolve, reject) => {
        if (window.Tesseract) return resolve(window.Tesseract);
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
        script.onload = () => resolve(window.Tesseract);
        script.onerror = () => reject(new Error("The OCR library could not be loaded"));
        document.head.appendChild(script);
      });
    }
    const Tesseract = await state.ocrLoading;
    state.ocrWorker = await Tesseract.createWorker("eng");
    return state.ocrWorker;
  }

  async function resolveScannedCandidates(values, source) {
    const candidates = Array.from(new Set(values.flatMap(extractObjectMarkerCandidates).map(normalizeMarkerValue).filter(Boolean)));
    if (!candidates.length) return;
    const now = Date.now();
    const fingerprint = candidates.join("|");
    if (fingerprint === state.lastScanCandidate && now - state.lastScanAt < 1800) return;
    state.lastScanCandidate = fingerprint;
    state.lastScanAt = now;
    const records = await listPackageRecords();
    const record = records.find((item) => recordMatchesMarkerCandidates(item, candidates));
    if (!record) {
      els.scanStatus.textContent = `${source} read: “${candidates[0]}”. No record matched in this browser-local library.`;
      els.scanResult.innerHTML = '<p class="scan-warning"><strong>No record matched.</strong> Keep scanning, or first open/import the matching .olml file into this browser-local library.</p>';
      return;
    }
    const title = record.title || record.olmlId;
    els.scanStatus.textContent = `${source} matched ${title}. Opening its object information…`;
    els.scanResult.innerHTML = `<p class="scan-match"><strong>Record matched:</strong> ${escapeHtml(title)}</p>`;
    stopScanner();
    if (record.zip) await loadRecord(record.olmlId);
    else els.scanStatus.textContent = `Matched ${title}, but this catalog record has no local package bytes to open.`;
  }

  function normalizeMarkerValue(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  }

  function recordMatchesMarkerCandidates(record, candidates) {
    const manifest = record.manifest || {};
    const markerValues = (record.markers || deriveMarkerIndex(manifest)).flatMap((marker) => [marker.value, marker.signature, marker.path]);
    const values = [record.olmlId, manifest.olml && manifest.olml.id, record.objectId, manifest.object && manifest.object.id, ...markerValues, ...(record.locations || []).map((location) => location.url)];
    return values.filter(Boolean).map(normalizeMarkerValue).some((value) => candidates.includes(value));
  }

  function buildUpdatedMemories(memoryId, assetPaths) {
    const existing = Array.isArray(state.manifest.memories) ? state.manifest.memories.slice() : [];
    const index = Math.max(0, state.editingMemoryIndex || 0);
    const nextMemory = {
      id: memoryId,
      title: els.memoryTitle.value.trim(),
      time: els.memoryTime.value.trim(),
      place: els.memoryPlace.value.trim(),
      note: els.memoryNote.value.trim(),
      assets: assetPaths
    };
    if (index >= existing.length) existing.push(nextMemory);
    else existing[index] = nextMemory;
    return existing;
  }

  function buildUpdatedLinks(objectId, memoryId) {
    const existing = Array.isArray(state.manifest.links) ? state.manifest.links.slice() : [];
    const byPair = new Map();
    for (const link of existing) {
      if (!link || !link.object || !link.memory) continue;
      byPair.set(`${link.object}|${link.memory}`, { ...link, object: link.object === els.objectId.value ? objectId : link.object });
    }
    byPair.set(`${objectId}|${memoryId}`, {
      object: objectId,
      memory: memoryId
    });
    return Array.from(byPair.values()).filter((link) => {
      return (state.manifest.memories || []).some((memory, index) => {
        if (index === (state.editingMemoryIndex || 0)) return memoryId === link.memory;
        return memory.id === link.memory;
      }) || link.memory === memoryId;
    });
  }

  async function showNewFileFlow(choice) {
    state.selectedExistingOlmlId = "";
    showMode("new-flow");
    await renderNewFlowLibrary();
    selectNewFlowChoice(choice || "new");
  }

  function selectNewFlowChoice(choice) {
    const existing = choice === "existing";
    els.newObjectChoiceButton.classList.toggle("active", !existing);
    els.existingObjectChoiceButton.classList.toggle("active", existing);
    els.existingObjectPicker.classList.toggle("hidden", !existing);
    els.existingObjectPackageList.classList.toggle("hidden", !existing);
    if (!existing) {
      els.existingObjectPackageList.innerHTML = "";
    }
  }

  function showInspector(name) {
    document.querySelectorAll(".inspector-tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.inspector === name);
    });
    $("validationView").classList.toggle("hidden", name !== "validation");
    $("markerView").classList.toggle("hidden", name !== "marker");
    $("libraryView").classList.toggle("hidden", name !== "library");
    if (name === "library") refreshLibrary();
  }

  async function setLibraryPanel(panel) {
    state.libraryPanel = panel === "activity" ? "activity" : "library";
    document.querySelectorAll("[data-library-tab]").forEach((button) => {
      const active = button.dataset.libraryTab === state.libraryPanel;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    if (els.libraryTabPanel) els.libraryTabPanel.classList.toggle("hidden", state.libraryPanel !== "library");
    if (els.activityTabPanel) els.activityTabPanel.classList.toggle("hidden", state.libraryPanel !== "activity");
    if (els.pendingConflictsList) els.pendingConflictsList.classList.toggle("hidden", state.libraryPanel !== "activity");
    if (state.libraryPanel === "activity") {
      await renderActivityList();
      await renderPendingConflictList();
    }
  }

  async function renderNewFlowLibrary() {
    const records = await listPackageRecords();
    const groups = groupPackageRecordsByObject(records);
    els.existingObjectSelect.innerHTML = '<option value="">Choose a saved local object</option>';
    for (const group of groups) {
      const option = document.createElement("option");
      option.value = group.objectId;
      option.textContent = `${group.object.title || "Untitled object"} | ${group.objectId}`;
      els.existingObjectSelect.appendChild(option);
    }
    els.existingObjectPackageList.innerHTML = "";
    if (groups.length === 0) {
      els.existingObjectPackageList.innerHTML = '<p class="small-muted no-existing-object-note">No browser-local objects yet. Open or import an .olml file, then save it to the local library.</p>';
    }
  }

  function groupPackageRecordsByObject(records) {
    const groups = new Map();
    for (const record of records || []) {
      const manifest = record && record.manifest || {};
      const object = manifest.object || record.objectProfile || {};
      const objectId = record && (record.objectId || object.id);
      if (!record || !objectId) continue;
      const existing = groups.get(objectId) || {
        objectId,
        object: { id: objectId, title: object.title || record.title || "", description: object.description || "" },
        records: []
      };
      if (!existing.object.title && object.title) existing.object.title = object.title;
      if (!existing.object.description && object.description) existing.object.description = object.description;
      existing.records.push(record);
      groups.set(objectId, existing);
    }
    return Array.from(groups.values()).map((group) => {
      group.records.sort((a, b) => (b.savedAt || b.readAt || b.catalogUpdatedAt || "").localeCompare(a.savedAt || a.readAt || a.catalogUpdatedAt || ""));
      group.record = group.records[0];
      return group;
    }).sort((a, b) => {
      const latestA = a.record && (a.record.savedAt || a.record.readAt || a.record.catalogUpdatedAt || "");
      const latestB = b.record && (b.record.savedAt || b.record.readAt || b.record.catalogUpdatedAt || "");
      return latestB.localeCompare(latestA);
    });
  }

  async function findExistingObjectGroup(objectId) {
    return groupPackageRecordsByObject(await listPackageRecords()).find((group) => group.objectId === objectId) || null;
  }

  async function previewExistingObject(objectId) {
    state.selectedExistingObjectId = objectId;
    state.selectedExistingOlmlId = "";
    if (!objectId) {
      els.existingObjectPackageList.innerHTML = "";
      return;
    }
    const group = await findExistingObjectGroup(objectId);
    if (!group || !group.record) {
      els.existingObjectPackageList.innerHTML = '<p class="small-muted no-existing-object-note">Could not load that local record.</p>';
      return;
    }
    els.existingObjectPackageList.innerHTML = buildObjectPackageList(group.object, group.records);
  }

  async function createPackageForExistingObject() {
    const objectId = state.selectedExistingObjectId || els.existingObjectSelect.value;
    if (!objectId) {
      setValidation([{ level: "warning", message: "Choose an existing local object first." }], true);
      return;
    }
    const group = await findExistingObjectGroup(objectId);
    const record = group && group.record;
    if (!record) {
      setValidation([{ level: "error", message: "Selected object is not available in the local library." }], true);
      return;
    }
    const source = record.manifest || {};
    const markerEvidenceFiles = await markerEvidenceFilesFromRecord(record);
    createNewPackage({
      object: source.object || record.objectProfile || group.object,
      objectMarkers: source.objectMarkers || record.objectMarkers || [],
      markerEvidenceFiles,
      collectionTitle: "",
      collectionDescription: "",
      existingObject: true
    });
    await updateSharedObjectContext();
    populateObjectMarkerInspector();
    renderWriterObjectWarnings();
  }

  async function markerEvidenceFilesFromRecord(record) {
    const files = new Map();
    if (!record || !record.zip) return files;
    try {
      const zipBytes = record.zip instanceof Uint8Array ? record.zip : new Uint8Array(record.zip);
      const entries = await readZipEntries(zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength));
      const manifest = record.manifest || {};
      for (const [path, entryBuffer] of entries) {
        if (!path.startsWith("marker-evidence/") || path.endsWith("/")) continue;
        const evidenceRecord = findObjectMarkerEvidenceRecord(manifest, path);
        files.set(path, {
          path,
          name: evidenceRecord && evidenceRecord.name || path.split("/").pop(),
          type: evidenceRecord && (evidenceRecord.mediaType || evidenceRecord.type) || guessMediaType(path),
          size: entryBuffer.byteLength,
          buffer: entryBuffer
        });
      }
    } catch (_) {
      // Missing historical evidence bytes should not block creating a sibling collection.
    }
    return files;
  }

  function renderLocalLibraryCompact(groups) {
    if (!groups.length) return '<p class="small-muted">object.id</p><p class="small-muted">No local library records.</p>';
    return `
      <p>object.id</p>
      <div class="object-package-list">
        ${groups.map((group) => {
          return `
            <button class="history-library-item" type="button" data-existing-object="${escapeHtml(group.objectId)}">
              <strong>${escapeHtml(group.object.title || "Untitled object")}</strong>
              <code>${escapeHtml(group.objectId)}</code>
              <span class="small-muted">${group.records.length} local collection${group.records.length === 1 ? "" : "s"}</span>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function buildExistingObjectPreview(record, fallbackObject) {
    const manifest = record.manifest || {};
    const object = manifest.object || record.objectProfile || fallbackObject || {};
    const memory = (manifest.memories || [])[0] || {};
    const assets = (memory.assets || []).map((path) => state.assets.get(path)).filter(Boolean);
    const assetBoxes = assets.length
      ? assets.slice(0, 4).map((asset) => `<div class="preview-box">${escapeHtml(asset.name || "Asset")}</div>`).join("")
      : '<div class="small-muted">No packaged preview assets loaded for this local record.</div>';
    const markers = (manifest.objectMarkers || []).map((marker) => `<div class="marker-box">${escapeHtml(markerLabel(markerType(marker)))}</div>`).join("") || '<div class="small-muted">No marker records.</div>';
    return `
      <p><strong>Chosen Object</strong> ${escapeHtml(object.title || "Untitled object")}</p>
      <code>${escapeHtml(object.id || record.objectId || "")}</code>
      <p>${escapeHtml(object.description || "No object description")}</p>
      <p><strong>Source Collection</strong> ${escapeHtml(manifest.olml && (manifest.olml.title || manifest.olml.id) || record.olmlId || "-")}</p>
      <p>${escapeHtml(manifest.olml && manifest.olml.note || "No collection description")}</p>
      <p>Memory Title : ${escapeHtml(memory.title || "-")}</p>
      <p>Memory Time : ${escapeHtml(memory.time || "-")}</p>
      <p>Memory Place : ${escapeHtml(memory.place || "-")}</p>
      <p>Memory Note : ${escapeHtml(memory.note || "-")}</p>
      <div class="preview-media-grid">${assetBoxes}</div>
      <p><strong>Object Markers</strong></p>
      <div class="marker-grid">${markers}</div>
    `;
  }

  function buildObjectPackageList(object, records) {
    return `
      <p><strong>${escapeHtml(object.title || "Object")}</strong></p>
      <code>${escapeHtml(object.id || "")}</code>
      <div class="object-package-list">
        ${records.map((record, index) => {
          const manifest = record.manifest || {};
          return `
            <div class="object-package-item">
              <strong>olml.id ${index + 1}</strong>
              <code>${escapeHtml(record.olmlId)}</code>
              <p class="small-muted">${escapeHtml(manifest.olml && (manifest.olml.title || manifest.olml.note) || record.title || "")}</p>
            </div>
          `;
        }).join("") || '<p class="small-muted">No related packages.</p>'}
      </div>
    `;
  }

  function markerLabel(type) {
    return {
      qr: "QR Code",
      nfc: "NFC Tag",
      "image-reference": "AR Reference Image",
      "text-marker": "OCR Text Marker"
    }[type] || "Marker";
  }

  function markerType(marker) {
    return marker && (marker.markerType || marker.type) || "";
  }

  function markerEvidence(marker) {
    return marker && (marker.markerEvidence || marker.evidence) || null;
  }

  function meaningfulMediaType(path) {
    const type = guessMediaType(path || "");
    return type && type !== "application/octet-stream" ? type : "";
  }

  function assetTypeSummary(asset) {
    if (asset && (asset.external || asset.url)) {
      return asset.type ? `Online asset | ${asset.type}` : "Online asset";
    }
    return `Bundled file | ${asset && (asset.type || guessMediaType(asset.path)) || "application/octet-stream"}`;
  }

  function normalizeObjectMarkerRecord(marker, objectId) {
    const type = markerType(marker) || "qr";
    return {
      markerType: type,
      object: objectId || marker.object || "",
      markerEvidence: markerEvidence(marker) || defaultMarkerEvidence(type, objectId || marker.object || ""),
      note: marker.note || buildMarkerNote(type)
    };
  }

  function defaultObjectMarker(type, objectId) {
    return {
      markerType: type,
      object: objectId,
      markerEvidence: defaultMarkerEvidence(type, objectId),
      note: buildMarkerNote(type)
    };
  }

  function createNewPackage(options = {}) {
    cleanupAssetUrls();
    state.assets = new Map();
    state.markerEvidenceFiles = options.markerEvidenceFiles ? new Map(options.markerEvidenceFiles) : new Map();
    state.editingAssetPaths = new Set();
    state.sourceName = "";
    state.sourceBytes = null;
    state.sourceHash = "";
    state.structuralReadOnly = false;
    state.sharedObjectSiblingCount = 0;
    state.activeConflict = null;
    state.candidateSemanticState = null;
    state.editorPurpose = "package";
    state.editingMemoryIndex = 0;
    state.editingMarkerIndex = 0;
    state.editSnapshot = null;
    state.preserveObjectId = Boolean(options.existingObject);
    const now = new Date().toISOString();
    const sourceObject = options.object || {};
    const objectTitle = sourceObject.title || sourceObject.label || "";
    const olmlId = makeId("Olml", "package");
    const objectId = sourceObject.id || makeId("Object", "object");
    const memoryId = makeId("Memory", "memory");
    state.manifest = {
      olml: {
        id: olmlId,
        version: OLML_VERSION,
        title: options.collectionTitle || "",
        note: options.collectionDescription || "",
        history: {
          createdAt: now,
          updatedAt: now,
          revision: 1
        }
      },
      object: {
        id: objectId,
        title: objectTitle,
        description: sourceObject.description || ""
      },
      memories: [
        {
          id: memoryId,
          title: "",
          time: "",
          place: "",
          note: "",
          assets: []
        }
      ],
      links: [
        {
          object: objectId,
          memory: memoryId
        }
      ],
      assets: [],
      objectMarkers: options.objectMarkers && options.objectMarkers.length
        ? structuredClone(options.objectMarkers).map((marker) => normalizeObjectMarkerRecord(marker, objectId))
        : [
          defaultObjectMarker("qr", objectId)
        ]
    };
    state.readerBaseline = captureReaderBaseline();
    populateFormFromManifest();
    configureEditorForPurpose("package");
    showMode("editor");
    showInspector("validation");
    renderWriterObjectWarnings();
  }

  function generateFormIds() {}

  async function addSelectedAssets(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    await addAssetFiles(files);
  }

  async function addAssetFiles(files) {
    for (const file of files) {
      const path = uniqueAssetPath(file.name);
      const buffer = await file.arrayBuffer();
      state.assets.set(path, {
        path,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        buffer
      });
      state.editingAssetPaths.add(path);
    }
    updatePreviewFromForm();
  }

  function addOnlineAssetFromInput() {
    const raw = els.onlineAssetUrl.value.trim();
    if (!raw) {
      setValidation([{ level: "warning", message: "Enter an online asset URL before adding it." }], true);
      return;
    }
    let parsed;
    try {
      parsed = new URL(raw);
    } catch (_) {
      setValidation([{ level: "error", message: "Online asset URL must be a valid URL." }], true);
      return;
    }
    const name = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname || "online-asset");
    const path = uniqueExternalAssetPath(name);
    state.assets.set(path, {
      path,
      name,
      type: meaningfulMediaType(name),
      size: 0,
      url: parsed.href,
      external: true
    });
    state.editingAssetPaths.add(path);
    els.onlineAssetUrl.value = "";
    updatePreviewFromForm();
  }

  async function addSelectedMarkerEvidenceFile(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    await addMarkerEvidenceFiles(files.slice(0, 1));
  }

  async function addMarkerEvidenceFiles(files) {
    const file = files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setValidation([{ level: "error", message: "Object Marker image evidence must be an image file." }], true);
      return;
    }
    state.markerEvidenceFiles = new Map();
    const path = uniqueObjectMarkerEvidencePath(file.name);
    const buffer = await file.arrayBuffer();
    state.markerEvidenceFiles.set(path, {
      path,
      name: file.name,
      type: file.type || guessMediaType(file.name),
      size: file.size,
      buffer
    });
    updatePreviewFromForm();
  }

  function resetReaderEditState() {
    state.readerEditing = false;
    state.readerUnlocks = {
      object: false,
      collection: false,
      markers: false,
      memories: false
    };
    state.readerBaseline = captureReaderBaseline();
    state.readerAssetTargetIndex = 0;
    state.readerMarkerTargetIndex = 0;
    state.selectedMarkerDeletes = new Set();
    state.selectedAssetDeletes = new Set();
    state.markerAddDraft = null;
    state.assetAddMemoryIndex = null;
    state.assetPreviewPath = "";
  }

  function captureReaderBaseline() {
    if (!state.manifest) return null;
    return {
      manifest: structuredClone(stripEmpty(state.manifest)),
      assets: assetFingerprintMap(state.assets),
      markerEvidenceFiles: assetFingerprintMap(state.markerEvidenceFiles)
    };
  }

  function assetFingerprintMap(map) {
    const out = {};
    for (const [path, asset] of map.entries()) {
      out[path] = {
        path: asset.path,
        name: asset.name,
        type: asset.type,
        size: asset.size,
        url: asset.url || "",
        external: Boolean(asset.external)
      };
    }
    return out;
  }

  async function handleReaderClick(event) {
    const unlock = event.target.closest("[data-unlock-scope]");
    if (unlock) {
      state.readerUnlocks[unlock.dataset.unlockScope] = true;
      renderReader();
      return;
    }
    const actionButton = event.target.closest("[data-reader-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.readerAction;
    if (action === "save-export") {
      saveAndExportCurrentCollection();
      return;
    }
    if (action === "accept-import") {
      acceptImportedSnapshot();
      return;
    }
    if (action === "preview-asset") {
      state.assetPreviewPath = actionButton.dataset.assetPath || "";
      renderReader();
      return;
    }
    if (action === "close-asset-preview") {
      state.assetPreviewPath = "";
      renderReader();
      return;
    }
    if (action === "back-home") {
      goHome();
      return;
    }
    if (action === "discard") {
      discardReaderChanges();
      return;
    }
    if (action === "conflict-cancel") {
      cancelConflictImport();
      return;
    }
    if (action === "conflict-back") {
      state.conflictMode = "compare";
      renderReader();
      return;
    }
    if (action === "conflict-use-library") {
      await showLibraryConflictChoice();
      return;
    }
    if (action === "conflict-export-library") {
      await exportLibraryConflictVersion();
      return;
    }
    if (action === "conflict-repair-library") {
      await repairFromLibraryConflictVersion();
      return;
    }
    if (action === "conflict-use-incoming") {
      state.conflictMode = "incoming";
      renderReader();
      return;
    }
    if (action === "conflict-set-incoming-current") {
      await setIncomingConflictAsCurrent();
      return;
    }
    if (action === "conflict-open-detached") {
      openIncomingWithoutUpdatingLibrary();
      return;
    }
    if (action === "edit-file") {
      state.readerEditing = true;
      renderReader();
      return;
    }
    if (action === "add-asset") {
      if (!state.readerUnlocks.memories) return;
      state.assetAddMemoryIndex = Number(actionButton.dataset.memoryIndex || 0);
      renderReader();
      return;
    }
    if (action === "remove-asset") {
      if (!state.readerUnlocks.memories) return;
      removeSelectedReaderAssets(Number(actionButton.dataset.memoryIndex || 0));
      return;
    }
    if (action === "add-memory") {
      state.readerUnlocks.memories = true;
      addMemoryToCurrentCollection();
      return;
    }
    if (action === "remove-memory") {
      state.readerUnlocks.memories = true;
      const requestedIndex = actionButton.dataset.memoryIndex === undefined
        ? (state.manifest && Array.isArray(state.manifest.memories) ? state.manifest.memories.length - 1 : 0)
        : Number(actionButton.dataset.memoryIndex || 0);
      removeMemoryFromCurrentCollection(requestedIndex);
      return;
    }
    if (action === "replace-asset") {
      if (!state.readerUnlocks.memories) return;
      toggleAssetDeleteSelection(actionButton.dataset.assetPath);
      return;
    }
    if (action === "add-marker") {
      if (!state.readerUnlocks.markers) return;
      startReaderMarkerAdd();
      return;
    }
    if (action === "remove-marker") {
      if (!state.readerUnlocks.markers) return;
      removeSelectedReaderMarkers();
      return;
    }
    if (action === "edit-marker") {
      if (!state.readerUnlocks.markers) return;
      toggleMarkerDeleteSelection(Number(actionButton.dataset.markerIndex || 0));
      return;
    }
    if (action === "choose-reader-files") {
      state.readerAssetTargetIndex = Number(actionButton.dataset.memoryIndex || 0);
      els.readerAssetInput.click();
      return;
    }
    if (action === "add-reader-url") {
      addReaderOnlineAsset(Number(actionButton.dataset.memoryIndex || 0));
      return;
    }
    if (action === "cancel-asset-add") {
      state.assetAddMemoryIndex = null;
      renderReader();
      return;
    }
    if (action === "confirm-marker-add") {
      confirmReaderMarkerAdd();
      return;
    }
    if (action === "cancel-marker-add") {
      state.markerAddDraft = null;
      renderReader();
      return;
    }
    if (action === "choose-marker-image") {
      els.readerMarkerImageInput.click();
    }
  }

  function handleReaderInput(event) {
    const draftField = event.target.closest("[data-marker-draft-field]");
    if (draftField) {
      updateMarkerAddDraft(draftField);
      return;
    }
    const input = event.target.closest("[data-reader-scope]");
    if (!input) return;
    const scope = input.dataset.readerScope;
    if (scope === "object" && !state.readerUnlocks.object) return;
    if (scope === "collection" && !state.readerUnlocks.collection) return;
    if (scope === "memory" && !state.readerUnlocks.memories) return;
    applyReaderField(input);
    validateAndRender(false);
    updateExportButtons();
    renderReaderStatusOnly();
  }

  function handleReaderChange(event) {
    handleReaderInput(event);
  }

  function handleReaderDragOver(event) {
    const drop = event.target.closest(".edit-asset-drop");
    if (!drop) return;
    event.preventDefault();
    drop.classList.add("dragging");
  }

  function handleReaderDragLeave(event) {
    const drop = event.target.closest(".edit-asset-drop");
    if (!drop) return;
    drop.classList.remove("dragging");
  }

  async function handleReaderDrop(event) {
    const drop = event.target.closest(".edit-asset-drop");
    if (!drop) return;
    event.preventDefault();
    drop.classList.remove("dragging");
    state.readerAssetTargetIndex = Number(drop.dataset.memoryIndex || 0);
    await addReaderAssetFiles(Array.from(event.dataTransfer.files || []));
  }

  function updateMarkerAddDraft(input) {
    if (!state.markerAddDraft) return;
    const field = input.dataset.markerDraftField;
    state.markerAddDraft[field] = input.value;
    if (field === "type") {
      state.markerAddDraft.value = "";
      state.markerAddDraft.filePath = "";
      renderReader();
    }
  }

  function applyReaderField(input) {
    const manifest = getCurrentManifest();
    const scope = input.dataset.readerScope;
    const field = input.dataset.readerField;
    if (scope === "object") {
      manifest.object[field] = input.value.trim();
      return;
    }
    if (scope === "collection") {
      manifest.olml[field] = input.value.trim();
      return;
    }
    if (scope === "memory") {
      const index = Number(input.dataset.memoryIndex || 0);
      if (!manifest.memories[index]) return;
      manifest.memories[index][field] = input.value.trim();
    }
  }

  async function addReaderAssets(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    await addReaderAssetFiles(files);
  }

  async function addReaderAssetFiles(files) {
    if (!files.length || !state.manifest) return;
    const memory = state.manifest.memories[state.readerAssetTargetIndex];
    if (!memory) return;
    memory.assets = Array.isArray(memory.assets) ? memory.assets : [];
    for (const file of files) {
      const path = uniqueAssetPath(file.name);
      const buffer = await file.arrayBuffer();
      state.sourceBytes = buffer;
      state.assets.set(path, {
        path,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        buffer
      });
      memory.assets.push(path);
    }
    syncManifestAssetRecords();
    validateAndRender(false);
    renderReader();
  }

  function addReaderOnlineAsset(memoryIndex) {
    const input = els.readerContent.querySelector(`[data-reader-asset-url="${memoryIndex}"]`);
    const raw = input && input.value.trim();
    if (!raw) {
      setValidation([{ level: "warning", message: "Enter an online asset URL before adding it." }], true);
      return;
    }
    let parsed;
    try {
      parsed = new URL(raw);
    } catch (_) {
      setValidation([{ level: "error", message: "Online asset URL must be a valid URL." }], true);
      return;
    }
    const memory = state.manifest && state.manifest.memories[memoryIndex];
    if (!memory) return;
    const name = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname || "online-asset");
    const path = uniqueExternalAssetPath(name);
    state.assets.set(path, {
      path,
      name,
      type: meaningfulMediaType(name),
      size: 0,
      url: parsed.href,
      external: true
    });
    memory.assets = Array.isArray(memory.assets) ? memory.assets : [];
    memory.assets.push(path);
    syncManifestAssetRecords();
    state.assetAddMemoryIndex = null;
    validateAndRender(false);
    renderReader();
  }

  function toggleAssetDeleteSelection(path) {
    if (!path) return;
    if (state.selectedAssetDeletes.has(path)) state.selectedAssetDeletes.delete(path);
    else state.selectedAssetDeletes.add(path);
    renderReader();
  }

  function removeSelectedReaderAssets(memoryIndex) {
    const memory = state.manifest && state.manifest.memories[memoryIndex];
    if (!memory || !Array.isArray(memory.assets)) return;
    const selected = memory.assets.filter((path) => state.selectedAssetDeletes.has(path));
    if (selected.length === 0) {
      setValidation([{ level: "warning", message: "Select one or more Memory Assets before deleting." }], true);
      return;
    }
    if (!window.confirm(`Delete ${selected.length} selected Memory Asset${selected.length === 1 ? "" : "s"} from this memory?`)) return;
    memory.assets = memory.assets.filter((path) => !state.selectedAssetDeletes.has(path));
    for (const path of selected) {
      const stillUsed = (state.manifest.memories || []).some((item) => (item.assets || []).includes(path));
      if (!stillUsed) state.assets.delete(path);
      state.selectedAssetDeletes.delete(path);
    }
    syncManifestAssetRecords();
    validateAndRender(false);
    renderReader();
  }

  function syncManifestAssetRecords() {
    if (!state.manifest) return;
    state.manifest.assets = Array.from(state.assets.values()).map((asset) => stripEmpty({
      path: asset.path,
      name: asset.name,
      mediaType: asset.type,
      size: asset.size,
      url: asset.url,
      external: Boolean(asset.external)
    }));
  }

  function startReaderMarkerAdd() {
    state.markerAddDraft = { type: "qr", value: "", filePath: "" };
    renderReader();
  }

  function confirmReaderMarkerAdd() {
    const manifest = getCurrentManifest();
    const draft = state.markerAddDraft || { type: "qr" };
    const type = draft.type || "qr";
    let evidence = null;
    if (type === "qr") {
      evidence = {
        type: "generated-qr",
        value: manifest.object.id,
        name: "Generated QR marker from object.id"
      };
    } else if (type === "image-reference") {
      if (!draft.filePath) {
        setValidation([{ level: "warning", message: "Add an AR reference image before saving this Object Marker." }], true);
        return;
      }
      const file = state.markerEvidenceFiles.get(draft.filePath);
      evidence = {
        type: "image",
        path: draft.filePath,
        name: file && file.name || draft.filePath.split("/").pop(),
        mediaType: file && file.type || guessMediaType(draft.filePath),
        size: file && file.size || 0
      };
    } else {
      if (!String(draft.value || "").trim()) {
        setValidation([{ level: "warning", message: `${markerLabel(type)} needs a value before saving this Object Marker.` }], true);
        return;
      }
      evidence = {
        type: type === "nfc" ? "ndef" : "text",
        value: String(draft.value || "").trim()
      };
    }
    manifest.objectMarkers = Array.isArray(manifest.objectMarkers) ? manifest.objectMarkers : [];
    manifest.objectMarkers.push({
      markerType: type,
      object: manifest.object.id,
      markerEvidence: evidence,
      note: buildMarkerNote(type)
    });
    state.markerAddDraft = null;
    validateAndRender(false);
    renderReader();
  }

  function toggleMarkerDeleteSelection(index) {
    if (state.selectedMarkerDeletes.has(index)) state.selectedMarkerDeletes.delete(index);
    else state.selectedMarkerDeletes.add(index);
    renderReader();
  }

  function removeSelectedReaderMarkers() {
    const manifest = getCurrentManifest();
    if (!Array.isArray(manifest.objectMarkers) || manifest.objectMarkers.length === 0) return;
    const selected = Array.from(state.selectedMarkerDeletes).filter((index) => manifest.objectMarkers[index]);
    if (selected.length === 0) {
      setValidation([{ level: "warning", message: "Select one or more Object Markers before deleting." }], true);
      return;
    }
    if (!window.confirm(`Delete ${selected.length} selected Object Marker${selected.length === 1 ? "" : "s"}?`)) return;
    const selectedSet = new Set(selected);
    const removed = manifest.objectMarkers.filter((_, index) => selectedSet.has(index));
    manifest.objectMarkers = manifest.objectMarkers.filter((_, index) => !selectedSet.has(index));
    for (const marker of removed) {
      const evidence = marker && (markerEvidence(marker));
      if (evidence && evidence.path) state.markerEvidenceFiles.delete(evidence.path);
    }
    state.selectedMarkerDeletes.clear();
    validateAndRender(false);
    renderReader();
  }

  async function addReaderMarkerImage(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file || !state.manifest) return;
    if (!file.type.startsWith("image/")) {
      setValidation([{ level: "error", message: "Object Marker evidence image must be an image file." }], true);
      return;
    }
    const path = uniqueObjectMarkerEvidencePath(file.name);
    const buffer = await file.arrayBuffer();
    state.markerEvidenceFiles.set(path, {
      path,
      name: file.name,
      type: file.type || guessMediaType(file.name),
      size: file.size,
      buffer
    });
    if (state.markerAddDraft && state.markerAddDraft.type === "image-reference") {
      state.markerAddDraft.filePath = path;
      renderReader();
      return;
    }
    const marker = state.manifest.objectMarkers[state.readerMarkerTargetIndex];
    if (!marker) return;
    const previous = markerEvidence(marker);
    if (previous && previous.path) state.markerEvidenceFiles.delete(previous.path);
    marker.object = state.manifest.object.id;
    delete marker.target;
    delete marker.payload;
    delete marker.evidence;
    delete marker.markerEvidence;
    marker.markerEvidence = {
      type: "image",
      path,
      name: file.name,
      mediaType: file.type || guessMediaType(file.name),
      size: file.size
    };
    validateAndRender(false);
    renderReader();
  }

  function discardReaderChanges() {
    if (state.readerBaseline) {
      state.manifest = structuredClone(state.readerBaseline.manifest);
      rebuildAssetsFromBaseline(state.readerBaseline.assets, state.assets);
      rebuildAssetsFromBaseline(state.readerBaseline.markerEvidenceFiles, state.markerEvidenceFiles);
    }
    resetReaderEditState();
    renderReader();
    setValidation([{ level: "info", message: "Unsaved edits discarded. Library records and exported files were not changed." }], true);
  }

  function rebuildAssetsFromBaseline(fingerprints, currentMap) {
    const next = new Map();
    for (const [path, meta] of Object.entries(fingerprints || {})) {
      const existing = currentMap.get(path);
      if (existing) next.set(path, existing);
      else next.set(path, { ...meta });
    }
    currentMap.clear();
    for (const [path, asset] of next.entries()) currentMap.set(path, asset);
  }

  function uniqueAssetPath(name) {
    const clean = name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-") || "asset";
    let path = `assets/${clean}`;
    let index = 2;
    while (state.assets.has(path)) {
      const dot = clean.lastIndexOf(".");
      path = dot > 0
        ? `assets/${clean.slice(0, dot)}-${index}${clean.slice(dot)}`
        : `assets/${clean}-${index}`;
      index += 1;
    }
    return path;
  }

  function uniqueObjectMarkerEvidencePath(name) {
    const clean = name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-") || "evidence-image";
    return `marker-evidence/${clean}`;
  }

  function uniqueExternalAssetPath(name) {
    const clean = name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-") || "online-asset";
    let path = `external/${clean}`;
    let index = 2;
    while (state.assets.has(path)) {
      const dot = clean.lastIndexOf(".");
      path = dot > 0
        ? `external/${clean.slice(0, dot)}-${index}${clean.slice(dot)}`
        : `external/${clean}-${index}`;
      index += 1;
    }
    return path;
  }

  function removeAsset(path) {
    state.assets.delete(path);
    state.editingAssetPaths.delete(path);
    if (state.manifest && Array.isArray(state.manifest.memories)) {
      for (const memory of state.manifest.memories) {
        memory.assets = (memory.assets || []).filter((item) => item !== path);
      }
    }
    updatePreviewFromForm();
  }

  function populateFormFromManifest() {
    const manifest = getCurrentManifest();
    const memoryIndex = Math.max(0, Math.min(state.editingMemoryIndex || 0, Math.max((manifest.memories || []).length - 1, 0)));
    state.editingMemoryIndex = memoryIndex;
    const memory = manifest.memories[memoryIndex] || {};
    const marker = selectedObjectMarker(manifest);
    els.olmlId.value = manifest.olml.id || "";
    els.objectId.value = manifest.object.id || "";
    els.memoryId.value = memory.id || "";
    els.objectTitle.value = manifest.object.title || manifest.object.label || "";
    els.objectDescription.value = manifest.object.description || "";
    els.collectionTitle.value = manifest.olml.title || "";
    els.collectionDescription.value = manifest.olml.note || "";
    els.memoryTitle.value = memory.title || "";
    els.memoryTime.value = memory.time || "";
    els.memoryPlace.value = memory.place || "";
    els.memoryNote.value = memory.note || memory.story || "";
    state.editingMemoryIndex = Math.max(0, Math.min(state.editingMemoryIndex || 0, Math.max((manifest.memories || []).length - 1, 0)));
    state.editingAssetPaths = new Set(memory.assets || []);
    els.markerType.value = marker ? markerType(marker) : "qr";
    populateMarkerEvidenceField(marker);
    els.markerPayload.textContent = `object.id ${marker ? marker.object || manifest.object.id : manifest.object.id}`;
    els.markerTarget.value = manifest.object.id || "";
    configureObjectMarkerUi();
    renderAssetList();
    renderMarkerEvidenceFileSummary();
    renderAdditionalMarkerEditors();
    updatePreviewFromForm();
  }

  function updatePreviewFromForm() {
    if (!state.manifest) return;
    const now = new Date().toISOString();
    const previousHistory = state.manifest.olml && state.manifest.olml.history || {};
    const memoryId = els.memoryId.value || makeId("memory", "memory");
    const objectId = els.objectId.value || makeId("object", "object");
    const assetRecords = Array.from(state.assets.values()).map((asset) => ({
      path: asset.path,
      name: asset.name,
      mediaType: asset.type,
      size: asset.size,
      url: asset.url,
      external: Boolean(asset.external)
    }));
    state.manifest = {
      olml: {
        id: els.olmlId.value || makeId("olml", "package"),
        version: OLML_VERSION,
        title: els.collectionTitle.value.trim(),
        note: els.collectionDescription.value.trim(),
        history: {
          createdAt: previousHistory.createdAt || now,
          updatedAt: now,
          revision: previousHistory.revision || 1,
          events: Array.isArray(previousHistory.events) ? previousHistory.events : []
        }
      },
      object: {
        id: objectId,
        title: els.objectTitle.value.trim(),
        description: els.objectDescription.value.trim()
      },
      memories: buildUpdatedMemories(memoryId, Array.from(state.editingAssetPaths)),
      links: buildUpdatedLinks(objectId, memoryId),
      assets: assetRecords,
      objectMarkers: buildUpdatedObjectMarkers(objectId)
    };
    els.markerTarget.value = state.manifest.object.id;
    els.markerPayload.textContent = `object.id ${state.manifest.object.id}`;
    renderAssetList();
    renderMarkerEvidenceFileSummary();
    renderAdditionalMarkerEditors();
    renderJsonPreview();
    renderWriterObjectWarnings();
    renderHistoryPanel();
    validateAndRender(false);
    updateExportButtons();
  }

  function syncDraftIdsFromTitles() {}

  function syncObjectMarkerFromInspector() {
    if (!state.manifest) return;
    const selected = selectedObjectMarker(state.manifest);
    const previousType = selected ? markerType(selected) : "";
    if (previousType && previousType !== els.markerType.value && els.markerType.value !== "qr") {
      els.markerEvidence.value = "";
    }
    configureObjectMarkerUi();
    if (state.mode === "editor") {
      updatePreviewFromForm();
      return;
    }
    const manifest = getCurrentManifest();
    manifest.objectMarkers = buildUpdatedObjectMarkers(manifest.object.id);
    state.manifest = manifest;
    configureObjectMarkerUi();
    renderReader();
    validateAndRender(false);
  }

  function configureObjectMarkerUi() {
    updateMarkerTarget();
    updateMarkerEvidenceUi();
    updateMarkerHelp();
  }

  function updateMarkerHelp() {
    if (!els.markerHelp) return;
    els.markerHelp.textContent = MARKER_HELP[els.markerType.value] || MARKER_HELP.qr;
    els.markerHelp.classList.toggle("marker-qr-hint", els.markerType.value === "qr");
  }

  function updateMarkerTarget() {
    const objectId = state.manifest && state.manifest.object && state.manifest.object.id || els.objectId.value || "";
    els.markerTarget.value = objectId;
    els.markerPayload.textContent = objectId ? `object.id ${objectId}` : "object.id";
    if (els.qrAutoPreview) {
      els.qrAutoPreview.innerHTML = renderGeneratedQrMarkup(objectId);
    }
  }

  function updateMarkerEvidenceUi() {
    const type = els.markerType.value;
    const usesFile = type === "image-reference";
    const usesText = type === "nfc" || type === "text-marker";
    const hasFile = currentMarkerEvidenceFile() !== null;
    if (els.qrAutoPanel) els.qrAutoPanel.classList.toggle("hidden", type !== "qr");
    els.markerEvidenceTextGroup.classList.toggle("hidden", usesFile);
    els.markerEvidenceTextGroup.classList.toggle("hidden", !usesText);
    els.markerEvidenceFileGroup.classList.toggle("hidden", !usesFile);
    if (els.markerEvidenceFileDropZone) els.markerEvidenceFileDropZone.classList.toggle("hidden", usesFile && hasFile);
    if (els.markerHelp) els.markerHelp.classList.toggle("hidden", usesFile && hasFile);
    if (usesFile) {
      els.markerEvidenceFileLabel.textContent = "AR Image Reference";
      els.markerEvidenceFileTitle.textContent = "Choose AR Reference Image";
      els.markerEvidenceFileHint.textContent = "Please choose reference image of the object itself.";
      renderMarkerEvidenceFileSummary();
      return;
    }
    if (type === "nfc") {
      els.markerEvidenceTextLabel.textContent = "NDEF Value";
      els.markerEvidence.placeholder = "Paste NFC NDEF text, URI, or tag value";
      return;
    }
    els.markerEvidenceTextLabel.textContent = "OCR Text Marker";
    els.markerEvidence.placeholder = "Exact printed, engraved, or handwritten text on/near the object";
  }

  function markerUsesImageFile(type) {
    return type === "image-reference";
  }

  function populateMarkerEvidenceField(marker) {
    els.markerEvidence.value = "";
    if (!marker) return;
    const evidence = markerEvidence(marker);
    if (!evidence) return;
    if (typeof evidence === "string") {
      els.markerEvidence.value = evidence;
      return;
    }
    if (evidence.type === "generated-qr") return;
    if (evidence.value) els.markerEvidence.value = evidence.value;
  }

  function getMarkerEvidenceForManifest() {
    const type = els.markerType.value;
    if (type === "qr") {
      return {
        type: "generated-qr",
        value: els.objectId.value || state.manifest && state.manifest.object && state.manifest.object.id || "",
        name: "Generated QR marker from object.id"
      };
    }
    if (markerUsesImageFile(type)) {
      const file = currentMarkerEvidenceFile();
      if (!file) return null;
      return {
        type: "image",
        path: file.path,
        name: file.name,
        mediaType: file.type,
        size: file.size
      };
    }
    return {
      type: type === "nfc" ? "ndef" : "text",
      value: els.markerEvidence.value.trim()
    };
  }

  function currentMarkerEvidenceFile() {
    const marker = selectedObjectMarker(state.manifest);
    const evidence = marker && (markerEvidence(marker));
    if (evidence && evidence.path && state.markerEvidenceFiles.has(evidence.path)) {
      return state.markerEvidenceFiles.get(evidence.path);
    }
    return Array.from(state.markerEvidenceFiles.values())[0] || null;
  }

  function buildCurrentObjectMarker(objectId) {
    return {
      markerType: els.markerType.value,
      object: objectId,
      markerEvidence: getMarkerEvidenceForManifest(),
      note: buildMarkerNote(els.markerType.value)
    };
  }

  function buildUpdatedObjectMarkers(objectId) {
    const existing = Array.isArray(state.manifest && state.manifest.objectMarkers)
      ? state.manifest.objectMarkers.slice()
      : [];
    const index = Math.max(0, state.editingMarkerIndex || 0);
    existing[index] = buildCurrentObjectMarker(objectId);
    return existing.map((marker) => normalizeObjectMarkerRecord(marker, objectId));
  }

  function addNewObjectMarker() {
    if (!state.manifest) return;
    updatePreviewFromForm();
    const objectId = state.manifest.object && state.manifest.object.id || els.objectId.value;
    state.manifest.objectMarkers = Array.isArray(state.manifest.objectMarkers) ? state.manifest.objectMarkers : [];
    state.manifest.objectMarkers.push(defaultObjectMarker("qr", objectId));
    renderAdditionalMarkerEditors();
    renderJsonPreview();
    renderWriterObjectWarnings();
    validateAndRender(false);
    setValidation([{ level: "info", message: `Added Object Marker ${state.manifest.objectMarkers.length}.` }], true);
  }

  function renderAdditionalMarkerEditors() {
    if (!els.additionalMarkerEditors || !state.manifest) return;
    const markers = Array.isArray(state.manifest.objectMarkers) ? state.manifest.objectMarkers : [];
    if (markers.length <= 1) {
      els.additionalMarkerEditors.innerHTML = "";
      return;
    }
    els.additionalMarkerEditors.innerHTML = markers.slice(1).map((marker, offset) => {
      const index = offset + 1;
      return `
        <section class="marker-editor-grid marker-editor-row" data-marker-index="${index}">
          <div class="marker-type-panel">
            <label for="extraMarkerType${index}">Marker Type</label>
            <select id="extraMarkerType${index}" size="4" data-extra-marker-field="type" data-marker-index="${index}">
              <option value="qr" ${markerType(marker) === "qr" ? "selected" : ""}>QR</option>
              <option value="nfc" ${markerType(marker) === "nfc" ? "selected" : ""}>NFC</option>
              <option value="image-reference" ${markerType(marker) === "image-reference" ? "selected" : ""}>AR Image Ref</option>
              <option value="text-marker" ${markerType(marker) === "text-marker" ? "selected" : ""}>OCR Text Marker</option>
            </select>
          </div>
          <div class="marker-evidence-panel">
            ${renderExtraMarkerEvidence(marker, index)}
            <p class="object-id-note">object.id ${escapeHtml(state.manifest.object && state.manifest.object.id || "")}</p>
          </div>
          <div class="marker-help-panel">
            <p class="small-muted ${markerType(marker) === "qr" ? "marker-qr-hint" : ""}">${escapeHtml(MARKER_HELP[markerType(marker)] || MARKER_HELP.qr)}</p>
            <button class="circle-action remove-extra-marker" type="button" data-remove-extra-marker="${index}" aria-label="Remove marker">−</button>
          </div>
        </section>
      `;
    }).join("");
  }

  function renderExtraMarkerEvidence(marker, index) {
    const evidence = markerEvidence(marker) || {};
    if (markerType(marker) === "qr") {
      return `
        <div class="qr-auto-panel">
          <div class="generated-marker-preview">${renderGeneratedQrMarkup(state.manifest.object && state.manifest.object.id || "")}</div>
          <strong>Auto-Generate QR Code</strong>
        </div>
      `;
    }
    if (markerType(marker) === "image-reference") {
      if (evidence.path && state.markerEvidenceFiles.has(evidence.path)) {
        return renderMarkerEvidenceImage(evidence.path, evidence.name || "AR reference image");
      }
      return `
        <label class="evidence-file-drop-zone">
          <input type="file" accept="image/*" data-extra-marker-file="${index}">
          <strong>Choose AR Reference Image</strong>
          <span>${escapeHtml(evidence.name || "No image attached.")}</span>
        </label>
      `;
    }
    const label = markerType(marker) === "nfc" ? "NDEF Value" : "OCR Text Marker";
    const placeholder = markerType(marker) === "nfc" ? "Paste NFC NDEF text, URI, or tag value" : "Exact printed, engraved, or handwritten text";
    return `
      <label for="extraMarkerValue${index}">${escapeHtml(label)}</label>
      <textarea id="extraMarkerValue${index}" rows="3" data-extra-marker-field="value" data-marker-index="${index}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(evidence.value || "")}</textarea>
    `;
  }

  function renderMarkerEvidenceImage(path, label) {
    const file = state.markerEvidenceFiles.get(path);
    if (!file) return "";
    let url = state.assetUrls.get(file.path);
    if (!url) {
      url = URL.createObjectURL(new Blob([file.buffer], { type: file.type || guessMediaType(file.path) }));
      state.assetUrls.set(file.path, url);
    }
    return `<div class="marker-evidence-preview"><img src="${url}" alt="${escapeHtml(label || file.name || "AR reference image")}"></div>`;
  }

  function handleAdditionalMarkerClick(event) {
    const removeButton = event.target.closest("[data-remove-extra-marker]");
    if (!removeButton) return;
    removeExtraObjectMarker(Number(removeButton.dataset.removeExtraMarker || 0));
  }

  function removeExtraObjectMarker(index) {
    if (!state.manifest || !Array.isArray(state.manifest.objectMarkers) || index <= 0 || !state.manifest.objectMarkers[index]) return;
    const removed = state.manifest.objectMarkers.splice(index, 1)[0];
    const evidence = markerEvidence(removed);
    if (evidence && evidence.path) {
      const stillUsed = state.manifest.objectMarkers.some((marker) => {
        const evidenceRecord = marker && markerEvidence(marker);
        return evidenceRecord && evidenceRecord.path === evidence.path;
      });
      if (!stillUsed) state.markerEvidenceFiles.delete(evidence.path);
    }
    state.editingMarkerIndex = 0;
    populateObjectMarkerInspector();
    renderAdditionalMarkerEditors();
    renderJsonPreview();
    renderWriterObjectWarnings();
    validateAndRender(false);
  }

  function handleAdditionalMarkerInput(event) {
    const field = event.target.closest("[data-extra-marker-field]");
    if (!field || field.dataset.extraMarkerField !== "value") return;
    updateExtraMarkerField(field);
  }

  async function handleAdditionalMarkerChange(event) {
    const fileInput = event.target.closest("[data-extra-marker-file]");
    if (fileInput) {
      await updateExtraMarkerFile(fileInput);
      return;
    }
    const field = event.target.closest("[data-extra-marker-field]");
    if (!field) return;
    updateExtraMarkerField(field);
  }

  function updateExtraMarkerField(field) {
    if (!state.manifest) return;
    const index = Number(field.dataset.markerIndex || 0);
    const marker = state.manifest.objectMarkers && state.manifest.objectMarkers[index];
    if (!marker) return;
    if (field.dataset.extraMarkerField === "type") {
      marker.markerType = field.value;
      delete marker.type;
      marker.note = buildMarkerNote(field.value);
      marker.object = state.manifest.object.id;
      delete marker.target;
      delete marker.payload;
      delete marker.evidence;
      delete marker.markerEvidence;
      marker.markerEvidence = defaultMarkerEvidence(field.value, state.manifest.object.id);
      renderAdditionalMarkerEditors();
    } else {
      delete marker.evidence;
      delete marker.markerEvidence;
      marker.object = state.manifest.object.id;
      marker.markerEvidence = {
        type: markerType(marker) === "nfc" ? "ndef" : "text",
        value: field.value.trim()
      };
    }
    validateAndRender(false);
    renderJsonPreview();
    renderWriterObjectWarnings();
  }

  async function updateExtraMarkerFile(input) {
    const index = Number(input.dataset.extraMarkerFile || 0);
    const file = input.files && input.files[0];
    input.value = "";
    if (!file || !state.manifest || !state.manifest.objectMarkers[index]) return;
    if (!file.type.startsWith("image/")) {
      setValidation([{ level: "error", message: "Object Marker evidence image must be an image file." }], true);
      return;
    }
    const path = uniqueObjectMarkerEvidencePath(file.name);
    const buffer = await file.arrayBuffer();
    state.markerEvidenceFiles.set(path, {
      path,
      name: file.name,
      type: file.type || guessMediaType(file.name),
      size: file.size,
      buffer
    });
    state.manifest.objectMarkers[index].object = state.manifest.object.id;
    delete state.manifest.objectMarkers[index].target;
    delete state.manifest.objectMarkers[index].payload;
    delete state.manifest.objectMarkers[index].evidence;
    delete state.manifest.objectMarkers[index].markerEvidence;
    state.manifest.objectMarkers[index].markerEvidence = {
      type: "image",
      path,
      name: file.name,
      mediaType: file.type || guessMediaType(file.name),
      size: file.size
    };
    renderAdditionalMarkerEditors();
    validateAndRender(false);
    renderJsonPreview();
    renderWriterObjectWarnings();
  }

  function defaultMarkerEvidence(type, objectId) {
    if (type === "qr") {
      return {
        type: "generated-qr",
        value: objectId,
        name: "Generated QR marker from object.id"
      };
    }
    if (type === "image-reference") return null;
    return { type: type === "nfc" ? "ndef" : "text", value: "" };
  }

  function renderMarkerEvidenceFileSummary() {
    if (!els.markerEvidenceFileSummary) return;
    const file = currentMarkerEvidenceFile();
    if (!file) {
      els.markerEvidenceFileSummary.textContent = "No marker image attached.";
      return;
    }
    let url = state.assetUrls.get(file.path);
    if (!url) {
      url = URL.createObjectURL(new Blob([file.buffer], { type: file.type || guessMediaType(file.path) }));
      state.assetUrls.set(file.path, url);
    }
    els.markerEvidenceFileSummary.innerHTML = `<div class="marker-evidence-preview"><img src="${url}" alt="${escapeHtml(file.name)}"></div>`;
  }

  function buildMarkerNote(markerType) {
    return `Recognition method ${markerType} records Object Marker evidence for the current object.id and opens the Object Hub.`;
  }

  function renderAssetList() {
    els.assetList.innerHTML = "";
    updateAssetSummaries();
    const editingAssets = Array.from(state.assets.values()).filter((asset) => state.editingAssetPaths.has(asset.path));
    els.assetDetailsPanel.classList.toggle("hidden", editingAssets.length === 0);
    if (editingAssets.length === 0) {
      return;
    }
    for (const asset of editingAssets) {
      const item = document.createElement("li");
      const preview = createAssetListPreview(asset);
      const label = document.createElement("div");
      label.className = "asset-item-info";
      label.innerHTML = `
        <strong>${escapeHtml(asset.name)}</strong>
        <code>${escapeHtml(asset.path)}</code>
        <span class="small-muted">${escapeHtml(assetTypeSummary(asset))}${asset.size ? ` | ${formatBytes(asset.size)}` : ""}</span>
        ${asset.url ? `<a href="${escapeHtml(asset.url)}" target="_blank" rel="noreferrer">${escapeHtml(asset.url)}</a>` : ""}
      `;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Remove";
      button.addEventListener("click", () => removeAsset(asset.path));
      item.append(preview, label, button);
      els.assetList.appendChild(item);
    }
  }

  function updateAssetSummaries() {
    if (!els.assetSizeSummary) return;
    const manifestBytes = state.manifest ? encodeUtf8(JSON.stringify(stripEmpty(state.manifest))).byteLength : 0;
    const editingAssets = Array.from(state.assets.values()).filter((asset) => state.editingAssetPaths.has(asset.path));
    const localAssets = editingAssets.filter((asset) => !asset.external);
    const onlineAssets = editingAssets.filter((asset) => asset.external);
    const assetBytes = localAssets.reduce((total, asset) => total + asset.size, 0);
    const count = editingAssets.length;
    if (count === 0) {
      els.assetSizeSummary.textContent = "No attached files. Text-only memory is valid.";
      return;
    }
    els.assetSizeSummary.textContent = `${localAssets.length} local file${localAssets.length === 1 ? "" : "s"}, ${onlineAssets.length} online URL${onlineAssets.length === 1 ? "" : "s"}; estimated .olml ${formatBytes(assetBytes + manifestBytes)} before ZIP overhead.`;
  }

  function createAssetListPreview(asset) {
    const shell = document.createElement("div");
    shell.className = "asset-preview-shell";
    if (asset.external) {
      shell.textContent = "URL";
      return shell;
    }
    const type = asset.type || guessMediaType(asset.path);
    let url = state.assetUrls.get(asset.path);
    if (!url) {
      url = URL.createObjectURL(new Blob([asset.buffer], { type }));
      state.assetUrls.set(asset.path, url);
    }
    if (type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = asset.name;
      shell.appendChild(img);
      return shell;
    }
    if (type.startsWith("video/")) {
      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      shell.appendChild(video);
      return shell;
    }
    shell.textContent = type.split("/")[0] || "file";
    return shell;
  }

  function renderJsonPreview() {
    els.jsonPreview.textContent = JSON.stringify(stripEmpty(getCurrentManifest()), null, 2);
  }

  function getCurrentManifest() {
    if (!state.manifest) createNewPackage();
    return state.manifest;
  }

  async function openOlmlFile(file) {
    try {
      cleanupAssetUrls();
      const buffer = await file.arrayBuffer();
      const sourceHash = await sha256Digest(new Uint8Array(buffer));
      const entries = await readZipEntries(buffer);
      const zipIssues = window.OLMLState.validateZipEntryNames(Array.from(entries.keys()));
      if (zipIssues.length) throw new Error(zipIssues.join(" "));
      if (!entries.has("olml.json")) {
        throw new Error("olml.json was not found at the package root.");
      }
      const manifestText = decodeUtf8(entries.get("olml.json"));
      const normalized = normalizeManifest(JSON.parse(manifestText));
      const manifest = normalized.manifest || normalized;
      state.manifest = manifest;
      state.preserveObjectId = true;
      state.structuralReadOnly = Boolean(normalized.errors && normalized.errors.length);
      state.assets = new Map();
      state.markerEvidenceFiles = new Map();
      for (const assetRecord of manifest.assets || []) {
        if (assetRecord.url || assetRecord.external) {
          state.assets.set(assetRecord.path, {
            path: assetRecord.path,
            name: assetRecord.name || assetRecord.url || assetRecord.path,
            type: assetRecord.mediaType || assetRecord.type || meaningfulMediaType(assetRecord.path),
            size: assetRecord.size || 0,
            url: assetRecord.url,
            external: true
          });
        }
      }
      for (const [path, entryBuffer] of entries) {
        if (path === "olml.json" || path.endsWith("/")) continue;
        if (path.startsWith("marker-evidence/")) {
          const evidenceRecord = findObjectMarkerEvidenceRecord(manifest, path);
          state.markerEvidenceFiles.set(path, {
            path,
            name: evidenceRecord && evidenceRecord.name || path.split("/").pop(),
            type: evidenceRecord && (evidenceRecord.mediaType || evidenceRecord.type) || guessMediaType(path),
            size: entryBuffer.byteLength,
            buffer: entryBuffer
          });
          continue;
        }
        const assetRecord = (manifest.assets || []).find((asset) => asset.path === path);
        state.assets.set(path, {
          path,
          name: assetRecord && assetRecord.name || path.split("/").pop(),
          type: assetRecord && (assetRecord.mediaType || assetRecord.type) || guessMediaType(path),
          size: entryBuffer.byteLength,
          buffer: entryBuffer
        });
      }
      state.sourceName = file.name;
      state.sourceBytes = buffer;
      state.sourceHash = sourceHash;
      state.candidateSemanticState = await computeSemanticStateForManifest(manifest);
      const conflict = await detectLibraryConflict(manifest, state.candidateSemanticState);
      state.activeConflict = conflict && conflict.decision || conflict && conflict.blocking ? conflict : null;
      state.conflictMode = "compare";
      const validationResult = validateManifest(manifest, state.assets);
      const hasReadableValidationErrors = validationResult.some((item) => item.level === "error");
      const readableButInvalid = Boolean(state.structuralReadOnly || hasReadableValidationErrors);
      state.detachedFromLibrary = readableButInvalid;
      state.detachedExport = readableButInvalid;
      if (!readableButInvalid && !state.activeConflict) {
        await addReadFileToLibrary(file, buffer, manifest, state.candidateSemanticState, sourceHash);
      }
      await updateSharedObjectContext();
      populateObjectMarkerInspector();
      showMode("reader");
      resetReaderEditState();
      state.detachedFromLibrary = readableButInvalid;
      state.detachedExport = readableButInvalid;
      showInspector("validation");
      if (state.structuralReadOnly) setValidation(normalized.errors.map((message) => ({ level: "error", message: `${message} Package remains read-only; missing IDs were not generated.` })), true);
      else if (hasReadableValidationErrors) setValidation([
        { level: "warning", message: "Readable but invalid file opened without updating Library. Fix it here, then export a corrected file." },
        ...validationResult
      ], true);
      else if (conflict) setValidation([{ level: conflict.blocking ? "error" : "warning", message: conflict.message }], true);
      else validateAndRender(true);
    } catch (error) {
      state.manifest = null;
      state.sourceBytes = null;
      state.sourceHash = "";
      state.activeConflict = null;
      state.structuralReadOnly = false;
      state.detachedFromLibrary = false;
      state.detachedExport = false;
      showMode("empty");
      showInspector("validation");
      setValidation([{ level: "error", message: error.message || String(error) }], true);
    }
  }

  async function updateSharedObjectContext() {
    const objectId = state.manifest && state.manifest.object && state.manifest.object.id;
    if (!objectId) {
      state.sharedObjectSiblingCount = 0;
      return;
    }
    const records = await listPackageRecords().catch(() => []);
    const currentOlmlId = state.manifest && state.manifest.olml && state.manifest.olml.id;
    state.sharedObjectSiblingCount = records.filter((record) => record.objectId === objectId && record.olmlId !== currentOlmlId).length;
  }

  async function detectLibraryConflict(manifest, semanticState) {
    if (!manifest || !manifest.olml || !manifest.olml.id || !semanticState) return null;
    const incoming = {
      olmlId: manifest.olml.id,
      objectId: manifest.object && manifest.object.id,
      objectStateHash: semanticState.objectStateHash,
      collectionStateHash: semanticState.collectionStateHash,
      packageStateHash: semanticState.packageStateHash,
      memoryStateHashes: semanticState.memoryStateHashes
    };
    const records = await listPackageRecords();
    const classification = window.OLMLState.classifyImport(incoming, records);
    const sameCollection = records.find((record) => record.olmlId === incoming.olmlId);
    const verification = window.OLMLState.verifyDeclaredIntegrity(manifest, semanticState);
    if (verification.status === "mismatch") {
      return {
        type: "integrity-mismatch",
        decision: true,
        message: `Stored declared hash differs from recomputed hash (${verification.mismatches.join(", ")}). Accepting will use normalized recomputed content and mark the Collection Needs export.`,
        incomingHashes: semanticState,
        currentHashes: sameCollection ? semanticHashSummary(sameCollection) : null,
        currentRecord: sameCollection || null
      };
    }
    return {
      ...classification,
      incomingHashes: semanticState,
      currentHashes: sameCollection ? semanticHashSummary(sameCollection) : null,
      currentRecord: sameCollection || null
    };
  }

  function semanticHashSummary(record) {
    if (!record) return null;
    return {
      hashProfile: record.hashProfile || HASH_PROFILE,
      objectStateHash: record.objectStateHash || "",
      memoryStateHashes: record.memoryStateHashes || [],
      collectionStateHash: record.collectionStateHash || "",
      packageStateHash: record.packageStateHash || record.collectionStateHash || "",
      parentPackageStateHash: record.parentPackageStateHash || "",
      lastPortablePackageStateHash: record.lastPortablePackageStateHash || record.lastPortableCollectionStateHash || "",
      lastPortableCollectionStateHash: record.lastPortableCollectionStateHash || ""
    };
  }

  function applyLibraryProfilesToManifest(record) {
    if (!record || !state.manifest) return;
    if (record.objectProfile && record.objectId === state.manifest.object.id) {
      state.manifest.object = { ...state.manifest.object, ...record.objectProfile, id: state.manifest.object.id };
    }
    if (record.objectMarkers && record.objectId === state.manifest.object.id) {
      state.manifest.objectMarkers = structuredClone(record.objectMarkers).map((marker) => normalizeObjectMarkerRecord(marker, state.manifest.object.id));
    }
  }

  function cancelConflictImport() {
    state.activeConflict = null;
    state.conflictMode = "compare";
    state.detachedFromLibrary = false;
    state.detachedExport = false;
    state.manifest = null;
    state.sourceBytes = null;
    state.sourceHash = "";
    state.sourceName = "";
    state.candidateSemanticState = null;
    showMode("empty");
    setValidation([{ level: "info", message: "Conflicting import canceled. Library records were not changed." }], true);
  }

  async function showLibraryConflictChoice() {
    const record = state.activeConflict && state.activeConflict.currentRecord;
    if (!record) {
      setValidation([{ level: "error", message: "No Library record is available for this conflict." }], true);
      return;
    }
    state.conflictMode = "library";
    renderReader();
  }

  async function exportLibraryConflictVersion() {
    const record = state.activeConflict && state.activeConflict.currentRecord;
    const bytes = record && (record.zip || record.latestPackageBytes);
    if (!bytes) {
      setValidation([{ level: "error", message: "Library record does not contain full package bytes. Repair file first or import the newer package." }], true);
      return;
    }
    downloadBlob(new Blob([new Uint8Array(bytes)], { type: "application/olml+zip" }), defaultExportFilename(record.manifest || state.manifest));
    setValidation([{ level: "info", message: "Library version exported. The existing file on disk remains unchanged until you replace it." }], true);
  }

  async function repairFromLibraryConflictVersion() {
    const record = state.activeConflict && state.activeConflict.currentRecord;
    if (!record || !record.manifest) {
      setValidation([{ level: "error", message: "No Library profile is available to repair this file." }], true);
      return;
    }
    state.manifest = structuredClone(record.manifest);
    state.assets = new Map();
    state.markerEvidenceFiles = new Map();
    if (record.zip || record.latestPackageBytes) {
      await loadPackageBytesIntoState(record.zip || record.latestPackageBytes, record.sourceName || "library-record.olml");
    } else {
      loadManifestRecordsIntoState(record.manifest);
    }
    state.activeConflict = null;
    state.conflictMode = "compare";
    state.detachedFromLibrary = false;
    state.detachedExport = false;
    state.candidateSemanticState = await computeSemanticStateForManifest(state.manifest);
    resetReaderEditState();
    state.readerEditing = true;
    state.readerUnlocks = { object: true, collection: true, markers: true, memories: true };
    renderReader();
    setValidation([{ level: "warning", message: "Repair file started from the Library version. Missing assets must be added before export." }], true);
  }

  async function setIncomingConflictAsCurrent() {
    if (!state.activeConflict || !state.manifest || !state.candidateSemanticState) return;
    const manifest = getCurrentManifest();
    const existing = state.activeConflict.currentRecord || await getPackageRecord(manifest.olml.id);
    const previousHashes = semanticHashSummary(existing);
    const objectChanged = Boolean(existing && existing.objectStateHash && existing.objectStateHash !== state.candidateSemanticState.objectStateHash);
    const records = await listPackageRecords();
    const siblings = objectChanged ? records.filter((record) => record.objectId === manifest.object.id && record.olmlId !== manifest.olml.id) : [];
    const cleanManifest = window.OLMLState.withIntegrityEnvelope(stripEmpty(manifest), state.candidateSemanticState);
    const zip = await buildCurrentZip(state.candidateSemanticState);
    const zipHash = await sha256Digest(zip);
    const now = new Date().toISOString();
    const currentRecord = buildPackageRecord({
      ...(existing || {}),
      olmlId: manifest.olml.id,
      objectId: manifest.object.id,
      title: manifest.object.title || manifest.olml.title || "Untitled OLML",
      manifest: structuredClone(cleanManifest),
      objectProfile: structuredClone(manifest.object),
      objectMarkers: structuredClone(manifest.objectMarkers || []),
      zip,
      sha256: zipHash,
      zipSha256: zipHash,
      hashProfile: HASH_PROFILE,
      objectStateHash: state.candidateSemanticState.objectStateHash,
      memoryStateHashes: state.candidateSemanticState.memoryStateHashes,
      collectionStateHash: state.candidateSemanticState.collectionStateHash,
      packageStateHash: state.candidateSemanticState.packageStateHash,
      parentPackageStateHash: state.candidateSemanticState.parentPackageStateHash || "",
      lastPortableCollectionStateHash: state.candidateSemanticState.collectionStateHash,
      lastPortablePackageStateHash: state.candidateSemanticState.packageStateHash,
      markers: deriveMarkerIndex(manifest),
      exportStatus: "export-generated",
      needsExportReasons: [],
      savedAt: now,
      importedAt: now,
      sourceName: state.sourceName,
      sourceHash: state.sourceHash
    });
    const siblingUpdates = siblings.map((sibling) => {
      const reasons = new Set(sibling.needsExportReasons || []);
      reasons.add("Shared Object Profile updated in Library.");
      return buildPackageRecord({
        ...sibling,
        exportStatus: "needs-export",
        needsExportReasons: Array.from(reasons),
        libraryUpdatedAt: now
      });
    });
    await commitLibraryTransaction({
      currentRecord,
      siblingUpdates,
      semanticState: state.candidateSemanticState,
      action: {
        id: `action:${crypto.randomUUID()}`,
        type: "incoming-version-set-current",
        at: now,
        affectedIds: {
          olmlId: manifest.olml.id,
          objectId: manifest.object.id,
          memoryIds: (manifest.memories || []).map((memory) => memory.id)
        },
        previousHashes: previousHashes || {},
        resultingHashes: state.candidateSemanticState,
        changedScopes: conflictChangedScopes(state.activeConflict),
        changedFields: conflictChangedFields(state.activeConflict),
        assetSummary: summarizeAssets(state.assets),
        conflictDecision: "incoming-current"
      }
    });
    if (objectChanged) await persistSiblingObjectHashConflicts(siblings, currentRecord, state.candidateSemanticState, { objectChanged: true, markersChanged: false, collectionChanged: false, changedMemories: [] });
    state.manifest = structuredClone(cleanManifest);
    state.activeConflict = null;
    state.conflictMode = "compare";
    resetReaderEditState();
    await refreshLibrary();
    setValidation([{ level: "info", message: objectChanged ? "Incoming file set as current Library state. Other local files with the same object.id were marked Needs export." : "Incoming file set as current Library state." }], true);
  }

  function openIncomingWithoutUpdatingLibrary() {
    state.activeConflict = null;
    state.conflictMode = "compare";
    state.detachedFromLibrary = true;
    state.detachedExport = true;
    resetReaderEditState();
    renderReader();
    setValidation([{ level: "info", message: "Opened without updating Library. Exporting from this session will not change Library records." }], true);
  }

  async function loadPackageBytesIntoState(bytes, sourceName) {
    const raw = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    const entries = await readZipEntries(buffer);
    const manifestText = decodeUtf8(entries.get("olml.json"));
    const normalized = normalizeManifest(JSON.parse(manifestText));
    state.manifest = normalized.manifest || normalized;
    loadManifestRecordsIntoState(state.manifest);
    for (const [path, entryBuffer] of entries) {
      if (path === "olml.json" || path.endsWith("/")) continue;
      if (path.startsWith("marker-evidence/")) {
        const evidenceRecord = findObjectMarkerEvidenceRecord(state.manifest, path);
        state.markerEvidenceFiles.set(path, {
          path,
          name: evidenceRecord && evidenceRecord.name || path.split("/").pop(),
          type: evidenceRecord && (evidenceRecord.mediaType || evidenceRecord.type) || guessMediaType(path),
          size: entryBuffer.byteLength,
          buffer: entryBuffer
        });
        continue;
      }
      const assetRecord = (state.manifest.assets || []).find((asset) => asset.path === path);
      state.assets.set(path, {
        path,
        name: assetRecord && assetRecord.name || path.split("/").pop(),
        type: assetRecord && (assetRecord.mediaType || assetRecord.type) || guessMediaType(path),
        size: entryBuffer.byteLength,
        buffer: entryBuffer
      });
    }
    state.sourceName = sourceName || state.sourceName;
  }

  function loadManifestRecordsIntoState(manifest) {
    state.assets = new Map();
    state.markerEvidenceFiles = new Map();
    for (const assetRecord of manifest.assets || []) {
      if (assetRecord.url || assetRecord.external) {
        state.assets.set(assetRecord.path, {
          path: assetRecord.path,
          name: assetRecord.name || assetRecord.url || assetRecord.path,
          type: assetRecord.mediaType || assetRecord.type || meaningfulMediaType(assetRecord.path),
          size: assetRecord.size || 0,
          url: assetRecord.url,
          external: true
        });
      }
    }
  }

  function conflictChangedScopes(conflict) {
    const scopes = new Set();
    const incoming = conflict && conflict.incomingHashes || {};
    const current = conflict && conflict.currentHashes || {};
    if (incoming.objectStateHash !== current.objectStateHash) scopes.add("Object");
    if (incoming.collectionStateHash !== current.collectionStateHash) scopes.add("Collection");
    if (incoming.packageStateHash !== current.packageStateHash) scopes.add("Package");
    for (const item of incoming.memoryStateHashes || []) {
      if (findMemoryHash(current, item.memory) !== item.memoryStateHash) scopes.add("Memory");
    }
    return Array.from(scopes);
  }

  function conflictChangedFields(conflict) {
    const fields = [];
    for (const scope of conflictChangedScopes(conflict)) fields.push(scope.toLowerCase());
    return fields;
  }

  function normalizeManifest(raw) {
    return window.OLMLState.normalizeManifest(raw);
  }

  function findObjectMarkerEvidenceRecord(manifest, path) {
    for (const marker of manifest.objectMarkers || []) {
      const evidence = markerEvidence(marker);
      if (evidence && typeof evidence === "object" && evidence.path === path) return evidence;
    }
    return null;
  }

  function populateObjectMarkerInspector() {
    const manifest = getCurrentManifest();
    const marker = selectedObjectMarker(manifest);
    els.markerType.value = marker ? markerType(marker) : "qr";
    populateMarkerEvidenceField(marker);
    els.markerPayload.textContent = `object.id ${marker ? marker.object || manifest.object.id : manifest.object.id}`;
    els.markerTarget.value = manifest.object.id || "";
    configureObjectMarkerUi();
  }

  function renderReader() {
    if (!state.manifest) return;
    const manifest = getCurrentManifest();
    const body = state.activeConflict
      ? buildConflictWorkspace(manifest, state.activeConflict)
      : buildReaderWorkspace(manifest);
    els.readerContent.innerHTML = `${body}${renderAssetPreviewOverlay()}`;
  }

  function buildConflictWorkspace(incomingManifest, conflict) {
    if (conflict.blocking) return buildConflictErrorWorkspace(incomingManifest, conflict);
    if (state.conflictMode === "library") return buildConflictLibraryWorkspace(conflict);
    if (state.conflictMode === "incoming") return buildConflictIncomingWorkspace(incomingManifest, conflict);
    const libraryManifest = conflict.currentRecord && conflict.currentRecord.manifest || {};
    return `
      <section class="conflict-workspace">
        <p class="conflict-warning">There seems to be some conflict between the file to read and our file record in Library, please see the diff below and choose one to load.</p>
        <div class="conflict-diff-grid">
          ${renderConflictColumn("Incoming File", incomingManifest, libraryManifest, conflict.incomingHashes, conflict.currentHashes)}
          ${renderConflictColumn("Current Library State", libraryManifest, incomingManifest, conflict.currentHashes, conflict.incomingHashes)}
        </div>
        <div class="conflict-actions">
          <button type="button" data-reader-action="conflict-use-library">Use Library File On Record</button>
          <button type="button" data-reader-action="conflict-use-incoming">Use My File</button>
          <button type="button" data-reader-action="conflict-cancel">Cancel</button>
        </div>
        <p class="conflict-warning">Downloads a new OLML file. The existing file on disk remains unchanged.</p>
      </section>
    `;
  }

  function buildConflictErrorWorkspace(manifest, conflict) {
    return `
      <section class="conflict-workspace">
        <p class="conflict-warning">${escapeHtml(conflict.message || "This file has an identity collision and cannot be opened into Library.")}</p>
        <div class="conflict-identity-list">
          <p><strong>olml.id</strong> ${escapeHtml(manifest.olml && manifest.olml.id || "-")}</p>
          <p><strong>object.id</strong> ${escapeHtml(manifest.object && manifest.object.id || "-")}</p>
          ${(manifest.memories || []).map((memory) => `<p><strong>memory.id</strong> ${escapeHtml(memory.id || "-")}</p>`).join("")}
        </div>
        <div class="conflict-actions">
          <button type="button" data-reader-action="conflict-cancel">Cancel</button>
        </div>
      </section>
    `;
  }

  function buildConflictLibraryWorkspace(conflict) {
    const record = conflict.currentRecord || {};
    const manifest = record.manifest || {};
    const missing = libraryMissingAssets(record);
    return `
      <section class="conflict-workspace">
        <div class="conflict-preview">
          ${renderConflictFileProfile(manifest, state.manifest, conflict.currentHashes, conflict.incomingHashes)}
        </div>
        ${missing.length ? `<div class="conflict-missing-assets">${missing.map((item) => `<p>${escapeHtml(item.name)} <span>Asset unavailable in Library</span></p>`).join("")}</div>` : ""}
        <div class="conflict-actions">
          ${missing.length ? '<button type="button" data-reader-action="conflict-repair-library">Repair File</button>' : '<button type="button" data-reader-action="conflict-export-library">Overwrite File & Export</button>'}
          <button type="button" data-reader-action="conflict-back">Back</button>
        </div>
        <p class="conflict-warning">Downloads a new OLML file. The existing file on disk remains unchanged.</p>
      </section>
    `;
  }

  function buildConflictIncomingWorkspace(manifest, conflict) {
    return `
      <section class="conflict-workspace">
        <div class="conflict-preview">
          ${renderConflictFileProfile(manifest, conflict.currentRecord && conflict.currentRecord.manifest || {}, conflict.incomingHashes, conflict.currentHashes)}
        </div>
        <div class="conflict-actions">
          <button type="button" data-reader-action="conflict-set-incoming-current">Set Incoming Version as Current</button>
          <button type="button" data-reader-action="conflict-open-detached">Open Without Updating Library</button>
          <button type="button" data-reader-action="conflict-back">Back</button>
        </div>
      </section>
    `;
  }

  function renderConflictColumn(title, manifest, otherManifest, hashes, otherHashes) {
    return `
      <article class="conflict-column">
        <h2>${escapeHtml(title)}</h2>
        ${renderConflictFileProfile(manifest, otherManifest, hashes, otherHashes)}
      </article>
    `;
  }

  function renderConflictFileProfile(manifest, otherManifest, hashes, otherHashes) {
    const object = manifest.object || {};
    const otherObject = otherManifest.object || {};
    const olml = manifest.olml || {};
    const otherOlml = otherManifest.olml || {};
    const memories = manifest.memories || [];
    const otherMemories = otherManifest.memories || [];
    const matchedMemories = memories.filter((memory) => otherMemories.some((item) => item.id === memory.id));
    const additionalMemories = memories.filter((memory) => !otherMemories.some((item) => item.id === memory.id));
    return `
      <div class="conflict-profile">
        <section>
          <h3>Object</h3>
          ${renderDiffLine("object.id", object.id, otherObject.id, false)}
          ${renderDiffLine("Object Title", object.title, otherObject.title, object.title !== otherObject.title)}
          ${renderDiffLine("Object Description", object.description, otherObject.description, object.description !== otherObject.description)}
          ${renderDiffHash("objectStateHash", hashes && hashes.objectStateHash, otherHashes && otherHashes.objectStateHash)}
        </section>
        <section>
          <h3>Object Markers</h3>
          ${renderMarkerDiffSummary(manifest.objectMarkers || [], otherManifest.objectMarkers || [])}
        </section>
        <section>
          <h3>Collection</h3>
          ${renderDiffLine("olml.id", olml.id, otherOlml.id, false)}
          ${renderDiffLine("Collection Title", olml.title, otherOlml.title, olml.title !== otherOlml.title)}
          ${renderDiffLine("Collection Description", olml.note, otherOlml.note, olml.note !== otherOlml.note)}
          ${renderDiffHash("collectionStateHash", hashes && hashes.collectionStateHash, otherHashes && otherHashes.collectionStateHash)}
          ${renderDiffHash("packageStateHash", hashes && hashes.packageStateHash, otherHashes && otherHashes.packageStateHash)}
        </section>
        <section>
          <h3>Memory</h3>
          ${matchedMemories.map((memory) => renderMemoryDiffSummary(memory, otherMemories.find((item) => item.id === memory.id), hashes, otherHashes)).join("")}
          ${additionalMemories.map((memory) => renderAdditionalMemorySummary(memory, hashes)).join("")}
          ${!matchedMemories.length && !additionalMemories.length ? '<p class="small-muted">No memories.</p>' : ""}
        </section>
      </div>
    `;
  }

  function renderAdditionalMemorySummary(memory, hashes) {
    const hash = findMemoryHash(hashes, memory.id);
    return `
      <div class="memory-diff changed">
        <p class="diff-line changed"><strong>Additional Memory in this version</strong> ${escapeHtml(memory.title || memory.id || "-")}</p>
        ${renderDiffLine("Memory Title", memory.title, "", true)}
        ${renderDiffLine("Memory Time", memory.time, "", Boolean(memory.time))}
        ${renderDiffLine("Memory Place", memory.place, "", Boolean(memory.place))}
        ${renderDiffLine("Memory Note", memory.note, "", Boolean(memory.note))}
        ${renderDiffLine("Memory Assets", (memory.assets || []).join(", "), "", Boolean((memory.assets || []).length))}
        ${renderDiffHash("memoryStateHash", hash, "")}
      </div>
    `;
  }

  function renderDiffLine(label, value, otherValue, changed) {
    return `<p class="diff-line ${changed ? "changed" : ""}"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value || "-")}${changed ? ` <small>Library/Incoming: ${escapeHtml(otherValue || "-")}</small>` : ""}</p>`;
  }

  function renderDiffHash(label, value, otherValue) {
    const changed = Boolean(value && otherValue && value !== otherValue);
    return `<p class="diff-line hash-line ${changed ? "changed" : ""}"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(shortIdentity(value || "-"))}</p>`;
  }

  function renderMarkerDiffSummary(markers, otherObjectMarkers) {
    if (!markers.length) return '<p class="small-muted">No object markers.</p>';
    return markers.map((marker, index) => {
      const other = otherObjectMarkers[index];
      const changed = stableJson(stripEmpty(marker)) !== stableJson(stripEmpty(other || {}));
      return `<p class="diff-line ${changed ? "changed" : ""}"><strong>${escapeHtml(markerLabel(markerType(marker)))}</strong> ${escapeHtml(markerEvidenceLabel(marker))}</p>`;
    }).join("");
  }

  function renderMemoryDiffSummary(memory, otherMemory, hashes, otherHashes) {
    const changed = stableJson(stripEmpty(memory)) !== stableJson(stripEmpty(otherMemory || {}));
    const hash = findMemoryHash(hashes, memory.id);
    const otherHash = findMemoryHash(otherHashes, memory.id);
    return `
      <div class="memory-diff ${changed || hash !== otherHash ? "changed" : ""}">
        ${renderDiffLine("Memory Title", memory.title, otherMemory && otherMemory.title, changed && memory.title !== (otherMemory && otherMemory.title))}
        ${renderDiffLine("Memory Time", memory.time, otherMemory && otherMemory.time, changed && memory.time !== (otherMemory && otherMemory.time))}
        ${renderDiffLine("Memory Place", memory.place, otherMemory && otherMemory.place, changed && memory.place !== (otherMemory && otherMemory.place))}
        ${renderDiffLine("Memory Note", memory.note, otherMemory && otherMemory.note, changed && memory.note !== (otherMemory && otherMemory.note))}
        ${renderDiffLine("Memory Assets", (memory.assets || []).join(", "), otherMemory && (otherMemory.assets || []).join(", "), stableJson(memory.assets || []) !== stableJson(otherMemory && otherMemory.assets || []))}
        ${renderDiffHash("memoryStateHash", hash, otherHash)}
      </div>
    `;
  }

  function markerEvidenceLabel(marker) {
    const evidence = marker && (markerEvidence(marker));
    if (!evidence) return "";
    if (typeof evidence === "string") return evidence;
    if (evidence.value) return evidence.value;
    if (evidence.name || evidence.path) return evidence.name || evidence.path;
    return "";
  }

  function findMemoryHash(hashes, memoryId) {
    const item = hashes && (hashes.memoryStateHashes || []).find((entry) => entry.memory === memoryId);
    return item && item.memoryStateHash || "";
  }

  function libraryMissingAssets(record) {
    const manifest = record && record.manifest || {};
    const zip = record && (record.zip || record.latestPackageBytes);
    const missing = [];
    if (zip) {
      return missing;
    }
    for (const asset of manifest.assets || []) {
      if (!asset.path || asset.url || asset.external) continue;
      missing.push({ path: asset.path, name: asset.name || asset.path });
    }
    for (const marker of manifest.objectMarkers || []) {
      const evidence = markerEvidence(marker);
      if (evidence && evidence.path) missing.push({ path: evidence.path, name: evidence.name || evidence.path });
    }
    const seen = new Set();
    return missing.filter((item) => {
      if (seen.has(item.path)) return false;
      seen.add(item.path);
      return true;
    });
  }

  function buildReaderWorkspace(manifest) {
    const readerEditing = state.readerEditing;
    const objectUnlocked = state.readerUnlocks.object;
    const collectionUnlocked = state.readerUnlocks.collection;
    const markersUnlocked = state.readerUnlocks.markers;
    const memoriesUnlocked = state.readerUnlocks.memories;
    const changes = describeReaderChanges();
    return `
      <section class="edit-section object-section ${objectUnlocked ? "unlocked" : "locked"}">
        <div class="section-copy">
          <h2>${readerEditing ? "Object & Collection" : "Object"}</h2>
          <code class="identity-line">${escapeHtml(manifest.object.id || "object.id")}</code>
          ${buildReaderField("Object Title", "object", "title", manifest.object.title || "", objectUnlocked)}
          ${buildReaderField("Object Description (optional)", "object", "description", manifest.object.description || "", objectUnlocked)}
          ${readerEditing ? '<p class="scope-warning">Object changes are saved only to this file when exported.<br>Other local files with the same object.id may need re-export to stay consistent.</p>' : ""}
          ${readerEditing ? `<div class="object-draft-warning-slot">${renderSharedObjectDraftWarning(changes)}</div>` : ""}
        </div>
        ${readerEditing ? `<button class="reader-scope-button" type="button" data-unlock-scope="object">${objectUnlocked ? "Editing Object Info" : "Edit Object Info"}</button>` : ""}
      </section>

      <section class="edit-section marker-section ${markersUnlocked ? "unlocked" : "locked"}">
        <div>
          <h2>Object Markers</h2>
          <div class="marker-grid reader-marker-grid">${renderMarkerCards(manifest.objectMarkers || [])}</div>
          ${markersUnlocked ? renderMarkerAddSlot(manifest) : ""}
          ${readerEditing ? `<div class="marker-draft-warning-slot">${renderSharedMarkerDraftWarning(changes)}</div>` : ""}
        </div>
        ${readerEditing ? `<div class="reader-mini-actions">
          <button class="reader-scope-button" type="button" data-unlock-scope="markers">${markersUnlocked ? "Editing Marker Info" : "Edit Marker Info"}</button>
          <button class="circle-action" type="button" data-reader-action="add-marker" ${markersUnlocked ? "" : "disabled"} aria-label="Add marker">+</button>
          <button class="circle-action" type="button" data-reader-action="remove-marker" ${markersUnlocked ? "" : "disabled"} aria-label="Remove marker">−</button>
        </div>` : ""}
      </section>

      <section class="edit-section collection-section ${collectionUnlocked ? "unlocked" : "locked"}">
        <div class="section-copy">
          <h2>Collection</h2>
          <code class="identity-line">${escapeHtml(manifest.olml.id || "olml.id")}</code>
          ${buildReaderField("Collection Title", "collection", "title", manifest.olml.title || "", collectionUnlocked)}
          ${buildReaderField("Collection Description", "collection", "note", manifest.olml.note || "", collectionUnlocked)}
        </div>
        ${readerEditing ? `<button class="reader-scope-button" type="button" data-unlock-scope="collection">${collectionUnlocked ? "Editing Collection Info" : "Edit Collection Info"}</button>` : ""}
      </section>

      <section class="edit-section memory-section ${memoriesUnlocked ? "unlocked" : "locked"}">
        <div class="memory-header">
          <h2>Memory</h2>
          ${readerEditing ? `<div class="reader-mini-actions memory-scope-action">
            <button class="reader-scope-button" type="button" data-unlock-scope="memories">${memoriesUnlocked ? "Editing Memories" : "Edit Memories"}</button>
            <button class="circle-action" type="button" data-reader-action="add-memory" aria-label="Add memory">+</button>
            <button class="circle-action" type="button" data-reader-action="remove-memory" ${(manifest.memories || []).length > 1 ? "" : "disabled"} aria-label="Remove memory">−</button>
          </div>` : ""}
        </div>
        <div class="memory-list">
          ${(manifest.memories || []).map((memory, index) => renderReaderMemory(memory, index, memoriesUnlocked)).join("") || '<p class="small-muted">No memories found.</p>'}
        </div>
      </section>

      <section class="reader-actions-panel">
        ${readerEditing
          ? `<button class="primary-action compact reader-save-export" type="button" data-reader-action="save-export" ${isExportReady(manifest) ? "" : "disabled"}>${state.detachedFromLibrary ? "Export Without Updating Library" : "Save & Export Current Collection"}</button>
            <button type="button" data-reader-action="discard">Discard Changes</button>
            <p class="action-note">Exports the currently open collection only. Export generated means the browser downloaded a new snapshot; the original disk file is not overwritten.</p>
            <div class="reader-status">${renderReaderChangeStatus(changes)}</div>`
          : `<button class="primary-action compact" type="button" data-reader-action="edit-file">Edit File</button>
            <button class="primary-action compact back-action" type="button" data-reader-action="back-home">Back</button>
            <p class="action-note reader-preview-warning">Saved edited files would store changes in library, but the revise needs export & save to take effect.</p>`}
      </section>
    `;
  }

  function renderSharedObjectDraftWarning(changes) {
    if (state.detachedFromLibrary) return "";
    if (!state.sharedObjectSiblingCount || !(changes.objectChanged || changes.markersChanged)) return "";
    return '<p class="object-update-warning">Object info updated, other files on the same object needs a re-export after this one saved.</p>';
  }

  function renderWriterObjectWarnings() {
    const changes = describeWriterObjectChanges();
    const sharedObjectDraft = Boolean(state.sharedObjectSiblingCount || state.preserveObjectId);
    const objectMessage = sharedObjectDraft && changes.objectChanged
      ? '<p class="object-update-warning">Object info updated, other files on the same object needs a re-export after this one saved.</p>'
      : "";
    const markerMessage = sharedObjectDraft && changes.markersChanged
      ? '<p class="object-update-warning">Object marker updated, other files on the same object needs a re-export after this one saved.</p>'
      : "";
    if (els.writerObjectWarning) els.writerObjectWarning.innerHTML = objectMessage;
    if (els.writerMarkerWarning) els.writerMarkerWarning.innerHTML = markerMessage;
  }

  function describeWriterObjectChanges() {
    const baseline = state.readerBaseline && state.readerBaseline.manifest || {};
    const beforeObject = baseline.object || {};
    const currentObject = {
      id: els.objectId && els.objectId.value || state.manifest && state.manifest.object && state.manifest.object.id || "",
      title: els.objectTitle && els.objectTitle.value.trim() || "",
      description: els.objectDescription && els.objectDescription.value.trim() || ""
    };
    const beforeObjectMarkers = baseline.objectMarkers || [];
    const currentObjectMarkers = state.manifest && Array.isArray(state.manifest.objectMarkers) ? state.manifest.objectMarkers : [];
    return {
      objectChanged: stableJson(stripEmpty(beforeObject)) !== stableJson(stripEmpty(currentObject)),
      markersChanged: stableJson(stripEmpty(beforeObjectMarkers)) !== stableJson(stripEmpty(currentObjectMarkers))
        || stableJson(state.readerBaseline && state.readerBaseline.markerEvidenceFiles || {}) !== stableJson(assetFingerprintMap(state.markerEvidenceFiles))
    };
  }

  function renderSharedMarkerDraftWarning(changes) {
    if (state.detachedFromLibrary) return "";
    if (!changes.markersChanged) return "";
    return '<p class="object-update-warning">Object marker updated, other files on the same object needs a re-export after this one saved.</p>';
  }

  function buildReaderField(label, scope, field, value, unlocked) {
    const id = `reader-${scope}-${field}`;
    const readonly = unlocked ? "" : "readonly";
    return `
      <label class="inline-reader-field" for="${id}">
        <span>${escapeHtml(label)} :</span>
        <input id="${id}" data-reader-scope="${scope}" data-reader-field="${field}" type="text" value="${escapeHtml(value)}" ${readonly}>
      </label>
    `;
  }

  function renderMarkerCards(markers) {
    if (!markers.length) return '<p class="small-muted">No object markers.</p>';
    return markers.map((marker, index) => `
      <button class="marker-box marker-card-button selectable-card ${state.selectedMarkerDeletes.has(index) ? "selected-delete" : ""}" type="button" data-reader-action="edit-marker" data-marker-index="${index}" ${state.readerUnlocks.markers ? "" : "disabled"}>
        ${state.readerUnlocks.markers ? '<span class="selection-indicator" aria-hidden="true"></span>' : ""}
        ${renderMarkerCardInner(marker)}
        ${state.readerUnlocks.markers ? `<small>${escapeHtml(markerLabel(markerType(marker)))}</small>` : ""}
      </button>
    `).join("");
  }

  function renderMarkerCardInner(marker) {
    const evidence = markerEvidence(marker);
    if (evidence && evidence.type === "generated-qr") return renderGeneratedQrMarkup(evidence.value || marker.object || "");
    if (evidence && evidence.path && state.markerEvidenceFiles.has(evidence.path)) {
      const file = state.markerEvidenceFiles.get(evidence.path);
      let url = state.assetUrls.get(file.path);
      if (!url) {
        url = URL.createObjectURL(new Blob([file.buffer], { type: file.type || guessMediaType(file.path) }));
        state.assetUrls.set(file.path, url);
      }
      return `<img src="${url}" alt="${escapeHtml(evidence.name || markerType(marker) || "marker")}">`;
    }
    if (evidence && typeof evidence === "object" && String(evidence.value || "").trim()) {
      return `<span class="marker-text-value">${escapeHtml(evidence.value)}</span>`;
    }
    if (typeof evidence === "string" && evidence.trim()) {
      return `<span class="marker-text-value">${escapeHtml(evidence)}</span>`;
    }
    const legacyValue = marker && (marker.value || marker.signature || marker.payload || marker.text || marker.label);
    if (legacyValue) return `<span class="marker-text-value">${escapeHtml(legacyValue)}</span>`;
    return escapeHtml(markerLabel(markerType(marker)));
  }

  function renderGeneratedQrMarkup(value) {
    const payload = String(value || "");
    const qr = generateQrMatrix(payload);
    if (!qr) return `<span class="generated-qr fallback-qr" title="${escapeHtml(payload)}">QR payload too long</span>`;
    const modules = [];
    for (let row = 0; row < qr.size; row += 1) {
      for (let col = 0; col < qr.size; col += 1) {
        if (qr.modules[row][col]) modules.push(`<rect x="${col + 4}" y="${row + 4}" width="1" height="1"></rect>`);
      }
    }
    const viewBox = `0 0 ${qr.size + 8} ${qr.size + 8}`;
    return `
      <svg class="generated-qr" viewBox="${viewBox}" role="img" aria-label="QR code for object.id" data-qr-payload="${escapeHtml(payload)}" shape-rendering="crispEdges">
        <rect class="qr-bg" width="${qr.size + 8}" height="${qr.size + 8}"></rect>
        <g class="qr-fg">${modules.join("")}</g>
      </svg>
    `;
  }

  function renderMarkerAddSlot(manifest) {
    if (!state.markerAddDraft) return "";
    const type = state.markerAddDraft.type || "qr";
    return `
      <section class="inline-add-panel marker-add-panel">
        <div>
          <h3>New Object Marker</h3>
          <label>Marker Type</label>
          <select data-marker-draft-field="type">
            <option value="qr" ${type === "qr" ? "selected" : ""}>QR</option>
            <option value="nfc" ${type === "nfc" ? "selected" : ""}>NFC</option>
            <option value="image-reference" ${type === "image-reference" ? "selected" : ""}>AR Image Ref</option>
            <option value="text-marker" ${type === "text-marker" ? "selected" : ""}>OCR Text Marker</option>
          </select>
        </div>
        <div>
          <h3>Marker Evidence</h3>
          ${renderMarkerDraftSpecific(type, manifest.object.id)}
          <p class="object-id-note">object.id ${escapeHtml(manifest.object.id || "")}</p>
        </div>
        <div class="inline-add-actions">
          <button type="button" data-reader-action="confirm-marker-add">Add Marker</button>
          <button type="button" data-reader-action="cancel-marker-add">Cancel</button>
        </div>
      </section>
    `;
  }

  function renderMarkerDraftSpecific(type, objectId) {
    if (type === "qr") {
      return `
        <div class="generated-marker-preview">
          ${renderGeneratedQrMarkup(objectId)}
          <span>QR Marker Generated From object.id</span>
        </div>
        <p class="marker-qr-hint">Please save the QR code image and attach to the object.</p>
      `;
    }
    if (type === "image-reference") {
      const file = state.markerAddDraft && state.markerAddDraft.filePath && state.markerEvidenceFiles.get(state.markerAddDraft.filePath);
      const preview = file ? renderMarkerEvidenceImage(file.path, file.name) : "";
      return `
        <button class="evidence-file-drop-zone compact-drop" type="button" data-reader-action="choose-marker-image">
          <strong>${file ? "Replace AR Reference Image" : "Upload AR Reference Image"}</strong>
          <span>${file ? escapeHtml(file.name) : "Please choose the reference image of the object itself."}</span>
        </button>
        ${preview || '<p class="small-muted">No AR reference image selected.</p>'}
      `;
    }
    if (type === "nfc") {
      return `<input data-marker-draft-field="value" type="text" placeholder="NFC NDEF value">`;
    }
    return `<input data-marker-draft-field="value" type="text" placeholder="Exact OCR text marker">`;
  }

  function renderReaderMemory(memory, index, unlocked) {
    const assetCards = renderReaderMemoryAssets(memory, index, unlocked);
    const canRemoveMemory = index > 0 && state.manifest && Array.isArray(state.manifest.memories) && state.manifest.memories.length > 1;
    return `
      <article class="reader-memory-row">
        <div class="reader-memory-fields">
          <code class="identity-line">${escapeHtml(memory.id || `memory.id${index + 1}`)}</code>
          ${buildReaderMemoryField(index, "Memory Title", "title", memory.title || "", unlocked)}
          ${buildReaderMemoryField(index, "Memory Time", "time", memory.time || "", unlocked)}
          ${buildReaderMemoryField(index, "Memory Place", "place", memory.place || "", unlocked)}
          ${buildReaderMemoryField(index, "Memory Note", "note", memory.note || "", unlocked)}
        </div>
        <div class="reader-memory-assets">
          <h3>Memory Assets</h3>
          ${assetCards}
          ${unlocked ? `<button class="asset-remove-action" type="button" data-reader-action="remove-asset" data-memory-index="${index}">Remove Assets</button>` : ""}
          ${unlocked ? renderAssetAddPanel(index) : ""}
        </div>
        ${unlocked && canRemoveMemory ? `<button class="circle-action memory-row-remove" type="button" data-reader-action="remove-memory" data-memory-index="${index}" aria-label="Remove this memory">−</button>` : ""}
      </article>
    `;
  }

  function buildReaderMemoryField(index, label, field, value, unlocked) {
    const id = `reader-memory-${index}-${field}`;
    const readonly = unlocked ? "" : "readonly";
    return `
      <label class="inline-reader-field" for="${id}">
        <span>${escapeHtml(label)} :</span>
        <input id="${id}" data-reader-scope="memory" data-memory-index="${index}" data-reader-field="${field}" type="text" value="${escapeHtml(value)}" ${readonly}>
      </label>
    `;
  }

  function renderReaderMemoryAssets(memory, memoryIndex, unlocked) {
    const memoryAssets = (memory.assets || []).map((path) => state.assets.get(path)).filter(Boolean);
    if (!memoryAssets.length) return '<p class="small-muted">No memory assets.</p>';
    return `<div class="reader-asset-grid">${memoryAssets.map((asset) => `
      <button class="asset-preview-card selectable-card ${asset.external || asset.url ? "online-asset-card" : ""} ${state.selectedAssetDeletes.has(asset.path) ? "selected-delete" : ""}" type="button" data-reader-action="${unlocked ? "replace-asset" : "preview-asset"}" data-memory-index="${memoryIndex}" data-asset-path="${escapeHtml(asset.path)}">
        ${unlocked ? '<span class="selection-indicator" aria-hidden="true"></span>' : ""}
        ${renderAssetPreviewMarkup(asset)}
      </button>
    `).join("")}</div>`;
  }

  function renderAssetAddPanel(memoryIndex) {
    return `
      <section class="inline-add-panel asset-add-panel">
        <button class="asset-drop-zone edit-asset-drop" type="button" data-reader-action="choose-reader-files" data-memory-index="${memoryIndex}">
          <strong>Drag Files Here Or Click To Add</strong>
          <span>Images, Video, Audio, Documents, Models, URL Notes, Or Other Files.</span>
        </button>
        <label class="url-entry-row">
          <input data-reader-asset-url="${memoryIndex}" type="url" placeholder="Download URL">
          <button type="button" data-reader-action="add-reader-url" data-memory-index="${memoryIndex}">Add URL</button>
        </label>
        <p class="asset-empty-note">${renderMemoryAssetStatus(memoryIndex)}</p>
      </section>
    `;
  }

  function renderMemoryAssetStatus(memoryIndex) {
    const memory = state.manifest && state.manifest.memories && state.manifest.memories[memoryIndex];
    const count = memory && Array.isArray(memory.assets) ? memory.assets.length : 0;
    return count ? `${count} attached file${count === 1 ? "" : "s"}. Select assets above, then remove assets if needed.` : "No attached files. Text-only memory is valid.";
  }

  function addMemoryToCurrentCollection() {
    if (!state.manifest) return;
    const objectId = state.manifest.object.id;
    const memoryId = makeId("Memory", "memory");
    state.manifest.memories = Array.isArray(state.manifest.memories) ? state.manifest.memories : [];
    state.manifest.memories.push({ id: memoryId, title: "", time: "", place: "", note: "", assets: [] });
    state.manifest.links = Array.isArray(state.manifest.links) ? state.manifest.links : [];
    state.manifest.links.push({ object: objectId, memory: memoryId });
    validateAndRender(false);
    renderReader();
  }

  function removeMemoryFromCurrentCollection(index) {
    if (!state.manifest || !Array.isArray(state.manifest.memories)) return;
    if (state.manifest.memories.length <= 1) {
      setValidation([{ level: "error", message: "Cannot remove the final Memory. Add another Memory first or remove the Collection." }], true);
      return;
    }
    const memory = state.manifest.memories[index];
    if (!memory) return;
    if (!window.confirm("Remove this Memory from the current Collection? Disk files are unaffected.")) return;
    state.manifest.memories.splice(index, 1);
    state.manifest.links = (state.manifest.links || []).filter((link) => link.memory !== memory.id);
    for (const path of memory.assets || []) {
      const stillUsed = state.manifest.memories.some((item) => (item.assets || []).includes(path));
      if (!stillUsed) state.assets.delete(path);
    }
    syncManifestAssetRecords();
    validateAndRender(false);
    renderReader();
    setValidation([{ level: "info", message: `Memory ${shortIdentity(memory.id)} removed from this Collection only. Save & Export to persist the membership change.` }], true);
  }

  function renderAssetPreviewMarkup(asset) {
    if (asset.external || asset.url) {
      const label = asset.url || asset.name || asset.path || "Online asset";
      return `<span>Online Asset</span><small>${escapeHtml(label)}</small>${asset.type ? `<small>${escapeHtml(asset.type)}</small>` : ""}`;
    }
    const type = asset.type || guessMediaType(asset.path);
    let url = state.assetUrls.get(asset.path);
    if (!url) {
      url = URL.createObjectURL(new Blob([asset.buffer], { type }));
      state.assetUrls.set(asset.path, url);
    }
    if (type.startsWith("image/")) return `<img src="${url}" alt="${escapeHtml(asset.name || asset.path)}">`;
    if (type.startsWith("video/")) return `<video src="${url}" muted></video>`;
    return `<span>${escapeHtml(titleCaseWords(type.split("/")[0] || "File"))}</span><small>${escapeHtml(asset.name || asset.path)}</small>`;
  }

  function renderAssetPreviewOverlay() {
    const asset = state.assetPreviewPath && state.assets.get(state.assetPreviewPath);
    if (!asset) return "";
    if (asset.external || asset.url) {
      return `
        <div class="asset-preview-overlay" role="dialog" aria-modal="true" aria-label="Online asset preview">
          <div class="asset-preview-modal">
            <button class="asset-preview-close" type="button" data-reader-action="close-asset-preview" aria-label="Close preview">×</button>
            <h3>Online Asset</h3>
            <a href="${escapeHtml(asset.url || "")}" target="_blank" rel="noreferrer">${escapeHtml(asset.url || asset.name || asset.path || "")}</a>
            ${asset.type ? `<p class="small-muted">${escapeHtml(asset.type)}</p>` : ""}
          </div>
        </div>
      `;
    }
    const type = asset.type || guessMediaType(asset.path);
    let url = state.assetUrls.get(asset.path);
    if (!url) {
      url = URL.createObjectURL(new Blob([asset.buffer], { type }));
      state.assetUrls.set(asset.path, url);
    }
    const content = type.startsWith("image/")
      ? `<img src="${url}" alt="${escapeHtml(asset.name || asset.path)}">`
      : type.startsWith("video/")
        ? `<video src="${url}" controls autoplay></video>`
        : `<p>${escapeHtml(asset.name || asset.path)}</p><p class="small-muted">${escapeHtml(type)}</p>`;
    return `
      <div class="asset-preview-overlay" role="dialog" aria-modal="true" aria-label="Memory asset preview">
        <div class="asset-preview-modal">
          <button class="asset-preview-close" type="button" data-reader-action="close-asset-preview" aria-label="Close preview">×</button>
          ${content}
        </div>
      </div>
    `;
  }

  function createAssetPreview(path) {
    const asset = state.assets.get(path);
    if (!asset) return null;
    if (asset.external || asset.url) {
      const link = document.createElement("a");
      link.href = asset.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Open URL";
      return link;
    }
    let url = state.assetUrls.get(path);
    if (!url) {
      url = URL.createObjectURL(new Blob([asset.buffer], { type: asset.type || guessMediaType(path) }));
      state.assetUrls.set(path, url);
    }
    const type = asset.type || guessMediaType(path);
    if (type.startsWith("image/")) {
      const img = document.createElement("img");
      img.className = "media-preview";
      img.src = url;
      img.alt = asset.name || path;
      return img;
    }
    if (type.startsWith("video/")) {
      const video = document.createElement("video");
      video.className = "media-preview";
      video.src = url;
      video.controls = true;
      return video;
    }
    if (type.startsWith("audio/")) {
      const audio = document.createElement("audio");
      audio.src = url;
      audio.controls = true;
      return audio;
    }
    return null;
  }

  function createPreviewBox(asset, fallbackLabel) {
    const box = document.createElement("div");
    box.className = "preview-box";
    const preview = createAssetListPreview(asset);
    if (preview.querySelector("img, video")) {
      box.append(...Array.from(preview.childNodes));
    } else {
      box.textContent = asset.name || fallbackLabel;
    }
    return box;
  }

  function createMarkerBox(marker) {
    const box = document.createElement("div");
    box.className = "marker-box";
    const evidence = markerEvidence(marker);
    if (evidence && evidence.path && state.markerEvidenceFiles.has(evidence.path)) {
      const file = state.markerEvidenceFiles.get(evidence.path);
      let url = state.assetUrls.get(file.path);
      if (!url) {
        url = URL.createObjectURL(new Blob([file.buffer], { type: file.type || guessMediaType(file.path) }));
        state.assetUrls.set(file.path, url);
      }
      const img = document.createElement("img");
      img.src = url;
      img.alt = evidence.name || markerType(marker) || "marker";
      box.appendChild(img);
      return box;
    }
    if (evidence && typeof evidence === "object" && String(evidence.value || "").trim()) {
      box.textContent = evidence.value;
      return box;
    }
    if (typeof evidence === "string" && evidence.trim()) {
      box.textContent = evidence;
      return box;
    }
    const legacyValue = marker && (marker.value || marker.signature || marker.payload || marker.text || marker.label);
    if (legacyValue) {
      box.textContent = legacyValue;
      return box;
    }
    const labels = {
      qr: "QR Code",
      nfc: "NFC Tag",
      "image-reference": "AR Reference Image",
      "text-marker": "OCR Text Marker"
    };
    box.textContent = labels[markerType(marker)] || "Marker";
    return box;
  }

  function startAddMemory() {
    if (!state.manifest) return;
    captureEditSnapshot();
    state.editorPurpose = "add-memory";
    state.editingMemoryIndex = (state.manifest.memories || []).length;
    state.editingAssetPaths = new Set();
    els.memoryId.value = makeId("Memory", "memory");
    els.memoryTitle.value = "";
    els.memoryTime.value = "";
    els.memoryPlace.value = "";
    els.memoryNote.value = "";
    configureEditorForPurpose("add-memory");
    showMode("editor");
  }

  function startEditMemory(index) {
    if (!state.manifest) return;
    captureEditSnapshot();
    state.editorPurpose = "edit-memory";
    state.editingMemoryIndex = Math.max(0, index || 0);
    populateFormFromManifest();
    configureEditorForPurpose("edit-memory");
    showMode("editor");
  }

  function configureEditorForPurpose(purpose) {
    state.editorPurpose = purpose;
    els.packageForm.classList.toggle("memory-only", purpose === "add-memory" || purpose === "edit-memory");
    els.objectTitle.readOnly = purpose === "add-memory" || purpose === "edit-memory";
    els.objectDescription.readOnly = purpose === "add-memory" || purpose === "edit-memory";
    els.collectionTitle.readOnly = purpose === "add-memory" || purpose === "edit-memory";
    els.collectionDescription.readOnly = purpose === "add-memory" || purpose === "edit-memory";
    if (purpose === "add-memory") {
      els.saveButton.textContent = "Save New Memory";
      els.discardButton.textContent = "Discard";
    } else if (purpose === "edit-memory") {
      els.saveButton.textContent = "Save Changes";
      els.discardButton.textContent = "Discard Changes";
    } else {
      els.saveButton.textContent = "Save & Export Current Collection";
      els.discardButton.textContent = "Discard";
    }
  }

  function captureEditSnapshot() {
    state.editSnapshot = {
      manifest: structuredClone(state.manifest),
      assets: new Map(state.assets),
      markerEvidenceFiles: new Map(state.markerEvidenceFiles),
      editingAssetPaths: new Set(state.editingAssetPaths),
      editingMemoryIndex: state.editingMemoryIndex
    };
  }

  async function saveCurrentToLibrary(options = {}) {
    await saveAndExportCurrentCollection(options);
  }

  async function addReadFileToLibrary(file, buffer, manifest, semanticState, sourceHash) {
    if (!manifest || !manifest.olml || !manifest.olml.id) return;
    const existing = await getPackageRecord(manifest.olml.id);
    if (existing) {
      await repairFileLogAfterRead(existing, file, buffer, manifest, semanticState, sourceHash);
      return;
    }
    const now = new Date().toISOString();
    const record = buildPackageRecord({
      olmlId: manifest.olml.id,
      objectId: manifest.object && manifest.object.id || "",
      title: manifest.object && manifest.object.title || manifest.olml.title || file.name || "Untitled OLML",
      manifest: structuredClone(stripEmpty(manifest)),
      objectProfile: structuredClone(manifest.object || {}),
      objectMarkers: structuredClone(manifest.objectMarkers || []),
      zip: new Uint8Array(buffer),
      sourceName: file.name,
      sourceHash,
      zipSha256: sourceHash,
      hashProfile: HASH_PROFILE,
      objectStateHash: semanticState.objectStateHash,
      memoryStateHashes: semanticState.memoryStateHashes,
      collectionStateHash: semanticState.collectionStateHash,
      packageStateHash: semanticState.packageStateHash,
      parentPackageStateHash: semanticState.parentPackageStateHash || "",
      lastPortableCollectionStateHash: "",
      lastPortablePackageStateHash: "",
      exportStatus: "read",
      needsExportReasons: ["File was read into Library but not accepted or re-exported."],
      savedAt: now,
      readAt: now
    });
    await putPackageRecord(record);
    await putActionRecord({
      id: `action:${crypto.randomUUID()}`,
      type: "file-read",
      at: now,
      affectedIds: {
        olmlId: manifest.olml.id,
        objectId: manifest.object && manifest.object.id || "",
        memoryIds: (manifest.memories || []).map((memory) => memory.id)
      },
      previousHashes: {},
      resultingHashes: semanticState,
      changedScopes: ["Library"],
      changedFields: [],
      assetSummary: summarizeAssets(state.assets)
    });
    await refreshLibraryPanelOnly();
  }

  async function repairFileLogAfterRead(existing, file, buffer, manifest, semanticState, sourceHash) {
    const incomingMarkers = manifest.objectMarkers || [];
    const hasIncomingMarkers = incomingMarkers.length > 0;
    const existingMarkers = existing.objectMarkers || existing.manifest && existing.manifest.objectMarkers || [];
    const missingMarkers = hasIncomingMarkers && existingMarkers.length === 0;
    const missingManifest = !existing.manifest || !existing.manifest.olml || !existing.manifest.object;
    const missingObjectHash = !existing.objectStateHash && semanticState && semanticState.objectStateHash;
    const missingCollectionHash = !existing.collectionStateHash && semanticState && semanticState.collectionStateHash;
    const missingPackageHash = !existing.packageStateHash && semanticState && semanticState.packageStateHash;
    const missingMemoryHashes = (!Array.isArray(existing.memoryStateHashes) || existing.memoryStateHashes.length === 0) && semanticState && semanticState.memoryStateHashes && semanticState.memoryStateHashes.length;
    const missingPackageBytes = !existing.zip;
    if (!missingMarkers && !missingManifest && !missingObjectHash && !missingCollectionHash && !missingPackageHash && !missingMemoryHashes && !missingPackageBytes) return;
    const nextManifest = structuredClone(missingManifest ? manifest : existing.manifest);
    if (missingMarkers) nextManifest.objectMarkers = structuredClone(incomingMarkers);
    const now = new Date().toISOString();
    await putPackageRecord(buildPackageRecord({
      ...existing,
      manifest: nextManifest,
      objectId: existing.objectId || manifest.object && manifest.object.id || "",
      title: existing.title || manifest.object && manifest.object.title || manifest.olml && manifest.olml.title || file.name || "Untitled OLML",
      objectProfile: existing.objectProfile && Object.keys(existing.objectProfile).length ? existing.objectProfile : structuredClone(manifest.object || {}),
      objectMarkers: missingMarkers ? structuredClone(incomingMarkers) : existing.objectMarkers,
      collectionProfile: existing.collectionProfile && Object.keys(existing.collectionProfile).length ? existing.collectionProfile : structuredClone(manifest.olml || {}),
      memoryProfiles: existing.memoryProfiles && existing.memoryProfiles.length ? existing.memoryProfiles : structuredClone(manifest.memories || []),
      linkProfiles: existing.linkProfiles && existing.linkProfiles.length ? existing.linkProfiles : structuredClone(manifest.links || []),
      zip: existing.zip || new Uint8Array(buffer),
      sourceName: existing.sourceName || file.name,
      sourceHash: existing.sourceHash || sourceHash,
      zipSha256: existing.zipSha256 || sourceHash,
      objectStateHash: existing.objectStateHash || semanticState.objectStateHash,
      memoryStateHashes: existing.memoryStateHashes && existing.memoryStateHashes.length ? existing.memoryStateHashes : semanticState.memoryStateHashes,
      collectionStateHash: existing.collectionStateHash || semanticState.collectionStateHash,
      packageStateHash: existing.packageStateHash || semanticState.packageStateHash,
      parentPackageStateHash: existing.parentPackageStateHash || semanticState.parentPackageStateHash || "",
      hashProfile: existing.hashProfile || HASH_PROFILE,
      readAt: existing.readAt || now,
      savedAt: existing.savedAt || now,
      exportStatus: existing.exportStatus && existing.exportStatus !== "catalog-only" ? existing.exportStatus : "read",
      libraryUpdatedAt: now
    }));
    await putActionRecord({
      id: `action:${crypto.randomUUID()}`,
      type: "file-log-repaired",
      at: now,
      affectedIds: {
        olmlId: manifest.olml.id,
        objectId: manifest.object && manifest.object.id || "",
        memoryIds: (manifest.memories || []).map((memory) => memory.id)
      },
      previousHashes: semanticHashSummary(existing) || {},
      resultingHashes: semanticState,
      changedScopes: missingPackageBytes || missingManifest ? ["Library"] : ["Object", "Marker", "Collection", "Memory"],
      changedFields: [
        ...(missingManifest ? ["manifest"] : []),
        ...(missingMarkers ? ["objectMarkers"] : []),
        ...(missingObjectHash ? ["objectStateHash"] : []),
        ...(missingCollectionHash ? ["collectionStateHash"] : []),
        ...(missingPackageHash ? ["packageStateHash"] : []),
        ...(missingMemoryHashes ? ["memoryStateHashes"] : []),
        ...(missingPackageBytes ? ["zip"] : [])
      ],
      assetSummary: []
    });
    await refreshLibraryPanelOnly();
  }

  function buildPackageRecord(record) {
    const manifest = record.manifest || {};
    return {
      ...record,
      objectId: record.objectId || manifest.object && manifest.object.id || "",
      objectProfile: structuredClone(record.objectProfile || manifest.object || {}),
      objectMarkers: structuredClone(record.objectMarkers || manifest.objectMarkers || []),
      collectionProfile: {
        id: manifest.olml && manifest.olml.id || record.olmlId,
        title: manifest.olml && manifest.olml.title || "",
        note: manifest.olml && manifest.olml.note || ""
      },
      memoryProfiles: structuredClone(manifest.memories || []),
      linkProfiles: (manifest.links || []).map((link) => ({ object: link.object, memory: link.memory })),
      markers: record.markers || deriveMarkerIndex(manifest),
      hashProfile: record.hashProfile || HASH_PROFILE,
      packageStateHash: record.packageStateHash || record.collectionStateHash || "",
      parentPackageStateHash: record.parentPackageStateHash || "",
      lastPortablePackageStateHash: record.lastPortablePackageStateHash || record.lastPortableCollectionStateHash || "",
      exportStatus: record.exportStatus || "needs-export",
      needsExportReasons: record.needsExportReasons || []
    };
  }

  async function computeSemanticStateForManifest(manifest, parentPackageStateHash) {
    return window.OLMLState.computeSemanticState(
      stripEmpty(manifest),
      bytesMapFromAssets(state.assets),
      bytesMapFromAssets(state.markerEvidenceFiles),
      parentPackageStateHash
    );
  }

  function bytesMapFromAssets(map) {
    const out = new Map();
    for (const [path, item] of map.entries()) {
      if (!item || item.external || !item.buffer) continue;
      out.set(path, item.buffer instanceof Uint8Array ? item.buffer : new Uint8Array(item.buffer));
    }
    return out;
  }

  async function parentHashForCollection(olmlId, candidatePackageStateHash) {
    const existing = await getPackageRecord(olmlId);
    const previous = existing && (existing.lastPortablePackageStateHash || existing.packageStateHash || existing.lastPortableCollectionStateHash || existing.collectionStateHash);
    if (previous && previous !== candidatePackageStateHash) return previous;
    return "";
  }

  function summarizeAssets(map) {
    return Array.from(map.values()).map((asset) => ({
      name: asset.name || asset.path,
      mediaType: asset.type || meaningfulMediaType(asset.path || asset.name || ""),
      size: asset.size || 0,
      external: Boolean(asset.external || asset.url)
    }));
  }

  function summarizeChangedScopes(changes) {
    const scopes = new Set();
    if (!changes) return [];
    if (changes.objectChanged) scopes.add("Object");
    if (changes.markersChanged) scopes.add("Marker");
    if (changes.collectionChanged) scopes.add("Collection");
    if ((changes.changedMemories || []).length) scopes.add("Memory");
    if (changes.addedAssetCount || changes.removedAssetCount || changes.replacedAssetCount) scopes.add("Asset");
    return Array.from(scopes);
  }

  function changedFieldNamesFromChanges(changes) {
    const fields = [];
    if (!changes) return fields;
    if (changes.objectChanged) fields.push("object.title", "object.description");
    if (changes.markersChanged) fields.push("objectMarkers");
    if (changes.collectionChanged) fields.push("olml.title", "olml.note");
    for (const memoryId of changes.changedMemories || []) fields.push(`memory:${memoryId}`);
    if (changes.addedAssetCount) fields.push("assets.added");
    if (changes.removedAssetCount) fields.push("assets.removed");
    if (changes.replacedAssetCount) fields.push("assets.replaced");
    return fields;
  }

  async function handleEditorSave() {
    if (!state.manifest) return;
    updatePreviewFromForm();
    if (state.editorPurpose === "add-memory") {
      recordHistory("added-memory");
      state.editSnapshot = null;
      state.activeTab = "memories";
      showMode("reader");
      setValidation([{ level: "info", message: "New memory is transient until Save & Export succeeds." }], true);
      return;
    }
    if (state.editorPurpose === "edit-memory") {
      recordHistory("edited-memory");
      state.editSnapshot = null;
      state.activeTab = "memories";
      showMode("reader");
      setValidation([{ level: "info", message: "Memory changes are transient until Save & Export succeeds." }], true);
      return;
    }
    await saveAndExportCurrentCollection();
  }

  function discardEditorWork() {
    if (state.editorPurpose === "add-memory" || state.editorPurpose === "edit-memory") {
      restoreEditSnapshot();
      state.activeTab = "memories";
      showMode("reader");
      return;
    }
    state.sourceBytes = null;
    state.activeConflict = null;
    state.structuralReadOnly = false;
    showMode("empty");
  }

  function restoreEditSnapshot() {
    if (!state.editSnapshot) return;
    state.manifest = state.editSnapshot.manifest;
    state.assets = new Map(state.editSnapshot.assets);
    state.markerEvidenceFiles = new Map(state.editSnapshot.markerEvidenceFiles);
    state.editingAssetPaths = new Set(state.editSnapshot.editingAssetPaths);
    state.editingMemoryIndex = state.editSnapshot.editingMemoryIndex;
    state.editSnapshot = null;
  }

  async function exportPackage() {
    return saveAndExportCurrentCollection();
  }

  async function saveAndExportCurrentCollection() {
    if (!state.manifest) return;
    if (state.mode === "editor") updatePreviewFromForm();
    if (state.structuralReadOnly) {
      setValidation([{ level: "error", message: "This package has structural identity errors and is read-only. Missing IDs were not generated." }], true);
      return;
    }
    if (state.activeConflict && (state.activeConflict.blocking || state.activeConflict.decision)) {
      setValidation([{ level: state.activeConflict.blocking ? "error" : "warning", message: `${state.activeConflict.message} Save & Export is blocked. Use Postpone Conflict Reminder if you want a compact reminder, then reopen the source file to continue resolving this conflict.` }], true);
      return;
    }
    const result = validateAndRender(true);
    const errors = result.filter((item) => item.level === "error");
    if (errors.length > 0 || !isExportReady(state.manifest)) {
      setValidation([{ level: "error", message: "Cannot export this collection until required fields and structural errors are fixed." }], true);
      return;
    }
    const changes = describeReaderChanges();
    const manifest = getCurrentManifest();
    const baseSemanticState = await computeSemanticStateForManifest(manifest);
    const parent = await parentHashForCollection(manifest.olml.id, baseSemanticState.packageStateHash);
    const semanticState = parent
      ? await computeSemanticStateForManifest(manifest, parent)
      : baseSemanticState;
    const zip = await buildCurrentZip(semanticState);
    const zipHash = await sha256Digest(zip);
    if (state.detachedFromLibrary) {
      const cleanManifest = window.OLMLState.withIntegrityEnvelope(stripEmpty(manifest), semanticState, zipHash);
      state.manifest = structuredClone(cleanManifest);
      state.candidateSemanticState = semanticState;
      downloadBlob(new Blob([zip], { type: "application/olml+zip" }), defaultExportFilename(manifest));
      state.readerBaseline = captureReaderBaseline();
      state.readerEditing = false;
      state.readerUnlocks = { object: false, collection: false, markers: false, memories: false };
      renderReader();
      showMode("reader");
      setValidation([{ level: "info", message: "Export generated without updating the browser-local Library." }], true);
      return;
    }
    const now = new Date().toISOString();
    const records = await listPackageRecords();
    const siblings = records.filter((record) => record.objectId === manifest.object.id && record.olmlId !== manifest.olml.id);
    const otherNeedsExport = (changes.objectChanged || changes.markersChanged) ? siblings.length : 0;
    const existing = await getPackageRecord(manifest.olml.id);
    const previousHashes = semanticHashSummary(existing);
    const cleanManifest = window.OLMLState.withIntegrityEnvelope(stripEmpty(manifest), semanticState, zipHash);
    const currentRecord = buildPackageRecord({
      ...(existing || {}),
      olmlId: manifest.olml.id,
      objectId: manifest.object.id,
      title: manifest.object.title || manifest.olml.title || "Untitled OLML",
      manifest: structuredClone(cleanManifest),
      objectProfile: structuredClone(manifest.object),
      objectMarkers: structuredClone(manifest.objectMarkers || []),
      zip,
      sha256: zipHash,
      zipSha256: zipHash,
      hashProfile: HASH_PROFILE,
      objectStateHash: semanticState.objectStateHash,
      memoryStateHashes: semanticState.memoryStateHashes,
      collectionStateHash: semanticState.collectionStateHash,
      packageStateHash: semanticState.packageStateHash,
      parentPackageStateHash: semanticState.parentPackageStateHash || "",
      lastPortableCollectionStateHash: semanticState.collectionStateHash,
      lastPortablePackageStateHash: semanticState.packageStateHash,
      revision: manifest.olml.history && manifest.olml.history.revision || 1,
      markers: deriveMarkerIndex(manifest),
      exportStatus: "export-generated",
      needsExportReasons: [],
      lastExportGeneratedAt: now,
      savedAt: now,
      sourceName: state.sourceName,
      sourceHash: state.sourceHash
    });
    const siblingUpdates = siblings.filter(() => changes.objectChanged || changes.markersChanged).map((sibling) => {
      const reasons = new Set(sibling.needsExportReasons || []);
      if (changes.objectChanged) reasons.add("Shared Object Profile updated in Library.");
      if (changes.markersChanged) reasons.add("Object Markers updated in Library.");
      return buildPackageRecord({
        ...sibling,
        exportStatus: "needs-export",
        needsExportReasons: Array.from(reasons),
        libraryUpdatedAt: now
      });
    });
    await commitLibraryTransaction({
      currentRecord,
      siblingUpdates,
      semanticState,
      action: {
        id: `action:${crypto.randomUUID()}`,
        type: "collection-exported",
        at: now,
        affectedIds: {
          olmlId: manifest.olml.id,
          objectId: manifest.object.id,
          memoryIds: (manifest.memories || []).map((memory) => memory.id)
        },
        previousHashes: previousHashes || {},
        resultingHashes: semanticState,
        changedScopes: summarizeChangedScopes(changes),
        changedFields: changedFieldNamesFromChanges(changes),
        assetSummary: summarizeAssets(state.assets)
      }
    });
    if (changes.objectChanged || changes.markersChanged) {
      await persistSiblingObjectHashConflicts(siblings, currentRecord, semanticState, changes);
    }
    state.manifest = structuredClone(cleanManifest);
    state.candidateSemanticState = semanticState;
    downloadBlob(new Blob([zip], { type: "application/olml+zip" }), defaultExportFilename(manifest));
    state.readerBaseline = captureReaderBaseline();
    state.readerEditing = false;
    state.readerUnlocks = { object: false, collection: false, markers: false, memories: false };
    renderReader();
    showMode("reader");
    await refreshLibrary();
    const messages = buildSaveExportMessages(changes, manifest, otherNeedsExport);
    setValidation([{ level: "info", message: messages.join(" ") }], true);
  }

  function canAcceptImportedSnapshot() {
    return Boolean(state.manifest && state.sourceBytes && !state.structuralReadOnly && !(state.activeConflict && state.activeConflict.blocking));
  }

  async function acceptImportedSnapshot() {
    if (!canAcceptImportedSnapshot()) {
      setValidation([{ level: "error", message: "This imported snapshot cannot be accepted until structural or blocking conflict issues are resolved." }], true);
      return;
    }
    const result = validateAndRender(true);
    if (result.some((item) => item.level === "error")) {
      setValidation([{ level: "error", message: "Invalid imports stay read-only and were not written to the Library." }], true);
      return;
    }
    const manifest = getCurrentManifest();
    const semanticState = state.candidateSemanticState || await computeSemanticStateForManifest(manifest);
    const zip = new Uint8Array(state.sourceBytes);
    const zipHash = await sha256Digest(zip);
    const now = new Date().toISOString();
    const verification = window.OLMLState.verifyDeclaredIntegrity(manifest, semanticState);
    const mismatch = verification.status === "mismatch";
    const acceptedManifest = window.OLMLState.withIntegrityEnvelope(stripEmpty(manifest), semanticState);
    const record = buildPackageRecord({
      ...(await getPackageRecord(manifest.olml.id) || {}),
      olmlId: manifest.olml.id,
      objectId: manifest.object.id,
      title: manifest.object.title || manifest.olml.title || "Untitled OLML",
      manifest: structuredClone(acceptedManifest),
      objectProfile: structuredClone(manifest.object),
      objectMarkers: structuredClone(manifest.objectMarkers || []),
      zip,
      sha256: zipHash,
      zipSha256: zipHash,
      hashProfile: HASH_PROFILE,
      objectStateHash: semanticState.objectStateHash,
      memoryStateHashes: semanticState.memoryStateHashes,
      collectionStateHash: semanticState.collectionStateHash,
      packageStateHash: semanticState.packageStateHash,
      parentPackageStateHash: semanticState.parentPackageStateHash || "",
      lastPortableCollectionStateHash: mismatch ? "" : semanticState.collectionStateHash,
      lastPortablePackageStateHash: mismatch ? "" : semanticState.packageStateHash,
      markers: deriveMarkerIndex(manifest),
      exportStatus: mismatch ? "needs-export" : "export-generated",
      needsExportReasons: mismatch ? ["Declared integrity hash differed from recomputed normalized content."] : [],
      savedAt: now,
      importedAt: now,
      sourceName: state.sourceName,
      sourceHash: state.sourceHash
    });
    await commitLibraryTransaction({
      currentRecord: record,
      semanticState,
      sourceType: "import",
      action: {
        id: `action:${crypto.randomUUID()}`,
        type: mismatch ? "import-accepted-integrity-mismatch" : "import-accepted",
        at: now,
        affectedIds: {
          olmlId: manifest.olml.id,
          objectId: manifest.object.id,
          memoryIds: (manifest.memories || []).map((memory) => memory.id)
        },
        previousHashes: semanticHashSummary(await getPackageRecord(manifest.olml.id)) || {},
        resultingHashes: semanticState,
        changedScopes: ["Collection"],
        changedFields: [],
        assetSummary: summarizeAssets(state.assets)
      }
    });
    state.readerBaseline = captureReaderBaseline();
    await refreshLibrary();
    setValidation([{ level: "info", message: mismatch ? "Imported snapshot accepted with recomputed hashes. Collection Needs export for corrected portable integrity metadata." : "Imported snapshot accepted into the browser-local Library without re-export." }], true);
  }

  async function buildCurrentZip(semanticState) {
    const manifest = semanticState
      ? window.OLMLState.withIntegrityEnvelope(stripEmpty(getCurrentManifest()), semanticState)
      : stripEmpty(getCurrentManifest());
    const entries = [
      {
        path: "olml.json",
        data: encodeUtf8(JSON.stringify(manifest, null, 2)),
        type: "application/json"
      }
    ];
    for (const asset of state.assets.values()) {
      if (asset.external) continue;
      entries.push({ path: asset.path, data: new Uint8Array(asset.buffer), type: asset.type });
    }
    for (const file of state.markerEvidenceFiles.values()) {
      entries.push({ path: file.path, data: new Uint8Array(file.buffer), type: file.type });
    }
    return writeZip(entries);
  }

  function validateAndRender(markRun) {
    if (!state.manifest) {
      renderValidation([]);
      return [];
    }
    const result = [
      ...validateManifest(getCurrentManifest(), state.assets),
      ...activeFlowValidationItems()
    ];
    state.validation = result;
    renderValidation(result);
    if (markRun) els.lastRun.textContent = `Last run: ${new Date().toLocaleString()}`;
    return result;
  }

  function activeFlowValidationItems() {
    if (!state.manifest) return [];
    const items = [];
    if (state.detachedFromLibrary) {
      items.push({ level: "warning", message: "This file is open without updating Library. Exporting from this session will not change Library records." });
    }
    if (state.activeConflict) {
      items.push({ level: state.activeConflict.blocking ? "error" : "warning", message: state.activeConflict.message || "This file has a Library conflict." });
    }
    const changes = describeReaderChanges();
    if (!state.detachedFromLibrary && state.sharedObjectSiblingCount && changes.objectChanged) {
      items.push({ level: "warning", message: "Object info updated, other files on the same object needs a re-export after this one saved." });
    }
    if (!state.detachedFromLibrary && state.sharedObjectSiblingCount && changes.markersChanged) {
      items.push({ level: "warning", message: "Object marker updated, other files on the same object needs a re-export after this one saved." });
    }
    return items;
  }

  function validateManifest(manifest, assets) {
    const items = [];
    const add = (level, message) => items.push({ level, message });
    if (!manifest.olml || !manifest.olml.id) add("error", "Missing olml.id.");
    if (!manifest.olml || !manifest.olml.version) add("error", "Missing olml.version.");
    if (!manifest.object || !manifest.object.id) add("error", "Missing object.id.");
    if (!manifest.object || !String(manifest.object.title || "").trim()) add("warning", "Object Title is required before export.");
    if (!Array.isArray(manifest.memories) || manifest.memories.length === 0) add("error", "At least one memory record is required.");
    if (!Array.isArray(manifest.links) || manifest.links.length === 0) add("error", "At least one object-memory link is required.");

    const memoryIds = new Set();
    const duplicateMemoryIds = new Set();
    for (const memory of manifest.memories || []) {
      if (!memory.id) add("error", "A memory record is missing memory.id.");
      if (memory.id && memoryIds.has(memory.id)) duplicateMemoryIds.add(memory.id);
      if (memory.id) memoryIds.add(memory.id);
      const hasContent = Boolean((memory.note || "").trim() || (memory.title || "").trim() || (memory.assets || []).length);
      if (!hasContent) add("warning", `${memory.id || "A memory"} has no title, note, or assets.`);
      if (!String(memory.title || "").trim()) add("warning", `${memory.id || "A memory"} needs Memory Title before export.`);
    }
    for (const id of duplicateMemoryIds) add("error", `Duplicate memory.id: ${id}`);

    const linkPairs = new Set();
    const linkedMemories = new Set();
    const linkIds = new Set();
    for (const link of manifest.links || []) {
      if (link.id) add("warning", `Legacy link.id ignored while reading: ${link.id}`);
      if (link.object !== manifest.object.id) add("error", `Link references unknown object: ${link.object || "(missing)"}`);
      if (!memoryIds.has(link.memory)) add("error", `Link references unknown memory: ${link.memory || "(missing)"}`);
      if (link.memory) linkedMemories.add(link.memory);
      const pair = `${link.object} -> ${link.memory}`;
      if (linkPairs.has(pair)) add("error", `Duplicate object-memory link pair: ${pair}`);
      linkPairs.add(pair);
    }
    for (const id of memoryIds) {
      if (!linkedMemories.has(id)) add("error", `Memory is not reachable through a link: ${id}`);
    }
    if (linkPairs.size !== memoryIds.size) add("error", "A V1 package must contain exactly one Link pair for each included Memory.");

    const assetPaths = new Set((manifest.assets || []).map((asset) => asset.path));
    for (const asset of manifest.assets || []) {
      if (!asset.path) add("error", "An asset record is missing path.");
      if (asset.url) {
        try {
          new URL(asset.url);
        } catch (_) {
          add("error", `External asset URL is invalid: ${asset.url}`);
        }
      } else if (asset.path && !assets.has(asset.path)) {
        add("error", `Asset path is missing from ZIP/local asset map: ${asset.path}`);
      }
      if (asset.path && !asset.path.startsWith("assets/") && !asset.path.startsWith("external/")) add("warning", `Asset path should live under assets/ or external/: ${asset.path}`);
    }
    for (const memory of manifest.memories || []) {
      for (const path of memory.assets || []) {
        if (!assetPaths.has(path)) add("error", `Memory references unknown asset: ${path}`);
      }
    }

    for (const marker of manifest.objectMarkers || []) {
      if (!SUPPORTED_OBJECT_MARKERS.has(markerType(marker))) add("warning", `Unsupported Object Marker type: ${markerType(marker) || "(missing)"}`);
      if (marker.object && marker.object !== manifest.object.id) add("error", `Object Marker references unknown object: ${marker.object}`);
      const evidence = markerEvidence(marker);
      if (markerType(marker) === "qr") {
        const hasGeneratedQr = markerType(marker) === "qr" && evidence && evidence.type === "generated-qr" && evidence.value;
        if (!hasGeneratedQr) add("error", "QR marker requires generated object.id evidence before Save & Export.");
      } else if (markerUsesImageFile(markerType(marker))) {
        if (!evidence || typeof evidence !== "object" || !evidence.path) add("error", `${markerLabel(markerType(marker))} Object Marker requires portable image evidence before Save & Export.`);
        if (evidence && evidence.path && !state.markerEvidenceFiles.has(evidence.path)) add("error", `Object Marker evidence image is missing from ZIP/local map: ${evidence.path}`);
      } else if (!evidence || typeof evidence !== "object" || !String(evidence.value || "").trim()) {
        add("error", `${markerLabel(markerType(marker))} Object Marker requires a non-empty exact value before Save & Export.`);
      }
      if (markerType(marker) === "image-reference") add("warning", "Image-reference Object Markers can be ambiguous for similar or mass-produced objects.");
      if (markerType(marker) === "text-marker") add("warning", "OCR text markers depend on readable text and may be ambiguous if labels are duplicated.");
      if (!marker.object) add("warning", "Object Marker should reference the current object.id.");
      if (marker.object && marker.object !== manifest.object.id) add("warning", "Object Marker object differs from the current object.id.");
    }
    if (!Array.isArray(manifest.objectMarkers) || !manifest.objectMarkers.some((marker) => SUPPORTED_OBJECT_MARKERS.has(markerType(marker)))) {
      add("error", "At least one complete Object Marker is required before Save & Export.");
    }
    if (items.length === 0) add("info", "Package structure is valid for the OLML Solver MVP.");
    return items;
  }

  function describeReaderChanges() {
    const baseline = state.readerBaseline;
    const manifest = state.manifest;
    if (!baseline || !manifest) {
      return {
        objectChanged: false,
        collectionChanged: false,
        markersChanged: false,
        changedMemories: [],
        addedAssetCount: 0,
        removedAssetCount: 0,
        replacedAssetCount: 0
      };
    }
    const before = baseline.manifest || {};
    const beforeMemories = before.memories || [];
    const afterMemories = manifest.memories || [];
    const changedMemories = [];
    for (const memory of afterMemories) {
      const previous = beforeMemories.find((item) => item.id === memory.id);
      if (!previous || stableJson(stripEmpty(previous)) !== stableJson(stripEmpty(memory))) changedMemories.push(memory.id);
    }
    for (const memory of beforeMemories) {
      if (!afterMemories.some((item) => item.id === memory.id)) changedMemories.push(memory.id);
    }
    const beforeAssets = new Set(Object.keys(baseline.assets || {}));
    const afterAssets = new Set(Array.from(state.assets.keys()));
    let addedAssetCount = 0;
    let removedAssetCount = 0;
    let replacedAssetCount = 0;
    for (const path of afterAssets) {
      if (!beforeAssets.has(path)) addedAssetCount += 1;
      else {
        const currentFingerprint = assetFingerprintMap(new Map([[path, state.assets.get(path)]]))[path];
        if (stableJson((baseline.assets || {})[path]) !== stableJson(currentFingerprint)) replacedAssetCount += 1;
      }
    }
    for (const path of beforeAssets) {
      if (!afterAssets.has(path)) removedAssetCount += 1;
    }
    return {
      objectChanged: stableJson(stripEmpty(before.object || {})) !== stableJson(stripEmpty(manifest.object || {})),
      collectionChanged: stableJson(stripEmpty(before.olml || {})) !== stableJson(stripEmpty(manifest.olml || {})),
      markersChanged: stableJson(stripEmpty(before.objectMarkers || [])) !== stableJson(stripEmpty(manifest.objectMarkers || []))
        || stableJson(baseline.markerEvidenceFiles || {}) !== stableJson(assetFingerprintMap(state.markerEvidenceFiles)),
      changedMemories,
      addedAssetCount,
      removedAssetCount,
      replacedAssetCount
    };
  }

  function buildSaveExportMessages(changes, manifest, otherNeedsExport) {
    const messages = ["Saved and exported."];
    if (changes.objectChanged) messages.push(`Shared Object ${shortIdentity(manifest.object.id)} updated.`);
    if (changes.collectionChanged) messages.push(`Collection ${shortIdentity(manifest.olml.id)} updated.`);
    if (changes.markersChanged) messages.push(`Object Markers for ${shortIdentity(manifest.object.id)} updated.`);
    for (const memoryId of changes.changedMemories) messages.push(`Memory ${shortIdentity(memoryId)} updated.`);
    if (changes.addedAssetCount) messages.push(`${changes.addedAssetCount} asset${changes.addedAssetCount === 1 ? "" : "s"} added.`);
    if (changes.removedAssetCount) messages.push(`${changes.removedAssetCount} asset${changes.removedAssetCount === 1 ? "" : "s"} removed.`);
    if (changes.replacedAssetCount) messages.push(`${changes.replacedAssetCount} asset${changes.replacedAssetCount === 1 ? "" : "s"} changed.`);
    messages.push(`Current collection ${shortIdentity(manifest.olml.id)} export generated.`);
    if (otherNeedsExport) messages.push(`${otherNeedsExport} other collection${otherNeedsExport === 1 ? "" : "s"} need export.`);
    return messages;
  }

  function renderReaderChangeStatus(changes) {
    const manifest = state.manifest;
    if (!manifest) return "";
    const messages = [];
    if (!changes.objectChanged && !changes.collectionChanged && !changes.markersChanged && changes.changedMemories.length === 0 && !changes.addedAssetCount && !changes.removedAssetCount && !changes.replacedAssetCount) {
      return '<p class="small-muted">No unsaved changes.</p>';
    }
    if (changes.objectChanged) messages.push(`Shared Object ${shortIdentity(manifest.object.id)} has unsaved changes.`);
    if (changes.collectionChanged) messages.push(`Collection ${shortIdentity(manifest.olml.id)} has unsaved changes.`);
    if (changes.markersChanged) messages.push(`Object Markers for ${shortIdentity(manifest.object.id)} have unsaved changes.`);
    for (const memoryId of changes.changedMemories) messages.push(`Memory ${shortIdentity(memoryId)} has unsaved changes.`);
    if (changes.addedAssetCount) messages.push(`${changes.addedAssetCount} asset${changes.addedAssetCount === 1 ? "" : "s"} added.`);
    if (changes.removedAssetCount) messages.push(`${changes.removedAssetCount} asset${changes.removedAssetCount === 1 ? "" : "s"} removed.`);
    if (changes.replacedAssetCount) messages.push(`${changes.replacedAssetCount} asset${changes.replacedAssetCount === 1 ? "" : "s"} changed.`);
    return `<ul>${messages.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>`;
  }

  function renderReaderStatusOnly() {
    const status = els.readerContent.querySelector(".reader-status");
    const changes = describeReaderChanges();
    if (status) status.innerHTML = renderReaderChangeStatus(changes);
    const objectWarning = els.readerContent.querySelector(".object-draft-warning-slot");
    if (objectWarning) objectWarning.innerHTML = renderSharedObjectDraftWarning(changes);
    const markerWarning = els.readerContent.querySelector(".marker-draft-warning-slot");
    if (markerWarning) markerWarning.innerHTML = renderSharedMarkerDraftWarning(changes);
    const save = els.readerContent.querySelector("[data-reader-action='save-export']");
    if (save) save.disabled = !isExportReady(state.manifest);
  }

  function stableJson(value) {
    return JSON.stringify(sortJson(value));
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

  function shortIdentity(id) {
    const parts = String(id || "").split(":");
    if (parts.length >= 2) return parts[1] || parts[0];
    return id || "-";
  }

  function generateQrMatrix(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    const specs = [
      { version: 1, dataBlocks: [19], eccCodewords: 7, alignment: [] },
      { version: 2, dataBlocks: [34], eccCodewords: 10, alignment: [6, 18] },
      { version: 3, dataBlocks: [55], eccCodewords: 15, alignment: [6, 22] },
      { version: 4, dataBlocks: [80], eccCodewords: 20, alignment: [6, 26] },
      { version: 5, dataBlocks: [108], eccCodewords: 26, alignment: [6, 30] },
      { version: 6, dataBlocks: [68, 68], eccCodewords: 18, alignment: [6, 34] },
      { version: 7, dataBlocks: [78, 78], eccCodewords: 20, alignment: [6, 22, 38] },
      { version: 8, dataBlocks: [97, 97], eccCodewords: 24, alignment: [6, 24, 42] },
      { version: 9, dataBlocks: [116, 116], eccCodewords: 30, alignment: [6, 26, 46] },
      { version: 10, dataBlocks: [68, 68, 69, 69], eccCodewords: 18, alignment: [6, 28, 50] }
    ];
    const spec = specs.find((item) => qrBytePayloadFits(bytes.length, item));
    if (!spec) return null;
    const data = qrDataCodewords(bytes, spec.dataBlocks.reduce((sum, count) => sum + count, 0), spec.version);
    return buildQrModules(spec, qrInterleaveCodewords(data, spec));
  }

  function qrBytePayloadFits(byteLength, spec) {
    const dataCodewords = spec.dataBlocks.reduce((sum, count) => sum + count, 0);
    return 4 + qrByteCountBits(spec.version) + byteLength * 8 <= dataCodewords * 8;
  }

  function qrDataCodewords(bytes, dataCodewords, version = 1) {
    const bits = [];
    const append = (value, length) => {
      for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
    };
    append(0b0100, 4);
    append(bytes.length, qrByteCountBits(version));
    for (const byte of bytes) append(byte, 8);
    const capacityBits = dataCodewords * 8;
    const terminator = Math.min(4, capacityBits - bits.length);
    append(0, terminator);
    while (bits.length % 8) bits.push(0);
    const out = [];
    for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
    for (let pad = 0; out.length < dataCodewords; pad += 1) out.push(pad % 2 === 0 ? 0xec : 0x11);
    return out;
  }

  function qrByteCountBits(version) {
    return version < 10 ? 8 : 16;
  }

  function qrInterleaveCodewords(data, spec) {
    const blocks = [];
    let offset = 0;
    for (const length of spec.dataBlocks) {
      const block = data.slice(offset, offset + length);
      blocks.push({ data: block, ecc: qrReedSolomonRemainder(block, spec.eccCodewords) });
      offset += length;
    }
    const out = [];
    const maxData = Math.max(...blocks.map((block) => block.data.length));
    for (let i = 0; i < maxData; i += 1) {
      for (const block of blocks) {
        if (i < block.data.length) out.push(block.data[i]);
      }
    }
    for (let i = 0; i < spec.eccCodewords; i += 1) {
      for (const block of blocks) out.push(block.ecc[i]);
    }
    return out;
  }

  function buildQrModules(spec, codewords) {
    const size = spec.version * 4 + 17;
    const modules = Array.from({ length: size }, () => Array(size).fill(false));
    const reserved = Array.from({ length: size }, () => Array(size).fill(false));
    const set = (row, col, dark, fixed = true) => {
      if (row < 0 || col < 0 || row >= size || col >= size) return;
      modules[row][col] = Boolean(dark);
      if (fixed) reserved[row][col] = true;
    };
    addFinder(modules, reserved, 0, 0);
    addFinder(modules, reserved, size - 7, 0);
    addFinder(modules, reserved, 0, size - 7);
    for (let i = 8; i < size - 8; i += 1) {
      set(6, i, i % 2 === 0);
      set(i, 6, i % 2 === 0);
    }
    for (const row of spec.alignment || []) {
      for (const col of spec.alignment || []) {
        if (reserved[row][col]) continue;
        addAlignment(modules, reserved, row, col);
      }
    }
    set(size - 8, 8, true);
    reserveFormatAreas(reserved);
    if (spec.version >= 7) addVersionBits(modules, reserved, spec.version);
    placeQrData(modules, reserved, codewords);
    let best = null;
    for (let mask = 0; mask < 8; mask += 1) {
      const candidate = modules.map((row) => row.slice());
      applyQrMask(candidate, reserved, mask);
      addFormatBits(candidate, reserved, mask);
      const penalty = qrPenalty(candidate);
      if (!best || penalty < best.penalty) best = { modules: candidate, penalty, mask };
    }
    return { size, modules: best.modules };
  }

  function addFinder(modules, reserved, top, left) {
    const size = modules.length;
    for (let row = -1; row <= 7; row += 1) {
      for (let col = -1; col <= 7; col += 1) {
        const y = top + row;
        const x = left + col;
        if (y < 0 || x < 0 || y >= size || x >= size) continue;
        const inCore = row >= 0 && row <= 6 && col >= 0 && col <= 6;
        modules[y][x] = inCore && (row === 0 || row === 6 || col === 0 || col === 6 || (row >= 2 && row <= 4 && col >= 2 && col <= 4));
        reserved[y][x] = true;
      }
    }
  }

  function addAlignment(modules, reserved, centerRow, centerCol) {
    for (let row = -2; row <= 2; row += 1) {
      for (let col = -2; col <= 2; col += 1) {
        const y = centerRow + row;
        const x = centerCol + col;
        modules[y][x] = Math.max(Math.abs(row), Math.abs(col)) !== 1;
        reserved[y][x] = true;
      }
    }
  }

  function reserveFormatAreas(reserved) {
    const size = reserved.length;
    for (let i = 0; i <= 8; i += 1) {
      if (i !== 6) {
        reserved[8][i] = true;
        reserved[i][8] = true;
      }
    }
    for (let i = 0; i < 8; i += 1) {
      reserved[8][size - 1 - i] = true;
      reserved[size - 1 - i][8] = true;
    }
  }

  function addVersionBits(modules, reserved, version) {
    const size = modules.length;
    const bits = qrVersionBits(version);
    for (let i = 0; i < 18; i += 1) {
      const bit = Boolean((bits >>> i) & 1);
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      modules[a][b] = bit;
      reserved[a][b] = true;
      modules[b][a] = bit;
      reserved[b][a] = true;
    }
  }

  function qrVersionBits(version) {
    let bits = version << 12;
    for (let i = 17; i >= 12; i -= 1) {
      if (((bits >>> i) & 1) !== 0) bits ^= 0x1f25 << (i - 12);
    }
    return (version << 12) | bits;
  }

  function placeQrData(modules, reserved, codewords) {
    const size = modules.length;
    const bits = [];
    for (const codeword of codewords) {
      for (let i = 7; i >= 0; i -= 1) bits.push((codeword >>> i) & 1);
    }
    let bitIndex = 0;
    let upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right -= 1;
      for (let vert = 0; vert < size; vert += 1) {
        const row = upward ? size - 1 - vert : vert;
        for (let j = 0; j < 2; j += 1) {
          const col = right - j;
          if (reserved[row][col]) continue;
          modules[row][col] = Boolean(bits[bitIndex] || 0);
          bitIndex += 1;
        }
      }
      upward = !upward;
    }
  }

  function applyQrMask(modules, reserved, mask) {
    for (let row = 0; row < modules.length; row += 1) {
      for (let col = 0; col < modules.length; col += 1) {
        if (!reserved[row][col] && qrMaskBit(mask, row, col)) modules[row][col] = !modules[row][col];
      }
    }
  }

  function qrMaskBit(mask, row, col) {
    if (mask === 0) return (row + col) % 2 === 0;
    if (mask === 1) return row % 2 === 0;
    if (mask === 2) return col % 3 === 0;
    if (mask === 3) return (row + col) % 3 === 0;
    if (mask === 4) return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    if (mask === 5) return ((row * col) % 2) + ((row * col) % 3) === 0;
    if (mask === 6) return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }

  function addFormatBits(modules, reserved, mask) {
    const size = modules.length;
    const bits = qrFormatBits(mask);
    const first = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
    const second = [[size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8], [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]];
    for (let i = 0; i < 15; i += 1) {
      const bit = Boolean((bits >>> (14 - i)) & 1);
      modules[first[i][0]][first[i][1]] = bit;
      modules[second[i][0]][second[i][1]] = bit;
      reserved[first[i][0]][first[i][1]] = true;
      reserved[second[i][0]][second[i][1]] = true;
    }
  }

  function qrFormatBits(mask) {
    let data = (0b01 << 3) | mask;
    let bits = data << 10;
    for (let i = 14; i >= 10; i -= 1) {
      if (((bits >>> i) & 1) !== 0) bits ^= 0x537 << (i - 10);
    }
    return (((data << 10) | bits) ^ 0x5412) & 0x7fff;
  }

  function qrPenalty(modules) {
    const size = modules.length;
    let penalty = 0;
    const scanRuns = (get) => {
      for (let outer = 0; outer < size; outer += 1) {
        let runColor = get(outer, 0);
        let runLength = 1;
        for (let inner = 1; inner < size; inner += 1) {
          const color = get(outer, inner);
          if (color === runColor) runLength += 1;
          else {
            if (runLength >= 5) penalty += 3 + runLength - 5;
            runColor = color;
            runLength = 1;
          }
        }
        if (runLength >= 5) penalty += 3 + runLength - 5;
      }
    };
    scanRuns((row, col) => modules[row][col]);
    scanRuns((col, row) => modules[row][col]);
    for (let row = 0; row < size - 1; row += 1) {
      for (let col = 0; col < size - 1; col += 1) {
        const color = modules[row][col];
        if (color === modules[row][col + 1] && color === modules[row + 1][col] && color === modules[row + 1][col + 1]) penalty += 3;
      }
    }
    const finderPattern = [true, false, true, true, true, false, true, false, false, false, false];
    const checkPattern = (line, index) => finderPattern.every((value, offset) => line[index + offset] === value);
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col <= size - finderPattern.length; col += 1) {
        if (checkPattern(modules[row], col)) penalty += 40;
      }
    }
    for (let col = 0; col < size; col += 1) {
      const line = modules.map((row) => row[col]);
      for (let row = 0; row <= size - finderPattern.length; row += 1) {
        if (checkPattern(line, row)) penalty += 40;
      }
    }
    const dark = modules.flat().filter(Boolean).length;
    penalty += Math.floor(Math.abs((dark * 20) / (size * size) - 10)) * 10;
    return penalty;
  }

  function qrReedSolomonRemainder(data, degree) {
    const divisor = qrRsGenerator(degree);
    const result = data.concat(Array(degree).fill(0));
    for (let i = 0; i < data.length; i += 1) {
      const factor = result[i];
      if (!factor) continue;
      for (let j = 0; j < divisor.length; j += 1) {
        result[i + j + 1] ^= qrGfMul(divisor[j], factor);
      }
    }
    return result.slice(data.length);
  }

  function qrRsGenerator(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i += 1) {
      const next = Array(poly.length + 1).fill(0);
      const root = qrGfPow(2, i);
      for (let j = 0; j < poly.length; j += 1) {
        next[j] ^= poly[j];
        next[j + 1] ^= qrGfMul(poly[j], root);
      }
      poly = next;
    }
    return poly.slice(1);
  }

  function qrGfPow(value, power) {
    let result = 1;
    for (let i = 0; i < power; i += 1) result = qrGfMul(result, value);
    return result;
  }

  function qrGfMul(a, b) {
    let result = 0;
    for (let i = 0; i < 8; i += 1) {
      if (b & 1) result ^= a;
      const high = a & 0x80;
      a = (a << 1) & 0xff;
      if (high) a ^= 0x1d;
      b >>>= 1;
    }
    return result;
  }

  function renderValidation(items) {
    const counts = { warning: 0, error: 0, info: 0 };
    items.forEach((item) => { counts[item.level] = (counts[item.level] || 0) + 1; });
    els.warningCount.textContent = counts.warning;
    els.errorCount.textContent = counts.error;
    els.infoCount.textContent = counts.info;
    if (els.postponeConflictButton) {
      els.postponeConflictButton.classList.toggle("hidden", !(state.activeConflict && (state.activeConflict.decision || state.activeConflict.blocking)));
    }
    renderValidationSummary(counts);
    els.validationList.innerHTML = "";
    if (items.length === 0) {
      const item = document.createElement("div");
      item.className = "validation-item info";
      item.textContent = "Open or create a package to validate.";
      els.validationList.appendChild(item);
      return;
    }
    for (const validation of items) {
      const item = document.createElement("div");
      item.className = `validation-item ${validation.level}`;
      item.textContent = validation.message;
      els.validationList.appendChild(item);
    }
  }

  function renderValidationSummary(counts) {
    if (!els.validationSummary) return;
    if (!state.manifest) {
      els.validationSummary.textContent = "No package is open.";
      renderStatusAxes({ structural: "Invalid", markers: "Not ready", exportFreshness: "-", conflict: "Clean" });
      return;
    }
    const manifest = getCurrentManifest();
    const objectName = manifest.object.title || manifest.object.id || "This object";
    const memoryCount = (manifest.memories || []).length;
    const linkCount = (manifest.links || []).length;
    const assetCount = (manifest.assets || []).length;
    const status = counts.error > 0
      ? `${counts.error} error${counts.error === 1 ? "" : "s"} ${counts.error === 1 ? "needs" : "need"} fixing before this is valid OLML.`
      : counts.warning > 0
        ? `${counts.warning} warning${counts.warning === 1 ? "" : "s"} ${counts.warning === 1 ? "needs" : "need"} review, but the structure is readable.`
        : "No structural issues detected.";
    els.validationSummary.textContent = `${objectName} has ${memoryCount} memor${memoryCount === 1 ? "y" : "ies"}, ${linkCount} link${linkCount === 1 ? "" : "s"}, and ${assetCount} asset${assetCount === 1 ? "" : "s"}. ${status}`;
    renderStatusAxes({
      structural: counts.error > 0 || state.structuralReadOnly ? "Invalid" : "Valid",
      markers: isExportReady(manifest) ? "Ready" : "Not ready",
      exportFreshness: currentExportStatusText(),
      conflict: state.activeConflict ? "Pending" : "Clean"
    });
  }

  function renderStatusAxes(status) {
    if (!els.statusAxisGrid) return;
    els.statusAxisGrid.innerHTML = [
      ["Structural", status.structural],
      ["Object Markers", status.markers],
      ["Export", status.exportFreshness],
      ["Conflict", status.conflict]
    ].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  }

  function currentExportStatusText() {
    if (!state.manifest) return "-";
    const declared = window.OLMLState.declaredIntegrity(state.manifest);
    const baselineClean = !describeReaderChanges().objectChanged
      && !describeReaderChanges().collectionChanged
      && !describeReaderChanges().markersChanged
      && describeReaderChanges().changedMemories.length === 0
      && !describeReaderChanges().addedAssetCount
      && !describeReaderChanges().removedAssetCount
      && !describeReaderChanges().replacedAssetCount;
    if (declared && declared.packageStateHash && state.candidateSemanticState && declared.packageStateHash === state.candidateSemanticState.packageStateHash && baselineClean) {
      return "Export generated for current state";
    }
    return "Needs export";
  }

  function canWriteWithCurrentValidation(action) {
    const result = validateAndRender(true);
    const errors = result.filter((item) => item.level === "error");
    if (errors.length === 0) return true;
    const verb = action === "save" ? "Save" : "Export";
    return window.confirm(`This package has ${errors.length} validation error${errors.length === 1 ? "" : "s"}. ${verb} anyway?`);
  }

  function isExportReady(manifest) {
    if (!manifest) return false;
    const objectTitle = manifest.object && String(manifest.object.title || "").trim();
    const hasMemoryTitle = Array.isArray(manifest.memories) && manifest.memories.some((memory) => String(memory.title || "").trim());
    const hasObjectMarker = Array.isArray(manifest.objectMarkers) && manifest.objectMarkers.some((marker) => isCompleteMarker(marker));
    return Boolean(objectTitle && hasMemoryTitle && hasObjectMarker && !state.structuralReadOnly && !(state.activeConflict && (state.activeConflict.blocking || state.activeConflict.decision)));
  }

  function isCompleteMarker(marker) {
    if (!marker || !SUPPORTED_OBJECT_MARKERS.has(markerType(marker))) return false;
    const evidence = markerEvidence(marker);
    if (markerType(marker) === "qr" || markerType(marker) === "image-reference") {
      if (markerType(marker) === "qr") return Boolean(evidence && evidence.type === "generated-qr" && evidence.value);
      return Boolean(evidence && evidence.path && state.markerEvidenceFiles.has(evidence.path));
    }
    return Boolean(evidence && typeof evidence === "object" && String(evidence.value || "").trim());
  }

  function updateExportButtons() {
    const ready = isExportReady(state.manifest);
    if (els.exportButton) els.exportButton.disabled = !ready;
    if (els.editorExportButton) els.editorExportButton.disabled = !ready;
  }

  function defaultExportFilename(manifest) {
    const object = slugify(manifest.object && manifest.object.title || "object");
    const collection = slugify(manifest.olml && manifest.olml.title || "");
    const memory = slugify(manifest.memories && manifest.memories[0] && manifest.memories[0].title || "");
    return `${[object, collection || memory || "olml"].filter(Boolean).join("-")}.olml`;
  }

  function setValidation(items, markRun) {
    state.validation = items;
    renderValidation(items);
    if (markRun) els.lastRun.textContent = `Last run: ${new Date().toLocaleString()}`;
  }

  async function postponeActiveConflict() {
    if (!state.activeConflict) {
      setValidation([{ level: "info", message: "No active conflict to postpone." }], true);
      return;
    }
    await persistPendingConflict(state.activeConflict);
    await renderPendingConflictList();
    setValidation([{ level: "info", message: "Pending Conflict reminder saved. Reopen the source file to continue resolving this conflict." }], true);
  }

  async function dismissPendingConflict(conflictId) {
    if (!conflictId) return;
    await deleteStoreRecord(STORE_CONFLICTS, conflictId);
    await renderPendingConflictList();
    setValidation([{ level: "info", message: "Pending Conflict reminder dismissed. Current Library records and disk files were not changed." }], true);
  }

  async function searchObjectMarkerInLibrary() {
    const raw = els.resolveInput.value.trim();
    if (!raw) {
      els.resolveResult.textContent = "Paste an olml.id, marker value, or catalog URL first.";
      return;
    }
    const candidates = extractObjectMarkerCandidates(raw);
    const records = await listPackageRecords();
    const record = records.find((item) => {
      const manifest = item.manifest || {};
      const objectMarkerObjects = (manifest.objectMarkers || []).flatMap((marker) => [marker.object]).filter(Boolean);
      const markerValues = (item.markers || []).flatMap((marker) => [marker.value, marker.signature, marker.path]).filter(Boolean);
      const locationUrls = (item.locations || []).map((location) => location.url).filter(Boolean);
      return candidates.includes(item.olmlId)
        || candidates.includes(manifest.olml && manifest.olml.id)
        || objectMarkerObjects.some((objectId) => candidates.includes(objectId))
        || markerValues.some((value) => candidates.includes(value))
        || locationUrls.some((url) => candidates.includes(url));
    });
    if (!record) {
      els.resolveResult.innerHTML = "No browser-local match found. Import or open the matching .olml file, then save it to the local library.";
      return;
    }
    const url = firstLocationUrl(record);
    els.resolveResult.innerHTML = `Matched <strong>${escapeHtml(record.title || record.olmlId)}</strong>${record.zip ? "." : url ? `; catalog has remote URL ${escapeHtml(url)}.` : "; catalog entry has no local package bytes."}`;
    if (record.zip) await loadRecord(record.olmlId);
  }

  function extractObjectMarkerCandidates(raw) {
    const values = new Set([raw]);
    if (raw.startsWith("olml:id:")) values.add(raw.slice("olml:id:".length));
    try {
      const url = new URL(raw);
      for (const key of ["id", "olml.id", "olmlId"]) {
        const value = url.searchParams.get(key);
        if (value) values.add(value);
      }
      values.add(url.href);
    } catch (_) {
      // Not a URL, keep raw value only.
    }
    return Array.from(values).filter(Boolean);
  }

  async function refreshLibrary() {
    const records = await listPackageRecords();
    if (els.libraryList) els.libraryList.innerHTML = "";
    renderHistoryLibraryList(records);
    await renderActivityList();
    await renderPendingConflictList();
    if (records.length === 0) {
      if (els.libraryList) els.libraryList.innerHTML = '<p class="small-muted">No local packages saved yet.</p>';
      updatePublicationField(null);
      return;
    }
    records.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
    if (els.libraryList) {
      for (const record of records) {
        const card = document.createElement("div");
        card.className = "library-card";
        card.innerHTML = `
          <strong>${escapeHtml(record.title || "Untitled OLML")}</strong>
          <span class="${statusClass(record)}">${escapeHtml(statusText(record))}</span>
          <code>${escapeHtml(record.olmlId)}</code>
          <span class="small-muted">${record.exportStatus === "read" ? `Read ${escapeHtml(formatDate(record.readAt || record.savedAt))}` : record.zip ? `Saved ${escapeHtml(formatDate(record.savedAt))}` : "Catalog entry only"}</span>
          <span class="small-muted">${escapeHtml(firstLocationUrl(record) || "No remote location")}</span>
        `;
        const open = document.createElement("button");
        open.type = "button";
        open.textContent = "Open";
        open.disabled = !record.zip;
        open.addEventListener("click", () => loadRecord(record.olmlId));
        card.appendChild(open);
        els.libraryList.appendChild(card);
      }
    }
    updatePublicationField(state.manifest);
  }

  function renderHistoryLibraryList(records) {
    if (!els.historyLibraryList) return;
    const filtered = filterLibraryRecords(records || []);
    if (!filtered.length) {
      els.historyLibraryList.innerHTML = '<p class="small-muted">No matching local Library records.</p>';
      renderLibraryObjectProfile([]);
      return;
    }
    const sorted = filtered.slice().sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
    els.historyLibraryList.innerHTML = sorted.slice(0, 8).map((record) => {
      const manifest = record.manifest || {};
      const object = manifest.object || {};
      const memory = (manifest.memories || [])[0] || {};
      const memories = manifest.memories || [];
      const memoryTitle = memories.length > 1
        ? `${memory.title || "Untitled memory"} + ${memories.length - 1} more`
        : memory.title || "Untitled memory";
      return `
        <button class="history-library-item file-log-item" type="button" data-open-olml="${escapeHtml(record.olmlId)}" ${record.zip ? "" : "disabled"}>
          <span>Object: ${escapeHtml(currentObjectProfile(record).title || object.title || record.title || "Untitled object")}</span>
          <small>${escapeHtml(object.id || record.objectId || "-")}</small>
          <span>Collection: ${escapeHtml(collectionTitle(record))}</span>
          <small>${escapeHtml(record.olmlId || manifest.olml && manifest.olml.id || "-")}</small>
          <span>Memory: ${escapeHtml(memoryTitle)}</span>
          <small>${escapeHtml(memory.id || "-")}</small>
        </button>
        <button class="small-danger" type="button" data-remove-olml="${escapeHtml(record.olmlId)}">Remove File Log</button>
      `;
    }).join("");
    renderLibraryObjectProfile(sorted);
  }

  function filterLibraryRecords(records) {
    const query = state.librarySearch.toLowerCase();
    if (!query) return records;
    return records.filter((record) => {
      const manifest = record.manifest || {};
      const object = currentObjectProfile(record);
      const fields = [
        record.objectId,
        record.olmlId,
        object.title,
        manifest.olml && manifest.olml.title,
        ...(manifest.memories || []).flatMap((memory) => [memory.id, memory.title])
      ];
      return fields.some((field) => String(field || "").toLowerCase().includes(query));
    });
  }

  function renderLibraryObjectProfile(records) {
    if (!els.libraryObjectProfile) return;
    els.libraryObjectProfile.innerHTML = "";
  }

  function currentObjectProfile(record) {
    return record.objectProfile || record.manifest && record.manifest.object || {};
  }

  function collectionTitle(record) {
    return record.collectionProfile && record.collectionProfile.title
      || record.manifest && record.manifest.olml && record.manifest.olml.title
      || record.title
      || "Untitled collection";
  }

  function statusText(record) {
    if (record.exportStatus === "export-generated") return "Export generated";
    if (record.exportStatus === "needs-export") return "Needs export";
    if (record.exportStatus === "read") return "Read file";
    if (record.zip) return "Export-ready";
    return "Catalog only";
  }

  function statusClass(record) {
    const status = statusText(record);
    if (status === "Needs export") return "draft-label";
    if (status === "Export generated" || status === "Export-ready") return "ready-label";
    if (status === "Read file") return "catalog-label";
    return "catalog-label";
  }

  async function renderHistoryPanel() {
    await refreshLibraryPanelOnly();
  }

  async function refreshLibraryPanelOnly() {
    try {
      const records = await listPackageRecords();
      renderHistoryLibraryList(records);
      await renderActivityList();
      await renderPendingConflictList();
    } catch (_) {
      if (els.libraryObjectProfile) els.libraryObjectProfile.innerHTML = '<p class="small-muted">Local storage unavailable.</p>';
    }
  }

  async function renderActivityList() {
    if (!els.libraryActivityList) return;
    const actions = await listStoreRecords(STORE_ACTIONS).catch(() => []);
    const recentActions = actions
      .slice()
      .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
      .slice(0, 6);
    els.libraryActivityList.innerHTML = `
      <div class="library-collections">
        <strong>Activity</strong>
        ${recentActions.map((action) => `
          <div class="activity-row">
            <span>${escapeHtml(activityLabel(action))}</span>
            <small>${escapeHtml(formatDate(action.at))}</small>
          </div>
        `).join("") || '<p class="small-muted">No local activity events yet.</p>'}
      </div>
    `;
  }

  function activityLabel(action) {
    return action && (action.summaryLabel || action.label || action.type) || "action";
  }

  async function renderPendingConflictList() {
    if (!els.pendingConflictsList) return;
    const conflicts = await listStoreRecords(STORE_CONFLICTS).catch(() => []);
    els.pendingConflictsList.innerHTML = `
      <div class="library-collections">
        <strong>Pending Conflicts</strong>
        ${conflicts.map((conflict) => `
          <div class="pending-conflict-row">
            <span>${escapeHtml(conflict.conflictType || conflict.type || "conflict")}</span>
            <strong>${escapeHtml(conflict.sourceName || "Other file")}</strong>
            <code>${escapeHtml(conflict.olmlId || conflict.objectId || "-")}</code>
            <small>${escapeHtml(conflict.sourceName || "source file")} / ${escapeHtml(formatDate(conflict.detectedAt || conflict.sourceTime))}</small>
            <p class="small-muted">${escapeHtml(conflict.reason || "Reopen the source file to continue resolving this conflict.")}</p>
            <button class="small-danger" type="button" data-dismiss-conflict="${escapeHtml(conflict.id)}">Dismiss Reminder</button>
          </div>
        `).join("") || '<p class="small-muted">No pending conflict reminders.</p>'}
      </div>
    `;
  }

  async function loadRecord(olmlId) {
    const record = await getPackageRecord(olmlId);
    if (!record || !record.zip) return;
    const file = new File([record.zip], `${slugify(record.title || "package")}.olml`, { type: "application/olml+zip" });
    await openOlmlFile(file);
  }

  async function removeCollectionRecord(olmlId) {
    const record = await getPackageRecord(olmlId);
    if (!record) return;
    await removeRecordsTransaction({
      olmlIds: [olmlId],
      objectIds: [],
      actionType: "file-log-removed",
      affectedIds: { olmlId, objectId: record.objectId },
      summaryLabel: removedFileLogLabel(record)
    });
    await refreshLibrary();
    setValidation([{ level: "info", message: "File log removed from the browser-local Library. Disk files are unaffected." }], true);
  }

  function removedFileLogLabel(record) {
    const manifest = record && record.manifest || {};
    const object = currentObjectProfile(record || {});
    const memories = manifest.memories || [];
    const memory = memories[0] || {};
    const objectName = object.title || record.title || "Untitled Object";
    const collectionName = collectionTitle(record || {});
    const memoryName = memories.length > 1
      ? `${memory.title || "Untitled Memory"} + ${memories.length - 1} More`
      : memory.title || "Untitled Memory";
    return `file-log-removed - ${objectName} (${collectionName}) ${memoryName}`;
  }

  async function removeObjectRecords(objectId) {
    if (!objectId) return;
    const records = (await listPackageRecords()).filter((record) => record.objectId === objectId);
    if (!records.length) return;
    const label = `${records.length} local Collection${records.length === 1 ? "" : "s"}`;
    if (!window.confirm(`Remove Object ${shortIdentity(objectId)} and ${label}? Exported disk files are unaffected.`)) return;
    await removeRecordsTransaction({
      olmlIds: records.map((record) => record.olmlId),
      objectIds: [objectId],
      actionType: "remove-object",
      affectedIds: { objectId, olmlIds: records.map((record) => record.olmlId) }
    });
    if (state.manifest && state.manifest.object && state.manifest.object.id === objectId) showMode("empty");
    await refreshLibrary();
    setValidation([{ level: "info", message: "Local Object and related Collections removed. Disk files are unaffected." }], true);
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "olmlId" });
        }
        if (!db.objectStoreNames.contains(STORE_OBJECTS)) db.createObjectStore(STORE_OBJECTS, { keyPath: "objectId" });
        if (!db.objectStoreNames.contains(STORE_MEMORIES)) db.createObjectStore(STORE_MEMORIES, { keyPath: "memoryId" });
        if (!db.objectStoreNames.contains(STORE_COLLECTIONS)) db.createObjectStore(STORE_COLLECTIONS, { keyPath: "olmlId" });
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) db.createObjectStore(STORE_SNAPSHOTS, { keyPath: "snapshotKey" });
        if (!db.objectStoreNames.contains(STORE_OBJECT_SNAPSHOTS)) db.createObjectStore(STORE_OBJECT_SNAPSHOTS, { keyPath: "snapshotKey" });
        if (!db.objectStoreNames.contains(STORE_ACTIONS)) db.createObjectStore(STORE_ACTIONS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(STORE_CONFLICTS)) db.createObjectStore(STORE_CONFLICTS, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function withStore(mode, callback) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const result = callback(store);
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  function putPackageRecord(record) {
    return withStore("readwrite", (store) => store.put(record));
  }

  async function putActionRecord(action) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ACTIONS, "readwrite");
      tx.objectStore(STORE_ACTIONS).put(action);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  async function buildObjectMarkerSnapshot(currentRecord, sourceType) {
    const manifest = currentRecord.manifest || {};
    const markers = [];
    for (const marker of currentRecord.objectMarkers || manifest.objectMarkers || []) {
      const evidence = markerEvidence(marker) || null;
      let descriptor = evidence ? structuredClone(evidence) : null;
      if (evidence && evidence.path) {
        const file = state.markerEvidenceFiles.get(evidence.path);
        descriptor = stripEmpty({
          type: evidence.type || "image",
          path: evidence.path,
          name: evidence.name || file && file.name || "",
          mediaType: evidence.mediaType || file && file.type || meaningfulMediaType(evidence.path),
          size: file && file.size || evidence.size || 0,
          digest: file && file.buffer ? await sha256Digest(new Uint8Array(file.buffer)) : evidence.digest || ""
        });
      }
      markers.push(stripEmpty({
        markerType: markerType(marker),
        object: marker.object || currentRecord.objectId,
        markerEvidence: descriptor,
        note: marker.note || ""
      }));
    }
    return {
      snapshotKey: `${currentRecord.objectId}|${currentRecord.objectStateHash}|${currentRecord.hashProfile || HASH_PROFILE}`,
      objectId: currentRecord.objectId,
      objectStateHash: currentRecord.objectStateHash,
      hashProfile: currentRecord.hashProfile || HASH_PROFILE,
      profile: structuredClone(currentRecord.objectProfile || manifest.object || {}),
      markers,
      sourceType,
      recordedAt: currentRecord.savedAt || new Date().toISOString()
    };
  }

  function buildCollectionSnapshot(currentRecord, semanticState, sourceType) {
    return {
      snapshotKey: `${currentRecord.olmlId}|${currentRecord.packageStateHash || currentRecord.collectionStateHash}|${currentRecord.hashProfile || HASH_PROFILE}`,
      olmlId: currentRecord.olmlId,
      collectionStateHash: currentRecord.collectionStateHash,
      packageStateHash: currentRecord.packageStateHash || semanticState.packageStateHash || "",
      parentPackageStateHash: semanticState.parentPackageStateHash || "",
      parentCollectionStateHash: "",
      objectId: currentRecord.objectId,
      objectStateHash: currentRecord.objectStateHash,
      memoryStateHashes: currentRecord.memoryStateHashes || [],
      hashProfile: currentRecord.hashProfile || HASH_PROFILE,
      sourceType,
      sourceName: currentRecord.sourceName || "",
      sourceHash: currentRecord.sourceHash || "",
      zipSha256: currentRecord.zipSha256 || "",
      recordedAt: currentRecord.savedAt || new Date().toISOString()
    };
  }

  function markerEvidenceCurrentRecords(markers) {
    return (markers || []).map((marker) => {
      const evidence = markerEvidence(marker) || {};
      const file = evidence.path && state.markerEvidenceFiles.get(evidence.path);
      return stripEmpty({
        markerType: markerType(marker),
        object: marker.object,
        path: evidence.path,
        value: evidence.value,
        name: evidence.name || file && file.name,
        mediaType: evidence.mediaType || file && file.type || meaningfulMediaType(evidence.path),
        size: evidence.size || file && file.size,
        bytes: file && file.buffer ? file.buffer : undefined,
        hasCurrentBytes: Boolean(file && file.buffer)
      });
    });
  }

  function memoryAssetCurrentRecords(memory) {
    return (memory.assets || []).map((path) => {
      const asset = state.assets.get(path);
      return stripEmpty({
        path,
        name: asset && asset.name,
        mediaType: asset && asset.type,
        size: asset && asset.size,
        url: asset && asset.url,
        external: Boolean(asset && asset.external),
        bytes: asset && !asset.external && asset.buffer ? asset.buffer : undefined
      });
    });
  }

  function normalizeActionEvent(action, currentRecord, semanticState) {
    return {
      id: action.id || `action:${crypto.randomUUID()}`,
      type: action.type || "save-export",
      at: action.at || new Date().toISOString(),
      affectedIds: action.affectedIds || {
        olmlId: currentRecord.olmlId,
        objectId: currentRecord.objectId,
        memoryIds: (currentRecord.manifest && currentRecord.manifest.memories || []).map((memory) => memory.id)
      },
      previousHashes: action.previousHashes || {},
      resultingHashes: action.resultingHashes || semanticState,
      changedScopes: action.changedScopes || [],
      changedFields: action.changedFields || [],
      assetSummary: action.assetSummary || [],
      conflictDecision: action.conflictDecision || ""
    };
  }

  async function commitLibraryTransaction({ currentRecord, siblingUpdates = [], semanticState, action, sourceType = "export", resolvedConflictId = "" }) {
    const objectSnapshot = await buildObjectMarkerSnapshot(currentRecord, sourceType);
    const collectionSnapshot = buildCollectionSnapshot(currentRecord, semanticState, sourceType);
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const storeNames = [STORE_NAME, STORE_OBJECTS, STORE_MEMORIES, STORE_COLLECTIONS, STORE_SNAPSHOTS, STORE_OBJECT_SNAPSHOTS, STORE_ACTIONS, STORE_CONFLICTS];
      const tx = db.transaction(storeNames, "readwrite");
      const packages = tx.objectStore(STORE_NAME);
      const objects = tx.objectStore(STORE_OBJECTS);
      const memories = tx.objectStore(STORE_MEMORIES);
      const collections = tx.objectStore(STORE_COLLECTIONS);
      const snapshots = tx.objectStore(STORE_SNAPSHOTS);
      const objectSnapshots = tx.objectStore(STORE_OBJECT_SNAPSHOTS);
      const actions = tx.objectStore(STORE_ACTIONS);
      const conflicts = tx.objectStore(STORE_CONFLICTS);
      const allRecords = [currentRecord, ...siblingUpdates];
      for (const record of allRecords) packages.put(record);
      const manifest = currentRecord.manifest || {};
      objects.put({
        objectId: currentRecord.objectId,
        profile: structuredClone(currentRecord.objectProfile || manifest.object || {}),
        markers: structuredClone(currentRecord.objectMarkers || manifest.objectMarkers || []),
        markerEvidence: markerEvidenceCurrentRecords(currentRecord.objectMarkers || manifest.objectMarkers || []),
        objectStateHash: currentRecord.objectStateHash,
        hashProfile: currentRecord.hashProfile || HASH_PROFILE,
        updatedAt: currentRecord.savedAt || new Date().toISOString()
      });
      for (const memory of manifest.memories || []) {
        const hash = (semanticState.memoryStateHashes || []).find((item) => item.memory === memory.id);
        memories.put({
          memoryId: memory.id,
          profile: structuredClone(memory),
          assets: memoryAssetCurrentRecords(memory),
          memoryStateHash: hash && hash.memoryStateHash || "",
          hashProfile: currentRecord.hashProfile || HASH_PROFILE,
          assetSummary: (memory.assets || []).map((path) => {
            const asset = state.assets.get(path);
            return asset ? { path, name: asset.name, size: asset.size || 0, external: Boolean(asset.external) } : { path };
          }),
          updatedAt: currentRecord.savedAt || new Date().toISOString()
        });
      }
      collections.put({
        olmlId: currentRecord.olmlId,
        objectId: currentRecord.objectId,
        metadata: structuredClone(currentRecord.collectionProfile || {}),
        links: structuredClone(currentRecord.linkProfiles || []),
        collectionStateHash: currentRecord.collectionStateHash,
        packageStateHash: currentRecord.packageStateHash,
        parentPackageStateHash: currentRecord.parentPackageStateHash,
        lastPortableCollectionStateHash: currentRecord.lastPortableCollectionStateHash,
        lastPortablePackageStateHash: currentRecord.lastPortablePackageStateHash,
        hashProfile: currentRecord.hashProfile || HASH_PROFILE,
        latestPackageBytes: currentRecord.zip,
        exportStatus: currentRecord.exportStatus,
        updatedAt: currentRecord.savedAt || new Date().toISOString()
      });
      objectSnapshots.put(objectSnapshot);
      snapshots.put(collectionSnapshot);
      if (resolvedConflictId) conflicts.delete(resolvedConflictId);
      actions.put(normalizeActionEvent(action || {
        id: `action:${crypto.randomUUID()}`,
        type: "collection-exported",
        at: new Date().toISOString(),
        affectedIds: { olmlId: currentRecord.olmlId, objectId: currentRecord.objectId },
        resultingHashes: semanticState
      }, currentRecord, semanticState));
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  async function persistPendingConflict(conflict) {
    if (!state.manifest || !conflict) return;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CONFLICTS, STORE_ACTIONS], "readwrite");
      const now = new Date().toISOString();
      tx.objectStore(STORE_CONFLICTS).put({
        id: `${state.manifest.olml.id}|${conflict.type}`,
        conflictId: `${state.manifest.olml.id}|${conflict.type}`,
        conflictType: conflict.type,
        olmlId: state.manifest.olml.id,
        objectId: state.manifest.object && state.manifest.object.id,
        memoryIds: (state.manifest.memories || []).map((memory) => memory.id),
        incomingHashes: conflict.incomingHashes || state.candidateSemanticState || {},
        currentHashes: conflict.currentHashes || null,
        hashProfile: HASH_PROFILE,
        sourceName: state.sourceName,
        detectedAt: now,
        reason: conflict.message,
        status: "pending"
      });
      tx.objectStore(STORE_ACTIONS).put({
        id: `action:${crypto.randomUUID()}`,
        type: "conflict-postponed",
        at: now,
        affectedIds: {
          olmlId: state.manifest.olml.id,
          objectId: state.manifest.object && state.manifest.object.id,
          memoryIds: (state.manifest.memories || []).map((memory) => memory.id)
        },
        previousHashes: conflict.currentHashes || {},
        resultingHashes: conflict.incomingHashes || state.candidateSemanticState || {},
        changedScopes: ["Conflict"],
        changedFields: [],
        assetSummary: [],
        conflictDecision: "postponed"
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  async function persistSiblingObjectHashConflicts(siblings, currentRecord, semanticState, changes) {
    const affected = (siblings || []).filter((sibling) => sibling && sibling.olmlId && sibling.objectStateHash !== semanticState.objectStateHash);
    if (!affected.length) return;
    const db = await openDb();
    const now = new Date().toISOString();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CONFLICTS, STORE_ACTIONS], "readwrite");
      const conflicts = tx.objectStore(STORE_CONFLICTS);
      for (const sibling of affected) {
        conflicts.put({
          id: `${sibling.olmlId}|shared-object-hash`,
          conflictId: `${sibling.olmlId}|shared-object-hash`,
          conflictType: "shared-object-hash",
          olmlId: sibling.olmlId,
          objectId: sibling.objectId,
          memoryIds: (sibling.manifest && sibling.manifest.memories || []).map((memory) => memory.id),
          incomingHashes: {
            hashProfile: semanticState.hashProfile || HASH_PROFILE,
            objectStateHash: semanticState.objectStateHash,
            sourceOlmlId: currentRecord.olmlId
          },
          currentHashes: semanticHashSummary(sibling),
          hashProfile: HASH_PROFILE,
          sourceName: collectionTitle(sibling),
          detectedAt: now,
          reason: "Object info updated, this file uses the same object.id and needs a re-export.",
          status: "pending"
        });
      }
      tx.objectStore(STORE_ACTIONS).put({
        id: `action:${crypto.randomUUID()}`,
        type: "shared-object-conflicts-created",
        at: now,
        affectedIds: {
          olmlId: currentRecord.olmlId,
          objectId: currentRecord.objectId,
          siblingOlmlIds: affected.map((sibling) => sibling.olmlId)
        },
        previousHashes: {},
        resultingHashes: semanticState,
        changedScopes: summarizeChangedScopes(changes),
        changedFields: changedFieldNamesFromChanges(changes),
        assetSummary: [],
        conflictDecision: "pending-reexport"
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  async function removeRecordsTransaction({ olmlIds, objectIds, actionType, affectedIds, summaryLabel }) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, STORE_OBJECTS, STORE_COLLECTIONS, STORE_ACTIONS], "readwrite");
      for (const olmlId of olmlIds || []) {
        tx.objectStore(STORE_NAME).delete(olmlId);
        tx.objectStore(STORE_COLLECTIONS).delete(olmlId);
      }
      for (const objectId of objectIds || []) tx.objectStore(STORE_OBJECTS).delete(objectId);
      tx.objectStore(STORE_ACTIONS).put({
        id: `action:${crypto.randomUUID()}`,
        type: actionType,
        at: new Date().toISOString(),
        affectedIds,
        summaryLabel,
        resultingHashes: {},
        changedFields: ["local-removal"],
        assetSummary: [],
        tombstone: true,
        note: "Local removal only; exported disk files are unaffected."
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  async function savePublicationLocation() {
    if (!state.manifest) {
      setValidation([{ level: "error", message: "Open or create an OLML package before saving a publication location." }], true);
      return;
    }
    const url = els.publicationUrl.value.trim();
    if (!url) {
      setValidation([{ level: "warning", message: "No publication URL entered." }], true);
      return;
    }
    try {
      new URL(url);
    } catch (_) {
      setValidation([{ level: "error", message: "Publication location must be a valid URL." }], true);
      return;
    }
    const manifest = getCurrentManifest();
    const existing = await getPackageRecord(manifest.olml.id);
    const location = {
      url,
      kind: "remote-olml",
      revision: manifest.olml.history && manifest.olml.history.revision || existing && existing.revision || 1,
      sha256: existing && existing.sha256 || "",
      updatedAt: new Date().toISOString()
    };
    await putPackageRecord({
      ...(existing || {}),
      olmlId: manifest.olml.id,
      objectId: manifest.object.id,
      title: manifest.object.title || manifest.memories[0] && manifest.memories[0].title || "Untitled OLML",
      manifest: existing && existing.manifest || stripEmpty(manifest),
      markers: deriveMarkerIndex(manifest),
      locations: mergeLocations(existing && existing.locations, location),
      catalogUpdatedAt: new Date().toISOString()
    });
    setValidation([{ level: "info", message: "Saved publication location to the browser-local Library Catalog. It was not written into olml.json." }], true);
    await refreshLibrary();
  }

  async function exportCatalog() {
    const records = await listPackageRecords();
    const catalog = {
      catalogVersion: CATALOG_VERSION,
      exportedAt: new Date().toISOString(),
      note: "OLML Library Catalog stores portable Library logs, semantic hashes, manifests, marker records, and remote locations. It does not contain .olml package bytes or bundled asset bytes.",
      entries: records.map(toCatalogEntry)
    };
    downloadBlob(new Blob([JSON.stringify(catalog, null, 2)], { type: "application/json" }), `olml-library-catalog-${dateStamp()}.json`);
  }

  async function importCatalogFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const catalog = JSON.parse(await file.text());
      const entries = Array.isArray(catalog.entries) ? catalog.entries : [];
      let merged = 0;
      for (const entry of entries) {
        if (!entry.olmlId) continue;
        const existing = await getPackageRecord(entry.olmlId);
        const manifest = entry.manifest ? normalizeManifest(entry.manifest).manifest : existing && existing.manifest || null;
        const objectProfile = entry.objectProfile || manifest && manifest.object || {};
        const objectMarkers = entry.objectMarkers || manifest && manifest.objectMarkers || [];
        const collectionProfile = entry.collectionProfile || manifest && manifest.olml || {};
        const memoryProfiles = entry.memoryProfiles || manifest && manifest.memories || [];
        const linkProfiles = entry.linkProfiles || manifest && manifest.links || [];
        const record = stripEmpty(buildPackageRecord({
          ...(existing || {}),
          olmlId: entry.olmlId,
          objectId: existing && existing.objectId || entry.objectId || (entry.objectIds || [])[0] || objectProfile.id || "",
          title: existing && existing.title || entry.title || entry.olmlId,
          manifest: existing && existing.manifest || manifest || undefined,
          objectProfile: existing && existing.objectProfile || objectProfile,
          objectMarkers: existing && existing.objectMarkers || objectMarkers,
          collectionProfile: existing && existing.collectionProfile || collectionProfile,
          memoryProfiles: existing && existing.memoryProfiles || memoryProfiles,
          linkProfiles: existing && existing.linkProfiles || linkProfiles,
          hashProfile: existing && existing.hashProfile || entry.hashProfile || HASH_PROFILE,
          objectStateHash: existing && existing.objectStateHash || entry.objectStateHash || "",
          memoryStateHashes: existing && existing.memoryStateHashes || entry.memoryStateHashes || [],
          collectionStateHash: existing && existing.collectionStateHash || entry.collectionStateHash || "",
          packageStateHash: existing && existing.packageStateHash || entry.packageStateHash || "",
          parentPackageStateHash: existing && existing.parentPackageStateHash || entry.parentPackageStateHash || "",
          lastPortableCollectionStateHash: existing && existing.lastPortableCollectionStateHash || entry.lastPortableCollectionStateHash || "",
          lastPortablePackageStateHash: existing && existing.lastPortablePackageStateHash || entry.lastPortablePackageStateHash || "",
          exportStatus: existing && existing.exportStatus || entry.exportStatus || "catalog",
          needsExportReasons: existing && existing.needsExportReasons || entry.needsExportReasons || [],
          savedAt: existing && existing.savedAt || entry.savedAt || "",
          readAt: existing && existing.readAt || entry.readAt || "",
          locations: mergeLocationLists(existing && existing.locations, entry.locations),
          markers: mergeMarkerLists(existing && existing.markers, entry.markers),
          catalogUpdatedAt: new Date().toISOString()
        }));
        await putPackageRecord(record);
        await putCatalogDerivedRecords(record);
        merged += 1;
      }
      setValidation([{ level: "info", message: `Imported ${merged} catalog entr${merged === 1 ? "y" : "ies"}. Existing local package bytes were preserved.` }], true);
      await refreshLibrary();
    } catch (error) {
      setValidation([{ level: "error", message: `Could not import catalog: ${error.message || String(error)}` }], true);
    }
  }

  async function putCatalogDerivedRecords(record) {
    if (!record || !record.objectId) return;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_OBJECTS, STORE_COLLECTIONS, STORE_MEMORIES], "readwrite");
      const objectProfile = record.objectProfile || record.manifest && record.manifest.object || {};
      tx.objectStore(STORE_OBJECTS).put({
        objectId: record.objectId,
        profile: structuredClone(objectProfile),
        markers: structuredClone(record.objectMarkers || record.manifest && record.manifest.objectMarkers || []),
        markerEvidence: markerEvidenceCurrentRecords(record.objectMarkers || record.manifest && record.manifest.objectMarkers || []),
        objectStateHash: record.objectStateHash || "",
        hashProfile: record.hashProfile || HASH_PROFILE,
        updatedAt: record.savedAt || record.catalogUpdatedAt || new Date().toISOString()
      });
      tx.objectStore(STORE_COLLECTIONS).put({
        olmlId: record.olmlId,
        objectId: record.objectId,
        metadata: structuredClone(record.collectionProfile || record.manifest && record.manifest.olml || {}),
        links: structuredClone(record.linkProfiles || record.manifest && record.manifest.links || []),
        collectionStateHash: record.collectionStateHash || "",
        packageStateHash: record.packageStateHash || "",
        parentPackageStateHash: record.parentPackageStateHash || "",
        lastPortableCollectionStateHash: record.lastPortableCollectionStateHash || "",
        lastPortablePackageStateHash: record.lastPortablePackageStateHash || "",
        hashProfile: record.hashProfile || HASH_PROFILE,
        latestPackageBytes: record.zip,
        exportStatus: record.exportStatus || "catalog",
        needsExportReasons: record.needsExportReasons || [],
        updatedAt: record.savedAt || record.catalogUpdatedAt || new Date().toISOString()
      });
      for (const memory of record.memoryProfiles || record.manifest && record.manifest.memories || []) {
        const hash = (record.memoryStateHashes || []).find((item) => item.memory === memory.id);
        tx.objectStore(STORE_MEMORIES).put({
          memoryId: memory.id,
          profile: structuredClone(memory),
          assets: catalogMemoryAssetRecords(memory, record),
          memoryStateHash: hash && hash.memoryStateHash || "",
          hashProfile: record.hashProfile || HASH_PROFILE,
          assetSummary: (memory.assets || []).map((path) => ({ path })),
          updatedAt: record.savedAt || record.catalogUpdatedAt || new Date().toISOString()
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function catalogMemoryAssetRecords(memory, record) {
    const manifestAssets = new Map(((record && record.manifest && record.manifest.assets) || []).map((asset) => [asset.path, asset]));
    return (memory.assets || []).map((path) => {
      const asset = manifestAssets.get(path) || {};
      return stripEmpty({
        path,
        name: asset.name,
        mediaType: asset.mediaType || asset.type,
        size: asset.size,
        url: asset.url,
        external: Boolean(asset.external || asset.url)
      });
    });
  }

  function updatePublicationField(manifest) {
    if (!els.publicationUrl) return;
    if (!manifest || !manifest.olml || !manifest.olml.id) {
      els.publicationUrl.value = "";
      return;
    }
    getPackageRecord(manifest.olml.id).then((record) => {
      if (!record) {
        els.publicationUrl.value = "";
        return;
      }
      els.publicationUrl.value = firstLocationUrl(record) || "";
    }).catch(() => {});
  }

  function toCatalogEntry(record) {
    const manifest = record.manifest || {};
    return stripEmpty({
      olmlId: record.olmlId,
      objectId: record.objectId || manifest.object && manifest.object.id,
      title: record.title,
      objectIds: [record.objectId || manifest.object && manifest.object.id].filter(Boolean),
      revision: record.revision || manifest.olml && manifest.olml.history && manifest.olml.history.revision,
      sha256: record.sha256,
      savedAt: record.savedAt,
      readAt: record.readAt,
      catalogUpdatedAt: record.catalogUpdatedAt,
      hashProfile: record.hashProfile || HASH_PROFILE,
      objectStateHash: record.objectStateHash,
      memoryStateHashes: record.memoryStateHashes || [],
      collectionStateHash: record.collectionStateHash,
      packageStateHash: record.packageStateHash,
      parentPackageStateHash: record.parentPackageStateHash,
      lastPortableCollectionStateHash: record.lastPortableCollectionStateHash,
      lastPortablePackageStateHash: record.lastPortablePackageStateHash,
      exportStatus: record.exportStatus,
      needsExportReasons: record.needsExportReasons || [],
      manifest: record.manifest || undefined,
      objectProfile: record.objectProfile || manifest.object,
      objectMarkers: record.objectMarkers || manifest.objectMarkers || [],
      collectionProfile: record.collectionProfile || manifest.olml,
      memoryProfiles: record.memoryProfiles || manifest.memories || [],
      linkProfiles: record.linkProfiles || manifest.links || [],
      locations: record.locations || [],
      markers: record.markers || deriveMarkerIndex(manifest)
    });
  }

  function deriveMarkerIndex(manifest) {
    if (!manifest || !Array.isArray(manifest.objectMarkers)) return [];
    return manifest.objectMarkers.map((marker) => {
      const evidence = markerEvidence(marker) || {};
      return stripEmpty({
        markerType: markerType(marker),
        objectId: marker.object || manifest.object && manifest.object.id,
        value: evidence.value,
        path: evidence.path,
        name: evidence.name,
        mediaType: evidence.mediaType || evidence.type,
        signature: evidence.value || evidence.path || marker.object || manifest.object && manifest.object.id
      });
    });
  }

  function firstLocationUrl(record) {
    const location = record && Array.isArray(record.locations) && record.locations.find((item) => item && item.url);
    return location ? location.url : "";
  }

  function mergeLocations(existing, next) {
    return mergeLocationLists(existing, [next]);
  }

  function mergeLocationLists(existing, incoming) {
    const byUrl = new Map();
    for (const item of [...(existing || []), ...(incoming || [])]) {
      if (!item || !item.url) continue;
      byUrl.set(item.url, { ...byUrl.get(item.url), ...item });
    }
    return Array.from(byUrl.values());
  }

  function mergeMarkerLists(existing, incoming) {
    const byKey = new Map();
    for (const item of [...(existing || []), ...(incoming || [])]) {
      if (!item) continue;
      const key = [item.markerType || item.method, item.objectId, item.signature || item.value || item.path].filter(Boolean).join("|");
      if (!key) continue;
      byKey.set(key, { ...byKey.get(key), ...item });
    }
    return Array.from(byKey.values());
  }

  async function sha256Digest(bytes) {
    const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const hash = await crypto.subtle.digest("SHA-256", source);
    return `sha256:${Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }

  function dateStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function getPackageRecord(olmlId) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await openDb();
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(olmlId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      } catch (error) {
        reject(error);
      }
    });
  }

  function listPackageRecords() {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await openDb();
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      } catch (error) {
        reject(error);
      }
    });
  }

  function listStoreRecords(storeName) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await openDb();
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      } catch (error) {
        reject(error);
      }
    });
  }

  async function deleteStoreRecord(storeName, key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  function firstObjectMarker(manifest) {
    return manifest && Array.isArray(manifest.objectMarkers) ? manifest.objectMarkers[0] : null;
  }

  function selectedObjectMarker(manifest) {
    if (!manifest || !Array.isArray(manifest.objectMarkers) || manifest.objectMarkers.length === 0) return null;
    const index = Math.max(0, Math.min(state.editingMarkerIndex || 0, manifest.objectMarkers.length - 1));
    state.editingMarkerIndex = index;
    return manifest.objectMarkers[index];
  }

  function makeId(kind, slug) {
    return `${kind}:${crypto.randomUUID()}`;
  }

  function retitleDraftId(value, kind, slug) {
    return String(value || "") || makeId(kind, slug);
  }

  function recordHistory(action) {
    const manifest = getCurrentManifest();
    const now = new Date().toISOString();
    const current = manifest.olml.history || {};
    const events = Array.isArray(current.events) ? current.events.slice(-19) : [];
    events.push({ at: now, action, tool: "OLML Solver Web App" });
    manifest.olml.history = {
      createdAt: current.createdAt || now,
      updatedAt: now,
      revision: Number(current.revision || 1) + 1,
      events
    };
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
  }

  function stripEmpty(value) {
    if (Array.isArray(value)) return value.map(stripEmpty);
    if (value && typeof value === "object") {
      const result = {};
      for (const [key, item] of Object.entries(value)) {
        if (item === "" || item == null) continue;
        if (Array.isArray(item) && item.length === 0) continue;
        const next = stripEmpty(item);
        if (next && typeof next === "object" && !Array.isArray(next) && Object.keys(next).length === 0) continue;
        result[key] = next;
      }
      return result;
    }
    return value;
  }

  function cleanupAssetUrls() {
    for (const url of state.assetUrls.values()) URL.revokeObjectURL(url);
    state.assetUrls.clear();
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  function guessMediaType(path) {
    const ext = path.toLowerCase().split(".").pop();
    const map = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      mp4: "video/mp4",
      mov: "video/quicktime",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      pdf: "application/pdf",
      usdz: "model/vnd.usdz+zip",
      glb: "model/gltf-binary"
    };
    return map[ext] || "application/octet-stream";
  }

  function titleCaseWords(value) {
    return String(value || "").replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function copyText(value) {
    if (!value) return;
    navigator.clipboard && navigator.clipboard.writeText(value).catch(() => {});
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function encodeUtf8(text) {
    return new TextEncoder().encode(text);
  }

  function decodeUtf8(buffer) {
    return new TextDecoder().decode(buffer);
  }

  async function readZipEntries(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const entries = new Map();
    const normalizedSeen = new Map();
    const caseSeen = new Map();
    let manifestCount = 0;
    let offset = 0;
    while (offset + 30 <= bytes.length) {
      const signature = view.getUint32(offset, true);
      if (signature !== 0x04034b50) break;
      const flags = view.getUint16(offset + 6, true);
      const method = view.getUint16(offset + 8, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const uncompressedSize = view.getUint32(offset + 22, true);
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      const nameStart = offset + 30;
      const nameEnd = nameStart + nameLength;
      const dataStart = nameEnd + extraLength;
      if (flags & 0x08) throw new Error("ZIP entries with data descriptors are not supported in this MVP.");
      if (nameEnd > bytes.length || dataStart + compressedSize > bytes.length) throw new Error("Invalid ZIP structure.");
      const name = decodeUtf8(bytes.slice(nameStart, nameEnd));
      const normalizedName = window.OLMLState.normalizePath(name);
      if (!normalizedName) throw new Error(`Unsafe ZIP path: ${name || "(blank)"}`);
      if (normalizedName === "olml.json") manifestCount += 1;
      if (normalizedSeen.has(normalizedName)) throw new Error(`Duplicate normalized ZIP path: ${normalizedName}`);
      normalizedSeen.set(normalizedName, name);
      const foldedName = normalizedName.toLowerCase();
      if (caseSeen.has(foldedName) && caseSeen.get(foldedName) !== normalizedName) throw new Error(`Case-colliding ZIP paths: ${caseSeen.get(foldedName)} and ${normalizedName}`);
      caseSeen.set(foldedName, normalizedName);
      const payload = bytes.slice(dataStart, dataStart + compressedSize);
      let data;
      if (method === 0) {
        data = payload;
      } else if (method === 8) {
        data = await inflateRaw(payload, uncompressedSize);
      } else {
        throw new Error(`Unsupported ZIP compression method ${method} for ${name}.`);
      }
      entries.set(normalizedName, data);
      offset = dataStart + compressedSize;
    }
    if (entries.size === 0) throw new Error("No readable ZIP entries found.");
    if (manifestCount !== 1) throw new Error(`Expected exactly one olml.json, found ${manifestCount}.`);
    return entries;
  }

  async function inflateRaw(payload, expectedSize) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("This browser cannot decompress deflated ZIP entries. Re-export from OLML Solver or use a Chromium-based browser.");
    }
    const stream = new Blob([payload]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const buffer = await new Response(stream).arrayBuffer();
    if (expectedSize && buffer.byteLength !== expectedSize) {
      // Some ZIP tools store padded sizes; prefer readable data over rejecting.
    }
    return new Uint8Array(buffer);
  }

  function writeZip(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const now = new Date();
    const time = dosTime(now);
    const date = dosDate(now);
    for (const entry of entries) {
      const name = encodeUtf8(entry.path);
      const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, time, true);
      localView.setUint16(12, date, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, data.length, true);
      localView.setUint32(22, data.length, true);
      localView.setUint16(26, name.length, true);
      localView.setUint16(28, 0, true);
      local.set(name, 30);
      localParts.push(local, data);

      const central = new Uint8Array(46 + name.length);
      const centralView = new DataView(central.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, time, true);
      centralView.setUint16(14, date, true);
      centralView.setUint32(16, crc, true);
      centralView.setUint32(20, data.length, true);
      centralView.setUint32(24, data.length, true);
      centralView.setUint16(28, name.length, true);
      centralView.setUint16(30, 0, true);
      centralView.setUint16(32, 0, true);
      centralView.setUint16(34, 0, true);
      centralView.setUint16(36, 0, true);
      centralView.setUint32(38, 0, true);
      centralView.setUint32(42, offset, true);
      central.set(name, 46);
      centralParts.push(central);
      offset += local.length + data.length;
    }

    const centralOffset = offset;
    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, entries.length, true);
    endView.setUint16(10, entries.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, centralOffset, true);

    return concatUint8([...localParts, ...centralParts, end]);
  }

  function concatUint8(parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }

  function dosTime(date) {
    return (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  }

  function dosDate(date) {
    return ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  }

  let crcTable = null;
  function crc32(data) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let i = 0; i < 256; i += 1) {
        let c = i;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[i] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i += 1) {
      crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
})();
