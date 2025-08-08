import "./style.css";
import { 
  hexToOklch, 
  generatePalette,
  generateCustomPalette,
  getDefaultParameters, 
  getFormulaDisplay, 
  getParameterLabels,
  type OKLCHColor,
  type PaletteOptions 
} from './color-converter';

// Get the current theme from the URL
const searchParams = new URLSearchParams(window.location.search);
document.body.dataset.theme = searchParams.get("theme") ?? "light";

// State management
interface AppState {
  baseColor: OKLCHColor;
  steps: number;
  currentTab: 'luminescence' | 'chroma' | 'hue';
  curveType: 'linear' | 'normal' | 'quad' | 'arctan' | 'sine' | 'expo';
  parameters: { [key: string]: number };
  customLightnessValues: number[];
  createAssets: boolean;
}

let state: AppState = {
  baseColor: { l: 0.5, c: 0.1, h: 0 },
  steps: 10,
  currentTab: 'luminescence',
  curveType: 'linear',
  parameters: getDefaultParameters('linear'),
  customLightnessValues: [],
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
const verticalSliders = document.querySelectorAll('.vertical-slider') as NodeListOf<HTMLInputElement>;
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
    state.baseColor = hexToOklch(hex);
    updatePalette();
  });

  // Number of shades slider
  shadesSlider.addEventListener('input', (e) => {
    state.steps = parseInt((e.target as HTMLInputElement).value);
    shadeCount.textContent = state.steps.toString();
    updateVerticalSliders();
    updatePalette();
  });

  // Channel tabs
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const tabNames = ['luminescence', 'chroma', 'hue'] as const;
      state.currentTab = tabNames[index];
      updateVerticalSliders();
    });
  });

  // Function buttons
  functionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      functionBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const curveTypes = ['linear', 'normal', 'quad', 'arctan', 'sine', 'expo'] as const;
      const btnText = btn.textContent?.toLowerCase() as typeof curveTypes[number];
      state.curveType = btnText;
      state.parameters = getDefaultParameters(btnText);
      
      updateFormulaDisplay();
      updateParameterControls();
      updatePalette();
    });
  });

  // Parameter sliders
  paramSliders.forEach((slider, index) => {
    slider.addEventListener('input', (e) => {
      const rawValue = parseFloat((e.target as HTMLInputElement).value);
      const labels = getParameterLabels(state.curveType);
      if (labels[index]) {
        // Scale the value based on parameter type and expected range
        let scaledValue = rawValue / 100;
        
        // Adjust scaling for specific parameters that need different ranges
        if (labels[index] === 'd') {
          scaledValue = (rawValue / 100) * 5; // d parameter typically ranges 0-5
        } else if (labels[index] === 'k') {
          scaledValue = (rawValue / 100) * 2; // k parameter typically ranges 0-2
        }
        
        state.parameters[labels[index]] = scaledValue;
        updateParameterValues();
        updatePalette();
      }
    });
  });

  // Vertical sliders (for manual lightness adjustment)
  verticalSliders.forEach((slider, index) => {
    slider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value) / 100;
      if (state.currentTab === 'luminescence') {
        if (!state.customLightnessValues.length) {
          state.customLightnessValues = generateDefaultLightnessValues();
        }
        state.customLightnessValues[index] = value;
        updateSliderValues();
        updatePalette();
      }
    });
  });

  // Create assets checkbox
  createAssetsCheckbox.addEventListener('change', (e) => {
    state.createAssets = (e.target as HTMLInputElement).checked;
  });

  // Add button
  addBtn.addEventListener('click', () => {
    const palette = generateCurrentPalette();
    parent.postMessage({
      type: 'add-palette',
      colors: palette,
      createAssets: state.createAssets
    }, "*");
  });
}

// Request base color from selected object
function requestBaseColor() {
  parent.postMessage({ type: 'get-base-color' }, "*");
}

// Generate default lightness values
function generateDefaultLightnessValues(): number[] {
  const values: number[] = [];
  for (let i = 0; i < state.steps; i++) {
    values.push(i / (state.steps - 1));
  }
  return values;
}

// Update vertical sliders based on current tab and steps
function updateVerticalSliders() {
  const container = document.querySelector('.sliders-container') as HTMLElement;
  container.innerHTML = '';

  for (let i = 0; i < state.steps; i++) {
    const sliderItem = document.createElement('div');
    sliderItem.className = 'slider-item';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'vertical-slider';
    slider.min = '0';
    slider.max = '100';
    slider.setAttribute('orient', 'vertical');

    const valueSpan = document.createElement('span');
    valueSpan.className = 'slider-value';

    // Set ranges based on current tab
    let value = 0;
    let maxRange = 100;
    
    switch (state.currentTab) {
      case 'luminescence':
        maxRange = 100; // 0-1
        value = state.customLightnessValues.length ? 
          state.customLightnessValues[i] * 100 : 
          (i / (state.steps - 1)) * 100;
        break;
      case 'chroma':
        maxRange = 40; // 0-0.4 (40 represents 0.4 in the slider)
        value = (state.baseColor.c / 0.4) * 40;
        break;
      case 'hue':
        maxRange = 360; // 0-360 degrees
        value = state.baseColor.h || 0;
        break;
    }

    slider.max = maxRange.toString();
    slider.value = value.toString();
    
    // Update value display
    updateSliderValueDisplay(valueSpan, value, state.currentTab);

    // Add event listener
    slider.addEventListener('input', (e) => {
      const sliderValue = parseFloat((e.target as HTMLInputElement).value);
      updateSliderValueDisplay(valueSpan, sliderValue, state.currentTab);
      
      if (state.currentTab === 'luminescence') {
        if (!state.customLightnessValues.length) {
          state.customLightnessValues = generateDefaultLightnessValues();
        }
        state.customLightnessValues[i] = sliderValue / 100;
        updatePalette();
      }
    });

    sliderItem.appendChild(slider);
    sliderItem.appendChild(valueSpan);
    container.appendChild(sliderItem);
  }
}

// Update slider value display based on tab
function updateSliderValueDisplay(element: HTMLElement, value: number, tab: string) {
  switch (tab) {
    case 'luminescence':
      element.textContent = (value / 100).toFixed(2);
      break;
    case 'chroma':
      element.textContent = (value / 100).toFixed(2);
      break;
    case 'hue':
      element.textContent = Math.round(value).toString();
      break;
  }
}

// Update slider values
function updateSliderValues() {
  const sliderValues = document.querySelectorAll('.slider-value');
  sliderValues.forEach((valueEl, index) => {
    if (state.currentTab === 'luminescence' && state.customLightnessValues[index] !== undefined) {
      valueEl.textContent = state.customLightnessValues[index].toFixed(2);
    }
  });
}

// Update formula display
function updateFormulaDisplay() {
  formulaDisplay.textContent = getFormulaDisplay(state.curveType);
}

// Update parameter controls
function updateParameterControls() {
  const labels = getParameterLabels(state.curveType);
  const parameterGroups = document.querySelectorAll('.parameter-group');
  
  // Hide all parameter groups first
  parameterGroups.forEach(group => {
    (group as HTMLElement).style.display = 'none';
  });
  
  // Show and update relevant parameter groups
  labels.forEach((label, index) => {
    if (parameterGroups[index]) {
      (parameterGroups[index] as HTMLElement).style.display = 'flex';
      const labelEl = parameterGroups[index].querySelector('.param-label') as HTMLElement;
      const sliderEl = parameterGroups[index].querySelector('.param-slider') as HTMLInputElement;
      const valueEl = parameterGroups[index].querySelector('.param-value') as HTMLElement;
      
      labelEl.textContent = label;
      
      // Scale the slider value based on parameter type
      let sliderValue = state.parameters[label] * 100;
      if (label === 'd') {
        sliderValue = (state.parameters[label] / 5) * 100; // d parameter ranges 0-5
      } else if (label === 'k') {
        sliderValue = (state.parameters[label] / 2) * 100; // k parameter ranges 0-2
      }
      
      sliderEl.value = sliderValue.toString();
      valueEl.textContent = state.parameters[label].toFixed(2);
    }
  });
}

// Update parameter values display
function updateParameterValues() {
  const labels = getParameterLabels(state.curveType);
  labels.forEach((label, index) => {
    if (paramValues[index]) {
      paramValues[index].textContent = state.parameters[label].toFixed(2);
    }
  });
}

// Generate current palette
function generateCurrentPalette(): string[] {
  if (state.customLightnessValues.length && state.currentTab === 'luminescence') {
    // Use custom lightness values
    return generateCustomPalette(state.baseColor, state.customLightnessValues);
  } else {
    // Use curve-based generation
    const options: PaletteOptions = {
      baseColor: state.baseColor,
      steps: state.steps,
      curveType: state.curveType,
      parameters: state.parameters
    };
    return generatePalette(options);
  }
}

// Update palette preview
function updatePalette() {
  const colors = generateCurrentPalette();
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
  updatePalette();
  shadeCount.textContent = state.steps.toString();
  shadesSlider.value = state.steps.toString();
  createAssetsCheckbox.checked = state.createAssets;
}

// Listen for messages from plugin
window.addEventListener("message", (event) => {
  if (event.data.source === "penpot") {
    document.body.dataset.theme = event.data.theme;
  } else if (event.data.type === "base-color") {
    if (event.data.color) {
      state.baseColor = hexToOklch(event.data.color);
      colorPicker.value = event.data.color;
      updatePalette();
    }
  }
});

// Initialize the app
init();
