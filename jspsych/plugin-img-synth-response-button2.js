var jsPsychImgSynthResponseButtons2 = (function (jspsych) {
  "use strict";

  const info = {
    name: "img-synth-response-flipped",
    version: "1.0.0",
    parameters: {
      /** Path to JSON file containing cue stimuli */
      stimulus_json: {
        type: jspsych.ParameterType.STRING,
        default: undefined,
      },
      /** Index of the stimulus in the JSON array */
      stimulus_index: {
        type: jspsych.ParameterType.INT,
        default: 0,
      },
      /** Width of the cue canvas */
      cue_canvas_width: {
        type: jspsych.ParameterType.INT,
        default: 400,
      },
      /** Height of the cue canvas */
      cue_canvas_height: {
        type: jspsych.ParameterType.INT,
        default: 300,
      },
      /** Width of the instrument canvas */
      instrument_canvas_width: {
        type: jspsych.ParameterType.INT,
        default: 600,
      },
      /** Height of the instrument canvas */
      instrument_canvas_height: {
        type: jspsych.ParameterType.INT,
        default: 300,
      },
      /** Prompt to display above the canvases */
      prompt: {
        type: jspsych.ParameterType.HTML_STRING,
        default: null,
      },
      /** How long to show the trial (ms). If null, trial continues until ended by other means. */
      trial_duration: {
        type: jspsych.ParameterType.INT,
        default: null,
      },
      /** Key to press to end the trial */
      end_trial_key: {
        type: jspsych.ParameterType.KEY,
        default: 'Enter',
      },
    },
    data: {
      /** Array of interaction events with key, mouse Y position, filter cutoff, and timestamp */
      interactions: {
        type: jspsych.ParameterType.COMPLEX,
      },
      /** The stimulus JSON path */
      stimulus_json: {
        type: jspsych.ParameterType.STRING,
      },
      /** The stimulus index */
      stimulus_index: {
        type: jspsych.ParameterType.INT,
      },
      /** Response time (trial duration) */
      rt: {
        type: jspsych.ParameterType.INT,
      },
    },
  };

  /**
   * **img-synth-response-flipped**
   *
   * Display a visual cue and allow the participant to respond by playing notes on a keyboard-controlled synthesizer.
   * Uses ASDFGHJKL; keys for filter cutoff (quality) and mouse Y position for pitch.
   *
   * @author Matthew Caren
   */
  class ImgSynthResponseFlippedPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial) {
      // Constants
      const SHAPE_SIZE = 36;
      const TEXTURE_GRID_SIZE = 10;
      const TEXTURE_SPACING = 0.20;
      const SHAPE_COLOR = 'darkslategray';
      const MIN_FILTER_FREQ = 100;
      const MAX_FILTER_FREQ = 20000;
      
      // Keyboard synthesizer constants
      const KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'];
      const NUM_KEYS = KEYS.length;
      const KEY_FREQUENCIES = [
        261.63, // C4
        293.66, // D4
        329.63, // E4
        349.23, // F4
        392.00, // G4
        440.00, // A4
        493.88, // B4
        523.25, // C5
        587.33, // D5
        659.25, // E5
      ];
      const KEY_FILTER_CUTOFFS = [
        200,    // Low cutoff
        500,
        1000,
        2000,
        4000,
        6000,
        8000,
        10000,
        15000,
        20000   // High cutoff
      ];
      const SQUARE_HEIGHT = 40;
      const SQUARE_SPACING = 10;

      // Trial state
      let startTime = performance.now();
      let interactions = [];
      let audioContext = null;
      let activeNote = null; // Single active note (not key-based)
      let currentMouseY = 0;
      let currentFrequency = 440;
      let currentFilterCutoff = 1000;
      let isMouseDown = false;
      let currentKey = null; // Track which key is pressed for filter cutoff

      // Initialize audio context
      const initAudio = () => {
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
      };

      // Create HTML structure
      const html = `
        <style>
          .img-synth-container {
            display: flex;
            flex-direction: row;
            gap: 160px;
            align-items: flex-start;
            justify-content: center;
            margin-bottom: 50px;
          }
          .img-synth-canvas-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            position: relative;
          }
          .img-synth-canvas-section h2 {
            margin: 0;
            font-size: 1.5em;
            font-weight: 400;
            color: #f95959;
          }
          .img-synth-cue-canvas {
            cursor: default;
            border: 1px solid #455d7a;
          }
          .img-synth-instrument-canvas {
            cursor: crosshair;
            background-color: #e3e3e3;
            border: 1px solid #455d7a;
          }
          .img-synth-y-axis-label {
            position: absolute;
            color: #f95959;
            font-size: 14px;
            pointer-events: none;
            left: -65px;
            top: 50%;
            transform: translateY(100%) rotate(-90deg);
            white-space: nowrap;
          }
          .img-synth-prompt {
            text-align: center;
            margin-bottom: 20px;
          }
          .img-synth-end-instruction {
            text-align: center;
            margin-top: 20px;
            color: #666;
          }
          .img-synth-keyboard-instruction {
            text-align: center;
            margin-top: 10px;
            color: #666;
            font-size: 14px;
          }
        </style>
        ${trial.prompt ? `<div class="img-synth-prompt">${trial.prompt}</div>` : ''}
        <div class="img-synth-container">
          <div class="img-synth-canvas-section">
            <h2>CUE</h2>
            <canvas class="img-synth-cue-canvas" width="${trial.cue_canvas_width}" height="${trial.cue_canvas_height}"></canvas>
          </div>
          <div class="img-synth-canvas-section">
            <h2>INSTRUMENT</h2>
            <canvas class="img-synth-instrument-canvas" width="${trial.instrument_canvas_width}" height="${trial.instrument_canvas_height}"></canvas>
            <div class="img-synth-keyboard-instruction">Use ASDFGHJKL; keys for quality, mouse Y position for pitch, click/hold to play</div>
          </div>
        </div>
        <div class="img-synth-end-instruction">Press ${trial.end_trial_key} to continue</div>
      `;

      display_element.innerHTML = html;

      // Get canvas elements
      const cueCanvas = display_element.querySelector('.img-synth-cue-canvas');
      const instrumentCanvas = display_element.querySelector('.img-synth-instrument-canvas');
      const instrumentCtx = instrumentCanvas.getContext('2d');

      // Calculate square dimensions
      const squareWidth = (trial.instrument_canvas_width - (NUM_KEYS + 1) * SQUARE_SPACING) / NUM_KEYS;

      // Shape drawing functions
      const drawCircle = (ctx, x, y, radius) => {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
      };

      const drawSquare = (ctx, x, y, size) => {
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      };

      const drawTriangle = (ctx, x, y, size) => {
        const height = size * Math.sqrt(3) / 2;
        ctx.beginPath();
        ctx.moveTo(x, y - height / 2);
        ctx.lineTo(x - size / 2, y + height / 2);
        ctx.lineTo(x + size / 2, y + height / 2);
        ctx.closePath();
        ctx.fill();
      };

      const drawStar = (ctx, x, y, radius) => {
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
      };

      const drawShape = (ctx, type, x, y, size) => {
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
      };

      const drawTilePattern = (ctx, canvasWidth, canvasHeight, tilePattern) => {
        const gridSize = TEXTURE_GRID_SIZE;
        const spacing = TEXTURE_SPACING;
        const { pattern } = tilePattern;
        const cellSize = Math.min(canvasWidth, canvasHeight) / gridSize;
        const shapeSize = cellSize * (1 - spacing);
        const gridWidth = gridSize * cellSize;
        const gridHeight = gridSize * cellSize;
        const startX = (canvasWidth - gridWidth) / 2;
        const startY = (canvasHeight - gridHeight) / 2;
        
        for (let row = 0; row < gridSize; row++) {
          for (let col = 0; col < gridSize; col++) {
            const x = startX + col * cellSize + cellSize / 2;
            const y = startY + row * cellSize + cellSize / 2;
            let shapeType;
            if (tilePattern.type) {
              shapeType = tilePattern.type;
            } else if (tilePattern.types) {
              if (pattern === 'alternating') {
                const index = (row + col) % tilePattern.types.length;
                shapeType = tilePattern.types[index];
              } else if (pattern === 'random') {
                const seed = row * gridSize + col;
                const index = seed % tilePattern.types.length;
                shapeType = tilePattern.types[index];
              } else {
                const index = (row * gridSize + col) % tilePattern.types.length;
                shapeType = tilePattern.types[index];
              }
            }
            drawShape(ctx, shapeType, x, y, shapeSize);
          }
        }
      };

      const drawCue = (canvas, cue) => {
        const ctx = canvas.getContext('2d');
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = SHAPE_COLOR;
        ctx.strokeStyle = SHAPE_COLOR;
        ctx.lineWidth = 2;
        
        if (cue.tilePattern) {
          drawTilePattern(ctx, canvasWidth, canvasHeight, cue.tilePattern);
        } else if (cue.shapes) {
          cue.shapes.forEach(shapeSpec => {
            const centerX = shapeSpec.x * canvasWidth;
            const centerY = shapeSpec.y * canvasHeight;
            const size = SHAPE_SIZE;
            drawShape(ctx, shapeSpec.type, centerX, centerY, size);
          });
        }
      };

      // Draw keyboard interface
      const drawKeyboard = () => {
        instrumentCtx.clearRect(0, 0, instrumentCanvas.width, instrumentCanvas.height);
        
        // Draw keyboard squares
        for (let i = 0; i < NUM_KEYS; i++) {
          const x = SQUARE_SPACING + i * (squareWidth + SQUARE_SPACING);
          const y = instrumentCanvas.height - SQUARE_HEIGHT - SQUARE_SPACING;
          
          const key = KEYS[i];
          const isActive = currentKey === key;
          
          // Draw square
          instrumentCtx.fillStyle = isActive ? '#f95959' : '#455d7a';
          instrumentCtx.fillRect(x, y, squareWidth, SQUARE_HEIGHT);
          
          // Draw key label
          instrumentCtx.fillStyle = '#ffffff';
          instrumentCtx.font = '16px Arial';
          instrumentCtx.textAlign = 'center';
          instrumentCtx.textBaseline = 'middle';
          instrumentCtx.fillText(key.toUpperCase(), x + squareWidth / 2, y + SQUARE_HEIGHT / 2);
        }
        
        // Draw pitch bar if note is active (mouse is down)
        if (activeNote) {
          instrumentCtx.fillStyle = 'rgba(249, 89, 89, 0.5)';
          instrumentCtx.fillRect(0, currentMouseY - 2, instrumentCanvas.width, 4);
        }
      };

      // Calculate frequency from Y position
      const calculateFrequency = (y) => {
        const normalizedY = 1 - y / instrumentCanvas.height;
        // Use same frequency range as keyboard
        const minFreq = KEY_FREQUENCIES[0];
        const maxFreq = KEY_FREQUENCIES[KEY_FREQUENCIES.length - 1];
        const logFrequency = minFreq * Math.pow(maxFreq / minFreq, normalizedY);
        return logFrequency;
      };

      // Audio synthesis functions
      const startNote = () => {
        if (activeNote) return; // Already playing
        
        initAudio();
        
        const frequency = currentFrequency;
        const filterCutoff = currentFilterCutoff;
        
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        
        const filter = audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterCutoff, audioContext.currentTime);
        filter.Q.setValueAtTime(1, audioContext.currentTime);
        
        const gain = audioContext.createGain();
        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        
        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        
        oscillator.start();
        
        activeNote = {
          oscillator: oscillator,
          filter: filter,
          gain: gain,
          frequency: frequency,
          filterCutoff: filterCutoff
        };
        
        drawKeyboard();
        
        // Record interaction
        const timestamp = performance.now() - startTime;
        interactions.push({
          type: 'mousedown',
          frequency: frequency,
          mouseY: currentMouseY,
          filterCutoff: filterCutoff,
          activeKey: currentKey,
          t: timestamp
        });
      };

      const stopNote = () => {
        if (!activeNote) return;
        
        const now = audioContext.currentTime;
        const fadeTime = 0.1;
        
        activeNote.gain.gain.cancelScheduledValues(now);
        activeNote.gain.gain.setValueAtTime(activeNote.gain.gain.value, now);
        activeNote.gain.gain.linearRampToValueAtTime(0, now + fadeTime);
        activeNote.oscillator.stop(now + fadeTime);
        
        activeNote = null;
        drawKeyboard();
        
        // Record interaction
        const timestamp = performance.now() - startTime;
        interactions.push({
          type: 'mouseup',
          t: timestamp
        });
      };

      const updateFrequency = () => {
        if (!activeNote) return;
        const now = audioContext.currentTime;
        const glideTime = 0.05;
        activeNote.oscillator.frequency.linearRampToValueAtTime(currentFrequency, now + glideTime);
      };

      const updateFilterCutoff = () => {
        if (!activeNote) return;
        const now = audioContext.currentTime;
        const glideTime = 0.05;
        activeNote.filter.frequency.linearRampToValueAtTime(currentFilterCutoff, now + glideTime);
      };

      // Mouse event handlers
      const handleMouseDown = (event) => {
        const rect = instrumentCanvas.getBoundingClientRect();
        const y = event.clientY - rect.top;
        
        isMouseDown = true;
        currentMouseY = Math.max(0, Math.min(y, instrumentCanvas.height - SQUARE_HEIGHT - 2 * SQUARE_SPACING));
        currentFrequency = calculateFrequency(currentMouseY);
        
        startNote();
      };

      const handleMouseMove = (event) => {
        const rect = instrumentCanvas.getBoundingClientRect();
        const y = event.clientY - rect.top;
        
        // Clamp Y within canvas bounds
        currentMouseY = Math.max(0, Math.min(y, instrumentCanvas.height - SQUARE_HEIGHT - 2 * SQUARE_SPACING));
        currentFrequency = calculateFrequency(currentMouseY);
        
        // Update frequency if note is active
        if (activeNote) {
          updateFrequency();
          
          // Record interaction
          const timestamp = performance.now() - startTime;
          interactions.push({
            type: 'mousemove',
            mouseY: currentMouseY,
            frequency: currentFrequency,
            filterCutoff: currentFilterCutoff,
            activeKey: currentKey,
            t: timestamp
          });
        }
        
        drawKeyboard();
      };

      const handleMouseUp = (event) => {
        if (!isMouseDown) return;
        isMouseDown = false;
        stopNote();
      };

      const handleMouseLeave = (event) => {
        if (isMouseDown) {
          isMouseDown = false;
          stopNote();
        }
      };

      // Keyboard event handlers
      const handleKeyDown = (event) => {
        const key = event.key.toLowerCase();
        if (KEYS.includes(key) && !event.repeat) {
          event.preventDefault();
          const keyIndex = KEYS.indexOf(key);
          if (keyIndex !== -1) {
            currentKey = key;
            currentFilterCutoff = KEY_FILTER_CUTOFFS[keyIndex];
            
            // Update filter if note is already playing
            if (activeNote) {
              updateFilterCutoff();
            }
            
            drawKeyboard();
            
            // Record interaction
            const timestamp = performance.now() - startTime;
            interactions.push({
              type: 'keydown',
              key: key,
              filterCutoff: currentFilterCutoff,
              t: timestamp
            });
          }
        }
      };

      const handleKeyUp = (event) => {
        const key = event.key.toLowerCase();
        if (KEYS.includes(key)) {
          event.preventDefault();
          // Keep currentKey and currentFilterCutoff at their last values (don't reset)
          
          // Record interaction
          const timestamp = performance.now() - startTime;
          interactions.push({
            type: 'keyup',
            key: key,
            t: timestamp
          });
        }
      };

      // Attach event listeners
      instrumentCanvas.addEventListener('mousedown', handleMouseDown);
      instrumentCanvas.addEventListener('mousemove', handleMouseMove);
      instrumentCanvas.addEventListener('mouseup', handleMouseUp);
      instrumentCanvas.addEventListener('mouseleave', handleMouseLeave);
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);

      // Load and draw the cue
      const loadCue = async () => {
        try {
          const response = await fetch(trial.stimulus_json);
          const cues = await response.json();
          
          if (trial.stimulus_index < 0 || trial.stimulus_index >= cues.length) {
            console.error(`Stimulus index ${trial.stimulus_index} is out of bounds.`);
            return;
          }
          
          const cue = cues[trial.stimulus_index];
          drawCue(cueCanvas, cue);
        } catch (error) {
          console.error('Error loading cue:', error);
        }
      };

      // End trial function
      const endTrial = () => {
        // Stop active note if playing
        if (activeNote) {
          stopNote();
        }

        // Remove event listeners
        instrumentCanvas.removeEventListener('mousedown', handleMouseDown);
        instrumentCanvas.removeEventListener('mousemove', handleMouseMove);
        instrumentCanvas.removeEventListener('mouseup', handleMouseUp);
        instrumentCanvas.removeEventListener('mouseleave', handleMouseLeave);
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);

        // Gather data
        const trial_data = {
          interactions: interactions,
          stimulus_json: trial.stimulus_json,
          stimulus_index: trial.stimulus_index,
          rt: performance.now() - startTime,
        };

        // Clear display
        display_element.innerHTML = '';

        // Finish trial
        this.jsPsych.finishTrial(trial_data);
      };

      // Keyboard listener for ending trial
      const keyboardListener = this.jsPsych.pluginAPI.getKeyboardResponse({
        callback_function: (info) => {
          endTrial();
        },
        valid_responses: [trial.end_trial_key],
        rt_method: 'performance',
        persist: false,
        allow_held_key: false,
      });

      // Trial duration timeout
      if (trial.trial_duration !== null) {
        this.jsPsych.pluginAPI.setTimeout(() => {
          endTrial();
        }, trial.trial_duration);
      }

      // Initialize keyboard display
      drawKeyboard();

      // Load the cue stimulus
      loadCue();
    }
  }
  
  ImgSynthResponseFlippedPlugin.info = info;

  return ImgSynthResponseFlippedPlugin;
})(jsPsychModule);
