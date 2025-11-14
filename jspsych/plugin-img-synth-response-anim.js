var jsPsychImgSynthResponseAnim = (function (jspsych) {
  "use strict";

  const info = {
    name: "img-synth-response-anim",
    version: "1.0.0",
    parameters: {
      /** Path to JSON file containing animation stimuli */
      stimulus_json: {
        type: jspsych.ParameterType.STRING,
        default: null,
      },
      /** Index of the stimulus in the JSON array */
      stimulus_index: {
        type: jspsych.ParameterType.INT,
        default: 0,
      },
      /** Type of synthesizer mode: 'discrete' or 'legato' */
      synth_type: {
        type: jspsych.ParameterType.STRING,
        default: 'legato',
      },
      /** Width and height of the animation canvas */
      animation_canvas_size: {
        type: jspsych.ParameterType.INT,
        default: 400,
      },
      /** Width and height of the instrument canvas */
      instrument_canvas_size: {
        type: jspsych.ParameterType.INT,
        default: 400,
      },
      /** Duration of the animation in milliseconds */
      animation_duration: {
        type: jspsych.ParameterType.INT,
        default: 3000,
      },
      /** Duration of the countdown in milliseconds */
      countdown_duration: {
        type: jspsych.ParameterType.INT,
        default: 3000,
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
      /** If true, only show the instrument without animation (free play mode) */
      instrument_only: {
        type: jspsych.ParameterType.BOOL,
        default: false,
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
      /** The synth type used */
      synth_type: {
        type: jspsych.ParameterType.STRING,
      },
      /** Response time (trial duration) */
      rt: {
        type: jspsych.ParameterType.INT,
      },
      /** The animation stimulus data */
      animation_data: {
        type: jspsych.ParameterType.COMPLEX,
      },
    },
  };

  /**
   * **img-synth-response-anim**
   *
   * Display an animated visual cue and allow the participant to respond by interacting with a 2D synthesizer canvas
   * in real-time while the animation plays (like film scoring).
   *
   * @author Matthew Caren
   */
  class ImgSynthResponseAnimPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial) {
      // Constants
      const ANIMATION_DURATION = trial.animation_duration;
      const COUNTDOWN_DURATION = trial.countdown_duration;
      const NOTE_LENGTH = 1.5;
      const MIN_FREQ = 110;
      const MAX_FREQ = 440;
      const MIN_FILTER_FREQ = 50;
      const MAX_FILTER_FREQ = 10000;
      const CIRCLE_SIZE_START = 12;
      const CIRCLE_SIZE_END = 20;
      
      // Amoeba shape constants
      const AMOEBA_BASE_RADIUS = 80;
      const SPIKE_FREQUENCY = 8;        // Number of spikes around the shape (kiki)
      const SPIKE_MAX_AMPLITUDE = 0.7;  // Maximum spike height as fraction of base radius
      const BUMP_FREQUENCY = 10;        // Frequency of irregular bumps (bouba)
      const BUMP_MAX_AMPLITUDE = 0.2;   // Maximum bump displacement as fraction of base radius

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
      let recordingState = 'preview'; // 'preview', 'waiting', 'recording', 'recorded', 'playing'
      let performanceStartTime = null;
      let animationData = null;
      let isFirstInteraction = true;
      
      // Animation state
      let animationFrame = null;
      let animationStartTime = null;
      let isAnimating = false;

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

      // Interpolate between two values
      const lerp = (start, end, t) => {
        return start + (end - start) * t;
      };

      // Parse color string to RGB
      const parseColor = (colorStr) => {
        const colors = {
          'red': [255, 0, 0],
          'green': [0, 255, 0],
          'blue': [0, 0, 255],
          'yellow': [255, 255, 0],
          'purple': [128, 0, 128],
          'orange': [255, 165, 0],
          'cyan': [0, 255, 255],
          'magenta': [255, 0, 255]
        };
        return colors[colorStr.toLowerCase()] || [128, 128, 128];
      };

      // Interpolate colors
      const lerpColor = (color1, color2, t) => {
        const rgb1 = parseColor(color1);
        const rgb2 = parseColor(color2);
        const r = Math.round(lerp(rgb1[0], rgb2[0], t));
        const g = Math.round(lerp(rgb1[1], rgb2[1], t));
        const b = Math.round(lerp(rgb1[2], rgb2[2], t));
        return `rgb(${r}, ${g}, ${b})`;
      };

      // Draw amoeba shape
      const drawAmoeba = (ctx, centerX, centerY, params) => {
        const { color, scale_x, scale_y, spikiness, irregularity } = params;
        const baseRadius = AMOEBA_BASE_RADIUS;
        const numPoints = 128;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(scale_x, scale_y);
        
        ctx.beginPath();
        
        for (let i = 0; i <= numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          
          // Base radius with some variation
          let radius = baseRadius;
          
          // Add spikiness (sharp points)
          if (spikiness > 0) {
            const spikeAmount = spikiness * baseRadius * SPIKE_MAX_AMPLITUDE;
            const spike1 = Math.pow(Math.abs(Math.sin(angle * SPIKE_FREQUENCY)), 5);
            const spike2 = Math.pow(Math.abs(Math.sin(angle * SPIKE_FREQUENCY * 0.6 + 1)), 5) * 0.5;
            const spike3 = Math.pow(Math.abs(Math.sin(angle * SPIKE_FREQUENCY * 1.3 + 1.1)), 5) * 0.3;
            radius += (spike1+spike2+spike3) * spikeAmount - spikeAmount/2;
          }
          
          // Add irregularity (random round displacement)
          if (irregularity > 0) {
            const noiseAmount = irregularity * baseRadius * BUMP_MAX_AMPLITUDE;
            // Use smooth, organic noise by combining multiple frequencies
            const noise1 = Math.sin(angle * BUMP_FREQUENCY * 0.3);
            const noise2 = Math.sin(angle * BUMP_FREQUENCY * 0.7 + 1.2) * 0.6;
            const noise3 = Math.sin(angle * BUMP_FREQUENCY * 1.3 + 2.4) * 0.2;
            const noise = noise1 + noise2 + noise3;
            radius += noise * noiseAmount;
          }
          
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
      };

      // Get interpolated animation parameters at time t (0 to 1)
      const getAnimationParams = (t) => {
        if (!animationData) return null;
        
        const start = animationData.start;
        const end = animationData.end;
        
        return {
          color: lerpColor(start.color, end.color, t),
          scale_x: lerp(start.scale_x, end.scale_x, t),
          scale_y: lerp(start.scale_y, end.scale_y, t),
          spikiness: lerp(start.spikiness, end.spikiness, t),
          irregularity: lerp(start.irregularity, end.irregularity, t)
        };
      };

      // Render animation frame
      const renderAnimationFrame = (progress) => {
        const canvas = display_element.querySelector('.img-synth-animation-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw amoeba
        const params = getAnimationParams(progress);
        if (params) {
          drawAmoeba(ctx, centerX, centerY, params);
        }
      };

      // Play animation
      const playAnimation = (loop = false) => {
        if (isAnimating && !loop) return;
        
        isAnimating = true;
        animationStartTime = performance.now();
        
        const animate = () => {
          const elapsed = performance.now() - animationStartTime;
          const progress = Math.min(elapsed / ANIMATION_DURATION, 1.0);
          
          renderAnimationFrame(progress);
          
          if (progress < 1.0) {
            animationFrame = requestAnimationFrame(animate);
          } else {
            isAnimating = false;
            if (loop) {
              // If looping (preview mode), restart
              setTimeout(() => {
                if (recordingState === 'preview') {
                  playAnimation(true);
                }
              }, 500); // Short pause between loops
            } else if (recordingState === 'recording') {
              // Animation finished during recording, stop recording
              stopRecording();
            }
          }
        };
        
        animate();
      };

      // Stop animation
      const stopAnimation = () => {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
        isAnimating = false;
      };

      // Enter waiting state
      const enterWaitingState = () => {
        recordingState = 'waiting';
        stopAnimation();
        isFirstInteraction = true;
        
        const waitingOverlay = display_element.querySelector('.img-synth-waiting-overlay');
        const controlsContainer = display_element.querySelector('#controls-container');
        
        waitingOverlay.style.display = 'flex';
        controlsContainer.innerHTML = '';
        
        const instrumentCanvas = display_element.querySelector('.img-synth-instrument-canvas');
        instrumentCanvas.classList.remove('disabled');
        
        // Render first frame of animation in greyed-out state
        renderAnimationFrame(0);
      };

      // Start recording
      const startRecording = () => {
        if (recordingState === 'recording') return;
        
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
        recordingState = 'recording';
        
        // Hide waiting overlay
        const waitingOverlay = display_element.querySelector('.img-synth-waiting-overlay');
        waitingOverlay.style.display = 'none';
        
        const instrumentCanvas = display_element.querySelector('.img-synth-instrument-canvas');
        instrumentCanvas.classList.remove('disabled');
        
        // Start animation
        playAnimation(false);
      };

      // Stop recording
      const stopRecording = () => {
        if (recordingState !== 'recording') return;
        
        if (trial.synth_type === 'legato' && legatoState.active) {
          stopLegatoSynth();
        }
        
        stopAnimation();
        
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        
        currentPerformance = {
          interactions: [...interactions],
          duration: performance.now() - performanceStartTime,
          timestamp: Date.now()
        };
        
        recordingState = 'recorded';
        
        const instrumentCanvas = display_element.querySelector('.img-synth-instrument-canvas');
        instrumentCanvas.classList.add('disabled');
        isMouseDown = false;
        
        const endInstruction = display_element.querySelector('.img-synth-end-instruction');
        const controlsContainer = display_element.querySelector('#controls-container');
        
        endInstruction.textContent = 'Listen to your sound!';
        endInstruction.style.color = '#000';
        controlsContainer.innerHTML = `
          <button id="play-btn" class="pulse">Play</button>
          <button id="retry-btn">Retry</button>
          <button id="next-btn" class="primary" disabled>Next</button>
        `;
        
        document.getElementById('play-btn').addEventListener('click', playRecording);
        document.getElementById('retry-btn').addEventListener('click', retryRecording);
        document.getElementById('next-btn').addEventListener('click', nextTrial);
      };

      // Play recording with animation
      const playRecording = () => {
        if (!recordedAudioURL || recordingState === 'playing') return;
        
        recordingState = 'playing';
        const audio = new Audio(recordedAudioURL);
        
        const endInstruction = display_element.querySelector('.img-synth-end-instruction');
        const playBtn = document.getElementById('play-btn');
        const retryBtn = document.getElementById('retry-btn');
        const nextBtn = document.getElementById('next-btn');
        
        endInstruction.textContent = 'Playing...';
        endInstruction.style.color = '#666';
        
        if (playBtn) {
          playBtn.disabled = true;
          playBtn.classList.remove('pulse');
        }
        if (retryBtn) retryBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        
        // Start animation synchronized with audio
        playAnimation(false);
        
        audio.onended = () => {
          recordingState = 'recorded';
          endInstruction.textContent = 'Are you satisfied with your performance?';
          endInstruction.style.color = '#000';
          
          if (playBtn) playBtn.disabled = false;
          if (retryBtn) retryBtn.disabled = false;
          if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.classList.add('pulse');
          }
        };
        
        audio.play();
      };

      // Retry recording
      const retryRecording = () => {
        if (currentPerformance) {
          performances.push(currentPerformance);
          currentPerformance = null;
        }
        
        if (recordedAudioURL) {
          URL.revokeObjectURL(recordedAudioURL);
          recordedAudioURL = null;
        }
        
        recordingState = 'preview';
        interactions = [];
        
        const instrumentCanvas = display_element.querySelector('.img-synth-instrument-canvas');
        instrumentCanvas.classList.add('disabled');
        
        const ctx = instrumentCanvas.getContext('2d');
        ctx.clearRect(0, 0, instrumentCanvas.width, instrumentCanvas.height);
        activeCircles = [];
        
        const endInstruction = display_element.querySelector('.img-synth-end-instruction');
        const controlsContainer = display_element.querySelector('#controls-container');
        
        endInstruction.textContent = '';
        controlsContainer.innerHTML = `
          <button id="ready-btn" class="primary">I'm Ready</button>
        `;
        
        document.getElementById('ready-btn').addEventListener('click', enterWaitingState);
        
        // Restart preview loop
        playAnimation(true);
      };

      // Next trial
      const nextTrial = () => {
        if (currentPerformance) {
          performances.push(currentPerformance);
        }
        endTrial();
      };

      // Create HTML structure
      const containerClass = trial.instrument_only ? 'img-synth-container-single' : 'img-synth-container';
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
          .img-synth-container-single {
            display: flex;
            flex-direction: row;
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
          .img-synth-animation-canvas {
            cursor: default;
            border: 3px solid #455d7a;
            background-color: #f5f5f5;
            position: relative;
          }
          .img-synth-waiting-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(128, 128, 128, 0.7);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 100;
          }
          .img-synth-waiting-text {
            font-size: 18px;
            font-weight: normal;
            color: white;
            text-align: center;
            background-color: rgba(0, 0, 0, 0.6);
            padding: 20px 30px;
            border-radius: 8px;
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
            margin-top: 2px;
            margin-bottom: 0;
          }
          .img-synth-sub-instructions {
            text-align: center;
            color: #666;
            font-size: 0.9em;
            margin-top: 10px;
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
        </style>
        ${trial.prompt ? `<div class="img-synth-prompt">${trial.prompt}</div>` : ''}
        ${trial.instrument_only ? '<div class="img-synth-sub-instructions">Moving your mouse vertically changes the type of sound. Moving horizontally changes the pitch.</div>' : '<div class="img-synth-sub-instructions">Watch the animation as many times as you need. When you\'re ready, click I\'m Ready below to begin.</div>'}
        <div class="${containerClass}">
          ${trial.instrument_only ? '' : `
          <div class="img-synth-canvas-section">
            <h2>ANIMATION</h2>
            <div style="position: relative;">
              <canvas class="img-synth-animation-canvas" width="${trial.animation_canvas_size}" height="${trial.animation_canvas_size}"></canvas>
              <div class="img-synth-waiting-overlay">
                <div class="img-synth-waiting-text">Click the instrument to start recording</div>
              </div>
            </div>
          </div>
          `}
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
            <canvas class="img-synth-instrument-canvas disabled" width="${trial.instrument_canvas_size}" height="${trial.instrument_canvas_size}"></canvas>
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
        <div class="img-synth-controls" id="controls-container">
          ${trial.instrument_only ? '<button id="finish-btn" class="primary">I\'ve got it!</button>' : '<button id="ready-btn" class="primary">I\'m Ready</button>'}
        </div>
      `;

      display_element.innerHTML = html;

      // Get canvas elements
      const instrumentCanvas = display_element.querySelector('.img-synth-instrument-canvas');
      
      // Audio synthesis functions (from original plugin)
      const playNote = (frequency = 440, filterCutoff = 1000) => {
        initAudio();
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterCutoff, audioContext.currentTime);
        filter.Q.setValueAtTime(1, audioContext.currentTime);
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);
        gainNode.connect(audioDestination);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + NOTE_LENGTH);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + NOTE_LENGTH);
      };

      const startLegatoSynth = (frequency, filterCutoff) => {
        initAudio();
        
        if (legatoState.active) {
          updateLegatoSynth(frequency, filterCutoff);
          return;
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterCutoff, audioContext.currentTime);
        filter.Q.setValueAtTime(1, audioContext.currentTime);
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);
        gainNode.connect(audioDestination);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        
        oscillator.start();
        
        legatoState = {
          active: true,
          oscillator: oscillator,
          filter: filter,
          masterGain: gainNode,
          currentFrequency: frequency,
          currentFilterCutoff: filterCutoff
        };
      };

      const updateLegatoSynth = (frequency, filterCutoff) => {
        if (!legatoState.active) return;
        
        legatoState.oscillator.frequency.linearRampToValueAtTime(
          frequency,
          audioContext.currentTime + 0.05
        );
        legatoState.filter.frequency.linearRampToValueAtTime(
          filterCutoff,
          audioContext.currentTime + 0.05
        );
        
        legatoState.currentFrequency = frequency;
        legatoState.currentFilterCutoff = filterCutoff;
      };

      const stopLegatoSynth = () => {
        if (!legatoState.active) return;
        
        const now = audioContext.currentTime;
        legatoState.masterGain.gain.setValueAtTime(legatoState.masterGain.gain.value, now);
        legatoState.masterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        setTimeout(() => {
          if (legatoState.oscillator) {
            try {
              legatoState.oscillator.stop();
            } catch (e) {
              // Ignore if already stopped
            }
          }
          legatoState = {
            active: false,
            oscillator: null,
            filter: null,
            masterGain: null,
            currentFrequency: 440,
            currentFilterCutoff: 1000
          };
        }, 150);
      };

      // Circle animation for visual feedback
      class Circle {
        constructor(x, y) {
          this.x = x;
          this.y = y;
          this.size = CIRCLE_SIZE_START;
          this.maxSize = CIRCLE_SIZE_END;
          this.alpha = 1;
          this.growthRate = (this.maxSize - this.size) / 30;
          this.fadeRate = 1 / 30;
        }

        update() {
          this.size += this.growthRate;
          this.alpha -= this.fadeRate;
          return this.alpha > 0;
        }

        draw(ctx) {
          ctx.save();
          ctx.globalAlpha = this.alpha;
          ctx.strokeStyle = '#f95959';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      const animateCircles = () => {
        const ctx = instrumentCanvas.getContext('2d');
        ctx.clearRect(0, 0, instrumentCanvas.width, instrumentCanvas.height);

        // Only draw circles when instrument is enabled
        if (!instrumentCanvas.classList.contains('disabled')) {
          activeCircles = activeCircles.filter(circle => {
            const isAlive = circle.update();
            if (isAlive) circle.draw(ctx);
            return isAlive;
          });

          if (legatoCircle) {
            legatoCircle.draw(ctx);
          }
        }

        requestAnimationFrame(animateCircles);
      };

      const addCircle = (x, y) => {
        activeCircles.push(new Circle(x, y));
      };

      const calculateAudioParams = (x, y) => {
        const canvasWidth = instrumentCanvas.width;
        const canvasHeight = instrumentCanvas.height;

        const normalizedX = x / canvasWidth;
        const normalizedY = 1 - (y / canvasHeight);

        const frequency = MIN_FREQ + normalizedX * (MAX_FREQ - MIN_FREQ);
        const filterCutoff = MIN_FILTER_FREQ + normalizedY * (MAX_FILTER_FREQ - MIN_FILTER_FREQ);

        return { frequency, filterCutoff };
      };

      // Mouse event handlers
      const handleMouseDown = (event) => {
        // Start recording on first interaction if in waiting state
        if (recordingState === 'waiting' && isFirstInteraction) {
          isFirstInteraction = false;
          startRecording();
        }
        
        if (recordingState !== 'recording') return;
        if (instrumentCanvas.classList.contains('disabled')) return;

        isMouseDown = true;
        const rect = instrumentCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const { frequency, filterCutoff } = calculateAudioParams(x, y);

        if (trial.synth_type === 'discrete') {
          playNote(frequency, filterCutoff);
          addCircle(x, y);
        } else if (trial.synth_type === 'legato') {
          startLegatoSynth(frequency, filterCutoff);
          legatoCircle = new Circle(x, y);
        }

        interactions.push({
          type: 'mousedown',
          x: x,
          y: y,
          frequency: frequency,
          filterCutoff: filterCutoff,
          timestamp: performance.now() - performanceStartTime
        });
      };

      const handleMouseMove = (event) => {
        if (!isMouseDown || recordingState !== 'recording') return;
        if (instrumentCanvas.classList.contains('disabled')) return;

        const rect = instrumentCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const { frequency, filterCutoff } = calculateAudioParams(x, y);

        if (trial.synth_type === 'legato') {
          updateLegatoSynth(frequency, filterCutoff);
          legatoCircle = new Circle(x, y);
        }

        interactions.push({
          type: 'mousemove',
          x: x,
          y: y,
          frequency: frequency,
          filterCutoff: filterCutoff,
          timestamp: performance.now() - performanceStartTime
        });
      };

      const handleMouseUp = (event) => {
        if (!isMouseDown || recordingState !== 'recording') return;

        isMouseDown = false;

        if (trial.synth_type === 'legato') {
          stopLegatoSynth();
          legatoCircle = null;
        }

        interactions.push({
          type: 'mouseup',
          timestamp: performance.now() - performanceStartTime
        });
      };

      const handleMouseLeave = (event) => {
        if (isMouseDown && trial.synth_type === 'legato' && recordingState === 'recording') {
          stopLegatoSynth();
          legatoCircle = null;
          isMouseDown = false;
        }
      };

      instrumentCanvas.addEventListener('mousedown', handleMouseDown);
      instrumentCanvas.addEventListener('mousemove', handleMouseMove);
      instrumentCanvas.addEventListener('mouseup', handleMouseUp);
      instrumentCanvas.addEventListener('mouseleave', handleMouseLeave);

      // Start circle animation loop
      animateCircles();

      // Load animation data
      const loadAnimation = async () => {
        if (trial.instrument_only) {
          // Skip animation loading in instrument-only mode
          return;
        }
        
        try {
          const response = await fetch(trial.stimulus_json);
          const data = await response.json();
          
          if (trial.stimulus_index >= data.length) {
            console.error('Stimulus index out of bounds');
            return;
          }
          
          animationData = data[trial.stimulus_index];
          
          // Start preview animation loop
          playAnimation(true);
          
        } catch (error) {
          console.error('Error loading animation data:', error);
        }
      };

      // End trial
      const endTrial = () => {
        // Clean up
        stopAnimation();
        
        if (audioContext) {
          audioContext.close();
        }
        
        if (recordedAudioURL) {
          URL.revokeObjectURL(recordedAudioURL);
        }

        // Gather trial data
        const trialData = {
          rt: performance.now() - startTime,
          stimulus_json: trial.stimulus_json,
          stimulus_index: trial.stimulus_index,
          synth_type: trial.synth_type,
          animation_data: animationData,
          performances: performances
        };

        this.jsPsych.finishTrial(trialData);
      };

      // Set up initial button
      if (trial.instrument_only) {
        // In instrument-only mode, enable the instrument immediately
        const instrumentCanvas = display_element.querySelector('.img-synth-instrument-canvas');
        instrumentCanvas.classList.remove('disabled');
        recordingState = 'recording';
        performanceStartTime = performance.now();
        initAudio();
        
        // Set up MediaRecorder for instrument-only mode
        audioChunks = [];
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
        
        document.getElementById('finish-btn').addEventListener('click', () => {
          if (trial.synth_type === 'legato' && legatoState.active) {
            stopLegatoSynth();
          }
          
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
          
          currentPerformance = {
            interactions: [...interactions],
            duration: performance.now() - performanceStartTime,
            timestamp: Date.now()
          };
          
          performances.push(currentPerformance);
          endTrial();
        });
      } else {
        document.getElementById('ready-btn').addEventListener('click', enterWaitingState);
      }

      // Load and start
      loadAnimation();
    }
  }
  
  ImgSynthResponseAnimPlugin.info = info;

  return ImgSynthResponseAnimPlugin;
})(jsPsychModule);
