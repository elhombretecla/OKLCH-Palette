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
 * Generate color palette using different curve functions
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
function generateCurveValues(steps: number, curveType: string, params: { [key: string]: number }): number[] {
  const values: number[] = [];
  
  for (let i = 0; i < steps; i++) {
    const x = i / (steps - 1); // Normalized x (0 to 1)
    let y: number;
    
    switch (curveType) {
      case 'linear':
        // y = mx + c
        y = (params.m || 0.94) * x + (params.c || 0);
        break;
        
      case 'normal':
        // y = a*sin(kx - d) + c
        y = (params.a || 0.18) * Math.sin((params.k || 0.60) * x - (params.d || 0)) + (params.c || 0.18);
        break;
        
      case 'quad':
        // y = a(kx - d)² + c
        y = (params.a || 0.07) * Math.pow((params.k || 0.38) * x - (params.d || 1.40), 2) + (params.c || 0.07);
        break;
        
      case 'arctan':
        // y = b*tan⁻¹(kx - d) + c
        y = (params.b || 0.16) * Math.atan((params.k || 0.40) * x - (params.d || 1.68)) + (params.c || 0.18);
        break;
        
      case 'sine':
        // y = a*sin(kx - d) + c  
        y = (params.a || 0.18) * Math.sin((params.k || 0.60) * x - (params.d || 0)) + (params.c || 0.18);
        break;
        
      case 'expo':
        // y = a*e^(-(kx-d)²) + c
        y = (params.a || 0.18) * Math.exp(-Math.pow((params.k || 0.35) * x - (params.d || 2.50), 2)) + (params.c || 0);
        break;
        
      default:
        y = x; // Fallback to linear
    }
    
    // Clamp values to valid lightness range (0-1)
    values.push(Math.max(0, Math.min(1, y)));
  }
  
  return values;
}

/**
 * Get default parameters for each curve type
 */
export function getDefaultParameters(curveType: string): { [key: string]: number } {
  switch (curveType) {
    case 'linear':
      return { m: 0.94, c: 0.00 };
    case 'normal':
      return { a: 0.18, k: 0.60, d: 0.00, c: 0.18 };
    case 'quad':
      return { a: 0.07, k: 0.38, d: 1.40, c: 0.07 };
    case 'arctan':
      return { b: 0.16, k: 0.40, d: 1.68, c: 0.18 };
    case 'sine':
      return { a: 0.18, k: 0.60, d: 0.00, c: 0.18 };
    case 'expo':
      return { a: 0.18, k: 0.35, d: 2.50, c: 0.00 };
    default:
      return { m: 0.94, c: 0.00 };
  }
}

/**
 * Get formula display for each curve type
 */
export function getFormulaDisplay(curveType: string): string {
  switch (curveType) {
    case 'linear':
      return 'y = mx + c';
    case 'normal':
      return 'y = asin(kx - d) + c';
    case 'quad':
      return 'y = a(kx - d)² + c';
    case 'arctan':
      return 'y = btan⁻¹(kx - d) + c';
    case 'sine':
      return 'y = asin(kx - d) + c';
    case 'expo':
      return 'y = ae^(-(kx-d)²) + c';
    default:
      return 'y = mx + c';
  }
}

/**
 * Get parameter labels for each curve type
 */
export function getParameterLabels(curveType: string): string[] {
  switch (curveType) {
    case 'linear':
      return ['m', 'c'];
    case 'normal':
      return ['a', 'k', 'd', 'c'];
    case 'quad':
      return ['a', 'k', 'd', 'c'];
    case 'arctan':
      return ['b', 'k', 'd', 'c'];
    case 'sine':
      return ['a', 'k', 'd', 'c'];
    case 'expo':
      return ['a', 'k', 'd', 'c'];
    default:
      return ['m', 'c'];
  }
}