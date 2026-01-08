var jsPsychAnimationGridPreview = (function (jspsych) {
  "use strict";

  const info = {
    name: "animation-grid-preview",
    version: "1.0.0",
    parameters: {
      /** Path to JSON file containing animation stimuli */
      stimulus_json: {
        type: jspsych.ParameterType.STRING,
        default: null,
      },
      /** Index of the highlighted stimulus (if any) */
      highlight_index: {
        type: jspsych.ParameterType.INT,
        default: null,
      },
      /** Title text to display */
      title: {
        type: jspsych.ParameterType.HTML_STRING,
        default: 'Preview',
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
      /** Prompt or instruction text */
      prompt: {
        type: jspsych.ParameterType.HTML_STRING,
        default: null,
      },
      /** Button label to continue */
      button_label: {
        type: jspsych.ParameterType.STRING,
        default: 'Continue',
      },
      /** Enable interactive mode with audio playback and favorites selection */
      interactive_mode: {
        type: jspsych.ParameterType.BOOL,
        default: false,
      },
      /** Array of audio recordings to play back. Each element should have {audioURL, stimulusIndex} */
      audio_recordings: {
        type: jspsych.ParameterType.COMPLEX,
        default: null,
      },
      /** Maximum number of favorites that can be selected */
      max_favorites: {
        type: jspsych.ParameterType.INT,
        default: 2,
      },
    },
    data: {
      /** Response time */
      rt: {
        type: jspsych.ParameterType.INT,
      },
      /** Array of indices of the selected favorite clips */
      favorite_indices: {
        type: jspsych.ParameterType.COMPLEX,
      },
    },
  };

  class AnimationGridPreviewPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial) {
      const startTime = performance.now();
      
      // Amoeba drawing constants
      const AMOEBA_BASE_RADIUS = 50;
      const BUMP_FREQUENCY = 10;        // Frequency of irregular bumps (bouba)
      const BUMP_MAX_AMPLITUDE = 0.3;

      // State for animations
      let animationFrames = [];
      let stimuliData = null;
      let isRunning = true;
      let currentlyPlayingIndex = null;
      let currentAudio = null;
      let selectedFavorites = new Set();

      // Load stimuli data
      fetch(trial.stimulus_json)
        .then(response => response.json())
        .then(data => {
          stimuliData = data;
          renderGrid();
          if (!trial.interactive_mode) {
            startAnimations();
          }
        });

      // Helper functions
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
        
        // Interpolate hue by choosing shorter path around color wheel
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
        
        // Handle both color names and RGB arrays
        const rgb = Array.isArray(color) ? color : parseColor(color);
        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        
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

      const renderGrid = () => {
        if (!stimuliData) return;

        const html = `
          <style>
            .grid-preview-container {
              text-align: center;
              padding: 20px;
            }
            .grid-preview-title {
              font-size: 24px;
              margin-bottom: 10px;
              color: #455d7a;
            }
            .grid-preview-prompt {
              font-size: 16px;
              margin-bottom: 30px;
              color: #666;
            }
            .grid-preview-grid {
              display: inline-grid;
              grid-template-columns: repeat(3, ${trial.cell_size}px);
              grid-template-rows: repeat(3, ${trial.cell_size}px);
              gap: 15px;
              margin-bottom: 30px;
            }
            .grid-preview-cell {
              position: relative;
              width: ${trial.cell_size}px;
              height: ${trial.cell_size}px;
            }
            .grid-preview-cell canvas {
              background-color: #f5f5f5;
              border: 3px solid #455d7a;
              display: block;
            }
            .grid-preview-cell.highlighted canvas {
              border: 3px solid #f95959;
              border-width: 4px;
            }
            .grid-preview-cell.dimmed canvas {
              opacity: 0.5;
            }
            .grid-preview-cell.interactive {
              cursor: pointer;
            }
            .grid-preview-cell.interactive:hover canvas {
              border-color: #7fa4c7;
            }
            .grid-preview-cell.playing canvas {
              border-color: #28a745;
              border-width: 4px;
            }
            .grid-preview-cell-controls {
              position: absolute;
              bottom: 5px;
              left: 0;
              right: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              gap: 5px;
            }
            .grid-preview-play-btn {
              background-color: #455d7a;
              color: white;
              border: none;
              padding: 5px 10px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
            }
            .grid-preview-play-btn:hover {
              background-color: #7fa4c7;
            }
            .grid-preview-play-btn:disabled {
              background-color: #ccc;
              cursor: not-allowed;
            }
            .grid-preview-favorite-checkbox {
              width: 18px;
              height: 18px;
              cursor: pointer;
            }
            .grid-preview-favorite-label {
              display: flex;
              align-items: center;
              gap: 3px;
              font-size: 12px;
              color: #455d7a;
              cursor: pointer;
            }
          </style>
          <div class="grid-preview-container">
            <div class="grid-preview-title">${trial.title}</div>
            ${trial.prompt ? `<div class="grid-preview-prompt">${trial.prompt}</div>` : ''}
            <div class="grid-preview-grid" id="animation-grid"></div>
            <div>
              <button class="jspsych-btn" id="continue-btn">${trial.button_label}</button>
            </div>
          </div>
        `;

        display_element.innerHTML = html;

        // Create canvases for each stimulus
        const grid = display_element.querySelector('#animation-grid');
        stimuliData.forEach((stimulus, index) => {
          const cell = document.createElement('div');
          cell.className = 'grid-preview-cell';
          
          if (trial.highlight_index !== null) {
            if (index === trial.highlight_index) {
              cell.classList.add('highlighted');
            } else {
              cell.classList.add('dimmed');
            }
          }
          
          if (trial.interactive_mode) {
            cell.classList.add('interactive');
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = trial.cell_size;
          canvas.height = trial.cell_size;
          canvas.dataset.index = index;
          
          cell.appendChild(canvas);
          
          // Add interactive controls if in interactive mode
          if (trial.interactive_mode && trial.audio_recordings && trial.audio_recordings[index]) {
            const controls = document.createElement('div');
            controls.className = 'grid-preview-cell-controls';
            
            const playBtn = document.createElement('button');
            playBtn.className = 'grid-preview-play-btn';
            playBtn.textContent = 'Play';
            playBtn.dataset.index = index;
            
            const favoriteLabel = document.createElement('label');
            favoriteLabel.className = 'grid-preview-favorite-label';
            
            const favoriteCheckbox = document.createElement('input');
            favoriteCheckbox.type = 'checkbox';
            favoriteCheckbox.className = 'grid-preview-favorite-checkbox';
            favoriteCheckbox.dataset.index = index;
            
            favoriteLabel.appendChild(favoriteCheckbox);
            favoriteLabel.appendChild(document.createTextNode('Favorite'));
            
            controls.appendChild(playBtn);
            controls.appendChild(favoriteLabel);
            cell.appendChild(controls);
            
            // Add event listeners
            playBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              playClip(index);
            });
            
            favoriteCheckbox.addEventListener('change', (e) => {
              handleFavoriteToggle(index, e.target.checked);
            });
          }
          
          grid.appendChild(cell);
        });

        // Add button listener
        const continueBtn = display_element.querySelector('#continue-btn');
        if (trial.interactive_mode) {
          continueBtn.disabled = true;
          continueBtn.textContent = `Select ${trial.max_favorites} favorites to continue`;
        }
        continueBtn.addEventListener('click', endTrial);
      };

      const playClip = (index) => {
        // Stop any currently playing clip
        if (currentAudio) {
          currentAudio.pause();
          currentAudio = null;
        }
        
        // Clear playing state from all cells
        const cells = display_element.querySelectorAll('.grid-preview-cell');
        cells.forEach(cell => cell.classList.remove('playing'));
        
        // Disable all play buttons
        const playButtons = display_element.querySelectorAll('.grid-preview-play-btn');
        playButtons.forEach(btn => btn.disabled = true);
        
        if (currentlyPlayingIndex === index) {
          // Stop if clicking the same one
          currentlyPlayingIndex = null;
          playButtons.forEach(btn => btn.disabled = false);
          return;
        }
        
        currentlyPlayingIndex = index;
        
        // Get the audio URL for this clip
        const audioURL = trial.audio_recordings[index];
        if (!audioURL) {
          console.error('No audio recording for index:', index);
          playButtons.forEach(btn => btn.disabled = false);
          return;
        }
        
        // Mark this cell as playing
        cells[index].classList.add('playing');
        
        // Create and play audio
        currentAudio = new Audio(audioURL);
        
        // Animate the clip while playing
        const canvas = display_element.querySelector(`canvas[data-index="${index}"]`);
        const stimulus = stimuliData[index];
        const ctx = canvas.getContext('2d');
        const animationStartTime = performance.now();
        
        const animateClip = () => {
          if (currentlyPlayingIndex !== index) return;
          
          const elapsed = performance.now() - animationStartTime;
          const progress = (elapsed % trial.animation_duration) / trial.animation_duration;
          
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const params = getAnimationParams(stimulus, progress);
          drawAmoeba(ctx, canvas.width / 2, canvas.height / 2, params);
          
          if (elapsed < trial.animation_duration) {
            requestAnimationFrame(animateClip);
          }
        };
        
        currentAudio.onended = () => {
          currentlyPlayingIndex = null;
          cells[index].classList.remove('playing');
          playButtons.forEach(btn => btn.disabled = false);
          
          // Redraw the clip at its start state
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const params = getAnimationParams(stimulus, 0);
          drawAmoeba(ctx, canvas.width / 2, canvas.height / 2, params);
        };
        
        currentAudio.play();
        animateClip();
      };
      
      const handleFavoriteToggle = (index, checked) => {
        if (checked) {
          if (selectedFavorites.size < trial.max_favorites) {
            selectedFavorites.add(index);
          } else {
            // Uncheck the box if we've reached the limit
            const checkbox = display_element.querySelector(`input[data-index="${index}"]`);
            checkbox.checked = false;
            return;
          }
        } else {
          selectedFavorites.delete(index);
        }
        
        // Update continue button state
        const continueBtn = display_element.querySelector('#continue-btn');
        if (selectedFavorites.size === trial.max_favorites) {
          continueBtn.disabled = false;
          continueBtn.textContent = trial.button_label;
        } else {
          continueBtn.disabled = true;
          continueBtn.textContent = `Select ${trial.max_favorites} favorites to continue`;
        }
      };

      const startAnimations = () => {
        const canvases = display_element.querySelectorAll('.grid-preview-cell canvas');
        
        const animate = () => {
          if (!isRunning) return;
          
          const currentTime = performance.now();
          
          canvases.forEach(canvas => {
            const index = parseInt(canvas.dataset.index);
            const stimulus = stimuliData[index];
            const ctx = canvas.getContext('2d');
            
            // Calculate animation progress (loop)
            const elapsed = currentTime % trial.animation_duration;
            const progress = elapsed / trial.animation_duration;
            
            // Clear and draw
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
        
        // Stop any currently playing audio
        if (currentAudio) {
          currentAudio.pause();
          currentAudio = null;
        }
        
        const endTime = performance.now();
        const rt = Math.round(endTime - startTime);
        
        const trialData = {
          rt: rt,
        };
        
        // Add favorite indices if in interactive mode
        if (trial.interactive_mode) {
          trialData.favorite_indices = Array.from(selectedFavorites).sort((a, b) => a - b);
        }
        
        display_element.innerHTML = '';
        this.jsPsych.finishTrial(trialData);
      };
    }
  }

  AnimationGridPreviewPlugin.info = info;

  return AnimationGridPreviewPlugin;
})(jsPsychModule);
