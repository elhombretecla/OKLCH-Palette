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
 * Generate meaningful color names based on hex values
 * Uses HSL to determine base color name and lightness level
 */
export function generateColorName(hex: string, index: number, totalColors: number): string {
  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Convert RGB to HSL
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const diff = max - min;

  let h = 0;
  const l = (max + min) / 2;
  const s = diff === 0 ? 0 : diff / (1 - Math.abs(2 * l - 1));

  if (diff !== 0) {
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / diff) % 6;
        break;
      case gNorm:
        h = (bNorm - rNorm) / diff + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / diff + 4;
        break;
    }
  }

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  // Determine base color name from hue
  let baseName = 'gray';

  if (s > 0.1) { // Only assign color names if there's sufficient saturation
    if (h >= 0 && h < 15) baseName = 'red';
    else if (h >= 15 && h < 45) baseName = 'orange';
    else if (h >= 45 && h < 75) baseName = 'yellow';
    else if (h >= 75 && h < 105) baseName = 'lime';
    else if (h >= 105 && h < 135) baseName = 'green';
    else if (h >= 135 && h < 165) baseName = 'teal';
    else if (h >= 165 && h < 195) baseName = 'cyan';
    else if (h >= 195 && h < 225) baseName = 'blue';
    else if (h >= 225 && h < 255) baseName = 'indigo';
    else if (h >= 255 && h < 285) baseName = 'purple';
    else if (h >= 285 && h < 315) baseName = 'pink';
    else if (h >= 315 && h < 345) baseName = 'rose';
    else baseName = 'red';
  }

  // Generate weight based on position in palette (100-900 scale)
  const weight = Math.round(100 + (index / (totalColors - 1)) * 800);

  return `${baseName}-${weight}`;
}

/**
 * Create color assets in Penpot's library
 */
export function createColorAssets(colors: string[], groupName: string = 'new-palette'): ColorAsset[] {
  const assets: ColorAsset[] = [];

  colors.forEach((color, index) => {
    const colorName = generateColorName(color, index, colors.length);
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

  colors.forEach((color, index) => {
    if (!isValidHexColor(color)) {
      failed.push(color);
      return;
    }

    try {
      const colorName = generateColorName(color, index, colors.length);
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