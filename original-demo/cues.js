// CONSTANTS
const SHAPE_SIZE = 36;  // diameter, pixels
const SHAPES = ['circle', 'square', 'triangle', 'star'];
const TEXTURE_GRID_SIZE = 6;  // number of rows/columns in texture grid
const TEXTURE_SPACING = 0.17;  // spacing between shapes as proportion of cell size
const SHAPE_COLOR = 'darkslategray';

/**
 * Draw a cue on the canvas based on a cue specification
 * @param {HTMLCanvasElement} cueCanvas - The canvas element to draw on
 * @param {Object} cue - Cue specification from JSON (e.g., from individual.json or textures.json)
 */
function drawCue(cueCanvas, cue) {
    const ctx = cueCanvas.getContext('2d');
    const canvasWidth = cueCanvas.width;
    const canvasHeight = cueCanvas.height;
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Use SHAPE_COLOR for fills and strokes
    ctx.fillStyle = SHAPE_COLOR;
    ctx.strokeStyle = SHAPE_COLOR;
    ctx.lineWidth = 2;
    
    // Check if this is a tilePattern (textures.json format) or shapes array (individual/multiple.json format)
    if (cue.tilePattern) {
        drawTilePattern(ctx, canvasWidth, canvasHeight, cue.tilePattern);
    } else if (cue.shapes) {
        // Draw each shape in the cue
        cue.shapes.forEach(shapeSpec => {
            const centerX = shapeSpec.x * canvasWidth;
            const centerY = shapeSpec.y * canvasHeight;
            const size = SHAPE_SIZE;
            
            drawShape(ctx, shapeSpec.type, centerX, centerY, size);
        });
    }
}

/**
 * Draw a tiled pattern across the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {Object} tilePattern - Tile pattern specification
 */
function drawTilePattern(ctx, canvasWidth, canvasHeight, tilePattern) {
    const gridSize = TEXTURE_GRID_SIZE;
    const spacing = TEXTURE_SPACING;
    const { pattern } = tilePattern;
    
    const cellSize = Math.min(canvasWidth, canvasHeight) / gridSize;
    const shapeSize = cellSize * (1 - spacing);
    
    // Calculate grid to center it on canvas
    const gridWidth = gridSize * cellSize;
    const gridHeight = gridSize * cellSize;
    const startX = (canvasWidth - gridWidth) / 2;
    const startY = (canvasHeight - gridHeight) / 2;
    
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            // Calculate position
            const x = startX + col * cellSize + cellSize / 2;
            const y = startY + row * cellSize + cellSize / 2;
            
            // Determine which shape to draw
            let shapeType;
            if (tilePattern.type) {
                // Single shape type
                shapeType = tilePattern.type;
            } else if (tilePattern.types) {
                // Multiple shape types
                if (pattern === 'alternating') {
                    // Checkerboard pattern
                    const index = (row + col) % tilePattern.types.length;
                    shapeType = tilePattern.types[index];
                } else if (pattern === 'random') {
                    // Random pattern (seeded by position for consistency)
                    const seed = row * gridSize + col;
                    const index = seed % tilePattern.types.length;
                    shapeType = tilePattern.types[index];
                } else {
                    // Default to cycling through types
                    const index = (row * gridSize + col) % tilePattern.types.length;
                    shapeType = tilePattern.types[index];
                }
            }
            
            drawShape(ctx, shapeType, x, y, shapeSize);
        }
    }
}

/**
 * Draw a shape at the specified position
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} type - Shape type ('circle', 'square', 'triangle', 'star')
 * @param {number} x - Center x position
 * @param {number} y - Center y position
 * @param {number} size - Shape size
 */
function drawShape(ctx, type, x, y, size) {
    switch(type) {
        case 'circle':
            drawCircle(ctx, x, y, size / 2);
            break;
        case 'square':
            drawSquare(ctx, x, y, size);
            break;
        case 'triangle':
            drawTriangle(ctx, x, y, size);
            break;
        case 'star':
            drawStar(ctx, x, y, size / 2);
            break;
    }
}

/**
 * Draw a circle
 */
function drawCircle(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
}

/**
 * Draw a square
 */
function drawSquare(ctx, x, y, size) {
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
}

/**
 * Draw an upward-pointing triangle
 */
function drawTriangle(ctx, x, y, size) {
    const height = size * Math.sqrt(3) / 2;
    ctx.beginPath();
    ctx.moveTo(x, y - height / 2);  // top point
    ctx.lineTo(x - size / 2, y + height / 2);  // bottom left
    ctx.lineTo(x + size / 2, y + height / 2);  // bottom right
    ctx.closePath();
    ctx.fill();
}

/**
 * Draw a 5-pointed star
 */
function drawStar(ctx, x, y, radius) {
    const spikes = 5;
    const outerRadius = radius;
    const innerRadius = radius * 0.4;
    
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const angle = (Math.PI / spikes) * i - Math.PI / 2;
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;
        
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.closePath();
    ctx.fill();
}

/**
 * Load and draw a cue from a JSON file by index
 * @param {string} jsonPath - Path to the JSON file (e.g., 'stimuli/individual.json', 'stimuli/multiple.json', 'stimuli/textures.json')
 * @param {number} index - Index of the cue in the JSON array
 */
async function loadAndDrawCue(jsonPath, index) {
    try {
        const response = await fetch(jsonPath);
        const cues = await response.json();
        
        if (index < 0 || index >= cues.length) {
            console.error(`Index ${index} is out of bounds. Available cues: 0-${cues.length - 1}`);
            return;
        }
        
        const cue = cues[index];
        const cueCanvas = document.getElementById('cueCanvas');
        drawCue(cueCanvas, cue);
        
        console.log(`Drew cue: ${cue.id}`);
    } catch (error) {
        console.error('Error loading cue:', error);
    }
}

// Example usage - uncomment to test:
// loadAndDrawCue('stimuli/individual.json', 0);  // draws single shapes
// loadAndDrawCue('stimuli/multiple.json', 0);    // draws multiple shapes
loadAndDrawCue('stimuli/textures.json', 0);    // draws tiled patterns