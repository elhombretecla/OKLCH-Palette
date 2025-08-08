# OKLCH Palette Plugin for Penpot

A powerful color palette generator for Penpot that creates perceptually uniform and accessible color palettes using the OKLCH color space.

## Features

- **Base Color Detection**: Automatically detects the fill color from selected objects in Penpot
- **OKLCH Color Space**: Uses the perceptually uniform OKLCH color space for better color relationships
- **Multiple Curve Types**: Generate palettes using different mathematical curves:
  - Linear
  - Normal (sine wave)
  - Quadratic
  - Arctangent
  - Sine
  - Exponential
- **Real-time Preview**: See your palette update in real-time as you adjust parameters
- **Manual Control**: Fine-tune individual color lightness values with vertical sliders
- **Three Channel Tabs**: Control Luminescence, Chroma, and Hue independently
- **Canvas Integration**: Create color rectangles directly in your Penpot canvas
- **Color Library**: Option to add generated colors to your document's color library

## How to Use

1. **Select a Base Color**: 
   - Select an object with a fill color in Penpot, or
   - Use the color picker to choose a base color

2. **Adjust Parameters**:
   - Set the number of shades (2-20)
   - Choose between Luminescence, Chroma, or Hue tabs
   - Select a curve type (Linear, Normal, Quad, Arctan, Sine, Expo)
   - Fine-tune curve parameters using the sliders

3. **Manual Adjustments**:
   - Switch to Luminescence tab for manual control
   - Use vertical sliders to adjust individual color lightness values

4. **Generate Palette**:
   - Check "Create as color assets" to add colors to your library
   - Click "Add to my file" to create color rectangles in your canvas

## Technical Details

- Built with TypeScript and Vite
- Uses the Culori.js library for accurate color space conversions
- Implements the official Penpot Plugin API
- Supports gamut clipping to ensure web-safe colors

## Installation

1. Build the plugin: `npm run build`
2. Load the plugin in Penpot using the generated `dist` folder

## Development

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Build for production
npm run build
```

## Color Space Information

OKLCH (OK Lightness Chroma Hue) is a perceptually uniform color space that provides:
- **Lightness (L)**: 0-1 range, represents perceived brightness
- **Chroma (C)**: 0-0.4 range, represents color intensity/saturation
- **Hue (H)**: 0-360 degrees, represents the color angle

This ensures that color variations appear more natural and accessible compared to traditional RGB-based palette generation.

## License

This project is licensed under the MIT License - see the LICENSE file for details.