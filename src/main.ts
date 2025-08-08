import "./style.css";
import {
  hexToOklch,
  getDefaultParameters,
  getFormulaDisplay,
  getParameterLabels,
  recalculatePalette,
  createInitialState,
  initializePaletteData,
  getActivePropertyFormula,
  updateActivePropertyFormula,
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

      // La UI se actualizará para mostrar la configuración de la nueva propiedad activa
      updateUI();
    });
  });

  // El botón fx ya no es necesario, el comportamiento se maneja con los botones de fórmula

  // Function buttons - Toggle de curvas (activar/desactivar) para la propiedad activa
  functionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const curveTypes = ['Linear', 'Normal', 'Quad', 'Arctan', 'Sine', 'Expo'] as const;
      const btnText = btn.textContent as typeof curveTypes[number];
      const currentFormula = getActivePropertyFormula(pluginState);

      // Si la curva ya está activa para esta propiedad, desactivarla
      if (currentFormula.activeCurve === btnText) {
        pluginState = updateActivePropertyFormula(pluginState, {
          activeCurve: null,
          curveParams: {}
        });
      } else {
        // Activar la nueva curva para esta propiedad
        pluginState = updateActivePropertyFormula(pluginState, {
          activeCurve: btnText,
          curveParams: getDefaultParameters(btnText)
        });
      }

      // Recalcular paleta
      pluginState = recalculatePalette(pluginState);
      updateUI();
    });
  });

  // Parameter sliders - Actualizar parámetros de curva para la propiedad activa
  paramSliders.forEach((slider, index) => {
    slider.addEventListener('input', (e) => {
      const currentFormula = getActivePropertyFormula(pluginState);
      
      // Solo procesar si hay una curva activa para la propiedad actual
      if (!currentFormula.activeCurve) return;

      const rawValue = parseFloat((e.target as HTMLInputElement).value);
      const labels = getParameterLabels(currentFormula.activeCurve);
      if (labels[index]) {
        // Scale the value based on parameter type and expected range
        let scaledValue = rawValue / 100;

        // Adjust scaling for specific parameters that need different ranges
        if (labels[index] === 'd') {
          scaledValue = (rawValue / 100) * 5; // d parameter typically ranges 0-5
        } else if (labels[index] === 'k') {
          scaledValue = (rawValue / 100) * 2; // k parameter typically ranges 0-2
        }

        // Actualizar los parámetros de la propiedad activa
        const newParams = { ...currentFormula.curveParams };
        newParams[labels[index] as keyof EasingParams] = scaledValue;
        
        pluginState = updateActivePropertyFormula(pluginState, {
          curveParams: newParams
        });

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

      // Al mover un slider manual, desactivar la fórmula para esa propiedad
      const currentFormula = getActivePropertyFormula(pluginState);
      if (currentFormula.activeCurve !== null) {
        pluginState = updateActivePropertyFormula(pluginState, {
          activeCurve: null,
          curveParams: {}
        });
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
  const currentFormula = getActivePropertyFormula(pluginState);
  if (currentFormula.activeCurve) {
    formulaDisplay.textContent = getFormulaDisplay(currentFormula.activeCurve);
  } else {
    formulaDisplay.textContent = '';
  }
}

// Update parameter controls
function updateParameterControls() {
  const parameterGroups = document.querySelectorAll('.parameter-group');
  const currentFormula = getActivePropertyFormula(pluginState);

  // Hide all parameter groups first
  parameterGroups.forEach(group => {
    (group as HTMLElement).style.display = 'none';
  });

  // Si hay una curva activa para la propiedad actual, mostrar sus parámetros
  if (currentFormula.activeCurve) {
    const labels = getParameterLabels(currentFormula.activeCurve);

    // Show and update relevant parameter groups
    labels.forEach((label, index) => {
      if (parameterGroups[index]) {
        (parameterGroups[index] as HTMLElement).style.display = 'flex';
        const labelEl = parameterGroups[index].querySelector('.param-label') as HTMLElement;
        const sliderEl = parameterGroups[index].querySelector('.param-slider') as HTMLInputElement;
        const valueEl = parameterGroups[index].querySelector('.param-value') as HTMLElement;

        labelEl.textContent = label;

        // Scale the slider value based on parameter type
        const paramValue = currentFormula.curveParams[label as keyof EasingParams] || 0;
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
  const currentFormula = getActivePropertyFormula(pluginState);
  if (currentFormula.activeCurve) {
    const labels = getParameterLabels(currentFormula.activeCurve);
    labels.forEach((label, index) => {
      if (paramValues[index]) {
        const paramValue = currentFormula.curveParams[label as keyof EasingParams] || 0;
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

  // Actualizar botones de función activos para la propiedad actual
  const currentFormula = getActivePropertyFormula(pluginState);
  functionBtns.forEach((btn) => {
    btn.classList.remove('active');
    if (currentFormula.activeCurve && btn.textContent === currentFormula.activeCurve) {
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
  const formulaDisplay = document.querySelector('.formula-display') as HTMLElement;
  const formulaPlaceholder = document.querySelector('.formula-placeholder') as HTMLElement;
  const currentFormula = getActivePropertyFormula(pluginState);

  // Los sliders individuales siempre se muestran
  slidersContainer.style.display = 'flex';

  // Los botones de fórmula (functionLeft) siempre se muestran
  functionLeft.style.display = 'block';

  if (currentFormula.activeCurve === null) {
    // Sin fórmula activa para la propiedad actual: mostrar placeholder y ocultar controles
    functionRight.style.display = 'none';
    functionCenter.style.display = 'flex'; // Mantener visible para mostrar el placeholder
    formulaDisplay.style.display = 'none';
    formulaPlaceholder.style.display = 'block';
    formulaIcon.classList.remove('active');
  } else {
    // Con fórmula activa para la propiedad actual: mostrar controles y ocultar placeholder
    functionRight.style.display = 'block';
    functionCenter.style.display = 'flex';
    formulaDisplay.style.display = 'block';
    formulaPlaceholder.style.display = 'none';
    formulaIcon.classList.add('active');
  }
}

// Listen for messages from plugin
window.addEventListener("message", (event) => {
  if (event.data.source === "penpot") {
    document.body.dataset.theme = event.data.theme;
  } else if (event.data.type === "base-color") {
    console.log('Received base color from plugin:', event.data.color);
    if (event.data.color) {
      try {
        pluginState.baseColor = hexToOklch(event.data.color);
        pluginState.isNodeSelected = true;
        colorPicker.value = event.data.color;

        // Reinicializar la paleta con el nuevo color base
        pluginState.paletteData = initializePaletteData(pluginState.baseColor, pluginState.amountOfShades);
        pluginState = recalculatePalette(pluginState);
        updateUI();
        console.log('Base color updated successfully');
      } catch (error) {
        console.error('Error updating base color:', error);
      }
    } else {
      pluginState.isNodeSelected = false;
      console.log('No object selected or no color found');
    }
  }
});

// Initialize the app
init();
