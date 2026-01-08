var jsPsychAnimationMatching = (function (jspsych) {
  "use strict";

  const info = {
    name: "animation-matching",
    version: "1.0.0",
    parameters: {
      /** Path to JSON file containing animation stimuli */
      stimulus_json: {
        type: jspsych.ParameterType.STRING,
        default: null,
      },
      /** Audio URL to play */
      audio_url: {
        type: jspsych.ParameterType.STRING,
        default: null,
      },
      /** Index of the correct stimulus */
      correct_index: {
        type: jspsych.ParameterType.INT,
        default: null,
      },
      /** Array of 4 indices to display (one must be correct_index) */
      choice_indices: {
        type: jspsych.ParameterType.INT,
        array: true,
        default: [],
      },
      /** Title text to display */
      title: {
        type: jspsych.ParameterType.HTML_STRING,
        default: 'Which clip does this sound go with?',
      },
      /** Prompt or instruction text */
      prompt: {
        type: jspsych.ParameterType.HTML_STRING,
        default: '<p>Listen to the sound, then click on the clip it was made for.</p>',
      },
      /** Size of each grid cell canvas */
      cell_size: {
        type: jspsych.ParameterType.INT,
        default: 150,
      },
      /** Duration of each animation loop in ms */
      animation_duration: {
        type: jspsych.ParameterType.INT,
        default: 3000,
      },
      /** Button label to continue after selection */
      button_label: {
        type: jspsych.ParameterType.STRING,
        default: 'Continue',
      },
    },
    data: {
      /** Response time */
      rt: {
        type: jspsych.ParameterType.INT,
      },
      /** Index of the selected stimulus */
      selected_index: {
        type: jspsych.ParameterType.INT,
      },
      /** Index of the correct stimulus */
      correct_index: {
        type: jspsych.ParameterType.INT,
      },
      /** Whether the selection was correct */
      correct: {
        type: jspsych.ParameterType.BOOL,
      },
      /** The choice indices shown */
      choice_indices: {
        type: jspsych.ParameterType.COMPLEX,
      },
    },
  };

  class AnimationMatchingPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial) {
      const startTime = performance.now();
      
      // Amoeba drawing constants
      const AMOEBA_BASE_RADIUS = 50;
      const BUMP_FREQUENCY = 10;
      const BUMP_MAX_AMPLITUDE = 0.3;

      // State
      let stimuliData = null;
      let isRunning = true;
      let selectedIndex = null;
      let audioElement = null;
      let selectionTime = null;

      // Load stimuli data
      fetch(trial.stimulus_json)
        .then(response => response.json())
        .then(data => {
          stimuliData = data;
          renderDisplay();
          startAnimations();
        });

      // Helper functions (same as grid preview)
      const lerp = (start, end, t) => start + (end - start) * t;

      const parseColor = (colorStr) => {
        const colors = {
          'red': [255, 0, 0],
          'green': [0, 255, 0],
          'blue': [0, 0, 255]
        };
        return colors[colorStr.toLowerCase()] || [128, 128, 128];
      };

      const rgbToHsv = (r, g, b) => {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        
        let h = 0;
        if (delta !== 0) {
          if (max === r) {
            h = ((g - b) / delta) % 6;
          } else if (max === g) {
            h = (b - r) / delta + 2;
          } else {
            h = (r - g) / delta + 4;
          }
          h *= 60;
          if (h < 0) h += 360;
        }
        
        const s = max === 0 ? 0 : delta / max;
        const v = max;
        
        return [h, s, v];
      };

      const hsvToRgb = (h, s, v) => {
        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;
        
        let r, g, b;
        if (h < 60) {
          [r, g, b] = [c, x, 0];
        } else if (h < 120) {
          [r, g, b] = [x, c, 0];
        } else if (h < 180) {
          [r, g, b] = [0, c, x];
        } else if (h < 240) {
          [r, g, b] = [0, x, c];
        } else if (h < 300) {
          [r, g, b] = [x, 0, c];
        } else {
          [r, g, b] = [c, 0, x];
        }
        
        return [
          Math.round((r + m) * 255),
          Math.round((g + m) * 255),
          Math.round((b + m) * 255)
        ];
      };

      const lerpColor = (color1, color2, t) => {
        const c1 = parseColor(color1);
        const c2 = parseColor(color2);
        
        const hsv1 = rgbToHsv(c1[0], c1[1], c1[2]);
        const hsv2 = rgbToHsv(c2[0], c2[1], c2[2]);
        
        let h1 = hsv1[0];
        let h2 = hsv2[0];
        let hDiff = h2 - h1;
        
        if (hDiff > 180) {
          h1 += 360;
        } else if (hDiff < -180) {
          h2 += 360;
        }
        
        const h = (lerp(h1, h2, t) % 360 + 360) % 360;
        const s = lerp(hsv1[1], hsv2[1], t);
        const v = lerp(hsv1[2], hsv2[2], t);
        
        return hsvToRgb(h, s, v);
      };

      const drawAmoeba = (ctx, centerX, centerY, params) => {
        const irregularity = params.irregularity || 0;
        const aspectRatio = params.aspect_ratio || 1;
        const color = params.color || 'green';
        const baseRadius = AMOEBA_BASE_RADIUS;
        const numPoints = 128;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(aspectRatio, 1.0);
        
        const rgb = Array.isArray(color) ? color : parseColor(color);
        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        
        ctx.beginPath();
        
        for (let i = 0; i <= numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          let radius = baseRadius;
          
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
        ctx.fill();
        
        ctx.restore();
      };

      const getAnimationParams = (stimulus, t) => {
        return {
          irregularity: lerp(stimulus.start_state.irregularity, stimulus.end_state.irregularity, t),
          aspect_ratio: lerp(stimulus.start_state.aspect_ratio, stimulus.end_state.aspect_ratio, t),
          color: stimulus.start_state.color === stimulus.end_state.color 
            ? stimulus.start_state.color 
            : lerpColor(stimulus.start_state.color, stimulus.end_state.color, t)
        };
      };

      const renderDisplay = () => {
        if (!stimuliData) return;

        const html = `
          <style>
            .matching-container {
              text-align: center;
              padding: 20px;
            }
            .matching-title {
              font-size: 24px;
              margin-bottom: 10px;
              color: #455d7a;
            }
            .matching-prompt {
              font-size: 16px;
              margin-bottom: 20px;
              color: #666;
            }
            .matching-audio-section {
              margin-bottom: 30px;
            }
            .matching-play-btn {
              background-color: #455d7a;
              color: white;
              border: none;
              padding: 12px 30px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 16px;
              font-weight: bold;
            }
            .matching-play-btn:hover {
              background-color: #7fa4c7;
            }
            .matching-play-btn:disabled {
              background-color: #ccc;
              cursor: not-allowed;
            }
            .matching-grid {
              display: inline-grid;
              grid-template-columns: repeat(2, ${trial.cell_size}px);
              grid-template-rows: repeat(2, ${trial.cell_size}px);
              gap: 20px;
              margin-bottom: 30px;
            }
            .matching-cell {
              position: relative;
              width: ${trial.cell_size}px;
              height: ${trial.cell_size}px;
              cursor: pointer;
            }
            .matching-cell canvas {
              background-color: #f5f5f5;
              border: 3px solid #455d7a;
              display: block;
              transition: border-color 0.2s;
            }
            .matching-cell:hover canvas {
              border-color: #7fa4c7;
            }
            .matching-cell.selected canvas {
              border-color: #28a745;
              border-width: 5px;
            }
            .matching-continue-section {
              margin-top: 20px;
            }
          </style>
          <div class="matching-container">
            <div class="matching-title">${trial.title}</div>
            <div class="matching-prompt">${trial.prompt}</div>
            
            <div class="matching-audio-section">
              <button class="matching-play-btn" id="play-audio-btn">Play Sound</button>
            </div>
            
            <div class="matching-grid" id="matching-grid"></div>
            
            <div class="matching-continue-section">
              <button class="jspsych-btn" id="continue-btn" disabled>${trial.button_label}</button>
            </div>
          </div>
        `;

        display_element.innerHTML = html;

        // Create canvases for each choice
        const grid = display_element.querySelector('#matching-grid');
        trial.choice_indices.forEach((stimulusIndex, displayIndex) => {
          const cell = document.createElement('div');
          cell.className = 'matching-cell';
          cell.dataset.stimulusIndex = stimulusIndex;
          cell.dataset.displayIndex = displayIndex;
          
          const canvas = document.createElement('canvas');
          canvas.width = trial.cell_size;
          canvas.height = trial.cell_size;
          canvas.dataset.stimulusIndex = stimulusIndex;
          
          cell.appendChild(canvas);
          grid.appendChild(cell);
          
          // Add click handler
          cell.addEventListener('click', () => selectClip(stimulusIndex));
        });

        // Add audio button listener
        document.getElementById('play-audio-btn').addEventListener('click', playAudio);
        
        // Add continue button listener
        document.getElementById('continue-btn').addEventListener('click', endTrial);
      };

      const playAudio = () => {
        const playBtn = document.getElementById('play-audio-btn');
        playBtn.disabled = true;
        
        if (audioElement) {
          audioElement.pause();
        }
        
        audioElement = new Audio(trial.audio_url);
        
        audioElement.onended = () => {
          playBtn.disabled = false;
        };
        
        audioElement.onerror = () => {
          playBtn.disabled = false;
          console.error('Error playing audio');
        };
        
        audioElement.play();
      };

      const selectClip = (stimulusIndex) => {
        if (selectionTime === null) {
          selectionTime = performance.now();
        }
        
        selectedIndex = stimulusIndex;
        
        // Update visual selection
        const cells = display_element.querySelectorAll('.matching-cell');
        cells.forEach(cell => {
          if (parseInt(cell.dataset.stimulusIndex) === stimulusIndex) {
            cell.classList.add('selected');
          } else {
            cell.classList.remove('selected');
          }
        });
        
        // Enable continue button
        document.getElementById('continue-btn').disabled = false;
      };

      const startAnimations = () => {
        const canvases = display_element.querySelectorAll('.matching-cell canvas');
        
        const animate = () => {
          if (!isRunning) return;
          
          const currentTime = performance.now();
          
          canvases.forEach(canvas => {
            const stimulusIndex = parseInt(canvas.dataset.stimulusIndex);
            const stimulus = stimuliData[stimulusIndex];
            const ctx = canvas.getContext('2d');
            
            const elapsed = currentTime % trial.animation_duration;
            const progress = elapsed / trial.animation_duration;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const params = getAnimationParams(stimulus, progress);
            drawAmoeba(ctx, canvas.width / 2, canvas.height / 2, params);
          });
          
          requestAnimationFrame(animate);
        };
        
        animate();
      };

      const endTrial = () => {
        isRunning = false;
        
        if (audioElement) {
          audioElement.pause();
        }
        
        const endTime = performance.now();
        const rt = selectionTime ? Math.round(selectionTime - startTime) : Math.round(endTime - startTime);
        
        const trialData = {
          rt: rt,
          selected_index: selectedIndex,
          correct_index: trial.correct_index,
          correct: selectedIndex === trial.correct_index,
          choice_indices: trial.choice_indices,
        };
        
        display_element.innerHTML = '';
        this.jsPsych.finishTrial(trialData);
      };
    }
  }

  AnimationMatchingPlugin.info = info;

  return AnimationMatchingPlugin;
})(jsPsychModule);
