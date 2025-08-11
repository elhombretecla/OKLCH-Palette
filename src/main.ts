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
  saveOriginalPaletteState,
  resetPaletteToOriginal,
  hasAnyActiveFormula,
  type PluginState,
  type EasingParams
} from './color-converter';

// Get the current theme from the URL
const searchParams = new URLSearchParams(window.location.search);
document.body.dataset.theme = searchParams.get("theme") ?? "light";

// State management using the new architecture
let pluginState: PluginState = createInitialState({ l: 0.5, c: 0.1, h: 0 }, 10);

// Additional state for the UI
interface UIState {
  createAssets: boolean;
}

let uiState: UIState = {
  createAssets: false // Start disabled as requested
};

// DOM elements
const palettePreview = document.querySelector('.palette-preview') as HTMLElement;
const colorPicker = document.querySelector('.color-picker') as HTMLInputElement;
const shadesSlider = document.querySelector('.horizontal-slider') as HTMLInputElement;
const shadeCount = document.querySelector('.shade-count') as HTMLElement;
const tabs = document.querySelectorAll('.tab');
const functionBtns = document.querySelectorAll('.function-btn');
const formulaDisplay = document.querySelector('.formula') as HTMLElement;
// const formulaIcon = document.querySelector('.formula-icon') as HTMLElement; // Not used in current HTML
// These variables are removed because they are not used
const paramSliders = document.querySelectorAll('.param-slider') as NodeListOf<HTMLInputElement>;
const paramValues = document.querySelectorAll('.param-value') as NodeListOf<HTMLElement>;
const createAssetsCheckbox = document.querySelector('.create-variables') as HTMLInputElement;
const addBtn = document.querySelector('.add-btn') as HTMLButtonElement;
const resetBtn = document.querySelector('.reset-btn') as HTMLButtonElement;

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
    // Reinitialize the palette with the new base color
    pluginState.paletteData = initializePaletteData(pluginState.baseColor, pluginState.amountOfShades);
    // Clear original state since we're starting fresh with a new base color
    pluginState.originalPaletteData = null;
    // Reset all formulas since we have a new base color
    pluginState.formulas = {
      Luminance: { activeCurve: null, curveParams: {}, formulaRange: { from: 0, to: 1 } },
      Chroma: { activeCurve: null, curveParams: {}, formulaRange: { from: 0, to: 0.4 } },
      Hue: { activeCurve: null, curveParams: {}, formulaRange: { from: 0, to: 360 } }
    };
    pluginState = recalculatePalette(pluginState);
    updateUI();
  });

  // Number of shades slider
  shadesSlider.addEventListener('input', (e) => {
    pluginState.amountOfShades = parseInt((e.target as HTMLInputElement).value);
    shadeCount.textContent = pluginState.amountOfShades.toString();
    // Reinitialize the palette with the new number of steps
    pluginState.paletteData = initializePaletteData(pluginState.baseColor, pluginState.amountOfShades);
    // Clear original state since we're changing the structure
    pluginState.originalPaletteData = null;
    // Reset all formulas since we have a different number of shades
    pluginState.formulas = {
      Luminance: { activeCurve: null, curveParams: {}, formulaRange: { from: 0, to: 1 } },
      Chroma: { activeCurve: null, curveParams: {}, formulaRange: { from: 0, to: 0.4 } },
      Hue: { activeCurve: null, curveParams: {}, formulaRange: { from: 0, to: 360 } }
    };
    pluginState = recalculatePalette(pluginState);
    updateUI();
  });

  // Channel tabs - Change active property
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabNames = ['Luminance', 'Chroma', 'Hue'] as const;
      pluginState.activeProperty = tabNames[index];

      // The UI will update to show the configuration of the new active property
      updateUI();
    });
  });

  // The fx button is no longer necessary, the behavior is handled with the formula buttons

  // Function buttons - Toggle curves (activate/deactivate) for the active property
  functionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const curveTypes = ['Linear', 'Normal', 'Quad', 'Arctan', 'Sine', 'Expo'] as const;
      const btnText = btn.textContent as typeof curveTypes[number];
      const currentFormula = getActivePropertyFormula(pluginState);

      // If the curve is already active for this property, deactivate it
      if (currentFormula.activeCurve === btnText) {
        pluginState = updateActivePropertyFormula(pluginState, {
          activeCurve: null,
          curveParams: {}
        });
      } else {
        // Save original state before applying first formula (if not already saved)
        if (!hasAnyActiveFormula(pluginState)) {
          pluginState = saveOriginalPaletteState(pluginState);
        }

        // Activate the new curve for this property
        pluginState = updateActivePropertyFormula(pluginState, {
          activeCurve: btnText,
          curveParams: getDefaultParameters(btnText)
        });
      }

      // Recalculate palette
      pluginState = recalculatePalette(pluginState);
      updateUI();
    });
  });

  // Parameter sliders - Update curve parameters for the active property
  paramSliders.forEach((slider, index) => {
    slider.addEventListener('input', (e) => {
      const currentFormula = getActivePropertyFormula(pluginState);

      // Only process if there is an active curve for the current property
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

        // Update the parameters of the active property
        const newParams = { ...currentFormula.curveParams };
        newParams[labels[index] as keyof EasingParams] = scaledValue;

        pluginState = updateActivePropertyFormula(pluginState, {
          curveParams: newParams
        });

        // Recalculate palette with new parameters
        pluginState = recalculatePalette(pluginState);
        updateUI();
      }
    });
  });

  // Vertical sliders - For manual adjustment of individual values
  // These will be created dynamically in updateVerticalSliders()

  // Create assets checkbox
  createAssetsCheckbox.addEventListener('change', (e) => {
    uiState.createAssets = (e.target as HTMLInputElement).checked;
    updateButtonText();
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

  // Reset button
  resetBtn.addEventListener('click', () => {
    pluginState = resetPaletteToOriginal(pluginState);
    updateUI();
  });
}

// Request base color from selected object
function requestBaseColor() {
  parent.postMessage({ type: 'get-base-color' }, "*");
}

// Update button text based on create assets state
function updateButtonText() {
  if (uiState.createAssets) {
    addBtn.textContent = 'Add to my file + Create assets';
  } else {
    addBtn.textContent = 'Add to my file';
  }
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

    const valueInput = document.createElement('input');
    valueInput.type = 'number';
    valueInput.className = 'slider-value';

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
    updateSliderValueDisplay(valueInput, value, pluginState.activeProperty);

    // Add event listener for manual mode
    slider.addEventListener('input', (e) => {
      const sliderValue = parseFloat((e.target as HTMLInputElement).value);
      updateSliderValueDisplay(valueInput, sliderValue, pluginState.activeProperty);

      // When moving a manual slider, deactivate the formula for that property
      const currentFormula = getActivePropertyFormula(pluginState);
      if (currentFormula.activeCurve !== null) {
        pluginState = updateActivePropertyFormula(pluginState, {
          activeCurve: null,
          curveParams: {}
        });
      }

      // Update the specific value in paletteData
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

      // Recalculate only the hex values (manual mode)
      pluginState = recalculatePalette(pluginState);
      updatePalette();
    });

    // Add event listener for numeric input changes
    valueInput.addEventListener('input', (e) => {
      const inputValue = parseFloat((e.target as HTMLInputElement).value);
      if (isNaN(inputValue)) return;

      // When editing a numeric input, deactivate the formula for that property
      const currentFormula = getActivePropertyFormula(pluginState);
      if (currentFormula.activeCurve !== null) {
        pluginState = updateActivePropertyFormula(pluginState, {
          activeCurve: null,
          curveParams: {}
        });
      }

      // Update the slider and palette data based on the input value
      let sliderValue = inputValue;
      switch (pluginState.activeProperty) {
        case 'Luminance':
          sliderValue = inputValue * 100;
          pluginState.paletteData[i].l = inputValue;
          break;
        case 'Chroma':
          sliderValue = (inputValue / 0.4) * 40;
          pluginState.paletteData[i].c = inputValue;
          break;
        case 'Hue':
          sliderValue = inputValue;
          pluginState.paletteData[i].h = inputValue;
          break;
      }

      // Update the corresponding slider
      slider.value = Math.max(0, Math.min(maxRange, sliderValue)).toString();

      // Recalculate palette
      pluginState = recalculatePalette(pluginState);
      updatePalette();
    });

    // Set input attributes based on property type
    switch (pluginState.activeProperty) {
      case 'Luminance':
        valueInput.min = '0';
        valueInput.max = '1';
        valueInput.step = '0.01';
        break;
      case 'Chroma':
        valueInput.min = '0';
        valueInput.max = '0.4';
        valueInput.step = '0.01';
        break;
      case 'Hue':
        valueInput.min = '0';
        valueInput.max = '360';
        valueInput.step = '1';
        break;
    }

    sliderItem.appendChild(slider);
    sliderItem.appendChild(valueInput);
    container.appendChild(sliderItem);
  }
}

// Update slider value display based on active property
function updateSliderValueDisplay(element: HTMLInputElement, value: number, property: PluginState['activeProperty']) {
  switch (property) {
    case 'Luminance':
      element.value = (value / 100).toFixed(2);
      break;
    case 'Chroma':
      element.value = ((value / 40) * 0.4).toFixed(2);
      break;
    case 'Hue':
      element.value = Math.round(value).toString();
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

  // If there is an active curve for the current property, show its parameters
  if (currentFormula.activeCurve) {
    const labels = getParameterLabels(currentFormula.activeCurve);

    // Show and update relevant parameter groups
    labels.forEach((label, index) => {
      if (parameterGroups[index]) {
        (parameterGroups[index] as HTMLElement).style.display = 'flex';
        const labelEl = parameterGroups[index].querySelector('.param-label') as HTMLElement;
        const sliderEl = parameterGroups[index].querySelector('.param-slider') as HTMLInputElement;
        const valueEl = parameterGroups[index].querySelector('.param-value') as HTMLInputElement;

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
        valueEl.value = paramValue.toFixed(2);

        // Set input attributes based on parameter type
        valueEl.type = 'number';
        valueEl.step = '0.01';
        if (label === 'd') {
          valueEl.min = '0';
          valueEl.max = '5';
        } else if (label === 'k') {
          valueEl.min = '0';
          valueEl.max = '2';
        } else {
          valueEl.min = '0';
          valueEl.max = '1';
        }

        // Remove existing event listeners to avoid duplicates
        const newValueEl = valueEl.cloneNode(true) as HTMLInputElement;
        valueEl.parentNode?.replaceChild(newValueEl, valueEl);

        // Add event listener for direct numeric input
        newValueEl.addEventListener('input', (e) => {
          const inputValue = parseFloat((e.target as HTMLInputElement).value);
          if (isNaN(inputValue)) return;

          // Update the parameters of the active property
          const newParams = { ...currentFormula.curveParams };
          newParams[label as keyof EasingParams] = inputValue;

          pluginState = updateActivePropertyFormula(pluginState, {
            curveParams: newParams
          });

          // Update the corresponding slider
          let newSliderValue = inputValue * 100;
          if (label === 'd') {
            newSliderValue = (inputValue / 5) * 100;
          } else if (label === 'k') {
            newSliderValue = (inputValue / 2) * 100;
          }
          sliderEl.value = newSliderValue.toString();

          // Recalculate palette with new parameters
          pluginState = recalculatePalette(pluginState);
          updatePalette();
        });
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
        (paramValues[index] as HTMLInputElement).value = paramValue.toFixed(2);
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

// Get formula initial for display
function getFormulaInitial(formulaName: string | null): string {
  if (!formulaName) return '';

  switch (formulaName) {
    case 'Linear': return 'L';
    case 'Normal': return 'N';
    case 'Quad': return 'Q';
    case 'Arctan': return 'A';
    case 'Sine': return 'S';
    case 'Expo': return 'E';
    default: return '';
  }
}

// Update tab names with formula indicators
function updateTabNames() {
  const tabNames = ['Luminance', 'Chroma', 'Hue'] as const;

  tabs.forEach((tab, index) => {
    const propertyName = tabNames[index];
    const formula = pluginState.formulas[propertyName];
    const initial = getFormulaInitial(formula.activeCurve);

    // Clear existing content
    tab.innerHTML = '';
    
    // Add the property name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'tab-name';
    nameSpan.textContent = propertyName.toUpperCase();
    tab.appendChild(nameSpan);

    // Add formula indicator if there's an active formula
    if (initial) {
      const formulaSpan = document.createElement('span');
      formulaSpan.className = 'formula-indicator';
      formulaSpan.textContent = ` ${initial}`;
      tab.appendChild(formulaSpan);
    }
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
  updateButtonText();

  // Update tab names with formula indicators
  updateTabNames();

  // Update active tabs
  tabs.forEach((tab, index) => {
    tab.classList.remove('active');
    const tabNames = ['Luminance', 'Chroma', 'Hue'];
    if (tabNames[index] === pluginState.activeProperty) {
      tab.classList.add('active');
    }
  });

  // Update active function buttons for the current property
  const currentFormula = getActivePropertyFormula(pluginState);
  functionBtns.forEach((btn) => {
    btn.classList.remove('active');
    if (currentFormula.activeCurve && btn.textContent === currentFormula.activeCurve) {
      btn.classList.add('active');
    }
  });

  // Update UI according to editing mode
  updateModeUI();
}

// Update UI according to editing mode (Manual vs Formula)
function updateModeUI() {
  const slidersContainer = document.querySelector('.sliders-container') as HTMLElement;
  const functionLeft = document.querySelector('.function-left') as HTMLElement;
  const functionRight = document.querySelector('.function-right') as HTMLElement;
  const functionCenter = document.querySelector('.function-center') as HTMLElement;
  const formulaDisplay = document.querySelector('.formula-display') as HTMLElement;
  const formulaPlaceholder = document.querySelector('.formula-placeholder') as HTMLElement;
  const currentFormula = getActivePropertyFormula(pluginState);

  // Individual sliders are always shown
  slidersContainer.style.display = 'flex';

  // Formula buttons (functionLeft) are always shown
  functionLeft.style.display = 'block';

  // Show/hide reset button based on whether any formulas have been applied
  if (pluginState.originalPaletteData !== null) {
    resetBtn.style.display = 'block';
  } else {
    resetBtn.style.display = 'none';
  }

  if (currentFormula.activeCurve === null) {
    // No active formula for the current property: show placeholder and hide controls
    functionRight.style.display = 'none';
    functionCenter.style.display = 'flex'; // Keep visible to show the placeholder
    formulaDisplay.style.display = 'none';
    formulaPlaceholder.style.display = 'block';
  } else {
    // With active formula for the current property: show controls and hide placeholder
    functionRight.style.display = 'block';
    functionCenter.style.display = 'flex';
    formulaDisplay.style.display = 'block';
    formulaPlaceholder.style.display = 'none';
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

        // Reinitialize the palette with the new base color
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
  } else if (event.data.type === "palette-added") {
    // Handle palette addition response
    if (event.data.success) {
      console.log('✅ Palette added successfully');
      if (event.data.message) {
        console.log(event.data.message);
      }
      if (event.data.assetsCreated) {
        console.log(`Created ${event.data.assetsCreated} color assets`);
      }

      // Temporarily change button text to show success
      const originalText = addBtn.textContent;
      addBtn.textContent = uiState.createAssets ? 'Assets Created!' : 'Added to File!';
      addBtn.disabled = true;

      setTimeout(() => {
        addBtn.textContent = originalText;
        addBtn.disabled = false;
      }, 2000);
    } else {
      console.error('❌ Failed to add palette:', event.data.error);

      // Show error state
      const originalText = addBtn.textContent;
      addBtn.textContent = 'Error!';
      addBtn.style.backgroundColor = '#ff4444';

      setTimeout(() => {
        addBtn.textContent = originalText;
        addBtn.style.backgroundColor = '';
      }, 2000);
    }
  }
});

// Initialize the app
init();
