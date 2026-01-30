var jsPsychAudioPreference = (function (jspsych) {
  'use strict';

  const info = {
    name: 'audio-preference',
    parameters: {
      audio_a: {
        type: jspsych.ParameterType.OBJECT,
        pretty_name: 'Audio A',
        default: undefined,
        description: 'Audio buffer object for Sound A'
      },
      audio_b: {
        type: jspsych.ParameterType.OBJECT,
        pretty_name: 'Audio B',
        default: undefined,
        description: 'Audio buffer object for Sound B'
      },
      label_a: {
        type: jspsych.ParameterType.STRING,
        pretty_name: 'Label A',
        default: 'Sound A',
        description: 'Label for Sound A'
      },
      label_b: {
        type: jspsych.ParameterType.STRING,
        pretty_name: 'Label B',
        default: 'Sound B',
        description: 'Label for Sound B'
      },
      prompt: {
        type: jspsych.ParameterType.HTML_STRING,
        pretty_name: 'Prompt',
        default: 'Which sound is more pleasing?',
        description: 'Instruction prompt'
      }
    }
  };

  class AudioPreferencePlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial) {
      let selectedChoice = null;
      let audioUrlA = null;
      let audioUrlB = null;
      let audioElementA = null;
      let audioElementB = null;
      let hasPlayedA = false;
      let hasPlayedB = false;

      // Create audio blobs
      const uint8ArrayA = new Uint8Array(trial.audio_a.data);
      const blobA = new Blob([uint8ArrayA], { type: 'audio/webm' });
      audioUrlA = URL.createObjectURL(blobA);

      const uint8ArrayB = new Uint8Array(trial.audio_b.data);
      const blobB = new Blob([uint8ArrayB], { type: 'audio/webm' });
      audioUrlB = URL.createObjectURL(blobB);

      // Build HTML
      let html = `
        <div style="max-width: 1000px; margin: 0 auto; padding: 20px;">
          <!-- Prompt -->
          <div style="text-align: center; margin-bottom: 40px; font-size: 20px; font-weight: bold;">
            ${trial.prompt}
          </div>
          
          <!-- Audio comparison container -->
          <div style="display: flex; justify-content: center; gap: 80px; margin-bottom: 40px;">
            
            <!-- Sound A -->
            <div style="text-align: center; flex: 1; max-width: 300px;">
              <div style="font-size: 18px; font-weight: bold; margin-bottom: 20px;">
                <!--  ${trial.label_a} -->
              </div>
              
               <button id="play-audio-a-btn" style="
                padding: 15px 40px;
                font-size: 16px;
                background-color: #888888;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                transition: background-color 0.3s;
                margin-bottom: 15px;
                width: 100%;
                min-width: 200px;
                min-height: 56px;
              ">
                ▶ Play ${trial.label_a}
              </button>
              
              <!-- Progress bar for Audio A -->
              <div style="
                width: 100%;
                height: 8px;
                background-color: #e0e0e0;
                border-radius: 4px;
                margin-bottom: 30px;
                overflow: hidden;
              ">
                <div id="progress-bar-a" style="
                  width: 0%;
                  height: 100%;
                  background-color: #555555;
                  transition: width 0.1s linear;
                "></div>
              </div>
              
              <button id="select-a-btn" disabled style="
                padding: 12px 30px;
                font-size: 16px;
                background-color: #ccc;
                color: white;
                border: 2px solid transparent;
                border-radius: 8px;
                cursor: not-allowed;
                width: 100%;
                min-height: 50px;
                opacity: 0.6;
              ">
                Choose ${trial.label_a}
              </button>
            </div>
            
            <!-- Sound B -->
            <div style="text-align: center; flex: 1; max-width: 300px;">
              <div style="font-size: 18px; font-weight: bold; margin-bottom: 20px;">
              <!--  ${trial.label_b} -->
              </div>
              
               <button id="play-audio-b-btn" style="
                padding: 15px 40px;
                font-size: 16px;
                background-color: #888888;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                transition: background-color 0.3s;
                margin-bottom: 15px;
                width: 100%;
                min-width: 200px;
                min-height: 56px;
              ">
                ▶ Play ${trial.label_b}
              </button>
              
              <!-- Progress bar for Audio B -->
              <div style="
                width: 100%;
                height: 8px;
                background-color: #e0e0e0;
                border-radius: 4px;
                margin-bottom: 30px;
                overflow: hidden;
              ">
                <div id="progress-bar-b" style="
                  width: 0%;
                  height: 100%;
                  background-color: #555555;
                  transition: width 0.1s linear;
                "></div>
              </div>
              
              <button id="select-b-btn" disabled style="
                padding: 12px 30px;
                font-size: 16px;
                background-color: #ccc;
                color: white;
                border: 2px solid transparent;
                border-radius: 8px;
                cursor: not-allowed;
                width: 100%;
                min-height: 50px;
                opacity: 0.6;
              ">
                Choose ${trial.label_b}
              </button>
            </div>
            
          </div>
          
          
          <!-- Next button -->
          <div style="text-align: center;">
            <button id="next-btn" disabled class="jspsych-btn" style="
              opacity: 0.5;
              cursor: not-allowed;
            ">
              Next
            </button>
          </div>
        </div>
      `;

      display_element.innerHTML = html;


      audioElementA = new Audio(audioUrlA);
      audioElementB = new Audio(audioUrlB);


      const playBtnA = display_element.querySelector('#play-audio-a-btn');
      const playBtnB = display_element.querySelector('#play-audio-b-btn');
      const progressBarA = display_element.querySelector('#progress-bar-a');
      const progressBarB = display_element.querySelector('#progress-bar-b');
      const selectBtnA = display_element.querySelector('#select-a-btn');
      const selectBtnB = display_element.querySelector('#select-b-btn');
      const nextBtn = display_element.querySelector('#next-btn');

      // Helper to disable/enable play buttons --- can be smoother
      const setPlayButtonsEnabled = (enabled) => {
        playBtnA.disabled = !enabled;
        playBtnB.disabled = !enabled;
        if (enabled) {
          playBtnA.style.opacity = '1';
          playBtnA.style.cursor = 'pointer';
          playBtnB.style.opacity = '1';
          playBtnB.style.cursor = 'pointer';
        } else {
          playBtnA.style.opacity = '0.5';
          playBtnA.style.cursor = 'not-allowed';
          playBtnB.style.opacity = '0.5';
          playBtnB.style.cursor = 'not-allowed';
        }
      };

      // Update progress bars as we listen
      audioElementA.addEventListener('timeupdate', () => {
        if (audioElementA.duration) {
          const progress = (audioElementA.currentTime / audioElementA.duration) * 100;
          progressBarA.style.width = progress + '%';
        }
      });

      audioElementB.addEventListener('timeupdate', () => {
        if (audioElementB.duration) {
          const progress = (audioElementB.currentTime / audioElementB.duration) * 100;
          progressBarB.style.width = progress + '%';
        }
      });


      audioElementA.addEventListener('ended', () => {
        progressBarA.style.width = '100%';
        setPlayButtonsEnabled(true);
        setTimeout(() => {
          progressBarA.style.width = '0%';
        }, 500);
      });

      audioElementB.addEventListener('ended', () => {
        progressBarB.style.width = '100%';
        setPlayButtonsEnabled(true);
        setTimeout(() => {
          progressBarB.style.width = '0%';
        }, 500);
      });

      
      const checkBothPlayed = () => {
        if (hasPlayedA && hasPlayedB) {
          selectBtnA.disabled = false;
          selectBtnA.style.backgroundColor = 'rgb(48, 48, 48)';
          selectBtnA.style.cursor = 'pointer';
          selectBtnA.style.opacity = '1';
          
          selectBtnB.disabled = false;
          selectBtnB.style.backgroundColor = 'rgb(48, 48, 48)';
          selectBtnB.style.cursor = 'pointer';
          selectBtnB.style.opacity = '1';
        }
      };

      // Update button highlights based on selection
      const updateSelectionHighlight = () => {
        if (selectedChoice === 'A') {
          selectBtnA.style.backgroundColor = 'rgb(20, 20, 20)';
          selectBtnA.style.fontWeight = 'bold';
          selectBtnA.style.border = '4px solid green';
          selectBtnB.style.backgroundColor = 'rgb(48, 48, 48)';
          selectBtnB.style.fontWeight = 'normal';
          selectBtnB.style.border = 'px solid transparent';
        } else if (selectedChoice === 'B') {
          selectBtnB.style.backgroundColor = 'rgb(20, 20, 20)';
          selectBtnB.style.fontWeight = 'bold';
          selectBtnB.style.border = '4px solid green';
          selectBtnA.style.backgroundColor = 'rgb(48, 48, 48)'
          selectBtnA.style.fontWeight = 'normal';
          selectBtnA.style.border = '2px solid transparent';
        }
        
        
        if (selectedChoice !== null) {
          nextBtn.disabled = false;
          nextBtn.style.opacity = '1';
          nextBtn.style.cursor = 'pointer';
        }
      };

      // Play button handlers
      playBtnA.addEventListener('click', () => {
        if (playBtnA.disabled) return;
        setPlayButtonsEnabled(false);
        // Stop audio B if playing
        audioElementB.pause();
        audioElementB.currentTime = 0;
        progressBarB.style.width = '0%';
        
        audioElementA.currentTime = 0;
        progressBarA.style.width = '0%';
        audioElementA.play();
        hasPlayedA = true;
        checkBothPlayed();
      });

      playBtnB.addEventListener('click', () => {
        if (playBtnB.disabled) return;
        setPlayButtonsEnabled(false);
        // Stop audio A if playing
        audioElementA.pause();
        audioElementA.currentTime = 0;
        progressBarA.style.width = '0%';
        
        audioElementB.currentTime = 0;
        progressBarB.style.width = '0%';
        audioElementB.play();
        hasPlayedB = true;
        checkBothPlayed();
      });


      selectBtnA.addEventListener('click', () => {
        if (hasPlayedA && hasPlayedB) {
          selectedChoice = 'A';
          updateSelectionHighlight();
        }
      });

      selectBtnB.addEventListener('click', () => {
        if (hasPlayedA && hasPlayedB) {
          selectedChoice = 'B';
          updateSelectionHighlight();
        }
      });

      // Next button handler - ends the trial
      nextBtn.addEventListener('click', () => {
        if (selectedChoice !== null) {
          endTrial();
        }
      });


      const endTrial = () => {
        // Clean up audio
        if (audioElementA) {
          audioElementA.pause();
          audioElementA = null;
        }
        if (audioElementB) {
          audioElementB.pause();
          audioElementB = null;
        }
        if (audioUrlA) {
          URL.revokeObjectURL(audioUrlA);
        }
        if (audioUrlB) {
          URL.revokeObjectURL(audioUrlB);
        }


        const trialData = {
          selected_choice: selectedChoice,
          rt: performance.now() - startTime
        };


        display_element.innerHTML = '';

      
        this.jsPsych.finishTrial(trialData);
      };

      const startTime = performance.now();
    }
  }

  AudioPreferencePlugin.info = info;

  return AudioPreferencePlugin;
})(jsPsychModule);