# Cursor Mini Games Extension

Multiple mini games (Space Shooter, Runner, Breakout) for Cursor IDE and VS Code that display in a compact webview panel.

## Features

- 🎮 **3 Mini Games**: Space Shooter, Runner, and Breakout
- 🎯 **Space Shooter**: Move ship with mouse, click to shoot targets
- 🏃 **Runner**: Press Spacebar to jump over obstacles
- 🎾 **Breakout**: Move paddle with mouse to break bricks
- 📊 Score tracking for all games
- ⏸️ Pause/Resume with Escape key
- 🎨 Custom dark theme (#363d46, #22272e, #1c2128, #adbac7)
- 📱 Compact design perfect for sidebars and panels

## Installation

### Option 1: Install from VSIX (Recommended)

1. Build the extension:

   ```bash
   npm install -g vsce
   vsce package
   ```

2. In Cursor, go to Extensions view (Ctrl+Shift+X)
3. Click the "..." menu and select "Install from VSIX..."
4. Select the generated `.vsix` file

### Option 2: Development Installation

1. Clone or download this extension
2. Install dependencies (if needed):
   ```bash
   npm install
   ```
3. Press `F5` in VS Code/Cursor to open a new Extension Development Host window
4. **Look for "Space Shooter" in the Explorer sidebar** (left side panel)
5. If you don't see it, open the Explorer view (View → Explorer or Ctrl+Shift+E)
6. Expand the Explorer sidebar to see the "Space Shooter" view

## Usage

Once installed, the extension will automatically activate and show the game panel when Cursor starts.

### Controls

**All Games:**

- **Escape**: Pause/Resume
- **Menu Button**: Return to game selection
- **Reset Button**: Restart current game

**Space Shooter:**

- **Mouse Movement**: Move ship vertically
- **Click**: Shoot bullets

**Runner:**

- **Spacebar**: Jump over obstacles

**Breakout:**

- **Mouse Movement**: Control paddle

### Gameplay

**Space Shooter:**

- Targets spawn from the right side
- Click to shoot bullets at targets
- Score 10 points per target hit
- Avoid colliding with targets

**Runner:**

- Obstacles come from the right
- Press Spacebar to jump
- Score increases as obstacles pass
- Don't hit obstacles!

**Breakout:**

- Break all bricks to win
- Use paddle to bounce ball
- Score 10 points per brick
- Don't let the ball fall!

## Integration with Cursor Agent Panel

This extension now uses a **Webview View** instead of a full webview panel, which allows it to be integrated into sidebars and panels. The game will appear as a compact view in the Explorer sidebar by default.

### Moving the Game to the Agent Panel

To move the game to the agent panel area (above the chat interface):

1. **Find the "Space Shooter" view** in the Explorer sidebar (left side)
2. **Right-click on the "Space Shooter" title** or drag the view tab
3. **Drag it** to the agent panel area (above the chat interface) or wherever you prefer
4. The game will automatically resize to fit the new location

The webview view is designed to be compact and will adapt to the size of its container, making it perfect for smaller panel areas.

**Note**: The exact positioning depends on Cursor's UI layout. If you can't drag it directly to the agent panel, you may need to:

- Right-click on the view title and look for "Move" options
- Or check Cursor's view management settings

## Customization

### Colors

The game uses the following color scheme:

- Background: `#22272e` and `#1c2128`
- Header: `#363d46`
- Player: `#4fc3f7` (blue)
- Targets: `#ff5252` (red)
- Bullets: `#ffffff` (white)

You can modify these colors in the `getGameHTML()` function in `extension.js`.

### Game Settings

You can adjust game parameters in the JavaScript code:

- `targetSpawnRate`: Controls how often targets spawn (default: 0.02)
- `targetSpeed`: Speed of targets moving left (default: 2)
- `bulletSpeed`: Speed of bullets (default: 8)
- `targetSize`: Size of targets (default: 30)

## Building

```bash
# Install vsce if you haven't
npm install -g vsce

# Package the extension
vsce package
```

## Publishing

To publish this extension to the Visual Studio Marketplace:

1. **Create a Publisher Account** at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)
2. **Update `package.json`** with your Publisher ID
3. **Create a Personal Access Token** from Azure DevOps with Marketplace (Manage) scope
4. **Login**: `vsce login YOUR-PUBLISHER-ID`
5. **Publish**: `vsce publish`

See [PUBLISHING.md](./PUBLISHING.md) for detailed step-by-step instructions.

## Compatibility

✅ **VS Code 1.74.0+** - Fully compatible  
✅ **Cursor IDE** - Fully compatible

This extension uses standard VS Code extension APIs, so it works seamlessly in both editors. When published to the Visual Studio Marketplace, users can install it in either VS Code or Cursor.

## Requirements

- VS Code 1.74.0+ or Cursor IDE
- Node.js (for building/publishing only)

## License

MIT

## Troubleshooting

### Game doesn't appear

- Check that the extension is activated (look for "Cursor Space Shooter extension is now active!" in the Output panel)
- Try running the command "Show Space Shooter Game" from the Command Palette (Ctrl+Shift+P)

### Game is not in the agent panel

- The game appears in the Explorer sidebar by default
- **To move it**: Right-click on the "Space Shooter" view title and drag it to your desired location
- The view is designed to be compact and will adapt to smaller panel sizes
- If dragging doesn't work, try using the view context menu options (right-click)

### Performance issues

- Reduce `targetSpawnRate` in the code
- Reduce the number of simultaneous targets

## Contributing

Feel free to submit issues or pull requests to improve the game!
