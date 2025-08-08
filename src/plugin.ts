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
 * Generate meaningful color names based on hex values
 * Uses HSL to determine base color name and lightness level
 */
function generateColorName(hex: string, index: number, totalColors: number): string {
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
