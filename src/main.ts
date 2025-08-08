import "./style.css";
import {
  hexToOklch,
  getDefaultParameters,
  getFormulaDisplay,
  getParameterLabels,
  recalculatePalette,
  createInitialState,
  initializePaletteData,
  getPropertyRange,
  type PluginState,
  type EasingParams
} from './color-converter';

// Get the current theme from the URL
const searchParams = new URLSearchParams(window.location.search);
document.body.dataset.theme = searchParams.get("theme") ?? "light";

// State management usando la nueva arquitectura
let pluginState: PluginState = createInitialState({ l: 0.5, c: 0.1, h: 0 }, 10);

// Estado adicional para la UI
interface UIState {
  createAssets: boolean;
}

let uiState: UIState = {
  createAssets: true
};

// DOM elements
const palettePreview = document.querySelector('.palette-preview') as HTMLElement;
const colorPicker = document.querySelector('.color-picker') as HTMLInputElement;
const shadesSlider = document.querySelector('.horizontal-slider') as HTMLInputElement;
const shadeCount = document.querySelector('.shade-count') as HTMLElement;
const tabs = document.querySelectorAll('.tab');
const functionBtns = document.querySelectorAll('.function-btn');
const formulaDisplay = document.querySelector('.formula') as HTMLElement;
const formulaIcon = document.querySelector('.formula-icon') as HTMLElement;
// Estas variables se eliminan porque no se usan
const paramSliders = document.querySelectorAll('.param-slider') as NodeListOf<HTMLInputElement>;
const paramValues = document.querySelectorAll('.param-value') as NodeListOf<HTMLElement>;
const createAssetsCheckbox = document.querySelector('.create-variables') as HTMLInputElement;
const addBtn = document.querySelector('.add-btn') as HTMLButtonElement;

// Initialize the app
function init() {
  setupEventListeners();
  requestBaseColor();
  updateUI();
}

// Setup event listeners
function setupEventListeners() {
  // Color picker
  colorPicker.addEventListener('input', (e) => {
    const hex = (e.target as HTMLInputElement).value;
    pluginState.baseColor = hexToOklch(hex);
    // Reinicializar la paleta con el nuevo color base
    pluginState.paletteData = initializePaletteData(pluginState.baseColor, pluginState.amountOfShades);
    pluginState = recalculatePalette(pluginState);
    updateUI();
  });

  // Number of shades slider
  shadesSlider.addEventListener('input', (e) => {
    pluginState.amountOfShades = parseInt((e.target as HTMLInputElement).value);
    shadeCount.textContent = pluginState.amountOfShades.toString();
    // Reinicializar la paleta con el nuevo número de pasos
    pluginState.paletteData = initializePaletteData(pluginState.baseColor, pluginState.amountOfShades);
    pluginState = recalculatePalette(pluginState);
    updateUI();
  });

  // Channel tabs - Cambiar propiedad activa
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabNames = ['Luminance', 'Chroma', 'Hue'] as const;
      pluginState.activeProperty = tabNames[index];

      // Actualizar el rango de fórmula para la nueva propiedad
      pluginState.formulaRange = getPropertyRange(pluginState.activeProperty);

      // Si estamos en modo Formula, recalcular la paleta
      if (pluginState.editMode === 'Formula') {
        pluginState = recalculatePalette(pluginState);
      }

      updateUI();
    });
  });

  // El botón fx ya no es necesario, el comportamiento se maneja con los botones de fórmula

  // Function buttons - Toggle de curvas (activar/desactivar)
  functionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const curveTypes = ['Linear', 'Normal', 'Quad', 'Arctan', 'Sine', 'Expo'] as const;
      const btnText = btn.textContent as typeof curveTypes[number];

      // Si la curva ya está activa, desactivarla
      if (pluginState.easing.activeCurve === btnText) {
        pluginState.easing.activeCurve = null;
        pluginState.easing.curveParams = {};
        pluginState.editMode = 'Manual';
      } else {
        // Activar la nueva curva
        functionBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        pluginState.easing.activeCurve = btnText;
        pluginState.easing.curveParams = getDefaultParameters(btnText);
        pluginState.editMode = 'Formula';
      }

      // Recalcular paleta
      pluginState = recalculatePalette(pluginState);
      updateUI();
    });
  });

  // Parameter sliders - Actualizar parámetros de curva
  paramSliders.forEach((slider, index) => {
    slider.addEventListener('input', (e) => {
      // Solo procesar si hay una curva activa
      if (!pluginState.easing.activeCurve) return;

      const rawValue = parseFloat((e.target as HTMLInputElement).value);
      const labels = getParameterLabels(pluginState.easing.activeCurve);
      if (labels[index]) {
        // Scale the value based on parameter type and expected range
        let scaledValue = rawValue / 100;

        // Adjust scaling for specific parameters that need different ranges
        if (labels[index] === 'd') {
          scaledValue = (rawValue / 100) * 5; // d parameter typically ranges 0-5
        } else if (labels[index] === 'k') {
          scaledValue = (rawValue / 100) * 2; // k parameter typically ranges 0-2
        }

        pluginState.easing.curveParams[labels[index] as keyof EasingParams] = scaledValue;

        // Recalcular paleta con nuevos parámetros
        pluginState = recalculatePalette(pluginState);
        updateUI();
      }
    });
  });

  // Vertical sliders - Para ajuste manual de valores individuales
  // Estos se crearán dinámicamente en updateVerticalSliders()

  // Create assets checkbox
  createAssetsCheckbox.addEventListener('change', (e) => {
    uiState.createAssets = (e.target as HTMLInputElement).checked;
  });

  // Add button
  addBtn.addEventListener('click', () => {
    const palette = pluginState.paletteData.map(color => color.hex);
    parent.postMessage({
      type: 'add-palette',
      colors: palette,
      createAssets: uiState.createAssets
    }, "*");
  });
}

// Request base color from selected object
function requestBaseColor() {
  parent.postMessage({ type: 'get-base-color' }, "*");
}

// Update vertical sliders based on current tab and steps
function updateVerticalSliders() {
  const container = document.querySelector('.sliders-container') as HTMLElement;
  container.innerHTML = '';

  for (let i = 0; i < pluginState.amountOfShades; i++) {
    const sliderItem = document.createElement('div');
    sliderItem.className = 'slider-item';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'vertical-slider';
    slider.min = '0';
    slider.setAttribute('orient', 'vertical');

    const valueSpan = document.createElement('span');
    valueSpan.className = 'slider-value';

    // Set ranges and values based on current active property
    let value = 0;
    let maxRange = 100;

    switch (pluginState.activeProperty) {
      case 'Luminance':
        maxRange = 100; // 0-1
        value = pluginState.paletteData[i].l * 100;
        break;
      case 'Chroma':
        maxRange = 40; // 0-0.4 (40 represents 0.4 in the slider)
        value = (pluginState.paletteData[i].c / 0.4) * 40;
        break;
      case 'Hue':
        maxRange = 360; // 0-360 degrees
        value = pluginState.paletteData[i].h || 0;
        break;
    }

    slider.max = maxRange.toString();
    slider.value = value.toString();

    // Update value display
    updateSliderValueDisplay(valueSpan, value, pluginState.activeProperty);

    // Add event listener para modo manual
    slider.addEventListener('input', (e) => {
      const sliderValue = parseFloat((e.target as HTMLInputElement).value);
      updateSliderValueDisplay(valueSpan, sliderValue, pluginState.activeProperty);

      // Cambiar a modo manual si no estamos ya en él
      if (pluginState.editMode !== 'Manual') {
        pluginState.editMode = 'Manual';
      }

      // Actualizar el valor específico en paletteData
      switch (pluginState.activeProperty) {
        case 'Luminance':
          pluginState.paletteData[i].l = sliderValue / 100;
          break;
        case 'Chroma':
          pluginState.paletteData[i].c = (sliderValue / 40) * 0.4;
          break;
        case 'Hue':
          pluginState.paletteData[i].h = sliderValue;
          break;
      }

      // Recalcular solo los valores hex (modo manual)
      pluginState = recalculatePalette(pluginState);
      updatePalette();
    });

    sliderItem.appendChild(slider);
    sliderItem.appendChild(valueSpan);
    container.appendChild(sliderItem);
  }
}

// Update slider value display based on active property
function updateSliderValueDisplay(element: HTMLElement, value: number, property: PluginState['activeProperty']) {
  switch (property) {
    case 'Luminance':
      element.textContent = (value / 100).toFixed(2);
      break;
    case 'Chroma':
      element.textContent = ((value / 40) * 0.4).toFixed(2);
      break;
    case 'Hue':
      element.textContent = Math.round(value).toString();
      break;
  }
}



// Update formula display
function updateFormulaDisplay() {
  if (pluginState.easing.activeCurve) {
    formulaDisplay.textContent = getFormulaDisplay(pluginState.easing.activeCurve);
  } else {
    formulaDisplay.textContent = '';
  }
}

// Update parameter controls
function updateParameterControls() {
  const parameterGroups = document.querySelectorAll('.parameter-group');

  // Hide all parameter groups first
  parameterGroups.forEach(group => {
    (group as HTMLElement).style.display = 'none';
  });

  // Si hay una curva activa, mostrar sus parámetros
  if (pluginState.easing.activeCurve) {
    const labels = getParameterLabels(pluginState.easing.activeCurve);

    // Show and update relevant parameter groups
    labels.forEach((label, index) => {
      if (parameterGroups[index]) {
        (parameterGroups[index] as HTMLElement).style.display = 'flex';
        const labelEl = parameterGroups[index].querySelector('.param-label') as HTMLElement;
        const sliderEl = parameterGroups[index].querySelector('.param-slider') as HTMLInputElement;
        const valueEl = parameterGroups[index].querySelector('.param-value') as HTMLElement;

        labelEl.textContent = label;

        // Scale the slider value based on parameter type
        const paramValue = pluginState.easing.curveParams[label as keyof EasingParams] || 0;
        let sliderValue = paramValue * 100;
        if (label === 'd') {
          sliderValue = (paramValue / 5) * 100; // d parameter ranges 0-5
        } else if (label === 'k') {
          sliderValue = (paramValue / 2) * 100; // k parameter ranges 0-2
        }

        sliderEl.value = sliderValue.toString();
        valueEl.textContent = paramValue.toFixed(2);
      }
    });
  }
}

// Update parameter values display
function updateParameterValues() {
  if (pluginState.easing.activeCurve) {
    const labels = getParameterLabels(pluginState.easing.activeCurve);
    labels.forEach((label, index) => {
      if (paramValues[index]) {
        const paramValue = pluginState.easing.curveParams[label as keyof EasingParams] || 0;
        paramValues[index].textContent = paramValue.toFixed(2);
      }
    });
  }
}

// Update palette preview
function updatePalette() {
  const colors = pluginState.paletteData.map(color => color.hex);
  palettePreview.innerHTML = '';

  colors.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.background = color;
    palettePreview.appendChild(swatch);
  });
}

// Update UI
function updateUI() {
  updateVerticalSliders();
  updateFormulaDisplay();
  updateParameterControls();
  updateParameterValues();
  updatePalette();
  shadeCount.textContent = pluginState.amountOfShades.toString();
  shadesSlider.value = pluginState.amountOfShades.toString();
  createAssetsCheckbox.checked = uiState.createAssets;

  // Actualizar tabs activos
  tabs.forEach((tab, index) => {
    tab.classList.remove('active');
    const tabNames = ['Luminance', 'Chroma', 'Hue'];
    if (tabNames[index] === pluginState.activeProperty) {
      tab.classList.add('active');
    }
  });

  // Actualizar botones de función activos
  functionBtns.forEach((btn) => {
    btn.classList.remove('active');
    if (pluginState.easing.activeCurve && btn.textContent === pluginState.easing.activeCurve) {
      btn.classList.add('active');
    }
  });

  // Actualizar UI según el modo de edición
  updateModeUI();
}

// Actualizar UI según el modo de edición (Manual vs Formula)
function updateModeUI() {
  const slidersContainer = document.querySelector('.sliders-container') as HTMLElement;
  const functionLeft = document.querySelector('.function-left') as HTMLElement;
  const functionRight = document.querySelector('.function-right') as HTMLElement;
  const functionCenter = document.querySelector('.function-center') as HTMLElement;

  // Los sliders individuales siempre se muestran
  slidersContainer.style.display = 'flex';

  // Los botones de fórmula (functionLeft) siempre se muestran
  functionLeft.style.display = 'block';

  if (pluginState.easing.activeCurve === null) {
    // Sin fórmula activa: ocultar solo los controles de parámetros y la fórmula
    functionRight.style.display = 'none';
    functionCenter.style.display = 'none';
    formulaIcon.classList.remove('active');
  } else {
    // Con fórmula activa: mostrar controles de fórmula y parámetros
    functionRight.style.display = 'block';
    functionCenter.style.display = 'flex';
    formulaIcon.classList.add('active');
  }
}

// Listen for messages from plugin
window.addEventListener("message", (event) => {
  if (event.data.source === "penpot") {
    document.body.dataset.theme = event.data.theme;
  } else if (event.data.type === "base-color") {
    if (event.data.color) {
      pluginState.baseColor = hexToOklch(event.data.color);
      pluginState.isNodeSelected = true;
      colorPicker.value = event.data.color;

      // Reinicializar la paleta con el nuevo color base
      pluginState.paletteData = initializePaletteData(pluginState.baseColor, pluginState.amountOfShades);
      pluginState = recalculatePalette(pluginState);
      updateUI();
    } else {
      pluginState.isNodeSelected = false;
    }
  }
});

// Initialize the app
init();
