let configCache = [];

async function loadDashboard() {
  const dashboard = document.getElementById("dashboard");
  dashboard.innerHTML = "";

  const response = await fetch("/config");
  configCache = await response.json();

  for (const tileData of configCache) {
    const templateId = "template-" + tileData.type.toLowerCase();
    const tileEl = createTileFromTemplate(templateId, tileData);
    dashboard.appendChild(tileEl);
  }

  applyData();
}

function createTileFromTemplate(templateId, data) {
  const template = document.getElementById(templateId);
  const clone = template.content.cloneNode(true);
  const tile = clone.querySelector(".tile");

  tile.id = data.id;

  const label = tile.querySelector(".label");
  if (label) label.textContent = data.label || data.id;

  const type = data.type.toLowerCase();

  // MULTILED: create per-LED DOM elements
  if (type === "multiled") {
    const container = tile.querySelector(".led-strip-container");

    if (container && Array.isArray(data.leds)) {
      data.leds.forEach((ledData, i) => {
        const wrapper = document.createElement("div");
        wrapper.classList.add("led-wrapper");

        const led = document.createElement("div");
        led.classList.add("led-indicator");

        const ledLabel = document.createElement("div");
        ledLabel.textContent = ledData.label || `#${i + 1}`;

        wrapper.appendChild(led);
        wrapper.appendChild(ledLabel);
        container.appendChild(wrapper);
      });
    }
  }

  return clone;
}

function applyDataToTile(tileDef, tileEl, state) {
  const type = tileDef.type.toLowerCase();

  // Number
  if (type === "number") {
    const valEl = tileEl.querySelector(".number-value");
    const unit = tileDef.unit ? " " + tileDef.unit : "";
    if (valEl) valEl.textContent = (state.value ?? "--") + unit;
  }

  // LED
  if (type === "led") {
    const led = tileEl.querySelector(".led-indicator");
    if (led) {
      const isOn = state.state === "on";
      led.style.backgroundColor = isOn
        ? tileDef.colorOn || "limegreen"
        : tileDef.colorOff || "darkred";
    }
  }

  // Multi-LED
  if (type === "multiled") {
    const container = tileEl.querySelector(".led-strip-container");
    const defOn = tileDef.colorOn || "limegreen";
    const defOff = tileDef.colorOff || "darkred";

    if (!container || !Array.isArray(state.leds)) return;

    const leds = container.querySelectorAll(".led-indicator");
    state.leds.forEach((ledState, i) => {
      const led = leds[i];
      if (!led) return;

      const sub = tileDef.leds?.[i] || {};
      const isOn = ledState.state === true;

      led.style.backgroundColor = isOn
        ? sub.colorOn || tileDef.colorOn || defOn
        : sub.colorOff || tileDef.colorOff || defOff;
    });
  }

  // Button — state updates optional, for visual feedback
  if (type === "button") {
    const button = tileEl.querySelector(".button");
    if (button) button.textContent = tileDef.buttonText ?? "Activate";
  }

  // Toggle — update only if needed
  if (type === "toggle") {
    const input = tileEl.querySelector("input[type='checkbox']");
    const slider = tileEl.querySelector(".slider");

    if (input && slider && state.state !== undefined) {
      const isOn = state.state === true;
      input.checked = isOn;

      slider.style.backgroundColor = isOn
        ? tileDef.colorOn || "green"
        : tileDef.colorOff || "red";
    }
  }
}

async function applyData() {
  const res = await fetch("/data");
  const data = await res.json();

  for (const tileDef of configCache) {
    const tileEl = document.getElementById(tileDef.id);
    const state = data[tileDef.id];
    if (!tileEl || !state) continue;

    applyDataToTile(tileDef, tileEl, state);
  }
}

loadDashboard();

setInterval(applyData, 5000);
