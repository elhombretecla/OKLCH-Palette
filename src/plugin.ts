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

// Get base color from selected object
function getBaseColorFromSelection(): string | null {
  const selection = penpot.selection;
  
  if (selection.length === 0) {
    return null;
  }
  
  const firstObject = selection[0];
  
  // Check if object has fills
  if ('fills' in firstObject && firstObject.fills && firstObject.fills.length > 0) {
    const firstFill = firstObject.fills[0];
    
    // Check if it's a solid color fill (string means it's a color)
    if (typeof firstFill === 'string') {
      return firstFill;
    }
  }
  
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

// Update selection and send base color when selection changes
penpot.on('selectionchange', () => {
  const baseColor = getBaseColorFromSelection();
  penpot.ui.sendMessage({
    type: 'base-color',
    color: baseColor
  });
});

// Update the theme in the iframe
penpot.on("themechange", (theme) => {
  penpot.ui.sendMessage({
    source: "penpot",
    type: "themechange",
    theme,
  });
});

// Send initial base color
setTimeout(() => {
  const baseColor = getBaseColorFromSelection();
  penpot.ui.sendMessage({
    type: 'base-color',
    color: baseColor
  });
}, 100);
