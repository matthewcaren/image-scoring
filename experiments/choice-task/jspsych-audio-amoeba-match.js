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
              font-size: 20px;
              background-color:rgb(64, 64, 64);
              color: white;
              border: none;
              border-radius: 10px;
              cursor: pointer;
              transition: background-color 0.3s;
            ">
              ▶ Play Audio
            </button>
          </div>
          
          <!-- Animation grid -->
          <div id="animation-grid" style="
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 30px;
          ">
          </div>
          
          <!-- Next button -->
          <div style="text-align: center;">
            <button id="next-btn" disabled style="
              padding: 12px 30px;
              font-size: 16px;
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

      // Reset progress bar when audio ends
      audioElement.addEventListener('ended', () => {
        audioProgressBar.style.width = '100%';
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

        // Start animation
        const animData = {
          start_state: choice.start_state,
          end_state: choice.end_state,
          anim_length: trial.anim_length
        };
        
        const startAnimation = () => {
          const controller = renderAmoebaClip(JSON.stringify(animData), canvas);
          
          // Restart animation after it completes
          setTimeout(() => {
            if (animationControllers[index]) {
              controller.stop();
              startAnimation();
            }
          }, trial.anim_length);
          
          return controller;
        };
        
        const controller = startAnimation();
        animationControllers.push(controller);

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
          nextBtn.style.backgroundColor = 'rgb(64, 64, 64)';
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
