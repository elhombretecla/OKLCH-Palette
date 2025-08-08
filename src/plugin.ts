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
function addColorsToLibrary(colors: string[], baseName: string = 'Palette') {
  // For now, we'll just create the rectangles as the color library API needs more investigation
  console.log('Colors to add to library:', colors.map((color, index) => ({
    name: `${baseName}-${(index + 1) * 100}`,
    color
  })));
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
          addColorsToLibrary(message.colors);
        }
        
        // Show success message
        penpot.ui.sendMessage({
          type: 'palette-added',
          success: true
        });
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
