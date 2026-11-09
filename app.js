// Ruta a la subcarpeta local con el modelo exportado
const URL_MODEL = "./modelo/";

let model, webcam, labelContainer, maxPredictions;
let isWebcamActive = false;
let threshold = 0.70; // 70% por defecto
let lastLoggedClass = "";
let lastLoggedTime = 0;

const btnStart = document.getElementById("btn-start");
const btnStop = document.getElementById("btn-stop");
const customMessage = document.getElementById("custom-message");
const historyList = document.getElementById("history-list");
const imagePreview = document.getElementById("image-preview");
const webcamContainer = document.getElementById("webcam-container");

async function loadModel() {
  if (!model) {
    const modelURL = URL_MODEL + "model.json";
    const metadataURL = URL_MODEL + "metadata.json";
    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();
    buildLabelBars();
  }
}

function buildLabelBars() {
  labelContainer = document.getElementById("label-container");
  labelContainer.innerHTML = "";
  for (let i = 0; i < maxPredictions; i++) {
    const bar = document.createElement("div");
    bar.className = "bar-wrapper";
    bar.innerHTML = `
      <div class="bar-info">
        <span id="class-name-${i}">Clase ${i}</span>
        <span id="class-prob-${i}">0%</span>
      </div>
      <div class="progress-track">
        <div id="class-fill-${i}" class="progress-fill"></div>
      </div>
    `;
    labelContainer.appendChild(bar);
  }
}

async function startWebcam() {
  await loadModel();
  imagePreview.style.display = "none";
  webcamContainer.style.display = "block";

  // Configuración webcam de Teachable Machine (ancho, alto, espejo)
  const flip = true;
  webcam = new tmImage.Webcam(240, 240, flip);
  await webcam.setup();
  await webcam.play();
  
  webcamContainer.innerHTML = "";
  webcamContainer.appendChild(webcam.canvas);

  isWebcamActive = true;
  btnStart.disabled = true;
  btnStop.disabled = false;
  window.requestAnimationFrame(loop);
}

async function loop() {
  if (isWebcamActive) {
    webcam.update();
    await predict(webcam.canvas);
    window.requestAnimationFrame(loop);
  }
}

function stopWebcam() {
  if (webcam) {
    webcam.stop();
  }
  isWebcamActive = false;
  btnStart.disabled = false;
  btnStop.disabled = true;
  customMessage.className = "alert-box alert-waiting";
  customMessage.textContent = "Webcam detenida.";
}

async function predict(imageElement) {
  const prediction = await model.predict(imageElement);
  let highestProb = 0;
  let bestClass = "";

  for (let i = 0; i < maxPredictions; i++) {
    const prob = prediction[i].probability;
    const percent = (prob * 100).toFixed(1) + "%";
    
    document.getElementById(`class-name-${i}`).innerText = prediction[i].className;
    document.getElementById(`class-prob-${i}`).innerText = percent;
    document.getElementById(`class-fill-${i}`).style.width = percent;

    if (prob > highestProb) {
      highestProb = prob;
      bestClass = prediction[i].className;
    }
  }

  // Comprobación contra el umbral configurado
  if (highestProb >= threshold) {
    customMessage.className = "alert-box alert-success";
    customMessage.textContent = `Coincidencia confirmada: "${bestClass}" (${(highestProb * 100).toFixed(0)}%)`;
    
    // Evita saturar el historial guardando solo cada 2.5s o si cambia de clase
    const now = Date.now();
    if (bestClass !== lastLoggedClass || now - lastLoggedTime > 2500) {
      addHistoryEntry(bestClass, highestProb);
      lastLoggedClass = bestClass;
      lastLoggedTime = now;
    }
  } else {
    customMessage.className = "alert-box alert-warning";
    customMessage.textContent = `Confianza baja (< ${(threshold * 100).toFixed(0)}%). Objeto dudoso.`;
  }
}

async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (isWebcamActive) {
    stopWebcam();
  }

  await loadModel();

  const reader = new FileReader();
  reader.onload = function(e) {
    imagePreview.src = e.target.result;
    imagePreview.style.display = "block";
    webcamContainer.style.display = "none";

    imagePreview.onload = async function() {
      await predict(imagePreview);
    };
  };
  reader.readAsDataURL(file);
}

function updateThreshold(val) {
  threshold = val / 100;
  document.getElementById("threshold-val").textContent = `${val}%`;
}

function addHistoryEntry(className, prob) {
  const emptyNotice = historyList.querySelector(".history-empty");
  if (emptyNotice) emptyNotice.remove();

  const li = document.createElement("li");
  const time = new Date().toLocaleTimeString();
  li.innerHTML = `<span><strong>${className}</strong> (${(prob * 100).toFixed(1)}%)</span> <span style="color: #a6adc8">${time}</span>`;
  historyList.prepend(li);
}

function clearHistory() {
  historyList.innerHTML = '<li class="history-empty">No hay registros aún.</li>';
  lastLoggedClass = "";
}