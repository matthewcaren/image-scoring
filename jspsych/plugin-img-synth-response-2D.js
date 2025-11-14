var jsPsychImgSynthResponse2D = (function (jspsych) {
  "use strict";

  const info = {
    name: "img-synth-response",
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
      /** Index of the cue within the suite to highlight (0, 1, or 2) */
      cue_highlight_index: {
        type: jspsych.ParameterType.INT,
        default: 0,
      },
      /** Type of synthesizer mode: 'discrete' or 'legato' */
      synth_type: {
        type: jspsych.ParameterType.STRING,
        default: 'discrete',
      },
      /** Width of the cue canvas */
      cue_canvas_width: {
        type: jspsych.ParameterType.INT,
        default: 600,
      },
      /** Height of the cue canvas */
      cue_canvas_height: {
        type: jspsych.ParameterType.INT,
        default: 200,
      },
      /** Width and height of the instrument canvas */
      instrument_canvas_size: {
        type: jspsych.ParameterType.INT,
        default: 400,
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
      /** Array of all performance attempts, each containing interactions and metadata */
      performances: {
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
      /** The cue highlight index */
      cue_highlight_index: {
        type: jspsych.ParameterType.INT,
      },
      /** The synth type used */
      synth_type: {
        type: jspsych.ParameterType.STRING,
      },
      /** Response time (trial duration) */
      rt: {
        type: jspsych.ParameterType.INT,
      },
      /** Resolved explicit cue descriptions for this stimulus (array of objects) */
      cues: {
        type: jspsych.ParameterType.COMPLEX,
      },
    },
  };


  /**
   * **img-synth-response**
   *
   * Display a visual cue and allow the participant to respond by interacting with a 2D synthesizer canvas.
   * Records mouse position and timing data during interaction.
   *
   * @author Matthew Caren
   */
  class ImgSynthResponsePlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial) {
      // Constants
      const SHAPE_SIZE = 36;
      const TEXTURE_GRID_SIZE = 10;
      const TEXTURE_SPACING = 0.20;
      const SHAPE_COLOR = 'darkslategray';
      const NOTE_LENGTH = 1.5;
      const MIN_FREQ = 110;
      const MAX_FREQ = 450;
      const MIN_FILTER_FREQ = 100;
      const MAX_FILTER_FREQ = 20000;
      const CIRCLE_SIZE_START = 12;
      const CIRCLE_SIZE_END = 20;

      // Descriptor mappings
      const POSITION_MAP = {
        'low': 0.2,
        'mid': 0.5,
        'high': 0.8
      };

      const SHAPE_MAP = {
        'low': 'circle',
        'mid': 'square',
        'high': 'star'
      };

      const COLOR_MAP = {
        'low': 'red',
        'mid': 'green',
        'high': 'blue'
      };

      // Prompts
      const APPROVE_PROMPT = 'Listen to your performance and make sure you\'re satisfied before continuing.';
      const MATCHING_PROMPT = 'Does your sound match this cue?';

      // Resolve abstract descriptors to concrete values
      const resolveDescriptor = (descriptor, map, index) => {
        if (descriptor === 'mixed') {
          // For mixed, cycle through low/mid/high based on index
          const levels = ['low', 'mid', 'high'];
          const level = levels[index % 3];
          return map[level];
        }
        // For static descriptors (low/mid/high), return the mapped value
        return map[descriptor];
      };

      // Trial state
      let startTime = performance.now();
      let interactions = [];
      let isMouseDown = false;
      let audioContext = null;
      let activeCircles = [];
      let legatoCircle = null;
      let legatoState = {
        active: false,
        oscillator: null,
        filter: null,
        masterGain: null,
        currentFrequency: 440,
        currentFilterCutoff: 1000
      };
      
      // Recording state
      let performances = [];
      let currentPerformance = null;
      let mediaRecorder = null;
      let audioChunks = [];
      let recordedAudioURL = null;
      let audioDestination = null;
      let recordingState = 'idle';
      let performanceStartTime = null;
      let hasHeard = false;
      let recordingTimeoutId = null;
      let resolvedCues = null;

      // Initialize audio context
      const initAudio = () => {
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          // Create destination for recording
          audioDestination = audioContext.createMediaStreamDestination();
          
          // Add a silent oscillator to keep the stream active during silence/rests
          // This ensures MediaRecorder captures timing properly
          const silenceNode = audioContext.createConstantSource();
          const silenceGain = audioContext.createGain();
          silenceGain.gain.value = 0.0001;
          silenceNode.connect(silenceGain);
          silenceGain.connect(audioDestination);
          silenceNode.start();
        }
      };
      
      const startRecording = () => {
        if (recordingState !== 'idle') return;
        
        initAudio();
        audioChunks = [];
        interactions = [];
        performanceStartTime = performance.now();
        
        mediaRecorder = new MediaRecorder(audioDestination.stream);
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          recordedAudioURL = URL.createObjectURL(audioBlob);
        };
        
        mediaRecorder.start(100);

        // Set a timeout to automatically stop recording after 15 seconds
        recordingTimeoutId = setTimeout(() => {
          if (recordingState === 'recording') {
            stopRecording();
          }
        }, 15000);
        recordingState = 'recording';
        
        endInstruction.textContent = '';
        const _doneBtn = document.getElementById('done-btn');
        if (_doneBtn) {
          _doneBtn.disabled = false;
          _doneBtn.removeEventListener('click', stopRecording);
          _doneBtn.addEventListener('click', stopRecording);
        } else {
          controlsContainer.innerHTML = '<button id="done-btn">Done</button>';
          document.getElementById('done-btn').addEventListener('click', stopRecording);
        }
      };
      
      const stopRecording = () => {
        if (recordingState !== 'recording') return;
        
        if (trial.synth_type === 'legato' && legatoState.active) {
          stopLegatoSynth();
        }
        
        if (recordingTimeoutId) {
          clearTimeout(recordingTimeoutId);
          recordingTimeoutId = null;
        }

        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        
        currentPerformance = {
          interactions: [...interactions],
          duration: performance.now() - performanceStartTime,
          timestamp: Date.now()
        };
        
        recordingState = 'recorded';
        hasHeard = false;

        instrumentCanvas.classList.add('disabled');
        isMouseDown = false;

        // Hide the initial sub-instructions once recording is finished (Done pressed)
        const subInstructions = display_element.querySelector('.img-synth-sub-instructions');
        if (subInstructions) {
          subInstructions.style.display = 'none';
        }

        endInstruction.textContent = APPROVE_PROMPT;
        endInstruction.style.color = '#000';
        controlsContainer.innerHTML = `
          <button id="play-btn">Play</button>
          <button id="retry-btn">Retry</button>
          <button id="next-btn" class="primary" disabled>Next Cue</button>
        `;

        document.getElementById('play-btn').addEventListener('click', playRecording);
        document.getElementById('retry-btn').addEventListener('click', retryRecording);
        document.getElementById('next-btn').addEventListener('click', nextCue);
        
        const _playBtn_init = document.getElementById('play-btn');
        if (_playBtn_init) {
          _playBtn_init.classList.add('pulse');
        }
      };
      
      const playRecording = () => {
        if (!recordedAudioURL || recordingState === 'playing') return;
        
        recordingState = 'playing';
        const audio = new Audio(recordedAudioURL);
        
        endInstruction.textContent = 'Playing...';
        endInstruction.style.color = '#666';
        
        const _playBtn = document.getElementById('play-btn');
        if (_playBtn) { _playBtn.classList.remove('pulse'); }
        document.getElementById('play-btn').disabled = true;
        document.getElementById('retry-btn').disabled = true;
        
        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) nextBtn.disabled = true;
        
        const arrowIndicator = document.getElementById(`arrow-indicator-${trial.cue_highlight_index}`);
        if (arrowIndicator) {
          arrowIndicator.classList.add('visible');
        }
        
        audio.onended = () => {
          recordingState = 'recorded';
          hasHeard = true;
          endInstruction.textContent = APPROVE_PROMPT;
          endInstruction.style.color = '#000';
          document.getElementById('play-btn').disabled = false;
          document.getElementById('retry-btn').disabled = false;
          const nextBtn2 = document.getElementById('next-btn');
          if (nextBtn2) nextBtn2.disabled = false;
        };
        
        audio.play();
      };
      
      const retryRecording = () => {
        if (currentPerformance) {
          performances.push(currentPerformance);
          currentPerformance = null;
        }
        
        if (recordedAudioURL) {
          URL.revokeObjectURL(recordedAudioURL);
          recordedAudioURL = null;
        }
        
        if (recordingTimeoutId) {
          clearTimeout(recordingTimeoutId);
          recordingTimeoutId = null;
        }
        
        recordingState = 'idle';
        interactions = [];

        instrumentCanvas.classList.remove('disabled');
        endInstruction.textContent = '';
        
        const ctx = instrumentCanvas.getContext('2d');
        ctx.clearRect(0, 0, instrumentCanvas.width, instrumentCanvas.height);
        activeCircles = [];
        
        // Restore sub-instructions so the participant sees the play/record hint again
        const subInstructions = display_element.querySelector('.img-synth-sub-instructions');
        if (subInstructions) {
          subInstructions.style.display = '';
        }

        const arrowIndicator = document.getElementById(`arrow-indicator-${trial.cue_highlight_index}`);
        if (arrowIndicator) {
          arrowIndicator.classList.remove('visible');
        }

        endInstruction.textContent = '';
        endInstruction.style.color = '#666';
        controlsContainer.innerHTML = '<button id="done-btn" disabled>Done</button>';
      };
      
      const nextCue = () => {
        if (currentPerformance) {
          performances.push(currentPerformance);
        }
        
        endTrial();
      };

      // Create HTML structure
      const html = `
        <style>
          .img-synth-container {
            display: flex;
            flex-direction: row;
            gap: 120px;
            align-items: flex-start;
            justify-content: center;
            margin-top: 30px;
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
          .img-synth-cue-section {
            display: flex;
            flex-direction: row;
            gap: 10px;
            align-items: flex-start;
          }
          .img-synth-single-cue {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .img-synth-cue-canvas {
            cursor: default;
            border: 3px solid #455d7a;
          }
          .img-synth-cue-canvas.dimmed {
            opacity: 0.3;
          }
          .img-synth-cue-canvas.highlighted {
            border: 4px solid red;
          }
          .img-synth-instrument-canvas {
            cursor: pointer;
            background-color: #e3e3e3;
          }
          .img-synth-instrument-canvas.disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .img-synth-canvas-section:has(.img-synth-instrument-canvas.disabled) .img-synth-y-ticks,
          .img-synth-canvas-section:has(.img-synth-instrument-canvas.disabled) .img-synth-x-ticks,
          .img-synth-canvas-section:has(.img-synth-instrument-canvas.disabled) .img-synth-x-axis-label,
          .img-synth-canvas-section:has(.img-synth-instrument-canvas.disabled) .img-synth-y-axis-label {
            opacity: 0.5;
          }
          .img-synth-y-ticks {
            position: absolute;
            left: -25px;
            top: 40px;
            height: ${trial.instrument_canvas_size}px;
            display: flex;
            flex-direction: column-reverse;
            justify-content: space-between;
            color: #f95959;
            font-size: 12px;
            pointer-events: none;
          }
          .img-synth-y-ticks span {
            position: relative;
            padding-right: 15px;
            height: 0;
            line-height: 0;
            transform: translateY(-1px);
          }
          .img-synth-y-ticks span::after {
            content: '';
            position: absolute;
            right: 0;
            top: 50%;
            width: 6px;
            height: 1px;
            background-color: #f95959;
            transform: translateY(-50%);
          }
          .img-synth-x-ticks {
            position: absolute;
            left: 0;
            bottom: -36px;
            width: ${trial.instrument_canvas_size}px;
            display: flex;
            justify-content: space-between;
            color: #f95959;
            font-size: 12px;
            pointer-events: none;
          }
          .img-synth-x-ticks span {
            position: relative;
            padding-top: 5px;
          }
          .img-synth-x-ticks span::before {
            content: '';
            position: absolute;
            left: 50%;
            top: 0;
            width: 1px;
            height: 6px;
            background-color: #f95959;
          }
          .img-synth-x-axis-label,
          .img-synth-y-axis-label {
            position: absolute;
            color: #f95959;
            font-size: 14px;
            pointer-events: none;
          }
          .img-synth-x-axis-label {
            bottom: -45px;
            left: 50%;
            transform: translateX(-50%);
          }
          .img-synth-y-axis-label {
            left: -65px;
            top: 50%;
            transform: translateY(100%) rotate(-90deg);
            white-space: nowrap;
          }
          .img-synth-prompt {
            text-align: center;
          }
          .img-synth-prompt p {
            margin-bottom: 0;
          }
          .img-synth-sub-instructions {
            text-align: center;
            color: #666;
            font-size: 0.9em;
          }
          .img-synth-end-instruction {
            text-align: center;
            margin-top: 20px;
            color: #666;
          }
          .img-synth-controls {
            text-align: center;
            margin-top: 20px;
          }
          .img-synth-controls button {
            font-size: 16px;
            padding: 12px 24px;
            margin: 0 10px;
            cursor: pointer;
            border: 2px solid #455d7a;
            background-color: #455d7a;
            color: white;
            border-radius: 5px;
            transition: all 0.15s ease-in-out;
          }
          .img-synth-controls button:hover:not(:disabled) {
            filter: brightness(0.9);
          }
          .img-synth-controls button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          /* Pulse animation for attention on the play button before first click */
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.03); }
            100% { transform: scale(1); }
          }
          .img-synth-controls button.pulse {
            animation: pulse 1.1s infinite;
          }
          .img-synth-controls button.primary {
            background-color: #f95959;
            border-color: #f95959;
            color: white;
          }
          .img-synth-controls button.primary:hover:not(:disabled) {
            background-color: #d74545;
            border-color: #d74545;
          }
          .img-synth-single-cue {
            position: relative;
          }
          .img-synth-arrow-indicator {
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            display: none;
            flex-direction: column;
            align-items: center;
            pointer-events: none;
            z-index: 10;
            margin-top: 5px;
          }
          .img-synth-arrow-indicator.visible {
            display: flex;
          }
          .img-synth-arrow-label {
            color: red;
            font-weight: bold;
            font-size: 14px;
            margin-top: 5px;
            white-space: nowrap;
          }
          .img-synth-arrow-svg {
            width: 30px;
            height: 40px;
          }
        </style>
        ${trial.prompt ? `<div class="img-synth-prompt">${trial.prompt}</div>` : ''}
        <div class="img-synth-sub-instructions">Click and drag on the instrument to play notes. Press <em>Done</em> when you're finished.</div>
        <div class="img-synth-container">
          <div class="img-synth-canvas-section">
            <h2>CUES</h2>
            <div class="img-synth-cue-section">
              <div class="img-synth-single-cue">
                <canvas class="img-synth-cue-canvas" id="cue-canvas-0" width="${trial.cue_canvas_width / 3}" height="${trial.cue_canvas_height}"></canvas>
                <div class="img-synth-arrow-indicator" id="arrow-indicator-0">
                  <svg class="img-synth-arrow-svg" viewBox="0 0 30 40">
                    <path d="M15 40 L15 5 M15 5 L8 12 M15 5 L22 12" stroke="red" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <div class="img-synth-arrow-label">${MATCHING_PROMPT}</div>
                </div>
              </div>
              <div class="img-synth-single-cue">
                <canvas class="img-synth-cue-canvas" id="cue-canvas-1" width="${trial.cue_canvas_width / 3}" height="${trial.cue_canvas_height}"></canvas>
                <div class="img-synth-arrow-indicator" id="arrow-indicator-1">
                  <svg class="img-synth-arrow-svg" viewBox="0 0 30 40">
                    <path d="M15 40 L15 5 M15 5 L8 12 M15 5 L22 12" stroke="red" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <div class="img-synth-arrow-label">${MATCHING_PROMPT}</div>
                </div>
              </div>
              <div class="img-synth-single-cue">
                <canvas class="img-synth-cue-canvas" id="cue-canvas-2" width="${trial.cue_canvas_width / 3}" height="${trial.cue_canvas_height}"></canvas>
                <div class="img-synth-arrow-indicator" id="arrow-indicator-2">
                  <svg class="img-synth-arrow-svg" viewBox="0 0 30 40">
                    <path d="M15 40 L15 5 M15 5 L8 12 M15 5 L22 12" stroke="red" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <div class="img-synth-arrow-label">${MATCHING_PROMPT}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="img-synth-canvas-section">
            <h2>INSTRUMENT</h2>
            <div class="img-synth-y-axis-label">Quality</div>
            <div class="img-synth-y-ticks">
              <span>0</span>
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
            <canvas class="img-synth-instrument-canvas" width="${trial.instrument_canvas_size}" height="${trial.instrument_canvas_size}"></canvas>
            <div class="img-synth-x-ticks">
              <span>0</span>
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
            <div class="img-synth-x-axis-label">Pitch</div>
          </div>
        </div>
        <div class="img-synth-end-instruction"></div>
        <div class="img-synth-controls" id="controls-container"><button id="done-btn" disabled>Done</button></div>
      `;

      display_element.innerHTML = html;

      // Get canvas elements
      const cueCanvases = [
        display_element.querySelector('#cue-canvas-0'),
        display_element.querySelector('#cue-canvas-1'),
        display_element.querySelector('#cue-canvas-2')
      ];
      const instrumentCanvas = display_element.querySelector('.img-synth-instrument-canvas');
      const controlsContainer = display_element.querySelector('#controls-container');
      const endInstruction = display_element.querySelector('.img-synth-end-instruction');

      // Shape drawing functions
      const drawCircle = (ctx, x, y, radius) => {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
      };

      const drawSquare = (ctx, x, y, size, rotation = 0) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.restore();
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

      const drawShape = (ctx, type, x, y, size, rotation = 0) => {
        switch(type) {
          case 'circle':
            drawCircle(ctx, x, y, size / 2);
            break;
          case 'square':
            drawSquare(ctx, x, y, size, rotation);
            break;
          case 'star':
            drawStar(ctx, x, y, size / 2);
            break;
        }
      };

      const drawTilePattern = (ctx, canvasWidth, canvasHeight, tilePattern) => {
        const gridSize = TEXTURE_GRID_SIZE;
        const spacing = TEXTURE_SPACING;
        const { pattern, shapes } = tilePattern;
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
            
            if (pattern === 'uniform') {
              shapeType = shapes[0];
            } else if (pattern === 'alternating') {
              const index = row % shapes.length;
              shapeType = shapes[index];
            } else if (pattern === 'random') {
              const seed = row * gridSize + col;
              const index = seed % shapes.length;
              shapeType = shapes[index];
            } else {
              const index = (row * gridSize + col) % shapes.length;
              shapeType = shapes[index];
            }
            
            // Determine color for tiles: tilePattern.color overrides default
            const tileColor = tilePattern.color ? tilePattern.color : SHAPE_COLOR;
            ctx.fillStyle = tileColor;
            ctx.strokeStyle = tileColor;
            drawShape(ctx, shapeType, x, y, shapeSize);
          }
        }
      };

      const drawSingleCue = (canvas, cue) => {
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
            const size = shapeSpec.size ? shapeSpec.size : SHAPE_SIZE;
            const rotation = shapeSpec.rotation ? shapeSpec.rotation : 0;
            
            if (shapeSpec.color) {
              ctx.fillStyle = shapeSpec.color;
              ctx.strokeStyle = shapeSpec.color;
            } else {
              ctx.fillStyle = SHAPE_COLOR;
              ctx.strokeStyle = SHAPE_COLOR;
            }
            
            drawShape(ctx, shapeSpec.type, centerX, centerY, size, rotation);
          });
        }
      };

      const drawCueSuite = (canvases, suite, highlightIndex = 0) => {
        suite.forEach((cue, index) => {
          if (canvases[index]) {
            drawSingleCue(canvases[index], cue);
            
            if (index === highlightIndex) {
              canvases[index].classList.add('highlighted');
              canvases[index].classList.remove('dimmed');
            } else {
              canvases[index].classList.remove('highlighted');
              canvases[index].classList.add('dimmed');
            }
          }
        });
      };

      const playNote = (frequency = 440, filterCutoff = 1000) => {
        initAudio();
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        
        const filter = audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterCutoff, audioContext.currentTime);
        filter.Q.setValueAtTime(1, audioContext.currentTime);
        
        const masterGain = audioContext.createGain();
        masterGain.gain.setValueAtTime(0.3, audioContext.currentTime);
        masterGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + NOTE_LENGTH);
        
        oscillator.connect(filter);
        filter.connect(masterGain);
        masterGain.connect(audioContext.destination);
        
        // Also connect to recording destination
        if (recordingState === 'recording' && audioDestination) {
          masterGain.connect(audioDestination);
        }
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + NOTE_LENGTH);
      };

      const startLegatoSynth = (frequency, filterCutoff) => {
        if (legatoState.active) return;
        initAudio();
        legatoState.active = true;
        
        legatoState.oscillator = audioContext.createOscillator();
        legatoState.oscillator.type = 'sawtooth';
        legatoState.oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        
        legatoState.filter = audioContext.createBiquadFilter();
        legatoState.filter.type = 'lowpass';
        legatoState.filter.frequency.setValueAtTime(filterCutoff, audioContext.currentTime);
        legatoState.filter.Q.setValueAtTime(1, audioContext.currentTime);
        
        legatoState.masterGain = audioContext.createGain();
        legatoState.masterGain.gain.setValueAtTime(0.3, audioContext.currentTime);
        
        legatoState.oscillator.connect(legatoState.filter);
        legatoState.filter.connect(legatoState.masterGain);
        legatoState.masterGain.connect(audioContext.destination);
        
        // Also connect to recording destination
        if (recordingState === 'recording' && audioDestination) {
          legatoState.masterGain.connect(audioDestination);
        }
        
        legatoState.oscillator.start();
        
        legatoState.currentFrequency = frequency;
        legatoState.currentFilterCutoff = filterCutoff;
      };

      const updateLegatoSynth = (frequency, filterCutoff) => {
        if (!legatoState.active) return;
        const now = audioContext.currentTime;
        const glideTime = 0.05;
        legatoState.oscillator.frequency.linearRampToValueAtTime(frequency, now + glideTime);
        legatoState.filter.frequency.linearRampToValueAtTime(filterCutoff, now + glideTime);
        legatoState.currentFrequency = frequency;
        legatoState.currentFilterCutoff = filterCutoff;
      };

      const stopLegatoSynth = () => {
        if (!legatoState.active) return;
        
        try {
          if (legatoState.oscillator) {
            try { legatoState.oscillator.stop(); } catch (e) {}
            try { legatoState.oscillator.disconnect(); } catch (e) {}
            legatoState.oscillator = null;
          }
          if (legatoState.filter) {
            try { legatoState.filter.disconnect(); } catch (e) {}
            legatoState.filter = null;
          }
          if (legatoState.masterGain) {
            try { legatoState.masterGain.disconnect(); } catch (e) {}
            legatoState.masterGain = null;
          }
        } catch (err) {
          console.warn('Error stopping legato synth:', err);
        }

        legatoState.active = false;
      };

      class Circle {
        constructor(x, y, isLegato = false) {
          this.x = x;
          this.y = y;
          this.opacity = 1;
          this.active = true;
          this.isLegato = isLegato;
          this.radius = CIRCLE_SIZE_START;
        }

        update() {
          if (this.isLegato) return;
          const assumed_fps = 40;
          const totalExpandPixels = CIRCLE_SIZE_END - CIRCLE_SIZE_START;
          const expandStep = (totalExpandPixels / (NOTE_LENGTH * assumed_fps));
          this.radius += expandStep;
          const fadeStep = (1 / (NOTE_LENGTH * assumed_fps));
          this.opacity -= fadeStep;
          if (this.opacity <= 0) {
            this.active = false;
          }
        }

        draw(ctx) {
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 0, 0, ${this.opacity})`;
          ctx.fill();
        }
      }

      const animateCircles = () => {
        const ctx = instrumentCanvas.getContext('2d');
        ctx.clearRect(0, 0, instrumentCanvas.width, instrumentCanvas.height);
        
        if (legatoCircle) {
          legatoCircle.draw(ctx);
        }
        
        for (let i = activeCircles.length - 1; i >= 0; i--) {
          const circle = activeCircles[i];
          circle.update();
          if (circle.active) {
            circle.draw(ctx);
          } else {
            activeCircles.splice(i, 1);
          }
        }
        
        if (activeCircles.length > 0 || legatoCircle) {
          requestAnimationFrame(animateCircles);
        }
      };

      const addCircle = (x, y) => {
        const circle = new Circle(x, y);
        activeCircles.push(circle);
        if (activeCircles.length === 1) {
          requestAnimationFrame(animateCircles);
        }
      };

      const calculateAudioParams = (x, y) => {
        const normalizedX = x / instrumentCanvas.width;
        const logFrequency = MIN_FREQ * Math.pow(2, Math.log2(MAX_FREQ/MIN_FREQ) * normalizedX);
        
        // Quantize to A major scale
        // A major scale intervals in semitones from A: 0, 2, 4, 5, 7, 9, 11, 12
        const aMajorIntervals = [0, 2, 4, 5, 7, 9, 11];
        
        // Convert frequency to semitones above A (110 Hz)
        const semitonesFromA = 12 * Math.log2(logFrequency / MIN_FREQ);
        
        // Find which octave we're in
        const octave = Math.floor(semitonesFromA / 12);
        const semitoneInOctave = semitonesFromA % 12;
        
        // Find the closest note in the A major scale
        let closestInterval = aMajorIntervals[0];
        let minDistance = Math.abs(semitoneInOctave - closestInterval);
        
        for (let interval of aMajorIntervals) {
          const distance = Math.abs(semitoneInOctave - interval);
          if (distance < minDistance) {
            minDistance = distance;
            closestInterval = interval;
          }
        }
        
        // Calculate the quantized frequency
        const quantizedSemitones = octave * 12 + closestInterval;
        const quantizedFrequency = MIN_FREQ * Math.pow(2, quantizedSemitones / 12);
        
        const normalizedY = 1 - y / instrumentCanvas.height;
        const logFilterCutoff = MIN_FILTER_FREQ * Math.pow(MAX_FILTER_FREQ/MIN_FILTER_FREQ, normalizedY);
        return { frequency: quantizedFrequency, filterCutoff: logFilterCutoff };
      };

      const handleMouseDown = (event) => {
        if (recordingState !== 'idle' && recordingState !== 'recording') return;
        
        const rect = instrumentCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (recordingState === 'idle') {
          startRecording();
        }
        
        isMouseDown = true;
        const timestamp = performance.now() - performanceStartTime;
        interactions.push({ x, y, t: timestamp });
        
        const { frequency, filterCutoff } = calculateAudioParams(x, y);
        
        if (trial.synth_type === 'legato') {
          legatoCircle = new Circle(x, y, true);
          if (activeCircles.length === 0) {
            requestAnimationFrame(animateCircles);
          }
          startLegatoSynth(frequency, filterCutoff);
        } else {
          addCircle(x, y);
          playNote(frequency, filterCutoff);
        }
      };

      const handleMouseMove = (event) => {
        if (!isMouseDown || recordingState !== 'recording') return;
        
        const rect = instrumentCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const timestamp = performance.now() - performanceStartTime;
        interactions.push({ x, y, t: timestamp });
        
        if (trial.synth_type === 'legato') {
          const { frequency, filterCutoff } = calculateAudioParams(x, y);
          updateLegatoSynth(frequency, filterCutoff);
          if (legatoCircle) {
            legatoCircle.x = x;
            legatoCircle.y = y;
          }
        }
      };

      const handleMouseUp = (event) => {
        if (!isMouseDown || recordingState !== 'recording') return;
        
        isMouseDown = false;
        
        if (trial.synth_type === 'legato') {
          legatoCircle = null;
          stopLegatoSynth();
        }
      };

      const handleMouseLeave = (event) => {
        if (trial.synth_type === 'legato' && isMouseDown && recordingState === 'recording') {
          isMouseDown = false;
          legatoCircle = null;
          stopLegatoSynth();
        }
      };

      instrumentCanvas.addEventListener('mousedown', handleMouseDown);
      instrumentCanvas.addEventListener('mousemove', handleMouseMove);
      instrumentCanvas.addEventListener('mouseup', handleMouseUp);
      instrumentCanvas.addEventListener('mouseleave', handleMouseLeave);

      const loadCue = async () => {
        try {
          const response = await fetch(trial.stimulus_json);
          const suiteDescriptors = await response.json();
          
          if (trial.stimulus_index < 0 || trial.stimulus_index >= suiteDescriptors.length) {
            console.error(`Stimulus index ${trial.stimulus_index} is out of bounds.`);
            return;
          }
          
          const suiteDescriptor = suiteDescriptors[trial.stimulus_index];
          const suite = [];

          const resolveTilePatternValue = (val, cueIndex) => {
            if (val == null) return null;
            if (typeof val === 'string') {
              if (SHAPE_MAP[val]) return SHAPE_MAP[val];
              if (COLOR_MAP[val]) return COLOR_MAP[val];
              if (POSITION_MAP[val] !== undefined) return POSITION_MAP[val];
              return val;
            }
            return val;
          };

          for (let cueIndex = 0; cueIndex < 3; cueIndex++) {
            const shapesEntry = {
              type: resolveDescriptor(suiteDescriptor.shape, SHAPE_MAP, cueIndex),
              x: resolveDescriptor(suiteDescriptor.x, POSITION_MAP, cueIndex),
              y: resolveDescriptor(suiteDescriptor.y, POSITION_MAP, cueIndex),
              color: resolveDescriptor(suiteDescriptor.color, COLOR_MAP, cueIndex)
            };

            const cue = {
              id: `${suiteDescriptor.suite_id}_cue${cueIndex}`,
              shapes: [ shapesEntry ]
            };

            // If there's a tilePattern descriptor on the suite, resolve it per-cue as well
            if (suiteDescriptor.tilePattern) {
              const tp = suiteDescriptor.tilePattern;
              const resolvedTP = {};
              if (tp.type) {
                resolvedTP.type = resolveTilePatternValue(tp.type, cueIndex);
              }
              if (tp.types) {
                resolvedTP.types = tp.types.map(t => resolveTilePatternValue(t, cueIndex));
              }
              if (tp.pattern) {
                resolvedTP.pattern = tp.pattern;
              }
              if (tp.color) {
                // color could be descriptor; resolve using COLOR_MAP
                resolvedTP.color = resolveTilePatternValue(tp.color, cueIndex);
              }
              cue.tilePattern = resolvedTP;
            }

            suite.push(cue);
          }
          
          if (trial.cue_highlight_index < 0 || trial.cue_highlight_index >= suite.length) {
            console.warn(`Highlight index ${trial.cue_highlight_index} is out of bounds for suite of length ${suite.length}. Using 0.`);
          }
          
          drawCueSuite(cueCanvases, suite, trial.cue_highlight_index);
          
          resolvedCues = suite.map((cue) => {
            const shapeSpec = (cue.shapes && cue.shapes[0]) ? cue.shapes[0] : null;
            return {
              id: cue.id,
              shape: shapeSpec ? shapeSpec.type : null,
              x: shapeSpec ? shapeSpec.x : null,
              y: shapeSpec ? shapeSpec.y : null,
              color: shapeSpec ? shapeSpec.color : null,
              tilePattern: cue.tilePattern ? cue.tilePattern : null
            };
          });
        } catch (error) {
          console.error('Error loading cue:', error);
        }
      };

      const endTrial = () => {
        if (trial.synth_type === 'legato' && legatoState.active) {
          stopLegatoSynth();
        }
        
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        
        if (recordedAudioURL) {
          URL.revokeObjectURL(recordedAudioURL);
        }

        instrumentCanvas.removeEventListener('mousedown', handleMouseDown);
        instrumentCanvas.removeEventListener('mousemove', handleMouseMove);
        instrumentCanvas.removeEventListener('mouseup', handleMouseUp);
        instrumentCanvas.removeEventListener('mouseleave', handleMouseLeave);

        const trial_data = {
          performances: performances,
          stimulus_json: trial.stimulus_json,
          stimulus_index: trial.stimulus_index,
          cue_highlight_index: trial.cue_highlight_index,
          synth_type: trial.synth_type,
          rt: performance.now() - startTime,
          cues: resolvedCues,
        };

        display_element.innerHTML = '';
        this.jsPsych.finishTrial(trial_data);
      };

      loadCue();
    }
  }
  
  ImgSynthResponsePlugin.info = info;

  return ImgSynthResponsePlugin;
})(jsPsychModule);
