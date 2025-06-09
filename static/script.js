let configCache = [];
const lastTileStates = {};
let keyMap = {};

function flashAnimation(tile) {
  tile.classList.add("tile-flash");

  setTimeout(() => {
    tile.classList.remove("tile-flash");
  }, 300);
}

function debounce(fn, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

function bindKeys() {
  keyMap = {}; // reset

  for (const tile of configCache) {
    if (!tile.key) continue;
    keyMap[tile.key.toLowerCase()] = tile.id;
  }
}

function sendCommand(id, value) {
  fetch("/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, value }),
  }).catch((err) => {
    console.error("Failed to send command:", err);
  });
}

async function loadDashboard() {
  const dashboard = document.getElementById("dashboard");
  dashboard.innerHTML = "";

  const response = await fetch("/config");
  configCache = await response.json();

  const groups = {};

  // Group tiles by the "group" field
  for (const tileData of configCache) {
    const groupName = tileData.group || "__ungrouped__";
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(tileData);
  }

  // Render each group
  for (const groupName in groups) {
    const group = document.createElement("div");
    group.className = "group";

    if (groupName !== "__ungrouped__") {
      const groupHeader = document.createElement("div");
      groupHeader.className = "group-header";
      groupHeader.textContent = groupName;
      group.appendChild(groupHeader);
    }

    const groupContainer = document.createElement("div");
    groupContainer.className = "group-container";

    for (const tileData of groups[groupName]) {
      const templateId = "template-" + tileData.type.toLowerCase();
      const tileEl = createTileFromTemplate(templateId, tileData);
      groupContainer.appendChild(tileEl);
    }

    group.appendChild(groupContainer);
    dashboard.appendChild(group);
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

  // Multi-LED
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

  // Combo-box
  if (type === "combo-box") {
    const comboBox = tile.querySelector(".combo-box-box");

    if (comboBox && Array.isArray(data.options)) {
      data.options.forEach((option) => {
        const optionEl = document.createElement("option");
        optionEl.textContent = option;
        optionEl.value = option;
        comboBox.appendChild(optionEl);
      });

      if (data.defaultOption) {
        comboBox.value = data.defaultOption;
      }


      const debouncedSendCombo = debounce(() => {
        sendCommand(data.id, comboBox.value);
        flashAnimation(tile);
      }, 1000);

      comboBox.addEventListener("change", debouncedSendCombo);
    }
  }

  // Toggle
  if (type === "toggle") {
    const input = tile.querySelector("input[type='checkbox']");
    const slider = tile.querySelector(".switch-slider");

    if (input && slider) {
      const isOn = data.defaultState === true;
      input.checked = isOn;

      slider.style.backgroundColor = isOn
        ? data.colorOn || "green"
        : data.colorOff || "red";

      input.addEventListener("change", () => {
        const nowOn = input.checked;

        slider.style.backgroundColor = nowOn
          ? data.colorOn || "green"
          : data.colorOff || "red";

        sendCommand(data.id, nowOn);
        flashAnimation(tile);
      });
    }
  }

  // Slider
  if (type === "slider") {
    const slider = tile.querySelector(".slider");
    const valueDisplay = tile.querySelector(".slider-value");

    if (slider && valueDisplay) {
      slider.min = data.min ?? 0;
      slider.max = data.max ?? 100;
      slider.step = data.step ?? 1;
      slider.keyStep = data.keyStep ?? 1;
      slider.value = data.defaultValue ?? 0;

      const unit = data.unit ?? "";
      const updateDisplay = () => {
        valueDisplay.textContent = `${slider.value}${unit}`;
      };

      updateDisplay();

      const debouncedSendSlider = debounce(() => {
        sendCommand(data.id, parseFloat(slider.value));
        flashAnimation(tile);
      }, 500);

      slider.addEventListener("input", updateDisplay);
      slider.addEventListener("input", debouncedSendSlider);

      if (data.color) {
        slider.style.setProperty("--slider-color", data.color);
      }
    }
  }

  if (type === "button") {
    const button = tile.querySelector(".action-button");
    if (button) {
      button.textContent = data.buttonText ?? "Activate";
      button.addEventListener("click", () => {
        sendCommand(data.id, true);
        flashAnimation(tile);
      });
    }
  }

  if (data.key) {
    const keyHint = document.createElement("div");
    keyHint.className = "key-hint";
    keyHint.textContent = `[${data.key}]`;
    tile.appendChild(keyHint);
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

  // Button
  if (type === "button") {
    const button = tileEl.querySelector(".button");
    if (button) button.textContent = tileDef.buttonText ?? "Activate";
  }

  // Toggle
  if (type === "toggle") {
    const input = tileEl.querySelector("input[type='checkbox']");
    const slider = tileEl.querySelector(".switch-slider");

    if (input && slider && state.state !== undefined) {
      const isOn = state.state === true;
      input.checked = isOn;

      slider.style.backgroundColor = isOn
        ? tileDef.colorOn || "green"
        : tileDef.colorOff || "red";
    }
  }

  // Combo-box
  if (type === "combo-box") {
    const comboBox = tileEl.querySelector(".combo-box-box");
    if (comboBox && state.option !== undefined) {
      comboBox.value = state.option;
    }
  }

  // Slider
  if (type === "slider") {
    const slider = tileEl.querySelector(".slider");
    const valueDisplay = tileEl.querySelector(".slider-value");

    if (slider && valueDisplay && state.value !== undefined) {
      slider.value = state.value;

      const unit = tileDef.unit ?? "";
      valueDisplay.textContent = `${state.value}${unit}`;
    }
  }

  const id = tileDef.id;

  const stateChanged =
    JSON.stringify(lastTileStates[id]) !== JSON.stringify(state);
  lastTileStates[id] = structuredClone(state);

  if (stateChanged) {
    flashAnimation(tileEl);
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

loadDashboard().then(bindKeys);

setInterval(applyData, 5000);

document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  const tileId = keyMap[key];
  if (!tileId) return;

  const tileEl = document.getElementById(tileId);
  if (!tileEl) return;

  // Handle button
  if (tileEl.classList.contains("button")) {
    const btn = tileEl.querySelector(".action-button");
    if (btn) btn.click();
  }

  // Handle toggle
  if (tileEl.classList.contains("toggle")) {
    const input = tileEl.querySelector("input[type='checkbox']");
    if (input) {
      input.checked = !input.checked;
      input.dispatchEvent(new Event("change"));
    }
  }

  // Handle combo box
  if (tileEl.classList.contains("combo-box")) {
    const select = tileEl.querySelector("select");
    if (select) {
      const dir = e.shiftKey ? -1 : 1;
      const newIndex = (select.selectedIndex + dir + select.options.length) % select.options.length;
      select.selectedIndex = newIndex;
      select.dispatchEvent(new Event("change"));
    }
  }

  // Handle slider
  if (tileEl.classList.contains("slider-tile")) {
    const slider = tileEl.querySelector("input[type='range']");
    if (slider) {
      const step = parseFloat(slider.keyStep || 1);
      const current = parseFloat(slider.value);
      const dir = e.shiftKey ? -1 : 1;
      const newValue = Math.min(Math.max(current + dir * step, slider.min), slider.max);

      slider.value = newValue;
      slider.dispatchEvent(new Event("input"));
      slider.dispatchEvent(new Event("change"));
    }
  }
});
