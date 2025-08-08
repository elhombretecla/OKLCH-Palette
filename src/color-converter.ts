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

// Define la estructura de un único color dentro de nuestra paleta de estado
export interface PaletteColor {
  id: number; // Identificador único (ej. índice del array)
  l: number;  // Valor de Luminance
  c: number;  // Valor de Chroma
  h: number;  // Valor de Hue
  hex: string; // El resultado visual, para la UI
}

// Interfaz para los parámetros de las curvas de easing
export interface EasingParams {
  m?: number; c?: number; // Linear
  a?: number; k?: number; d?: number; // Común para muchas curvas
  b?: number; // Específico para Arctan
}

// EL NUEVO Y MEJORADO ESTADO CENTRAL
export interface PluginState {
  // ¿Qué propiedad maestra estamos editando ahora mismo?
  activeProperty: 'Luminance' | 'Chroma' | 'Hue';
  
  // ¿En qué modo de edición para la propiedad activa nos encontramos?
  editMode: 'Manual' | 'Formula'; // Controlado por el botón 'fx'
  
  // El array de objetos que representa nuestra paleta. ESTA ES LA FUENTE DE VERDAD.
  paletteData: PaletteColor[];
  
  // El resto del estado que ya conocemos
  isNodeSelected: boolean;
  baseColor: OKLCHColor;
  amountOfShades: number;
  
  // La configuración de las curvas de easing
  easing: {
    activeCurve: 'Linear' | 'Normal' | 'Quad' | 'Arctan' | 'Sine' | 'Expo' | null; // null = ninguna fórmula activa
    curveParams: EasingParams;
  };
  
  // El rango [from, to] para el MODO FÓRMULA
  formulaRange: {
    from: number;
    to: number;
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
 * Función principal que recalcula la paleta completa basada en el estado actual
 */
export function recalculatePalette(state: PluginState): PluginState {
  const newState = { ...state };
  
  // Identificar si hay una fórmula activa
  if (state.easing.activeCurve !== null) {
    // Modo fórmula - aplicar la curva activa
    const steps = state.amountOfShades;
    const easedValues = generateCurveValues(steps, state.easing.activeCurve, state.easing.curveParams);
    
    // Para cada color en paletteData, actualizar la propiedad activa
    for (let i = 0; i < newState.paletteData.length; i++) {
      const easedFactor = easedValues[i];
      const newValue = state.formulaRange.from + (state.formulaRange.to - state.formulaRange.from) * easedFactor;
      
      // Actualizar solo la propiedad activa
      switch (state.activeProperty) {
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
  // Si no hay fórmula activa, los valores ya están definidos por los sliders individuales
  
  // Paso final: actualizar los valores hex de todos los colores
  for (let i = 0; i < newState.paletteData.length; i++) {
    const color = newState.paletteData[i];
    newState.paletteData[i].hex = oklchToHex(color.l, color.c, color.h);
  }
  
  return newState;
}

/**
 * Calcula el factor eased para un valor x usando la curva especificada
 */
export function calculateEasedFactor(x: number, easing: PluginState['easing']): number {
  const params = easing.curveParams;
  
  switch (easing.activeCurve) {
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
 * Inicializa la paleta de datos con valores distribuidos uniformemente
 */
export function initializePaletteData(baseColor: OKLCHColor, steps: number): PaletteColor[] {
  const paletteData: PaletteColor[] = [];
  
  for (let i = 0; i < steps; i++) {
    // Distribuir la luminancia uniformemente de 0 a 1
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
function generateCurveValues(steps: number, curveType: string | PluginState['easing']['activeCurve'], params: { [key: string]: number } | EasingParams): number[] {
  const values: number[] = [];
  
  if (!curveType) {
    // Si no hay curva, devolver valores lineales
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
export function getDefaultParameters(curveType: string | PluginState['easing']['activeCurve']): EasingParams {
  if (!curveType) return {};
  
  switch (curveType.toLowerCase()) {
    case 'linear':
      // y = mx + c (2 parámetros)
      return { m: 0.94, c: 0.00 };
    case 'normal':
      // y = ae^(-(kx-d)²) + c (4 parámetros)
      return { a: 0.18, k: 0.60, d: 0.00, c: 0.18 };
    case 'quad':
      // y = a(kx - d)² + c (4 parámetros)
      return { a: 0.07, k: 0.38, d: 1.40, c: 0.07 };
    case 'arctan':
      // y = btan⁻¹(kx - d) + c (4 parámetros)
      return { b: 0.16, k: 0.40, d: 1.68, c: 0.18 };
    case 'sine':
      // y = asin(kx - d) + c (4 parámetros)
      return { a: 0.18, k: 0.60, d: 0.00, c: 0.18 };
    case 'expo':
      // y = ae^(kx - d) + c (4 parámetros)
      return { a: 0.18, k: 0.35, d: 2.50, c: 0.00 };
    default:
      return {};
  }
}

/**
 * Get formula display for each curve type
 */
export function getFormulaDisplay(curveType: string | PluginState['easing']['activeCurve']): string {
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
export function getParameterLabels(curveType: string | PluginState['easing']['activeCurve']): string[] {
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
 * Obtiene el rango apropiado para la propiedad activa
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
 * Crea un estado inicial del plugin
 */
export function createInitialState(baseColor: OKLCHColor, steps: number = 10): PluginState {
  return {
    activeProperty: 'Luminance',
    editMode: 'Manual', // Por defecto empezamos en modo manual
    paletteData: initializePaletteData(baseColor, steps),
    isNodeSelected: false,
    baseColor,
    amountOfShades: steps,
    easing: {
      activeCurve: null, // Por defecto no hay ninguna fórmula activa
      curveParams: {}
    },
    formulaRange: getPropertyRange('Luminance'),
    assetName: 'Palette'
  };
}