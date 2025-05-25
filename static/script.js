function createTileFromTemplate(templateId, data) {
  const template = document.getElementById(templateId);
  const clone = template.content.cloneNode(true);
  const tile = clone.querySelector(".tile");

  tile.id = data.id;

  const label = tile.querySelector(".label");
  if (label) label.textContent = data.label || data.id;

  if (templateId === "template-number") {
    const num = tile.querySelector(".number-value");
    var unit = "";
    if (data.unit)
      unit = " " + data.unit;
    if (num) num.textContent = (data.value ?? "--") + unit;
  }

  if (templateId === "template-led") {
    const led = tile.querySelector(".led-indicator");
    if (led) {
      const isOn = data.state === "on";
      led.style.backgroundColor = isOn ? data.colorOn || "limegreen" : data.colorOff || "darkred";
    }
  }

  if (templateId === "template-button") {
    const button = tile.querySelector(".button");
    if (button) button.textContent = data.buttonText ?? "Activate";
  }

  if (templateId === "template-toggle") {
    const input = tile.querySelector("input[type='checkbox']");
    const slider = tile.querySelector(".slider");

    if (input && slider) {
      const isOn = data.defaultState === true;
      input.checked = isOn;

      slider.style.backgroundColor = isOn ? data.colorOn || "green" : data.colorOff || "red";

      input.addEventListener("change", () => {
        const nowOn = input.checked;
        slider.style.backgroundColor = nowOn ? data.colorOn || "green" : data.colorOff || "red";
      });
    }
  }

  return clone;
}

async function loadDashboard() {
  const dashboard = document.getElementById("dashboard");
  dashboard.innerHTML = ""; // Clear old content

  const response = await fetch("/config");
  const tiles = await response.json();

  for (const tileData of tiles) {
    const templateId = "template-" + tileData.type.toLowerCase();
    const tileEl = createTileFromTemplate(templateId, tileData);
    dashboard.appendChild(tileEl);
  }
}

loadDashboard();

setInterval(loadDashboard, 5000);

