import { formatHex, clampRgb, converter } from 'culori';

export interface OKLCHColor {
  l: number; // Lightness (0-1)
  c: number; // Chroma (0-0.4)
  h: number; // Hue (0-360)
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

// Define the structure of a single color within our state palette
export interface PaletteColor {
  id: number; // Unique identifier (e.g. array index)
  l: number;  // Luminance value
  c: number;  // Chroma value
  h: number;  // Hue value
  hex: string; // The visual result, for the UI
}

// Interface for easing curve parameters
export interface EasingParams {
  m?: number; c?: number; // Linear
  a?: number; k?: number; d?: number; // Common for many curves
  b?: number; // Specific for Arctan
}

// Formula configuration for a specific property
export interface PropertyFormulaConfig {
  activeCurve: 'Linear' | 'Normal' | 'Quad' | 'Arctan' | 'Sine' | 'Expo' | null;
  curveParams: EasingParams;
  formulaRange: {
    from: number;
    to: number;
  };
}

// THE NEW AND IMPROVED CENTRAL STATE
export interface PluginState {
  // Which master property are we editing right now?
  activeProperty: 'Luminance' | 'Chroma' | 'Hue';

  // The array of objects that represents our palette. THIS IS THE SOURCE OF TRUTH.
  paletteData: PaletteColor[];

  // Original palette data before any formulas were applied (for reset functionality)
  originalPaletteData: PaletteColor[] | null;

  // The rest of the state we already know
  isNodeSelected: boolean;
  baseColor: OKLCHColor;
  amountOfShades: number;

  // Independent formula configuration for each property
  formulas: {
    Luminance: PropertyFormulaConfig;
    Chroma: PropertyFormulaConfig;
    Hue: PropertyFormulaConfig;
  };

  assetName: string;
}

// Create converters
const toOklch = converter('oklch');
const toRgb = converter('rgb');

/**
 * Convert RGB color to OKLCH
 */
export function rgbToOklch(r: number, g: number, b: number): OKLCHColor {
  const color = toOklch({ mode: 'rgb', r: r / 255, g: g / 255, b: b / 255 });
  return {
    l: color?.l || 0,
    c: color?.c || 0,
    h: color?.h || 0
  };
}

/**
 * Convert hex color to OKLCH
 */
export function hexToOklch(hex: string): OKLCHColor {
  const color = toOklch(hex);
  return {
    l: color?.l || 0,
    c: color?.c || 0,
    h: color?.h || 0
  };
}

/**
 * Convert OKLCH color to RGB
 */
export function oklchToRgb(l: number, c: number, h: number): RGBColor {
  const color = toRgb({ mode: 'oklch', l, c, h });
  const clamped = clampRgb(color);
  return {
    r: Math.round(((clamped as any)?.r || 0) * 255),
    g: Math.round(((clamped as any)?.g || 0) * 255),
    b: Math.round(((clamped as any)?.b || 0) * 255)
  };
}

/**
 * Convert OKLCH color to hex
 */
export function oklchToHex(l: number, c: number, h: number): string {
  const color = { mode: 'oklch' as const, l, c, h };
  return formatHex(color) || '#000000';
}

/**
 * Main function that recalculates the complete palette based on the current state
 */
export function recalculatePalette(state: PluginState): PluginState {
  const newState = { ...state };
  const steps = state.amountOfShades;

  // Apply formulas to each property independently
  const properties: Array<keyof typeof state.formulas> = ['Luminance', 'Chroma', 'Hue'];

  properties.forEach(property => {
    const formulaConfig = state.formulas[property];

    if (formulaConfig.activeCurve !== null) {
      // There is an active formula for this property
      const easedValues = generateCurveValues(steps, formulaConfig.activeCurve, formulaConfig.curveParams);

      // Apply the formula to all colors for this property
      for (let i = 0; i < newState.paletteData.length; i++) {
        const easedFactor = easedValues[i];
        const newValue = formulaConfig.formulaRange.from +
          (formulaConfig.formulaRange.to - formulaConfig.formulaRange.from) * easedFactor;

        // Update the specific property
        switch (property) {
          case 'Luminance':
            newState.paletteData[i].l = Math.max(0, Math.min(1, newValue));
            break;
          case 'Chroma':
            newState.paletteData[i].c = Math.max(0, Math.min(0.4, newValue));
            break;
          case 'Hue':
            newState.paletteData[i].h = newValue % 360;
            break;
        }
      }
    }
    // If there is no active formula for this property, keep the manual values
  });

  // Final step: update the hex values of all colors
  for (let i = 0; i < newState.paletteData.length; i++) {
    const color = newState.paletteData[i];
    newState.paletteData[i].hex = oklchToHex(color.l, color.c, color.h);
  }

  return newState;
}

/**
 * Calculates the eased factor for an x value using the specified curve
 */
export function calculateEasedFactor(x: number, formulaConfig: PropertyFormulaConfig): number {
  const params = formulaConfig.curveParams;

  switch (formulaConfig.activeCurve) {
    case 'Linear':
      return (params.m || 1) * x + (params.c || 0);
    case 'Normal':
      return (params.a || 0.18) * Math.sin((params.k || 0.60) * x - (params.d || 0)) + (params.c || 0.18);
    case 'Quad':
      return (params.a || 0.07) * Math.pow((params.k || 0.38) * x - (params.d || 1.40), 2) + (params.c || 0.07);
    case 'Arctan':
      return (params.b || 0.16) * Math.atan((params.k || 0.40) * x - (params.d || 1.68)) + (params.c || 0.18);
    case 'Sine':
      return (params.a || 0.18) * Math.sin((params.k || 0.60) * x - (params.d || 0)) + (params.c || 0.18);
    case 'Expo':
      return (params.a || 0.18) * Math.exp(-Math.pow((params.k || 0.35) * x - (params.d || 2.50), 2)) + (params.c || 0);
    default:
      return x;
  }
}

/**
 * Initialize the data palette with uniformly distributed values
 */
export function initializePaletteData(baseColor: OKLCHColor, steps: number): PaletteColor[] {
  const paletteData: PaletteColor[] = [];

  for (let i = 0; i < steps; i++) {
    // Distribute luminance uniformly from 0 to 1
    const l = i / (steps - 1);

    const color: PaletteColor = {
      id: i,
      l: l,
      c: baseColor.c,
      h: baseColor.h,
      hex: oklchToHex(l, baseColor.c, baseColor.h)
    };
    paletteData.push(color);
  }

  return paletteData;
}

/**
 * Generate color palette using different curve functions (LEGACY - mantener para compatibilidad)
 */
export interface PaletteOptions {
  baseColor: OKLCHColor;
  steps: number;
  curveType: 'linear' | 'normal' | 'quad' | 'arctan' | 'sine' | 'expo';
  parameters: { [key: string]: number };
}

export function generatePalette(options: PaletteOptions): string[] {
  const { baseColor, steps, curveType, parameters } = options;
  const colors: string[] = [];

  // Generate lightness values based on curve type
  const lightnessValues = generateCurveValues(steps, curveType, parameters);

  for (let i = 0; i < steps; i++) {
    const lightness = lightnessValues[i];

    // Apply chroma adjustment based on lightness
    let chroma = baseColor.c;

    // Reduce chroma for very light or very dark colors for more natural appearance
    if (lightness < 0.2 || lightness > 0.8) {
      const chromaReduction = Math.abs(lightness - 0.5) * 0.3;
      chroma = Math.max(0, baseColor.c - chromaReduction);
    }

    const hex = oklchToHex(lightness, chroma, baseColor.h);
    colors.push(hex);
  }

  return colors;
}

/**
 * Generate palette with custom lightness values
 */
export function generateCustomPalette(baseColor: OKLCHColor, lightnessValues: number[]): string[] {
  const colors: string[] = [];

  for (const lightness of lightnessValues) {
    // Apply chroma adjustment based on lightness
    let chroma = baseColor.c;

    // Reduce chroma for very light or very dark colors for more natural appearance
    if (lightness < 0.2 || lightness > 0.8) {
      const chromaReduction = Math.abs(lightness - 0.5) * 0.3;
      chroma = Math.max(0, baseColor.c - chromaReduction);
    }

    const hex = oklchToHex(lightness, chroma, baseColor.h);
    colors.push(hex);
  }

  return colors;
}

/**
 * Generate curve values based on different mathematical functions
 */
function generateCurveValues(steps: number, curveType: string | PropertyFormulaConfig['activeCurve'], params: { [key: string]: number } | EasingParams): number[] {
  const values: number[] = [];

  if (!curveType) {
    // If there is no curve, return linear values
    for (let i = 0; i < steps; i++) {
      values.push(i / (steps - 1));
    }
    return values;
  }

  for (let i = 0; i < steps; i++) {
    const x = i / (steps - 1); // Normalized x (0 to 1)
    let y: number;

    switch (curveType.toLowerCase()) {
      case 'linear':
        // y = mx + c
        y = (params.m || 0.94) * x + (params.c || 0);
        break;

      case 'normal':
        // y = ae^(-(kx-d)²) + c (Gaussian/Normal distribution)
        const kx_d_normal = (params.k || 0.60) * x - (params.d || 0);
        y = (params.a || 0.18) * Math.exp(-(kx_d_normal * kx_d_normal)) + (params.c || 0.18);
        break;

      case 'quad':
        // y = a(kx - d)² + c
        const kx_d_quad = (params.k || 0.38) * x - (params.d || 1.40);
        y = (params.a || 0.07) * (kx_d_quad * kx_d_quad) + (params.c || 0.07);
        break;

      case 'arctan':
        // y = btan⁻¹(kx - d) + c
        const kx_d_arctan = (params.k || 0.40) * x - (params.d || 1.68);
        y = (params.b || 0.16) * Math.atan(kx_d_arctan) + (params.c || 0.18);
        break;

      case 'sine':
        // y = asin(kx - d) + c  
        const kx_d_sine = (params.k || 0.60) * x - (params.d || 0);
        y = (params.a || 0.18) * Math.sin(kx_d_sine) + (params.c || 0.18);
        break;

      case 'expo':
        // y = ae^(kx - d) + c (Exponential function)
        const kx_d_expo = (params.k || 0.35) * x - (params.d || 2.50);
        y = (params.a || 0.18) * Math.exp(kx_d_expo) + (params.c || 0);
        break;

      default:
        y = x; // Fallback to linear
    }

    // Clamp values to valid range (0-1)
    values.push(Math.max(0, Math.min(1, y)));
  }

  return values;
}

/**
 * Get default parameters for each curve type
 */
export function getDefaultParameters(curveType: string | PropertyFormulaConfig['activeCurve']): EasingParams {
  if (!curveType) return {};

  switch (curveType.toLowerCase()) {
    case 'linear':
      // y = mx + c (2 parameters)
      return { m: 0.94, c: 0.00 };
    case 'normal':
      // y = ae^(-(kx-d)²) + c (4 parameters)
      return { a: 0.18, k: 0.60, d: 0.00, c: 0.18 };
    case 'quad':
      // y = a(kx - d)² + c (4 parameters)
      return { a: 0.07, k: 0.38, d: 1.40, c: 0.07 };
    case 'arctan':
      // y = btan⁻¹(kx - d) + c (4 parameters)
      return { b: 0.16, k: 0.40, d: 1.68, c: 0.18 };
    case 'sine':
      // y = asin(kx - d) + c (4 parameters)
      return { a: 0.18, k: 0.60, d: 0.00, c: 0.18 };
    case 'expo':
      // y = ae^(kx - d) + c (4 parameters)
      return { a: 0.18, k: 0.35, d: 2.50, c: 0.00 };
    default:
      return {};
  }
}

/**
 * Get formula display for each curve type
 */
export function getFormulaDisplay(curveType: string | PropertyFormulaConfig['activeCurve']): string {
  if (!curveType) return '';

  switch (curveType.toLowerCase()) {
    case 'linear':
      return 'y = mx + c';
    case 'normal':
      return 'y = ae^(-(kx-d)²) + c';
    case 'quad':
      return 'y = a(kx - d)² + c';
    case 'arctan':
      return 'y = btan⁻¹(kx - d) + c';
    case 'sine':
      return 'y = asin(kx - d) + c';
    case 'expo':
      return 'y = ae^(kx-d) + c';
    default:
      return '';
  }
}

/**
 * Get parameter labels for each curve type
 */
export function getParameterLabels(curveType: string | PropertyFormulaConfig['activeCurve']): string[] {
  if (!curveType) return [];

  switch (curveType.toLowerCase()) {
    case 'linear':
      return ['m', 'c']; // 2 sliders
    case 'normal':
      return ['a', 'k', 'd', 'c']; // 4 sliders
    case 'quad':
      return ['a', 'k', 'd', 'c']; // 4 sliders
    case 'arctan':
      return ['b', 'k', 'd', 'c']; // 4 sliders
    case 'sine':
      return ['a', 'k', 'd', 'c']; // 4 sliders
    case 'expo':
      return ['a', 'k', 'd', 'c']; // 4 sliders
    default:
      return [];
  }
}

/**
 * Gets the appropriate range for the active property
 */
export function getPropertyRange(property: PluginState['activeProperty']): { from: number; to: number } {
  switch (property) {
    case 'Luminance':
      return { from: 0, to: 1 };
    case 'Chroma':
      return { from: 0, to: 0.4 };
    case 'Hue':
      return { from: 0, to: 360 };
    default:
      return { from: 0, to: 1 };
  }
}

/**
 * Gets the formula configuration for the active property
 */
export function getActivePropertyFormula(state: PluginState): PropertyFormulaConfig {
  return state.formulas[state.activeProperty];
}

/**
 * Updates the formula configuration for the active property
 */
export function updateActivePropertyFormula(
  state: PluginState,
  updates: Partial<PropertyFormulaConfig>
): PluginState {
  const newState = { ...state };
  newState.formulas = { ...state.formulas };
  newState.formulas[state.activeProperty] = {
    ...state.formulas[state.activeProperty],
    ...updates
  };
  return newState;
}

/**
 * Creates an initial formula configuration for a property
 */
function createPropertyFormulaConfig(property: 'Luminance' | 'Chroma' | 'Hue'): PropertyFormulaConfig {
  return {
    activeCurve: null, // By default there is no active formula
    curveParams: {},
    formulaRange: getPropertyRange(property)
  };
}

/**
 * Creates an initial plugin state
 */
export function createInitialState(baseColor: OKLCHColor, steps: number = 10): PluginState {
  const paletteData = initializePaletteData(baseColor, steps);
  return {
    activeProperty: 'Luminance',
    paletteData,
    originalPaletteData: null, // Will be set when first formula is applied
    isNodeSelected: false,
    baseColor,
    amountOfShades: steps,
    formulas: {
      Luminance: createPropertyFormulaConfig('Luminance'),
      Chroma: createPropertyFormulaConfig('Chroma'),
      Hue: createPropertyFormulaConfig('Hue')
    },
    assetName: 'Palette'
  };
}

/**
 * Saves the current palette state as the original state (for reset functionality)
 */
export function saveOriginalPaletteState(state: PluginState): PluginState {
  if (state.originalPaletteData === null) {
    // Only save if we haven't saved before
    return {
      ...state,
      originalPaletteData: state.paletteData.map(color => ({ ...color }))
    };
  }
  return state;
}

/**
 * Resets the palette to its original state and clears all formulas
 */
export function resetPaletteToOriginal(state: PluginState): PluginState {
  if (state.originalPaletteData === null) {
    return state; // Nothing to reset
  }

  return {
    ...state,
    paletteData: state.originalPaletteData.map(color => ({ ...color })),
    originalPaletteData: null, // Clear the saved state
    formulas: {
      Luminance: createPropertyFormulaConfig('Luminance'),
      Chroma: createPropertyFormulaConfig('Chroma'),
      Hue: createPropertyFormulaConfig('Hue')
    }
  };
}

/**
 * Checks if any formula is currently active across all properties
 */
export function hasAnyActiveFormula(state: PluginState): boolean {
  return Object.values(state.formulas).some(formula => formula.activeCurve !== null);
}