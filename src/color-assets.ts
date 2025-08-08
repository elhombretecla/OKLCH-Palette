/**
 * Color Assets Management
 * Handles creation and management of color assets in Penpot's library
 */

export interface ColorAsset {
  name: string;
  color: string;
  groupName: string;
}

/**
 * Convert hex color to HSL values
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  const l = (max + min) / 2;
  const s = diff === 0 ? 0 : diff / (1 - Math.abs(2 * l - 1));

  if (diff !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / diff) % 6;
        break;
      case g:
        h = (b - r) / diff + 2;
        break;
      case b:
        h = (r - g) / diff + 4;
        break;
    }
  }

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  return { h, s, l };
}

/**
 * Get base color name from hue value
 */
function getBaseColorName(hue: number, saturation: number): string {
  if (saturation <= 0.1) return 'gray';

  if (hue >= 0 && hue < 15) return 'red';
  else if (hue >= 15 && hue < 45) return 'orange';
  else if (hue >= 45 && hue < 75) return 'yellow';
  else if (hue >= 75 && hue < 105) return 'lime';
  else if (hue >= 105 && hue < 135) return 'green';
  else if (hue >= 135 && hue < 165) return 'teal';
  else if (hue >= 165 && hue < 195) return 'cyan';
  else if (hue >= 195 && hue < 225) return 'blue';
  else if (hue >= 225 && hue < 255) return 'indigo';
  else if (hue >= 255 && hue < 285) return 'purple';
  else if (hue >= 285 && hue < 315) return 'pink';
  else if (hue >= 315 && hue < 345) return 'rose';
  else return 'red';
}

/**
 * Check if two hues are similar (within tolerance)
 */
function areHuesSimilar(hue1: number, hue2: number, tolerance: number = 20): boolean {
  const diff = Math.abs(hue1 - hue2);
  // Handle circular nature of hue (0° and 360° are the same)
  const circularDiff = Math.min(diff, 360 - diff);
  return circularDiff <= tolerance;
}

/**
 * Generate color names for an entire palette, analyzing hue consistency
 */
export function generatePaletteColorNames(colors: string[]): string[] {
  if (colors.length === 0) return [];

  // Convert all colors to HSL
  const hslColors = colors.map(color => ({
    hex: color,
    ...hexToHsl(color)
  }));

  // Sort colors by lightness (lightest first for proper 100-900 naming)
  const sortedColors = [...hslColors].sort((a, b) => b.l - a.l);

  // Check if all colors have similar hues
  const firstHue = sortedColors[0].h;
  const firstSaturation = sortedColors[0].s;
  const allSimilarHues = sortedColors.every(color =>
    areHuesSimilar(color.h, firstHue) || (color.s <= 0.1 && firstSaturation <= 0.1)
  );

  if (allSimilarHues) {
    // All colors share similar hue - use consistent naming with 100-900 scale
    const baseName = getBaseColorName(firstHue, firstSaturation);

    return colors.map(originalColor => {
      // Find the position of this color in the sorted array
      const sortedIndex = sortedColors.findIndex(sorted => sorted.hex === originalColor);
      // Generate weights in increments of 100: 100, 200, 300, 400, 500, 600, 700, 800, 900
      const weight = 100 + (sortedIndex * 100);
      return `${baseName}-${Math.min(900, weight)}`;
    });
  } else {
    // Colors have different hues - group by similar hues and name accordingly
    const hueGroups: { [key: string]: Array<{ hex: string; originalIndex: number; lightness: number }> } = {};

    colors.forEach((color, originalIndex) => {
      const hsl = hexToHsl(color);
      const baseName = getBaseColorName(hsl.h, hsl.s);

      if (!hueGroups[baseName]) {
        hueGroups[baseName] = [];
      }

      hueGroups[baseName].push({
        hex: color,
        originalIndex,
        lightness: hsl.l
      });
    });

    // Generate names for each group
    const result: string[] = new Array(colors.length);

    Object.entries(hueGroups).forEach(([baseName, group]) => {
      // Sort group by lightness (lightest first)
      group.sort((a, b) => b.lightness - a.lightness);

      if (group.length === 1) {
        // Single color in this hue group
        result[group[0].originalIndex] = `${baseName}-500`;
      } else {
        // Multiple colors - generate weights in increments of 100
        group.forEach((color, groupIndex) => {
          const weight = 100 + (groupIndex * 100);
          result[color.originalIndex] = `${baseName}-${Math.min(900, weight)}`;
        });
      }
    });

    return result;
  }
}

/**
 * Generate meaningful color names based on hex values (legacy function for compatibility)
 * Uses HSL to determine base color name and lightness level
 */
export function generateColorName(hex: string, index: number, totalColors: number): string {
  const hsl = hexToHsl(hex);
  const baseName = getBaseColorName(hsl.h, hsl.s);
  const weight = Math.round(100 + (index / (totalColors - 1)) * 800);
  return `${baseName}-${weight}`;
}

/**
 * Create color assets in Penpot's library
 */
export function createColorAssets(colors: string[], groupName: string = 'new-palette'): ColorAsset[] {
  const assets: ColorAsset[] = [];

  // Generate names for the entire palette considering hue consistency
  const colorNames = generatePaletteColorNames(colors);

  colors.forEach((color, index) => {
    const colorName = colorNames[index];
    const fullAssetName = `${groupName}/${colorName}`;

    try {
      // Create the color asset in Penpot's library
      const libraryColor = penpot.library.local.createColor();
      libraryColor.name = fullAssetName;
      libraryColor.color = color;

      assets.push({
        name: colorName,
        color: color,
        groupName: groupName
      });

      console.log(`✅ Created color asset: ${fullAssetName} (${color})`);
    } catch (error) {
      console.error(`❌ Failed to create color asset ${fullAssetName}:`, error);
    }
  });

  return assets;
}

/**
 * Check if color assets functionality is available
 */
export function isColorAssetsAvailable(): boolean {
  return typeof penpot !== 'undefined' &&
    penpot.library &&
    penpot.library.local &&
    typeof penpot.library.local.createColor === 'function';
}

/**
 * Get existing color assets from library (for future reference)
 */
export function getExistingColorAssets(): any[] {
  try {
    if (penpot.library && penpot.library.local) {
      // This would need to be implemented based on Penpot's API
      // Currently, there's no direct way to list existing assets
      return [];
    }
  } catch (error) {
    console.error('Error getting existing color assets:', error);
  }
  return [];
}

/**
 * Validate hex color format
 */
export function isValidHexColor(hex: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(hex);
}

/**
 * Batch create color assets with error handling
 */
export function batchCreateColorAssets(
  colors: string[],
  groupName: string = 'new-palette'
): { success: ColorAsset[], failed: string[] } {
  const success: ColorAsset[] = [];
  const failed: string[] = [];

  // Validate all colors first
  const validColors = colors.filter(color => {
    if (!isValidHexColor(color)) {
      failed.push(color);
      return false;
    }
    return true;
  });

  if (validColors.length === 0) {
    return { success, failed };
  }

  // Generate names for the entire palette considering hue consistency
  const colorNames = generatePaletteColorNames(validColors);

  validColors.forEach((color, index) => {
    try {
      const colorName = colorNames[index];
      const fullAssetName = `${groupName}/${colorName}`;

      const libraryColor = penpot.library.local.createColor();
      libraryColor.name = fullAssetName;
      libraryColor.color = color;

      success.push({
        name: colorName,
        color: color,
        groupName: groupName
      });

    } catch (error) {
      console.error(`Failed to create asset for color ${color}:`, error);
      failed.push(color);
    }
  });

  return { success, failed };
}