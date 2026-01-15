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
      /** If true, only show the instrument without animation (tutorial mode) */
      tutorial: {
        type: jspsych.ParameterType.BOOL,
        default: false,
      },
      /** Array of arrows to display in tutorial mode. Each arrow is {startX, startY, endX, endY} in 0-1 coordinates */
      tutorial_arrows: {
        type: jspsych.ParameterType.COMPLEX,
        default: [],
      },
      /** Prompt to display after recording is complete */
      post_recording_prompt: {
        type: jspsych.ParameterType.HTML_STRING,
        default: '<p>Listen to your sound!</p>',
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
      /** The audio blob from the final (accepted) performance */
      audio_blob: {
        type: jspsych.ParameterType.COMPLEX,
      },
      /** The audio URL from the final (accepted) performance */
      audio_url: {
        type: jspsych.ParameterType.STRING,
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
      const NOTE_LENGTH = 1.5;
      const MIN_FREQ = 220;
      const MAX_FREQ = 880;
      const VIBRATO_RATE = 5; // Hz
      const MIN_VIBRATO_DEPTH = 0; // semitones
      const MAX_VIBRATO_DEPTH = 1; // semitones
      const LOWPASS_CUTOFF = 1000; // Hz
      const REVERB_TIME = 2; // seconds
      const REVERB_DRY_MIX = 0.8;
      const REVERB_WET_MIX = 0.2;
      const CIRCLE_SIZE_START = 12;
      const CIRCLE_SIZE_END = 20;
      
      // Amoeba shape constants
      const AMOEBA_BASE_RADIUS = 120;
      const BUMP_FREQUENCY = 10;        // Frequency of irregular bumps (bouba)
      const BUMP_MAX_AMPLITUDE = 0.3;   // Maximum bump displacement as fraction of base radius

      // Trial state
      let startTime = performance.now();
      let interactions = [];
      let isMouseDown = false;
      let audioContext = null;
      let reverbNode = null;
      let dryGainNode = null;
      let wetGainNode = null;
      let activeCircles = [];
      let legatoCircle = null;
      let currentMousePos = null; // Track current mouse position for gradient
      let originalPrompt = trial.prompt; // Store original prompt for restoration
      let legatoState = {
        active: false,
        oscillator: null,
        vibratoOscillator: null,
        vibratoGain: null,
        masterGain: null,
        currentFrequency: 440,
        currentVibratoDepth: 0
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
          
          // Create reverb using convolution
          reverbNode = audioContext.createConvolver();
          
          // Generate impulse response for reverb
          const sampleRate = audioContext.sampleRate;
          const length = sampleRate * REVERB_TIME;
          const impulse = audioContext.createBuffer(2, length, sampleRate);
          const impulseL = impulse.getChannelData(0);
          const impulseR = impulse.getChannelData(1);
          
          for (let i = 0; i < length; i++) {
            const decay = Math.exp(-i / (sampleRate * (REVERB_TIME / 4))); // Exponential decay
            impulseL[i] = (Math.random() * 2 - 1) * decay;
            impulseR[i] = (Math.random() * 2 - 1) * decay;
          }
          
          reverbNode.buffer = impulse;
          
          // Create dry/wet mixing
          dryGainNode = audioContext.createGain();
          wetGainNode = audioContext.createGain();
          dryGainNode.gain.value = REVERB_DRY_MIX;
          wetGainNode.gain.value = REVERB_WET_MIX;
          
          // Connect reverb routing
          reverbNode.connect(wetGainNode);
          wetGainNode.connect(audioContext.destination);
          wetGainNode.connect(audioDestination);
          dryGainNode.connect(audioContext.destination);
          dryGainNode.connect(audioDestination);
          
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

      // Generate major-scale note frequencies anchored at MIN_FREQ (cached)
      const getMajorScaleNotes = (() => {
        let cached = null;
        return () => {
          if (cached) return cached;
          const scaleSemitones = [0, 2, 4, 5, 7, 9, 11]; // Major scale intervals
          const notes = [];
          const maxFreq = MAX_FREQ;

          for (let octave = 0; octave < 10; octave++) {
            for (let i = 0; i < scaleSemitones.length; i++) {
              const semis = scaleSemitones[i] + octave * 12;
              const freq = MIN_FREQ * Math.pow(2, semis / 12);
              if (freq <= maxFreq * 1.001) {
                notes.push(freq);
              }
            }
            const nextOctaveFreq = MIN_FREQ * Math.pow(2, (octave + 1));
            if (nextOctaveFreq > maxFreq) break;
          }

          notes.sort((a, b) => a - b);
          cached = notes;
          return cached;
        };
      })();

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
        const { color, aspect_ratio, irregularity } = params;
        const baseRadius = AMOEBA_BASE_RADIUS;
        const numPoints = 128;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(aspect_ratio, 1.0);
        
        ctx.beginPath();
        
        for (let i = 0; i <= numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          let radius = baseRadius;
          
          // Add irregularity (random round displacement)
          if (irregularity > 0) {
            const noiseAmount = irregularity * baseRadius * BUMP_MAX_AMPLITUDE;
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
        
        ctx.restore();
      };

      // Get interpolated animation parameters at time t (0 to 1)
      const getAnimationParams = (t) => {
        if (!animationData) return null;
        
        const start = animationData.start_state;
        const end = animationData.end_state;
        
        return {
          color: lerpColor(start.color, end.color, t),
          aspect_ratio: lerp(start.aspect_ratio, end.aspect_ratio, t),
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
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const params = getAnimationParams(progress);
        if (params) {
          drawAmoeba(ctx, centerX, centerY, params);
        }
        
        // Update progress bar
        const progressBar = display_element.querySelector('#animation-progress-bar');
        if (progressBar) {
          progressBar.style.width = (progress * 100) + '%';
        }
      };

      // Play animation
      const playAnimation = (loop = false) => {
        if (isAnimating && !loop) return;
        
        isAnimating = true;
        animationStartTime = performance.now();
        
        const animate = () => {
          const elapsed = performance.now() - animationStartTime;
          const duration = animationData?.anim_length || ANIMATION_DURATION;
          const progress = Math.min(elapsed / duration, 1.0);
          
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

          if (currentPerformance) {
            currentPerformance.audioBlob = audioBlob;
            currentPerformance.audioURL = recordedAudioURL;

            // // AUDIO STORAGE: convert audio blob to a list of audio samples at 48kHz, 16 bit, and store it as a hex string
            // const reader = new FileReader();
            // reader.onload = async () => {
            //   const arrayBuffer = reader.result;
            //   const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            //   const decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);
              
            //   // Resample to 48kHz if needed and convert to 16-bit PCM
            //   const sampleRate = 48000;
            //   const numChannels = decodedAudio.numberOfChannels;
            //   const length = Math.ceil(decodedAudio.duration * sampleRate);
              
            //   // Use first channel only (mono)
            //   const channelData = decodedAudio.getChannelData(0);
            //   const samples = new Int16Array(length);
              
            //   // Resample and convert to 16-bit
            //   for (let i = 0; i < length; i++) {
            //     const srcIndex = (i / sampleRate) * decodedAudio.sampleRate;
            //     const srcIndexFloor = Math.floor(srcIndex);
            //     const srcIndexCeil = Math.min(srcIndexFloor + 1, channelData.length - 1);
            //     const fraction = srcIndex - srcIndexFloor;
                
            //     // Linear interpolation
            //     const sample = channelData[srcIndexFloor] * (1 - fraction) + channelData[srcIndexCeil] * fraction;
                
            //     // Convert float (-1 to 1) to 16-bit int (-32768 to 32767)
            //     samples[i] = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
            //   }
              
            //   // Convert to hex string
            //   let hexString = '';
            //   for (let i = 0; i < samples.length; i++) {
            //     const byte1 = samples[i] & 0xFF;
            //     const byte2 = (samples[i] >> 8) & 0xFF;
            //     hexString += byte1.toString(16).padStart(2, '0') + byte2.toString(16).padStart(2, '0');
            //   }
              
            //   currentPerformance.audioSamples = hexString;
            //   audioCtx.close();
            // };
            // reader.readAsArrayBuffer(audioBlob);
          }
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
          timestamp: Date.now(),
          audioBlob: null,  // Will be populated by mediaRecorder.onstop
          audioURL: recordedAudioURL,
          audioSamples: null  // Will be populated by mediaRecorder.onstop
        };
        
        recordingState = 'recorded';
        
        const instrumentCanvas = display_element.querySelector('.img-synth-instrument-canvas');
        instrumentCanvas.classList.add('disabled');
        const instrumentSection = instrumentCanvas.closest('.img-synth-canvas-section');
        if (instrumentSection) instrumentSection.classList.add('hidden');
        isMouseDown = false;
        
        const subInstructions = display_element.querySelector('.img-synth-sub-instructions');
        const animationSection = display_element.querySelector('.img-synth-canvas-section');
        const clipLabel = animationSection ? animationSection.querySelector('h2') : null;
        const prompt = display_element.querySelector('.img-synth-prompt');
        const controlsContainer = display_element.querySelector('#controls-container');
        
        // Hide sub-instructions and CLIP label, update prompt
        if (subInstructions) subInstructions.style.display = 'none';
        if (clipLabel) clipLabel.style.display = 'none';
        if (prompt) prompt.innerHTML = trial.post_recording_prompt;
        
        controlsContainer.innerHTML = `
          <button id="play-btn" class="jspsych-btn">Play</button>
          <button id="retry-btn" class="jspsych-btn">Try again</button>
          <button id="next-btn" class="jspsych-btn" disabled>Yes, continue</button>
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
        
        const prompt = display_element.querySelector('.img-synth-prompt');
        const playBtn = document.getElementById('play-btn');
        const retryBtn = document.getElementById('retry-btn');
        const nextBtn = document.getElementById('next-btn');
        
        if (prompt) prompt.innerHTML = '<p><i>playing...</i></p>';
        
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
          if (prompt) prompt.innerHTML = '<p>Are you satisfied with your sound?</p>';
          
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
        const instrumentSection = instrumentCanvas.closest('.img-synth-canvas-section');
        if (instrumentSection) instrumentSection.classList.remove('hidden');
        
        // Show sub-instructions, CLIP label, and restore prompt
        const subInstructions = display_element.querySelector('.img-synth-sub-instructions');
        const animationSection = display_element.querySelector('.img-synth-canvas-section');
        const clipLabel = animationSection ? animationSection.querySelector('h2') : null;
        const prompt = display_element.querySelector('.img-synth-prompt');
        if (subInstructions) subInstructions.style.display = '';
        if (clipLabel) clipLabel.style.display = '';
        if (prompt && originalPrompt) prompt.innerHTML = originalPrompt;
        
        const ctx = instrumentCanvas.getContext('2d');
        ctx.clearRect(0, 0, instrumentCanvas.width, instrumentCanvas.height);
        activeCircles = [];
        currentMousePos = null;
        legatoCircle = null;
        
        const controlsContainer = display_element.querySelector('#controls-container');
        controlsContainer.innerHTML = `
          <button id="ready-btn" class="jspsych-btn">I'm ready!</button>
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
      const containerClass = trial.tutorial ? 'img-synth-container-single' : 'img-synth-container';
      const html = `
        <style>
          .animation-progress-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            height: 2px;
            background-color: black;
            width: 0;
            transition: width 16ms linear;
            z-index: 1000;
          }
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
          .img-synth-canvas-section.hidden {
            display: none;
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
        </style>
        ${trial.prompt ? `<div class="img-synth-prompt">${trial.prompt}</div>` : ''}
        ${trial.tutorial ? '' : '<div class="img-synth-sub-instructions">Watch the clip as many times as you need. When you\'re ready, click I\'m Ready below to begin.</div>'}
        <div class="${containerClass}">
          ${trial.tutorial ? '' : `
          <div class="img-synth-canvas-section">
            <h2>CLIP</h2>
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
            <div class="img-synth-y-axis-label">Vibrato</div>
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
          ${trial.tutorial ? '<button id="finish-btn" class="jspsych-btn" disabled>Next</button>' : '<button id="ready-btn" class="jspsych-btn">I\'m Ready</button>'}
        </div>
        <div class="animation-progress-bar" id="animation-progress-bar"></div>
      `;

      display_element.innerHTML = html;

      // Get canvas elements
      const instrumentCanvas = display_element.querySelector('.img-synth-instrument-canvas');
      
      // Audio synthesis functions (from original plugin)
      const playNote = (frequency = 440, vibratoDepth = 0) => {
        initAudio();
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        
        // Add vibrato if depth > 0
        if (vibratoDepth > 0) {
          const vibratoOscillator = audioContext.createOscillator();
          const vibratoGain = audioContext.createGain();
          
          vibratoOscillator.frequency.setValueAtTime(VIBRATO_RATE, audioContext.currentTime);
          // Convert vibrato depth from semitones to Hz
          const vibratoAmount = frequency * (Math.pow(2, vibratoDepth / 12) - 1);
          vibratoGain.gain.setValueAtTime(vibratoAmount, audioContext.currentTime);
          
          vibratoOscillator.connect(vibratoGain);
          vibratoGain.connect(oscillator.frequency);
          
          vibratoOscillator.start(audioContext.currentTime);
          vibratoOscillator.stop(audioContext.currentTime + NOTE_LENGTH);
        }
        
        oscillator.connect(gainNode);
        gainNode.connect(dryGainNode);
        gainNode.connect(reverbNode);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + NOTE_LENGTH);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + NOTE_LENGTH);
      };

      const startLegatoSynth = (frequency, vibratoDepth) => {
        initAudio();
        
        if (legatoState.active) {
          updateLegatoSynth(frequency, vibratoDepth);
          return;
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        
        // Fixed lowpass filter
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(LOWPASS_CUTOFF, audioContext.currentTime);
        filter.Q.setValueAtTime(1, audioContext.currentTime);
        
        // Create vibrato LFO
        const vibratoOscillator = audioContext.createOscillator();
        const vibratoGain = audioContext.createGain();
        
        vibratoOscillator.frequency.setValueAtTime(VIBRATO_RATE, audioContext.currentTime);
        // Convert vibrato depth from semitones to Hz
        const vibratoAmount = frequency * (Math.pow(2, vibratoDepth / 12) - 1);
        vibratoGain.gain.setValueAtTime(vibratoAmount, audioContext.currentTime);
        
        vibratoOscillator.connect(vibratoGain);
        vibratoGain.connect(oscillator.frequency);
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(dryGainNode);
        gainNode.connect(reverbNode);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        
        oscillator.start();
        vibratoOscillator.start();
        
        legatoState = {
          active: true,
          oscillator: oscillator,
          vibratoOscillator: vibratoOscillator,
          vibratoGain: vibratoGain,
          masterGain: gainNode,
          currentFrequency: frequency,
          currentVibratoDepth: vibratoDepth
        };
      };

      const updateLegatoSynth = (frequency, vibratoDepth) => {
        if (!legatoState.active) return;
        
        // Update base frequency
        legatoState.oscillator.frequency.linearRampToValueAtTime(
          frequency,
          audioContext.currentTime + 0.05
        );
        
        // Update vibrato amount (needs to scale with frequency)
        const vibratoAmount = frequency * (Math.pow(2, vibratoDepth / 12) - 1);
        legatoState.vibratoGain.gain.linearRampToValueAtTime(
          vibratoAmount,
          audioContext.currentTime + 0.05
        );
        
        legatoState.currentFrequency = frequency;
        legatoState.currentVibratoDepth = vibratoDepth;
      };

      const stopLegatoSynth = () => {
        if (!legatoState.active) return;
        
        const now = audioContext.currentTime;
        legatoState.masterGain.gain.setValueAtTime(legatoState.masterGain.gain.value, now);
        legatoState.masterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        // Store references to clean up asynchronously
        const oscillatorToStop = legatoState.oscillator;
        
        // Immediately mark as inactive so new notes can start right away
        legatoState = {
          active: false,
          oscillator: null,
          vibratoOscillator: null,
          vibratoGain: null,
          masterGain: null,
          currentFrequency: 440,
          currentVibratoDepth: 0
        };
        
        // Clean up the oscillator after fade out completes
        setTimeout(() => {
          if (oscillatorToStop) {
            try {
              oscillatorToStop.stop();
            } catch (e) {
              // Ignore if already stopped
            }
          }
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

      // Draw arrow on canvas
      const drawArrow = (ctx, arrow, canvasWidth, canvasHeight) => {
        const startX = arrow.startX * canvasWidth;
        const startY = arrow.startY * canvasHeight;
        const endX = arrow.endX * canvasWidth;
        const endY = arrow.endY * canvasHeight;

        const headLength = 25; // Length of arrow head
        const angle = Math.atan2(endY - startY, endX - startX);

        // Calculate where the line should end
        const lineEndX = endX - headLength * Math.cos(angle) * 0.5;
        const lineEndY = endY - headLength * Math.sin(angle) * 0.5;

        ctx.save();
        ctx.strokeStyle = 'LightSeaGreen';
        ctx.fillStyle = 'LightSeaGreen';
        ctx.lineWidth = 6;

        // Draw arrow line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(lineEndX, lineEndY);
        ctx.stroke();

        // Draw arrow head
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLength * Math.cos(angle - Math.PI / 6),
          endY - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          endX - headLength * Math.cos(angle + Math.PI / 6),
          endY - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      };

      const animateCircles = () => {
        const ctx = instrumentCanvas.getContext('2d');
        ctx.clearRect(0, 0, instrumentCanvas.width, instrumentCanvas.height);

        // Draw highlight for currently playing note region
        const drawNoteHighlight = (ctx) => {
          if (!currentMousePos || instrumentCanvas.classList.contains('disabled')) return;
          
          const notes = getMajorScaleNotes();
          if (!notes || notes.length < 2) return;
          
          const w = instrumentCanvas.width;
          const h = instrumentCanvas.height;
          const x = currentMousePos.x;
          const y = currentMousePos.y;
          
          // Calculate which note region the mouse is in
          const normalizedX = x / w;
          const noteIndex = Math.floor(normalizedX * notes.length);
          const clampedIndex = Math.max(0, Math.min(notes.length - 1, noteIndex));
          
          // Calculate the bounds of the note region
          const regionWidth = w / notes.length;
          const regionX = clampedIndex * regionWidth;
          
          // Create vertical gradient centered at mouse Y position
          const gradient = ctx.createLinearGradient(0, 0, 0, h);
          
          // Calculate normalized Y position (0 to 1)
          const normalizedY = Math.max(0, Math.min(1, y / h));
          
          // Add color stops around the mouse position
          const fadeRange = 0.2; // Range of the gradient fade
          const topFade = Math.max(0, normalizedY - fadeRange);
          const bottomFade = Math.min(1, normalizedY + fadeRange);
          gradient.addColorStop(topFade, 'rgba(255, 69, 0, 0)');
          gradient.addColorStop(normalizedY, 'rgba(255, 69, 0, 0.5)');
          gradient.addColorStop(bottomFade, 'rgba(255, 69, 0, 0)');
          
          // Draw the highlighted region
          ctx.save();
          ctx.fillStyle = gradient;
          ctx.fillRect(regionX, 0, regionWidth, h);
          ctx.restore();
        };

        drawNoteHighlight(ctx);

        // Draw vertical lines at boundaries between scale notes (equal-width regions)
        const drawNoteBoundaries = (ctx) => {
          const notes = getMajorScaleNotes();
          if (!notes || notes.length < 2) return;
          const w = instrumentCanvas.width;
          const h = instrumentCanvas.height;

          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;

          // Draw lines at equal intervals (boundaries between equal-width note regions)
          for (let i = 1; i < notes.length; i++) {
            const x = (i / notes.length) * w;
            // Align to half pixel for crisp 1px lines on some displays
            const xi = Math.round(x) + 0.5;
            ctx.beginPath();
            ctx.moveTo(xi, 0);
            ctx.lineTo(xi, h);
            ctx.stroke();
          }

          ctx.restore();
        };

        drawNoteBoundaries(ctx);

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

        // Draw tutorial arrows if in tutorial mode
        if (trial.tutorial && trial.tutorial_arrows && trial.tutorial_arrows.length > 0) {
          trial.tutorial_arrows.forEach(arrow => {
            drawArrow(ctx, arrow, instrumentCanvas.width, instrumentCanvas.height);
          });
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

        // Map x-position to note index (equal-width regions for each note)
        const notes = getMajorScaleNotes();
        let frequency = MIN_FREQ; // fallback
        if (notes && notes.length > 0) {
          // Each note gets an equal-width region: [0, 1/n), [1/n, 2/n), ..., [(n-1)/n, 1]
          const noteIndex = Math.floor(normalizedX * notes.length);
          const clampedIndex = Math.max(0, Math.min(notes.length - 1, noteIndex));
          frequency = notes[clampedIndex];
        }

        const vibratoDepth = MIN_VIBRATO_DEPTH + normalizedY * (MAX_VIBRATO_DEPTH - MIN_VIBRATO_DEPTH);

        return { frequency, vibratoDepth };
      };

      // Mouse event handlers
      const handleMouseDown = (event) => {
        // Start recording on first interaction if in waiting state
        if (recordingState === 'waiting' && isFirstInteraction) {
          isFirstInteraction = false;
          startRecording();
        }
        
        // Enable finish button on first interaction in tutorial mode
        if (trial.tutorial && isFirstInteraction) {
          isFirstInteraction = false;
          const finishBtn = document.getElementById('finish-btn');
          if (finishBtn) finishBtn.disabled = false;
        }
        
        if (recordingState !== 'recording') return;
        if (instrumentCanvas.classList.contains('disabled')) return;

        isMouseDown = true;
        const rect = instrumentCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        currentMousePos = { x, y };
        const { frequency, vibratoDepth } = calculateAudioParams(x, y);

        if (trial.synth_type === 'discrete') {
          playNote(frequency, vibratoDepth);
          addCircle(x, y);
        } else if (trial.synth_type === 'legato') {
          startLegatoSynth(frequency, vibratoDepth);
          legatoCircle = new Circle(x, y);
        }

        interactions.push({
          type: 'mousedown',
          x: x,
          y: y,
          frequency: frequency,
          vibratoDepth: vibratoDepth,
          timestamp: performance.now() - performanceStartTime
        });
      };

      const handleMouseMove = (event) => {
        if (!isMouseDown || recordingState !== 'recording') return;
        if (instrumentCanvas.classList.contains('disabled')) return;

        const rect = instrumentCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        currentMousePos = { x, y };
        const { frequency, vibratoDepth } = calculateAudioParams(x, y);

        if (trial.synth_type === 'legato') {
          updateLegatoSynth(frequency, vibratoDepth);
          legatoCircle = new Circle(x, y);
        }

        interactions.push({
          type: 'mousemove',
          x: x,
          y: y,
          frequency: frequency,
          vibratoDepth: vibratoDepth,
          timestamp: performance.now() - performanceStartTime
        });
      };

      const handleMouseUp = (event) => {
        if (!isMouseDown || recordingState !== 'recording') return;

        isMouseDown = false;
        currentMousePos = null;

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
          currentMousePos = null;
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
        if (trial.tutorial) {
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

        // Get the last (accepted) performance
        const lastPerformance = performances.length > 0 ? performances[performances.length - 1] : null;
        
        // Store audio blob and URL for later access, but don't revoke URL yet
        const audioBlob = lastPerformance ? lastPerformance.audioBlob : null;
        const audioURL = lastPerformance ? lastPerformance.audioURL : null;

        // Gather trial data
        const trialData = {
          rt: performance.now() - startTime,
          stimulus_json: trial.stimulus_json,
          stimulus_index: trial.stimulus_index,
          synth_type: trial.synth_type,
          animation_data: animationData,
          performances: performances,
          audio_blob: audioBlob,
          audio_url: audioURL
        };

        this.jsPsych.finishTrial(trialData);
      };

      // Set up initial button
      if (trial.tutorial) {
        // In tutorial mode, enable the instrument immediately
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
          // Store the audio blob in the current performance
          if (currentPerformance) {
            currentPerformance.audioBlob = audioBlob;
            currentPerformance.audioURL = recordedAudioURL;
          }
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
            timestamp: Date.now(),
            audioBlob: null,  // Will be populated by mediaRecorder.onstop
            audioURL: null    // Will be populated by mediaRecorder.onstop
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
