/**
 * @file Frontend script for pf2m.com/tools/mii (2026/pure JS/Fusion).
 *
 * Handles importing and converting Mii data to be displayed
 * via the studio.mii.nintendo.com API. Code for validating
 * data, scanning and decrypting Mii QR codes is also included.
 *
 * Uses the new MiiImportController, a "reusable" component
 * to assist with importing Mii data from various file formats.
 *
 * @author Arian Kordi <https://github.com/ariankordi>
 */

// @ts-check
import {
  MiiImportController,
  ImportParsedEvent,
  ImportErrorEvent,
  ImportSourceChangedEvent,
  MiiErrorReason
} from './MiiImportController.js';

// // ---------------------------------------------------------
// // Constants
// // ---------------------------------------------------------

/** CMOC entry number: 12 digits with optional dashes/spaces (e.g. "5403-6703-1484"). */
const ContestCodePattern = /^\d{4}-?\d{4}-?\d{4}$/;
/** Nintendo Account Mii ID: exactly 16 hex characters. */
const CdnMiiIdPattern = /^[0-9a-fA-F]{16}$/;

const CmocApiBase = 'https://mii-unsecure.ariankordi.net/cmoc_lookup/';
const CdnMiiBase = 'https://cdn-mii.accounts.nintendo.com/2.0.0/miis/';
const ImagePngBase = 'https://studio.mii.nintendo.com/miis/image.png?data=';

const FavoriteColorNames = [
  'Red', 'Orange', 'Yellow', 'Lime Green', 'Dark Green',
  'Dark Blue', 'Light Blue', 'Pink', 'Purple', 'Brown',
  'White', 'Black'
];

// // ---------------------------------------------------------
// // Codec utilities for text input parsing
// // ---------------------------------------------------------

const base64ToBytes = (/** @type {string} */ base64) =>
  Uint8Array.from(atob(base64), c => c.charCodeAt(0));

const hexToBytes = (/** @type {string} */ hex) => Uint8Array.from(
  { length: hex.length >>> 1 }, (_, i) =>
    Number.parseInt(hex.slice(i << 1, (i << 1) + 2), 16));

const bytesToHex = (/** @type {ArrayLike<number>} */ bytes) => Array.prototype.map.call(bytes,
  (/** @type {{ toString: function(number): string; }} */ x) =>
    x.toString(16).padStart(2, '0')).join(''); // padStart: ES2017

/** Parses either hex or Base64 -> U8, stripping spaces from the input. */
const parseHexOrBase64ToBytes = (/** @type {string} */ text) => {
  text = text.replace(/\s+/g, ''); // Strip spaces.
  // Check if it is hex, otherwise assume it is Base64.
  return /^[0-9a-fA-F]+$/.test(text)
    ? hexToBytes(text)
    : base64ToBytes(text);
};

// // ---------------------------------------------------------
// // URLs and fetching
// // ---------------------------------------------------------

/**
 * Fetch Mii data from a URL in a generic manner,
 * using Accept: application/octet-stream.
 * @param {string} urlBase - Base URL to use as a prefix.
 * @param {string} parameter - Input data to append after the URL.
 * @returns {Promise<Uint8Array>} Mii binary data.
 */
async function fetchData(urlBase, parameter) {
  const response = await fetch(urlBase + parameter, {
    // eslint-disable-next-line @stylistic/quote-props -- if not quoted then closure compiler flattens it
    headers: { 'Accept': 'application/octet-stream' }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || ('Data lookup failed: ' + response.status));
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

const buildImagePngUrl = (/** @type {string} */ data, /** @type {string} */ params) =>
  ImagePngBase + data + '&' + params;

const buildCdnMiiUrl = (/** @type {string} */ id, /** @type {string} */ params, format = 'png') =>
  `${CdnMiiBase}${id}/image/0000000000000000-0000000000000000.${format}?${params}`;

// // ---------------------------------------------------------
// // DOM references
// // ---------------------------------------------------------

const elById = (/** @type {string} */ id) => {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error('Element not found: ' + id);
  }
  return el;
};

const textInput = /** @type {HTMLInputElement} */ (elById('text-input'));
const fileInput = /** @type {HTMLInputElement} */ (elById('file-input'));
const qrStartBtn = elById('qr-start-btn');
const qrStopBtn = elById('qr-stop-btn');
const qrVideo = /** @type {HTMLVideoElement} */ (elById('qr-video'));
const qrContainer = elById('qr-container');
const qrFileInput = /** @type {HTMLInputElement} */ (elById('qr-file-input'));
const camList = /** @type {HTMLSelectElement} */ (elById('cam-list'));

const radioText = /** @type {HTMLInputElement} */ (elById('radio-text'));
const radioFile = /** @type {HTMLInputElement} */ (elById('radio-file'));
const radioQr = /** @type {HTMLInputElement} */ (elById('radio-qr'));
const rowText = elById('row-text');
const rowFile = elById('row-file');
const rowQr = elById('row-qr');
const loadedText = elById('loaded-text');
const loadedFile = elById('loaded-file');
const loadedQr = elById('loaded-qr');

const importStatus = elById('import-status');
const renderedImage = /** @type {HTMLImageElement} */ (elById('rendered-image'));
const loadingIndicator = elById('loading-indicator');
const studioCodeTextarea = /** @type {HTMLTextAreaElement} */ (elById('mii-studio-code'));
const dropOverlay = elById('drop-overlay');

// Options elements.
const widthSlider = /** @type {HTMLInputElement} */ (elById('width-slider'));
const widthLabel = elById('width-label');
const widthValue = /** @type {HTMLInputElement} */ (elById('width-value'));
const bgColorPicker = /** @type {HTMLInputElement} */ (elById('bg-color'));
const bgColorValue = /** @type {HTMLInputElement} */ (elById('bg-color-value'));
const bgOpacity = /** @type {HTMLInputElement} */ (elById('bg-opacity'));
const bgOpacityLabel = elById('bg-opacity-label');
const lightDirectionMode = /** @type {HTMLInputElement} */ (elById('light-direction-mode'));

// Mii info display elements.
const infoNickname = elById('info-nickname');
const infoCreator = elById('info-creator');
const infoBirthday = elById('info-birthday');
const infoFavoriteColor = elById('info-favorite-color');
const infoHeight = elById('info-height');
const infoBuild = elById('info-build');
const infoGender = elById('info-gender');
const infoLocalonly = elById('info-localonly');
const infoCopyable = elById('info-copyable');

// // ---------------------------------------------------------
// // Rendering state
// // ---------------------------------------------------------

/** @enum {number} */
const ImageSource = {
  Studio: 1,
  CdnMii: 2
};

/** @type {ImageSource} */
let imageSource = ImageSource.Studio;

/** Studio hexadecimal URL data (when mode is {@link ImageSource.Studio}). */
let currentStudioUrlData = '';

/** Nintendo Account/cdn-mii image ID (when mode is {@link ImageSource.CdnMii}). */
let currentCdnMiiId = '';

// // ---------------------------------------------------------
// // Controller setup
// // ---------------------------------------------------------

const controller = /* @__PURE__ */ new MiiImportController();

// File and QR use built-in sources.
const fileSourceId = controller.addFileInput(fileInput);
const qrSourceId = controller.addQrScanner({
  videoElement: qrVideo,
  startButton: qrStartBtn,
  stopButton: qrStopBtn,
  containerElement: qrContainer,
  fileInput: qrFileInput,
  cameraSelect: camList
});

/** Custom source for text input so that CMOC/cdn-mii IDs can be used alongside raw data. */
const textSourceId = controller.addCustomSource();

/**
 * Map of sources to DOM elements.
 * @type {Map<symbol, {row: HTMLElement, radio: HTMLInputElement,
 * input: HTMLInputElement | null, loadedIndicator: HTMLElement}>}
 */
const sourceUiMap = new Map([
  [textSourceId, { row: rowText, radio: radioText, input: textInput, loadedIndicator: loadedText }],
  [fileSourceId, { row: rowFile, radio: radioFile, input: fileInput, loadedIndicator: loadedFile }],
  [qrSourceId, { row: rowQr, radio: radioQr, input: null, loadedIndicator: loadedQr }]
]);

/** @type {Map<symbol, ImportParsedEvent>} */
const sourceResults = new Map();
/** @type {Map<symbol, 'idle' | 'loaded' | 'error'>} */
const sourceState = new Map();
for (const id of sourceUiMap.keys()) {
  sourceState.set(id, 'idle');
}

// // ---------------------------------------------------------
// // Activation of source rows by click / keyboard
// // ---------------------------------------------------------

for (const [id, ui] of sourceUiMap) {
  ui.row.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (target === ui.input || target.tagName === 'BUTTON') {
      return;
    }
    controller.setActiveSource(id);
  });
  ui.row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      controller.setActiveSource(id);
    }
  });
}

radioText.addEventListener('change', () => controller.setActiveSource(textSourceId));
radioFile.addEventListener('change', () => controller.setActiveSource(fileSourceId));
radioQr.addEventListener('change', () => controller.setActiveSource(qrSourceId));

// // ---------------------------------------------------------
// // Custom text input component
// // ---------------------------------------------------------

let textDebounceTimer = 0;
const DefaultDebounceMs = 500;

textInput.addEventListener('input', () => {
  clearTimeout(textDebounceTimer);
  textDebounceTimer = setTimeout(() => handleTextInput(), DefaultDebounceMs);
});

/**
 * Handles a custom, debounced text component that
 * supports CMOC and cdn-mii IDs alongside raw data.
 * @returns {Promise<void>}
 */
async function handleTextInput() {
  const value = textInput.value.trim();
  if (value.length === 0) {
    return;
  }

  controller.setActiveSource(textSourceId);
  // const type = detectInputType(value);

  if (ContestCodePattern.test(value)) {
  // if (type === 'contest') {
    setStatus('info', 'Looking up CMOC entry...');
    try {
      const data = await fetchData(CmocApiBase, value);
      controller.submitData(textSourceId, data); // Commit data on success.
    } catch (error) {
      setSourceState(textSourceId, 'error', '\u2718');
      const msg = error instanceof Error ? error.message : String(error);
      setStatus('error', 'CMOC lookup failed: ' + msg);
    }
  } else if (CdnMiiIdPattern.test(value)) { // (type === 'cdn') {
    // Nintendo Account IDs bypass the decoder entirely.
    imageSource = ImageSource.CdnMii; // Image is coming from CDN.
    currentCdnMiiId = value;

    setSourceState(textSourceId, 'loaded', '\u2714 Account ID');
    setStatus('ok', 'Nintendo Account Mii ID loaded.');

    // Clear info since we don't have decoded data.
    clearCharacterInfo();
    studioCodeTextarea.value = '';

    updateImage(); // Render via cdn-mii.
  } else {
    // Raw hex/base64 Mii data.
    try {
      const data = parseHexOrBase64ToBytes(value);
      controller.submitData(textSourceId, data);
    } catch {
      setSourceState(textSourceId, 'error', '\u2718');
      setStatus('error', 'Could not parse input as hex or base64.');
    }
  }

  // Save to localStorage on success.
  localStorage.setItem('importer-text-input', value);
}

// // ---------------------------------------------------------
// // Controller events
// // ---------------------------------------------------------

controller.on('sourceChanged', (/** @type {ImportSourceChangedEvent} */ evt) => {
  for (const [id, ui] of sourceUiMap) {
    const isActive = id === evt.activeSourceId;
    ui.row.classList.toggle('active', isActive);
    ui.radio.checked = isActive;
    if (ui.input) {
      ui.input.disabled = !isActive;
    }
    updateRowBorder(id);
  }

  // For the text source, re-evaluate the current input value rather
  // than replaying a stored event. This handles cdn-mii IDs (which
  // produce no ImportParsedEvent) and also picks up any edits.
  if (evt.activeSourceId === textSourceId) {
    handleTextInput();
    return;
  }

  const stored = sourceResults.get(evt.activeSourceId);
  if (stored) {
    updateCharacterResult(stored);
  } else if (sourceState.get(evt.activeSourceId) === 'idle') {
    clearStatus();
  }
});

controller.on('parsed', (/** @type {ImportParsedEvent} */ evt) => {
  sourceResults.set(evt.sourceId, evt);

  const name = evt.extraInfo.getNickname();
  const loadedName = name || evt.rawData.length + ' bytes';
  setSourceState(evt.sourceId, 'loaded', '\u2714 ' + loadedName);

  if (evt.sourceId === controller.activeSourceId) {
    updateCharacterResult(evt);
  }
});

controller.on('error', (/** @type {ImportErrorEvent} */ evt) => {
  setSourceState(evt.sourceId, 'error', '\u2718');

  // Check for specific error:
  let files;
  // Check if the error is file related.
  if (evt.sourceId.description === 'import-source-file' &&
    // Are files present?
    (files = fileInput.files) && files[0] &&
    // Is the file an image?
    files[0].type.startsWith('image/')
  ) {
    // They accidentally uploaded a QR code as an image.
    setStatus('error', 'Please upload your QR code where it says "upload QR image".');
    return;
  }

  // QR scanner specific error:
  if (evt.reason === MiiErrorReason.QrScanError) {
    const msg = evt.cause instanceof Error ? evt.cause.message : String(evt.cause);
    setStatus('error', 'QR scanner error: ' + msg);
    return;
  }

  if (evt.sourceId === controller.activeSourceId) {
    setStatus('error', evt.getFriendlyMessage());
  }
});

// // ---------------------------------------------------------
// // QR scanner events
// // ---------------------------------------------------------

controller.on('scanning', () => {
  setStatus('info', 'QR scanner active: point camera at a Mii QR code.');
  qrStopBtn.style.display = '';
  qrStartBtn.style.display = 'none';
  // camList.style.display = '';
});

controller.on('scannerStopped', () => {
  qrStopBtn.style.display = 'none';
  qrStartBtn.style.display = '';
  // camList.style.display = 'none';
  if (importStatus.classList.contains('status-info')) {
    clearStatus();
  }
});

// // ---------------------------------------------------------
// // Building the rendered image URL
// // ---------------------------------------------------------

/** Rebuild and set the Mii image src based on current state. */
function updateImage() {
  // if (imageSource === ImageSource.None) return;
  // Update computed values first.
  bgColorValue.value = getBgColor();
  widthValue.value = getWidthValue();

  /** Serialized options from the form as URL query parameters. */
  const params = serializeOptions();

  let url;
  if (imageSource === ImageSource.Studio && currentStudioUrlData) {
    url = buildImagePngUrl(currentStudioUrlData, params);
  } else if (imageSource === ImageSource.CdnMii && currentCdnMiiId) {
    // const format = /** @type {HTMLSelectElement} */ (elById('render-format')).value;
    url = buildCdnMiiUrl(currentCdnMiiId, params); // , format);
  }

  if (url) {
    const w = widthValue.value;
    // Display loading animation.
    loadingIndicator.style.display = '';
    const loadingSvg = loadingIndicator.firstElementChild;
    if (loadingSvg instanceof SVGElement) {
      loadingSvg.style.width = loadingSvg.style.height = w;
    }

    // Update the image.
    renderedImage.style.display = 'none';
    renderedImage.setAttribute('width', w);
    renderedImage.src = url;
  }
}

/** @returns {string} The background color value in format RRGGBBAA. */
function getBgColor() {
  const hex = bgColorPicker.value.replace('#', '').toUpperCase();
  const opacity = Number.parseInt(bgOpacity.value, 10);
  const opacityHex = opacity.toString(16).toUpperCase().padStart(2, '0');
  return hex + opacityHex;
}

/** @returns {string} The URL query parameter string from enabled inputs. */
function serializeOptions() {
  // Serialize all enabled .parameter fields.
  const searchParams = new URLSearchParams();
  /** @type {NodeListOf<HTMLInputElement|HTMLSelectElement>} */
  const inputs = document.querySelectorAll('.parameter:not(:disabled)');
  for (const input of inputs) {
    if (input.name && input.value) { // non-empty value
      searchParams.set(input.name, input.value);
    }
  }
  return searchParams.toString();
}

/**
 * Sync the width datalist slider to the hidden width field.
 * Replicates the original datalist label lookup logic.
 * @returns {string} The width value, or a default of 270.
 */
function getWidthValue() {
  let value;
  const datalistId = widthSlider.getAttribute('list');
  if (datalistId) {
    const datalist = document.getElementById(datalistId);
    if (datalist) {
      const option = datalist.querySelector(`option[value="${widthSlider.value}"]`);
      if (option instanceof HTMLElement) {
        widthLabel.textContent = option.getAttribute('label');
        value = option.dataset.width;
      }
    }
  }

  return value || '270'; // default value
}

const hideLoadingIndicator = () => {
  loadingIndicator.style.display = 'none';
  renderedImage.style.display = '';
};

// // ---------------------------------------------------------
// // Character result display
// // ---------------------------------------------------------

/**
 * Update the rendered character's icon and information from the event.
 * @param {ImportParsedEvent} evt
 */
function updateCharacterResult(evt) {
  // Update Studio source and URL data.
  imageSource = ImageSource.Studio;
  currentStudioUrlData = evt.studioHexUrl;
  // Update "Mii Studio code" area.
  studioCodeTextarea.value = bytesToHex(evt.studioData);

  if (evt.sourceId === controller.activeSourceId) {
    setStatus('ok', 'Loaded ' + evt.rawData.length + ' bytes.');
  }

  displayExtra(evt.extraInfo); // Update character info.

  updateImage(); // Render the image.
}

/**
 * Populate HTML character data fields from the MiiExtraInfo.
 * @param {typeof ImportParsedEvent.prototype.extraInfo} extra
 */
function displayExtra(extra) {
  infoNickname.textContent = extra.getNickname() || '?';
  infoCreator.textContent = extra.getCreatorName() || '?';

  // Birthday.
  if (extra.birthMonth && extra.birthDay) {
    const mm = String(extra.birthMonth).padStart(2, '0');
    const dd = String(extra.birthDay).padStart(2, '0');
    infoBirthday.textContent = mm + '/' + dd;
  } else {
    infoBirthday.textContent = '??/??';
  }

  infoFavoriteColor.textContent = FavoriteColorNames[extra.favoriteColor] || '?';
  infoHeight.textContent = String(extra.height);
  infoBuild.textContent = String(extra.build);
  infoGender.textContent = extra.gender === 0 ? 'Male' : 'Female';
  const yesOrNo = (/** @type {boolean} */ b) => b ? 'Yes' : 'No';
  infoLocalonly.textContent = yesOrNo(!extra.localonly); // opposite
  infoCopyable.textContent = yesOrNo(extra.copyable);
}

/** Reset all Mii info fields to defaults. */
function clearCharacterInfo() {
  infoNickname.textContent = '?';
  infoCreator.textContent = '?';
  infoBirthday.textContent = '??/??';
  infoFavoriteColor.textContent = '?';
  infoHeight.textContent = '?';
  infoBuild.textContent = '?';
  infoGender.textContent = '?';
  infoLocalonly.textContent = '?';
  infoCopyable.textContent = '?';
}

// // ---------------------------------------------------------
// // Options change handlers
// // ---------------------------------------------------------

// Range sliders: update adjacent .small span with current value.
for (const el of document.querySelectorAll('input[type=range]')) {
  el.addEventListener('input', () => {
    const input = /** @type {HTMLInputElement} */ (el);
    // Check for datalist label mapping.
    const listId = input.getAttribute('list');
    if (listId) {
      const datalist = document.getElementById(listId);
      if (datalist) {
        const option = datalist.querySelector('option[value="' + input.value + '"]');
        if (option && option.hasAttribute('label')) {
          const sibling = input.nextElementSibling;
          if (sibling && sibling.classList.contains('small')) {
            sibling.textContent = option.getAttribute('label');
          }
          return;
        }
      }
    }
    // No datalist or no label — just show the value.
    const sibling = input.nextElementSibling;
    if (sibling && sibling.classList.contains('small')) {
      sibling.textContent = input.value;
    }
  });
}

// Opacity slider label.
bgOpacity.addEventListener('input', () => {
  bgOpacityLabel.textContent = bgOpacity.value;
});

// Light checkbox toggles light direction inputs.
lightDirectionMode.addEventListener('change', () => {
  const lightDirectionEnabled = lightDirectionMode.value !== 'none';
  for (const el of document.querySelectorAll('.light')) {
    /** @type {HTMLInputElement} */ (el).disabled = !lightDirectionEnabled;
  }
});

// Switch width datalist between face and body when render type changes.
const typeSelect = /** @type {HTMLSelectElement} */ (
  document.querySelector('.parameter[name="type"]'));
typeSelect.addEventListener('change', () => {
  const newListId = typeSelect.value === 'all_body'
    ? 'widths-body'
    : 'widths-face';
  widthSlider.setAttribute('list', newListId);
  // Set the max to the last option in the list.
  widthSlider.setAttribute('max',
    /** @type {HTMLInputElement} */ (document.querySelector(`#${newListId} > option:last-of-type`)).value);
});

// Any option change triggers image rebuild.
for (const el of document.querySelectorAll('.parameter, .parameters select, .parameters input')) {
  el.addEventListener('change', updateImage);
}

// // ---------------------------------------------------------
// // Drag and drop
// // ---------------------------------------------------------

let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter += 1;
  dropOverlay.style.display = '';
});

document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter -= 1;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropOverlay.style.display = 'none';
  }
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.style.display = 'none';

  let files;
  if (!e.dataTransfer || !(files = e.dataTransfer.files) ||
    files.length <= 0) {
    return;
  }
  const file = files[0];

  // If the file is an image, route to QR scanner (image scan).
  if (file.type.startsWith('image/')) {
    // Programmatically set the QR file input and trigger.
    const dt = new DataTransfer();
    dt.items.add(file);
    qrFileInput.files = dt.files;
    qrFileInput.dispatchEvent(new Event('change'));
  } else {
    // Any other file goes to the file input.
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
  }
});

// // ---------------------------------------------------------
// // UI utilities
// // ---------------------------------------------------------

/**
 * @param {symbol} id
 * @param {'idle' | 'loaded' | 'error'} state
 * @param {string} indicator
 */
function setSourceState(id, state, indicator) {
  sourceState.set(id, state);
  updateRowBorder(id);

  // Update the loading indicator text.
  const ui = sourceUiMap.get(id);
  if (ui) {
    ui.loadedIndicator.textContent = indicator;
    ui.loadedIndicator.style.display = '';
  }
}

/** Update a source row's border color class. */
function updateRowBorder(/** @type {symbol} */ id) {
  const ui = sourceUiMap.get(id);
  if (!ui) {
    return;
  }
  const state = sourceState.get(id);
  ui.row.classList.remove('state-loaded', 'state-error', 'state-idle');
  ui.row.classList.add('state-' + state);
}

function setStatus(/** @type {string} */ type, /** @type {string} */ message) {
  importStatus.className = 'status-' + type;
  importStatus.textContent = message;
}

function clearStatus() {
  importStatus.className = '';
  importStatus.textContent = '';
}

// // ---------------------------------------------------------
// // Initialization
// // ---------------------------------------------------------

// Load saved text input.
const savedText = localStorage.getItem('importer-text-input');
if (savedText) {
  textInput.value = savedText;
}

/*
// Hide QR elements initially.
camList.style.display = 'none';
qrStopBtn.style.display = 'none';

// Activate text source by default and trigger parse.
controller.setActiveSource(textSourceId);
*/

// Add event handlers to hide the loading indicator.
renderedImage.addEventListener('load', hideLoadingIndicator);
renderedImage.addEventListener('error', hideLoadingIndicator);

// Trigger initial parse.
if (textInput.value.trim().length > 0) {
  // Fire immediately with minimal delay for initial load.
  // setTimeout(() => handleTextInput(), 30);
  handleTextInput();
}
