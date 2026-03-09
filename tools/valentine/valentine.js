/**
 * @file valentine.js
 *
 * Refactored (vibe coded) version of the pf2m.com
 * Valentine's Day Creator by Arian in March 2026.
 */
// @ts-check

// html2canvas v1.0.0-rc.1 is the last version that works here
import html2canvas from 'html2canvas';

const CdnMiiBase = 'https://cdn-mii.accounts.nintendo.com/2.0.0/miis/';

// OH NO ! Mii Studio cannot be used because it does not have CORS.
// (for some reason cdn-mii has a fully permissive CORS policy?????)
// Good thing I know an alternative... 🙂
// const ImagePngBase = 'https://studio.mii.nintendo.com/miis/image.png?data=';
const ImagePngBase = 'https://mii-unsecure.ariankordi.net/miis/image.png?shaderType=miitomo&data=';

// ---------------------------------------------------------
// Studio code support
// ---------------------------------------------------------

const hexToBytes = (/** @type {string} */ hex) => Uint8Array.from(
  { length: hex.length >>> 1 }, (_, i) =>
    Number.parseInt(hex.slice(i << 1, (i << 1) + 2), 16));

const bytesToHex = (/** @type {ArrayLike<number>} */ bytes) => Array.prototype.map.call(bytes,
  (/** @type {{ toString: function(number): string; }} */ x) =>
    x.toString(16).padStart(2, '0')).join(''); // padStart: ES2017

/** Obfuscate 46-byte raw studio data into the 47-byte URL hex format. */
function obfuscateStudioHex(/** @type {Uint8Array} */ src) {
  const dst = new Uint8Array(47);
  dst[0] = 0;
  for (let i = 0; i < 46; i++) {
    dst[i + 1] = (7 + (src[i] ^ dst[i])) % 256;
  }
  return bytesToHex(dst);
}

/**
 * Detect whether the ID field contains a cdn-mii ID or a studio code
 * and return the appropriate image URL base.
 * @param {string} input
 * @returns {{ mode: 'cdn', id: string } | { mode: 'studio', data: string }}
 */
function parseIdInput(input) {
  const stripped = input.replace(/\s+/g, '');
  // 94 hex chars = already-obfuscated studio URL data.
  if (/^[0-9a-fA-F]{94}$/.test(stripped)) {
    return { mode: 'studio', data: stripped };
  }
  // 92 hex chars = raw studio data (46 bytes), needs obfuscation.
  if (/^[0-9a-fA-F]{92}$/.test(stripped)) {
    return { mode: 'studio', data: obfuscateStudioHex(hexToBytes(stripped)) };
  }
  // Anything else (including 16-char hex) = cdn-mii ID.
  return { mode: 'cdn', id: stripped };
}

// ---------------------------------------------------------
// Color palettes: [gradient top, gradient bottom, text]
// ---------------------------------------------------------

/** @type {Record<string, [string, string, string]>} */
const COLOR_MAP = {
  red: ['#ff0000', '#ffa000', '#ff0000'],
  orange: ['#ff8000', '#806000', '#ff8000'],
  yellow: ['#ffff40', '#d8b000', '#ffff40'],
  yellowgreen: ['#00ff00', '#00c000', '#00ff00'],
  skyblue: ['#00ffff', '#0000ff', '#0080ff'],
  purple: ['#8000ff', '#600060', '#a000a0'],
  white: ['#ffffff', '#808080', '#ffffff'],
  black: ['#606060', '#000000', '#000000']
};

/** Default palette used for "pink" and any unrecognized value. */
const DEFAULT_COLORS = ['#ff00ff', '#8000ff', '#ff00ff'];

/** @returns {[string, string, string]} */
function getColors(/** @type {string} */ colorName) {
  return /** @type {[string, string, string]} */ (
    COLOR_MAP[colorName] || DEFAULT_COLORS
  );
}

// ---------------------------------------------------------
// DOM references (cached once)
// ---------------------------------------------------------

const backdropCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('backdrop'));
const miiCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('mii'));
const outputCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('output'));
const backdropCtx = /** @type {CanvasRenderingContext2D} */ (backdropCanvas.getContext('2d'));
const miiCtx = /** @type {CanvasRenderingContext2D} */ (miiCanvas.getContext('2d'));

const valentineEl = /** @type {HTMLElement} */ (document.getElementById('valentine'));
const messageEl = /** @type {HTMLTextAreaElement} */ (document.getElementById('message'));
const toLabel = /** @type {HTMLElement} */ (document.getElementById('to'));
const fromLabel = /** @type {HTMLElement} */ (document.getElementById('from'));
const fontStyleEl = /** @type {HTMLElement} */ (document.getElementById('font'));
const downloadBtn = /** @type {HTMLElement} */ (document.getElementById('download'));

// Form inputs.
const idInput = /** @type {HTMLInputElement} */ (document.getElementsByName('id')[0]);
const versionInput = /** @type {HTMLInputElement} */ (document.getElementsByName('version')[0]);
const expressionSelect = /** @type {HTMLSelectElement} */ (document.getElementsByName('expression')[0]);
const colorSelect = /** @type {HTMLSelectElement} */ (document.getElementsByName('color')[0]);
const shirtsCheckbox = /** @type {HTMLInputElement} */ (document.getElementsByName('shirts')[0]);
const fontSelect = /** @type {HTMLSelectElement} */ (document.getElementsByName('font')[0]);
const toInput = /** @type {HTMLInputElement} */ (document.getElementById('to-input'));
const fromInput = /** @type {HTMLInputElement} */ (document.getElementById('from-input'));

// ---------------------------------------------------------
// Background image (loaded once, reused across redraws)
// ---------------------------------------------------------

/** @type {HTMLImageElement | null} */
let cachedBgImage = null;

/** @returns {Promise<HTMLImageElement>} */
function loadBackgroundImage() {
  if (cachedBgImage) {
    return Promise.resolve(cachedBgImage);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      cachedBgImage = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = 'background.png';
  });
}

// ---------------------------------------------------------
// Settings
// ---------------------------------------------------------

/** Read all form values into a simple object. */
function readSettings() {
  const color = colorSelect.value;
  return {
    id: idInput.value,
    version: versionInput.value,
    expression: expressionSelect.value,
    color: color,
    clothesColor: shirtsCheckbox.checked ? color : 'default',
    font: fontSelect.value
  };
}

/** Sync non-canvas UI (font style, to/from labels) from current form values. */
function syncLabels() {
  const font = fontSelect.value;
  fontStyleEl.textContent = '#valentine, #message { font-family: \'' + font + '\', sans-serif; }';
  backdropCtx.font = '40px ' + font;
  toLabel.textContent = 'To: ' + toInput.value;
  fromLabel.textContent = 'From: ' + fromInput.value;
}

// ---------------------------------------------------------
// Canvas drawing
// ---------------------------------------------------------

/** Draw the gradient background, overlay image, then the Mii on top. */
function drawBackdrop() {
  const cfg = readSettings();
  const colors = getColors(cfg.color);

  loadBackgroundImage().then((bgImg) => {
    // Gradient fill.
    const gradient = backdropCtx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);
    backdropCtx.fillStyle = gradient;
    backdropCtx.fillRect(0, 0, backdropCanvas.width, backdropCanvas.height);

    // Background overlay (hearts/decorations).
    backdropCtx.drawImage(bgImg, 0, 0);

    // Draw the Mii into the right half.
    drawMii(cfg);
  });
}

/**
 * Fetch and draw the Mii face with a white outline into the backdrop.
 * @param {ReturnType<typeof readSettings>} cfg
 */
function drawMii(cfg) {
  miiCtx.clearRect(0, 0, miiCanvas.width, miiCanvas.height);

  const mii = new Image();
  mii.crossOrigin = 'anonymous';

  // Build the URL based on whether the input is a studio code or cdn-mii ID.
  const parsed = parseIdInput(cfg.id);
  const sharedParams = 'type=face&width=512' +
    '&expression=' + cfg.expression +
    '&characterYRotate=345' +
    '&clothesColor=' + cfg.clothesColor;

  mii.src = parsed.mode === 'studio'
    ? ImagePngBase + parsed.data + '&' + sharedParams
    : CdnMiiBase + parsed.id +
      '/image/aaaaaaaaaaaaaaaa-aaaaaaaaaaaaaaaa.png?' + sharedParams;

  mii.onload = () => {
    // Draw white outline by rendering the image at 8 offsets, filling
    // the composite silhouette with white, then drawing the image on top.
    const offsets = [-1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 0, 1, 1, 1];
    const thickness = 4;
    for (let i = 0; i < offsets.length; i += 2) {
      miiCtx.drawImage(mii, offsets[i] * thickness, offsets[i + 1] * thickness);
    }
    miiCtx.globalCompositeOperation = 'source-in';
    miiCtx.fillStyle = '#fff';
    miiCtx.fillRect(0, 0, miiCanvas.width, miiCanvas.height);
    miiCtx.globalCompositeOperation = 'source-over';
    miiCtx.drawImage(mii, 0, 0);

    // Composite the Mii canvas onto the right side of the backdrop.
    backdropCtx.drawImage(miiCanvas, 512, 0);
  };
}

// ---------------------------------------------------------
// Full UI update
// ---------------------------------------------------------

/** Read settings, sync labels, redraw canvas, apply text colors. */
function updateImage() {
  syncLabels();
  drawBackdrop();

  const textColor = getColors(colorSelect.value)[2];
  toLabel.style.color = textColor;
  fromLabel.style.color = textColor;
  messageEl.style.color = textColor;
  messageEl.style.paddingTop = paddingTop + 'px';
  messageEl.style.paddingBottom = paddingBottom + 'px';
}

// ---------------------------------------------------------
// Message textarea word-wrap
// ---------------------------------------------------------

const MAX_LINE_WIDTH = 496;
const MAX_LINES = 8;

/** Force word-wrap within the textarea to fit the canvas width. */
function wrapMessageText() {
  let lines = messageEl.value.split(/\r*\n/);

  for (let i = 0; i < lines.length; i++) {
    if (backdropCtx.measureText(lines[i]).width <= MAX_LINE_WIDTH) {
      continue;
    }

    let measured = '';
    let lastSpacePos = -1;

    for (let j = 0; j < lines[i].length - 1; j++) {
      measured += lines[i].charAt(j);
      if (lines[i].charAt(j) === ' ') {
        lastSpacePos = j;
      }

      if (backdropCtx.measureText(measured).width > MAX_LINE_WIDTH) {
        // Determine the split position: prefer breaking at a space.
        const splitPos = lastSpacePos === -1 ? j + 1 : lastSpacePos + 1;
        const overflow = lines[i].slice(splitPos);

        // Push overflow onto the next line (creating it if needed).
        lines[i + 1] = lines[i + 1] === undefined
          ? overflow
          : overflow + lines[i + 1];

        lines[i] = lines[i].slice(0, splitPos);
        break;
      }
    }
  }

  if (lines.length > MAX_LINES) {
    lines = lines.slice(0, MAX_LINES);
  }

  messageEl.value = lines.join('\n');

  // Vertically center the text based on line count.
  paddingTop = 184 - lines.length * 20;
  paddingBottom = 420 - paddingTop;
  messageEl.style.paddingTop = paddingTop + 'px';
  messageEl.style.paddingBottom = paddingBottom + 'px';
}

// ---------------------------------------------------------
// Download
// ---------------------------------------------------------

function downloadImage() {
  window.scrollTo(0, 0);

  html2canvas(valentineEl, {
    canvas: outputCanvas,
    width: 1024,
    height: 512,
    x: (valentineEl.scrollWidth / 2) - 512
  }).then(() => {
    const link = document.createElement('a');
    link.download = 'valentine.png';
    link.href = outputCanvas.toDataURL();
    document.body.append(link);
    link.click();
    link.remove();
  });
}

// ---------------------------------------------------------
// Event listeners
// ---------------------------------------------------------

// All selects and checkboxes trigger a full redraw.
for (const el of document.querySelectorAll('select, input[type=checkbox]')) {
  el.addEventListener('change', updateImage);
}

// Mii ID input triggers redraw on typing.
idInput.addEventListener('input', updateImage);

// To/From only need label sync, not a full canvas redraw.
toInput.addEventListener('input', syncLabels);
fromInput.addEventListener('input', syncLabels);

// Message textarea: word-wrap on input, lock scroll position.
messageEl.addEventListener('input', wrapMessageText);
messageEl.addEventListener('scroll', function () {
  this.scrollTop = 0;
  this.scrollLeft = 0;
});

downloadBtn.addEventListener('click', downloadImage);

// ---------------------------------------------------------
// Initial draw
// ---------------------------------------------------------

let paddingTop = 164;
let paddingBottom = 244;

updateImage();
