var canvas = document.getElementById("backdrop");
var ctx = canvas.getContext("2d");
var mCanvas = document.getElementById("mii");
var mCtx = mCanvas.getContext("2d");
var oCanvas = document.getElementById("output");
var oCtx = oCanvas.getContext("2d");
var settings = [];
var edited = false;
var paddingTop = 164;
var paddingBottom = 244;

function updateSettings() {
  settings.id = document.getElementsByName("id")[0].value;
  settings.version = document.getElementsByName("version")[0].value;
  settings.expression = document.getElementsByName("expression")[0].value;
  settings.color = document.getElementsByName("color")[0].value;
  if (document.getElementsByName("shirts")[0].checked) {
    settings.clothesColor = settings.color;
  } else {
    settings.clothesColor = "default";
  }
  document.getElementById("font").textContent = "#valentine, #message { font-family: '" + document.getElementsByName("font")[0].value + "', sans-serif; }";
  ctx.font = "40px " + document.getElementsByName("font")[0].value;
  document.getElementById("to").textContent = "To: " + document.getElementById("to-input").value;
  document.getElementById("from").textContent = "From: " + document.getElementById("from-input").value;
}

function getColors() {
  switch (settings.color) {
    case "red":
      colors = ["#ff0000", "#ffa000", "#ff0000"];
      break;
    case "orange":
      colors = ["#ff8000", "#806000", "#ff8000"];
      break;
    case "yellow":
      colors = ["#ffff40", "#d8b000", "#ffff40"];
      break;
    case "yellowgreen":
      colors = ["#00ff00", "#00c000", "#00ff00"];
      break;
    case "skyblue":
      colors = ["#00ffff", "#0000ff", "#0080ff"];
      break;
    case "purple":
      colors = ["#8000ff", "#600060", "#a000a0"];
      break;
    case "white":
      colors = ["#ffffff", "#808080", "#ffffff"];
      break;
    case "black":
      colors = ["#606060", "#000000", "#000000"];
      break;
    default: // pink is used if they select pink *or* if they somehow manage to select absolutely nothing
      colors = ["#ff00ff", "#8000ff", "#ff00ff"];
  }
  return colors;
}

function drawCanvas(ctx) {

  var bg = new Image();
  bg.src = "background.png";
  bg.onload = function() {
    var gradient = ctx.createLinearGradient(0, 0, 0, 512);
    var colors = getColors();
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bg, 0, 0);
    /*
        ctx.font = "48px Comfortaa";
      ctx.fillStyle = getColors()[2];
      ctx.textAlign = "left";
      printAtWordWrap(ctx, settings.text, 64, 256, 64, canvas.height);
        if(settings.tofrom) {
            ctx.textAlign = "left";
        ctx.fillText("To:" + settings.to, 64, 384);
        ctx.fillText("From:" + settings.from, 64, 448);
        }
        */
    drawMii();
  };
}

function drawMii() {
  mCtx.clearRect(0, 0, mCanvas.width, mCanvas.height);
  var mii = new Image();
  mii.crossOrigin = "anonymous";
  mii.src = "https://cdn-mii.accounts.nintendo.com/" + encodeURIComponent(settings.version) + ".0.0/miis/" + encodeURIComponent(settings.id) + "/image/aaaaaaaaaaaaaaaa-aaaaaaaaaaaaaaaa.png?type=face&width=512&expression=" + encodeURIComponent(settings.expression) + "&characterYRotate=345&clothesColor=" + encodeURIComponent(settings.clothesColor);
  mii.onload = function() {
    var dArr = [-1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 0, 1, 1, 1];
    var thickness = 4;
    for (var i = 0; i < dArr.length; i += 2) {
      mCtx.drawImage(mii, dArr[i] * thickness, dArr[i + 1] * thickness);
    }
    mCtx.globalCompositeOperation = "source-in";
    mCtx.fillStyle = "#fff";
    mCtx.fillRect(0, 0, mCanvas.width, mCanvas.height);
    mCtx.globalCompositeOperation = "source-over";
    mCtx.drawImage(mii, 0, 0);
    ctx.drawImage(mCanvas, 512, 0);
  }
}

function updateImage() {
  updateSettings();
  drawCanvas(ctx);
  document.getElementById("to").style.cssText = "color: " + getColors()[2];
  document.getElementById("from").style.cssText = "color: " + getColors()[2];
  document.getElementById("message").style.cssText = "color: " + getColors()[2];
  document.getElementById("message").style.paddingTop = paddingTop + "px";
  document.getElementById("message").style.paddingBottom = paddingBottom + "px";
}
document.getElementById("download").onclick = function() {
  /* if(!edited) {
    alert('You need to enter something before you can download the image.');
    return;
  } */
  window.scrollTo(0, 0);
  document.getElementById("valentine").style.csstext = "background-image: " + canvas.toDataURL();
  var exDee = ((512 - document.documentElement.clientWidth) * -0.5);
  if (exDee < 0) {
    exDee = 0;
  }
  html2canvas(document.getElementById("valentine"), {
    canvas: document.getElementById("output"),
    width: 1024,
    height: 512,
    x: (document.getElementById("valentine").scrollWidth / 2) - 512
  }).then(function() {
    var link = document.createElement("a");
    link.download = "valentine.png";
    link.href = oCanvas.toDataURL();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    delete link;
  });
}
for (var es = 0; es < document.getElementsByTagName("select").length; es++) {
  document.getElementsByTagName("select")[es].onchange = updateImage;
}
for (var es = 0; es < document.querySelectorAll("input[type=checkbox]").length; es++) {
  document.querySelectorAll("input[type=checkbox]")[es].onchange = updateImage;
}
document.getElementById("message").onscroll = function() {
  /*
      if (this.selectionStart || this.selectionStart == '0') {
          var startPos = this.selectionStart;
          var endPos = this.selectionEnd;
          this.value = this.value.substring(0, startPos) + "\n" + this.value.substring(endPos, this.value.length);
      } else {
          this.value += "\n";
      }*/
  this.scrollLeft = 0;
}
document.getElementById("message").onscroll = function() {
  this.scrollTop = 0;
  this.scrollLeft = 0;
}
document.getElementById("message").oninput = function() {
  edited = true;
  var lines = this.value.split(/\r*\n/);
  for (var i = 0; i < lines.length; i++) {
    if (ctx.measureText(lines[i]).width > 496) {
      var string = "";
      var lastSpacePos = -1;
      for (var j = 0; j < lines[i].length - 1; j++) {
        string = string + lines[i].charAt(j);
        if (lines[i].charAt(j) == " ") {
          lastSpacePos = j;
        }
        if (ctx.measureText(string).width > 496) {
          if (lastSpacePos === -1) {
            if (typeof lines[i + 1] === 'undefined') {
              lines[i + 1] = lines[i].substr(j + 1);
            } else {
              lines[i + 1] = lines[i].substr(j + 1) + lines[i + 1];
            }
            lines[i] = string.substr(0, j + 1);
          } else {
            if (typeof lines[i + 1] === 'undefined') {
              lines[i + 1] = lines[i].substr(lastSpacePos + 1);
            } else {
              lines[i + 1] = lines[i].substr(lastSpacePos + 1) + lines[i + 1];
            }
            lines[i] = lines[i].substr(0, lastSpacePos + 1);
          }
        }
      }
    }
  }
  if (lines.length > 8) {
    lines = lines.slice(0, 8);
  }
  this.value = lines.join("\n");
  paddingTop = 184 - lines.length * 20;
  paddingBottom = 420 - paddingTop;
  this.style.paddingTop = paddingTop + "px";
  this.style.paddingBottom = paddingBottom + "px";
}
document.getElementsByName("id")[0].oninput = updateImage;
document.getElementById("to-input").oninput = updateSettings;
document.getElementById("from-input").oninput = updateSettings;
window.onload = updateImage;
