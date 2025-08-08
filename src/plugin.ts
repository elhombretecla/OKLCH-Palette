// Use development server URL when in dev mode, otherwise use relative path
const isDev = import.meta.env.DEV;
const baseUrl = isDev ? 'http://localhost:4400' : '';

penpot.ui.open("OKLCH Palette Generator", `${baseUrl}/?theme=${penpot.theme}`, {
  width: 800,
  height: 600
});

interface PaletteMessage {
  type: string;
  colors?: string[];
  createAssets?: boolean;
}

// Helper function to debug object structure
function debugObjectStructure(obj: any, name: string) {
  console.log(`=== ${name} Structure ===`);
  console.log('Type:', typeof obj);
  console.log('Keys:', Object.keys(obj));
  console.log('Object:', obj);
  console.log('========================');
}

// Get base color from selected object
function getBaseColorFromSelection(): string | null {
  const selection = penpot.selection;
  
  if (selection.length === 0) {
    console.log('No objects selected');
    return null;
  }
  
  const firstObject = selection[0];
  
  // Debug: log object properties to understand structure
  debugObjectStructure(firstObject, 'Selected Object');
  
  try {
    // Check if object has fills array
    if ('fills' in firstObject && Array.isArray(firstObject.fills) && firstObject.fills.length > 0) {
      console.log('Object has fills array with', firstObject.fills.length, 'items');
      
      // Look for the first solid color fill
      for (let i = 0; i < firstObject.fills.length; i++) {
        const fill = firstObject.fills[i];
        debugObjectStructure(fill, `Fill ${i}`);
        
        if (fill && typeof fill === 'object') {
          // Use type assertion to access properties safely
          const fillObj = fill as any;
          
          // Check for fillColor property (most common)
          if (fillObj.fillColor && typeof fillObj.fillColor === 'string') {
            console.log('✅ Found fillColor:', fillObj.fillColor);
            return fillObj.fillColor;
          }
          
          // Check for color property
          if (fillObj.color && typeof fillObj.color === 'string') {
            console.log('✅ Found color:', fillObj.color);
            return fillObj.color;
          }
          
          // Check for fill property
          if (fillObj.fill && typeof fillObj.fill === 'string') {
            console.log('✅ Found fill:', fillObj.fill);
            return fillObj.fill;
          }
        }
        // Handle string fills (direct hex values)
        else if (typeof fill === 'string') {
          console.log('✅ Fill is string:', fill);
          return fill;
        }
      }
    } else {
      console.log('Object has no fills or fills is not an array');
    }
    
    // Try direct properties on the object using type assertion
    const objAny = firstObject as any;
    
    // Check common color properties
    if (objAny.fillColor && typeof objAny.fillColor === 'string') {
      console.log('✅ Found object fillColor:', objAny.fillColor);
      return objAny.fillColor;
    }
    
    if (objAny.color && typeof objAny.color === 'string') {
      console.log('✅ Found object color:', objAny.color);
      return objAny.color;
    }
    
    if (objAny.fill && typeof objAny.fill === 'string') {
      console.log('✅ Found object fill:', objAny.fill);
      return objAny.fill;
    }
    
  } catch (error) {
    console.error('❌ Error extracting color from selection:', error);
  }
  
  console.log('❌ No color found in selected object');
  return null;
}



// Create rectangles in canvas for palette preview
function createPaletteRectangles(colors: string[]) {
  const rectangles: any[] = [];
  const rectWidth = 100;
  const rectHeight = 100;
  const spacing = 10;
  const startX = penpot.viewport.center.x - (colors.length * (rectWidth + spacing)) / 2;
  const startY = penpot.viewport.center.y - rectHeight / 2;
  
  colors.forEach((color, index) => {
    const rect = penpot.createRectangle();
    if (rect) {
      rect.x = startX + index * (rectWidth + spacing);
      rect.y = startY;
      rect.resize(rectWidth, rectHeight);
      
      // Set fill color
      rect.fills = [{ fillColor: color, fillOpacity: 1 }];
      
      rectangles.push(rect);
    }
  });
  
  // Select all created rectangles
  if (rectangles.length > 0) {
    penpot.selection = rectangles;
  }
}

// Add colors to document color library
function addColorsToLibrary(colors: string[], groupName: string = 'new-palette') {
  const assets: Array<{name: string, color: string, groupName: string}> = [];
  
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
function generatePaletteColorNames(colors: string[]): string[] {
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

// Handle messages from UI
penpot.ui.onMessage<PaletteMessage>((message) => {
  switch (message.type) {
    case 'get-base-color':
      const baseColor = getBaseColorFromSelection();
      penpot.ui.sendMessage({
        type: 'base-color',
        color: baseColor
      });
      break;
      
    case 'add-palette':
      if (message.colors) {
        // Always create rectangles for visual preview
        createPaletteRectangles(message.colors);
        
        // Add to color library if requested
        if (message.createAssets) {
          try {
            const assets = addColorsToLibrary(message.colors, 'new-palette');
            console.log(`✅ Successfully created ${assets.length} color assets`);
            
            // Show success message with details
            penpot.ui.sendMessage({
              type: 'palette-added',
              success: true,
              assetsCreated: assets.length,
              message: `Created ${assets.length} color assets in "new-palette" group`
            });
          } catch (error) {
            console.error('❌ Error creating color assets:', error);
            penpot.ui.sendMessage({
              type: 'palette-added',
              success: false,
              error: 'Failed to create color assets'
            });
          }
        } else {
          // Show success message for rectangles only
          penpot.ui.sendMessage({
            type: 'palette-added',
            success: true,
            message: 'Palette rectangles created successfully'
          });
        }
      }
      break;
  }
});

// Debounce timer for selection changes
let selectionChangeTimer: number | null = null;

// Update selection and send base color when selection changes
penpot.on('selectionchange', () => {
  console.log('Selection changed, scheduling color update...');
  
  // Clear previous timer if it exists
  if (selectionChangeTimer) {
    clearTimeout(selectionChangeTimer);
  }
  
  // Set a small delay to avoid too frequent updates
  selectionChangeTimer = setTimeout(() => {
    console.log('Processing selection change...');
    const baseColor = getBaseColorFromSelection();
    console.log('Sending base color to UI:', baseColor);
    penpot.ui.sendMessage({
      type: 'base-color',
      color: baseColor
    });
    selectionChangeTimer = null;
  }, 100); // 100ms delay
});

// Update the theme in the iframe
penpot.on("themechange", (theme) => {
  penpot.ui.sendMessage({
    source: "penpot",
    type: "themechange",
    theme,
  });
});

// Send initial base color when plugin loads
setTimeout(() => {
  console.log('Sending initial base color...');
  const baseColor = getBaseColorFromSelection();
  console.log('Initial base color:', baseColor);
  penpot.ui.sendMessage({
    type: 'base-color',
    color: baseColor
  });
}, 200); // Slightly longer delay for initial load
