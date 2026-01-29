var jsPsychAudioAmoebaMatch = (function (jspsych) {
  'use strict';

  const info = {
    name: 'audio-amoeba-match',
    parameters: {
      audio: {
        type: jspsych.ParameterType.OBJECT,
        pretty_name: 'Audio',
        default: undefined,
        description: 'Audio buffer object with type and data array'
      },
      choices: {
        type: jspsych.ParameterType.OBJECT,
        pretty_name: 'Choices',
        array: true,
        default: undefined,
        description: 'Array of animation choice objects with start_state, end_state, and correct_answer'
      },
      anim_length: {
        type: jspsych.ParameterType.INT,
        pretty_name: 'Animation length',
        default: 3000,
        description: 'Length of animation in milliseconds'
      },
      canvas_size: {
        type: jspsych.ParameterType.INT,
        pretty_name: 'Canvas size',
        default: 200,
        description: 'Size of each animation canvas in pixels'
      },
      prompt: {
        type: jspsych.ParameterType.HTML_STRING,
        pretty_name: 'Prompt',
        default: '',
        description: 'Instruction prompt'
      }
    }
  };

  class AudioAmoebaMatchPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial) {
      let selectedChoice = null;
      let audioUrl = null;
      let audioElement = null;
      let animationControllers = [];
      let hasPlayedAudio = false; // Track if audio has been played

      // Create audio blob from buffer data
      const uint8Array = new Uint8Array(trial.audio.data);
      const blob = new Blob([uint8Array], { type: 'audio/webm' });
      audioUrl = URL.createObjectURL(blob);

      // Build HTML
      let html = `
        <div style="max-width: 900px; margin: 0 auto; padding: 20px;">
          <!-- Prompt -->
          <div style="text-align: center; margin-bottom: 20px; font-size: 18px;">
            ${trial.prompt}
          </div>
          
          <!-- Audio player -->
          <div style="text-align: center; margin-bottom: 40px;">
            <button id="play-audio-btn" style="
              padding: 15px 40px;
              font-size: 16px;
              background-color:rgb(67, 67, 67);
              color: white;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              transition: background-color 0.3s;
            ">
              ▶ Play Audio
            </button>
          </div>
          
          <!-- Animation grid -->
          <div style="position: relative;">
            <div id="animation-grid" style="
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
              margin-bottom: 30px;
            ">
            </div>
            
            <!-- Overlay that blocks animations until audio is played -->
            <div id="animation-overlay" style="
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background-color: rgba(128, 128, 128, 0.9);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 18px;
              color: white;
              font-weight: bold;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
              pointer-events: none;
            ">
             
            </div>
          </div>
          
          <!-- Next button -->
          <div style="text-align: center;">
            <button id="next-btn" disabled style="
              padding: 12px 30px;
              font-size: 16px;
              background-color: #ccc;
              color: white;
              border: none;
              border-radius: 8px;
              cursor: not-allowed;
            ">
              Next
            </button>
          </div>
        </div>
      `;

      display_element.innerHTML = html;

      // Helper function to draw a static amoeba (used before animation starts)
      const drawStaticAmoeba = (ctx, centerX, centerY, params, canvasSize) => {
        const AMOEBA_BASE_RADIUS = 120;
        const BUMP_FREQUENCY = 10;
        const BUMP_MAX_AMPLITUDE = 0.3;
        
        const { color, aspect_ratio, irregularity } = params;
        const baseRadius = AMOEBA_BASE_RADIUS;
        const numPoints = 128;
        
        // Parse color
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
        
        ctx.clearRect(0, 0, canvasSize, canvasSize);
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(aspect_ratio, 1.0);
        
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
        
        const rgb = Array.isArray(color) ? color : parseColor(color);
        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        ctx.fill();
        
        ctx.restore();
      };

      // Create audio element
      audioElement = new Audio(audioUrl);

      // Setup play button reference first
      const playBtn = display_element.querySelector('#play-audio-btn');

      // Create progress bar for audio
      const audioProgressContainer = document.createElement('div');
      audioProgressContainer.style.cssText = `
        width: 300px;
        height: 8px;
        background-color: #e0e0e0;
        border-radius: 4px;
        margin: 15px auto;
        overflow: hidden;
      `;
      const audioProgressBar = document.createElement('div');
      audioProgressBar.style.cssText = `
        width: 0%;
        height: 100%;
        background-color: #4CAF50;
        transition: width 0.1s linear;
      `;
      audioProgressContainer.appendChild(audioProgressBar);
      playBtn.parentElement.appendChild(audioProgressContainer);

       // Update progress bar during playback
       audioElement.addEventListener('timeupdate', () => {
        if (audioElement.duration) {
          const progress = (audioElement.currentTime / audioElement.duration) * 100;
          audioProgressBar.style.width = progress + '%';
        }
      });

      // Reset progress bar when audio ends and remove overlay on first complete playback
      audioElement.addEventListener('ended', () => {
        audioProgressBar.style.width = '100%';
        
        // On first complete playback, remove overlay and start animations
        if (!hasPlayedAudio) {
          hasPlayedAudio = true;
          const overlay = display_element.querySelector('#animation-overlay');
          overlay.style.display = 'none';
          
          // Start all animations
          animationControllers.forEach((controller, index) => {
            if (controller && controller.start) {
              controller.start();
            }
          });
        }
        
        setTimeout(() => {
          audioProgressBar.style.width = '0%';
        }, 500);
      });

      // Setup play button click handler
      playBtn.addEventListener('click', () => {
        audioElement.currentTime = 0;
        audioProgressBar.style.width = '0%';
        audioElement.play();
      });


      // Create animation grid
      const grid = display_element.querySelector('#animation-grid');
      
      trial.choices.forEach((choice, index) => {
        const container = document.createElement('div');
        container.style.cssText = `
          cursor: pointer;
          border: 3px solid transparent;
          border-radius: 8px;
          padding: 5px;
          transition: border-color 0.3s;
          background-color: #f5f5f5;
        `;
        container.dataset.index = index;

        const canvas = document.createElement('canvas');
        canvas.width = trial.canvas_size;
        canvas.height = trial.canvas_size;
        canvas.style.cssText = `
          display: block;
          width: 100%;
          height: auto;
        `;
        
        container.appendChild(canvas);
        grid.appendChild(container);

        // Draw initial static frame (first frame of animation)
        const ctx = canvas.getContext('2d');
        const initialParams = {
          color: choice.start_state.color,
          aspect_ratio: choice.start_state.aspect_ratio,
          irregularity: choice.start_state.irregularity
        };
        drawStaticAmoeba(ctx, canvas.width / 2, canvas.height / 2, initialParams, canvas.width);

        // Start animation (paused initially)
        const animData = {
          start_state: choice.start_state,
          end_state: choice.end_state,
          anim_length: trial.anim_length
        };
        
        let currentController = null;
        let isStarted = false;
        
        const startAnimation = () => {
          const controller = renderAmoebaClip(JSON.stringify(animData), canvas);
          
          // Restart animation after it completes
          setTimeout(() => {
            if (animationControllers[index] && isStarted) {
              controller.stop();
              startAnimation();
            }
          }, trial.anim_length);
          
          return controller;
        };
        
        // Create controller object with start method
        const controllerWrapper = {
          start: () => {
            if (!isStarted) {
              isStarted = true;
              currentController = startAnimation();
            }
          },
          stop: () => {
            isStarted = false;
            if (currentController && currentController.stop) {
              currentController.stop();
            }
          }
        };
        
        animationControllers.push(controllerWrapper);

        // Click handler
        container.addEventListener('click', () => {
          selectedChoice = index;
          
          // Update visual feedback
          grid.querySelectorAll('div').forEach(div => {
            div.style.borderColor = 'transparent';
          });
          container.style.borderColor = '#2196F3';
          
          // Enable next button
          const nextBtn = display_element.querySelector('#next-btn');
          nextBtn.disabled = false;
          nextBtn.style.backgroundColor = 'rgb(67, 67, 67)';
          nextBtn.style.cursor = 'pointer';
        });
      });

      // Next button handler
      const nextBtn = display_element.querySelector('#next-btn');
      nextBtn.addEventListener('click', () => {
        if (selectedChoice !== null) {
          endTrial();
        }
      });

      // End trial function
      const endTrial = () => {
        // Stop all animations by setting the flag and stopping controllers
        animationControllers.forEach((controller, index) => {
          animationControllers[index] = null; // Signal to stop looping
          if (controller && controller.stop) {
            controller.stop();
          }
        });
        
        // Clean up audio
        if (audioElement) {
          audioElement.pause();
          audioElement = null;
        }
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }

        // Gather data
        const trialData = {
          selected_choice: selectedChoice,
          rt: performance.now() - startTime
        };

        // Clear display
        display_element.innerHTML = '';

        // Finish trial
        this.jsPsych.finishTrial(trialData);
      };

      const startTime = performance.now();
    }
  }

  AudioAmoebaMatchPlugin.info = info;

  return AudioAmoebaMatchPlugin;
})(jsPsychModule);