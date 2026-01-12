const studyInstructions = {
    referential: {
        intro1: '<div style="padding: 0 100px;"><p>Imagine you are a sound effect designer.</p><p>You\'ll be shown a few short video clips, and your goal is to create a matching sound effect for each one.</p></div>',
        intro2: '<p>We\'ve provided you with a tool you can use to make a variety of sounds. To make sound, click and drag inside the panel below. That\'s it!</p><p>Drag your mouse to different places to make different sounds. Once you\'ve had a chance to play around with this tool, click "Next" to continue.</p>',
        intro3: '<p>Now let\'s see exactly how this tool works by making a few specific sounds. Try tracing the arrow below and pay attention to what it sounds like.</p>',
        intro4: '<p>Now try tracing over this arrow and notice what that sounds like.</p>',
        intro5: '<p>What about these arrows? What do you notice?</p>',
        intro6: '<div style="padding: 0 100px;"><p>Great! Now let\'s take a look at the different video clips you\'ll be creating sound effects for.</p></div>',
        intro7: '<div style="padding: 0 100px;"><p>For each video clip, create a sound effect that goes with just that video clip, and not any of the other video clips.</p><p>Each sound effect should be different from the others, and it should be easy to tell which video clip it was supposed to go with.</p><p>At the end of the study, you’ll get a chance to hear all your sound effects again and see how easily you can match each sound effect to the video clip it originally went with!</p></div>',
        gridTitle: 'Here are the 9 video clips you will see today.',
        gridPrompt: 'You will make sounds for them one at a time.',
        previewPrompt: 'This is the clip you\'re about to make a sound for.',
        trialPrompt: '<p>Watch the clip and create a sound that matches it. You\'ll get to play along with the clip.</p>',
        reviewPrompt: '<p>Listen to your sound! Does it match the clip?</p>',
        matchingIntro: '<div style="padding: 0 100px;"<p>Great! Now let\'s see how well your sounds match the clips.</p><p>You\'ll hear a sound you created, and we\'ll show you 4 clips. Click on the clip you think the sound was made for.</p></div>',
        matchingTitle: 'Which clip does this sound go with?',
        matchingPrompt: '<p>Listen to the sound, then click on the clip it was made for.</p>'
    },
    musical: {
        intro1: '<div style="padding: 0 100px;"><p>Imagine you are a sound effect designer.</p><p>You\'ll be shown a few short video clips, and your goal is to create a pleasing sound effect for each one.</p></div>',
        intro2: '<p>We\'ve provided you with a tool you can use to make a variety of sounds. To make sound, click and drag inside the panel below. That\'s it!</p><p>Drag your mouse to different places to make different sounds. Once you\'ve had a chance to play around with this tool, click "Next" to continue.</p>',
        intro3: '<p>Now let\'s see exactly how this tool works by making a few specific sounds. Try tracing the arrow below and pay attention to what it sounds like.</p>',
        intro4: '<p>Now try tracing over this arrow and notice what that sounds like.</p>',
        intro5: '<p>What about these arrows? What do you notice?</p>',
        intro6: '<div style="padding: 0 100px;"><p>Great! Now let\'s take a look at the different video clips you\'ll be creating sound effects for.</p></div>',
        intro7: '<div style="padding: 0 100px;"><p>For each video clip, create a sound effect that you think is pleasing to listen to.</p><p>Each sound effect should be different from the others, and it should be easy to tell which video clip it was supposed to go with. But above all, we want you to create sounds that you like.</p><p>At the end of the study, you\'ll get a chance to hear all your sound effects again and tell us which ones were your favorites!</p></div>',
        gridTitle: 'Here are the 9 video clips you will see today.',
        gridPrompt: 'You will make sounds for them one at a time.',
        previewPrompt: 'This is the clip you\'re about to make a sound for.',
        trialPrompt: '<p>Watch the clip and create a sound for it. You\'ll get to play along with the clip.</p>',
        reviewPrompt: '<p>Listen to your sound! Do you like it?</p>',
        matchingIntro: '<div style="padding: 0 100px;"<p>Great! Now let\'s see how well your sounds match the clips.</p><p>You\'ll hear a sound you created, and we\'ll show you 4 clips. Click on the clip you think the sound was made for.</p></div>',
        matchingTitle: 'Which clip does this sound go with?',
        matchingPrompt: '<p>Listen to the sound, then click on the clip it was made for.</p>'
    }
};


function runStudy(stimulusFile, condition) {
    if (!["referential", "musical"].includes(condition)) {
        throw new Error(`Invalid condition: ${condition}. Must be either "referential" or "musical".`);
    }

    const jsPsych = initJsPsych({
        on_finish: function() {
            jsPsych.data.displayData();
        }
    });

    // //#region STUDY TIMELINE

    // // Define the stimulus indices for the batch
    // const stimulusIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8];

    // // Get instruction text based on condition
    // const instructions = studyInstructions[condition];

    // // Instruction screens with 3-second delay on continue button
    // const intro1 = {
    //     type: jsPsychHtmlButtonResponse,
    //     stimulus: instructions.intro1,
    //     choices: ['Continue'],
    //     on_load: function() {
    //         const buttons = document.querySelectorAll('.jspsych-btn');
    //         buttons.forEach(btn => btn.disabled = true);
    //         setTimeout(function() {
    //             buttons.forEach(btn => btn.disabled = false);
    //         }, 3000);
    //     }
    // };

    // const intro2 = {
    //     type: jsPsychImgSynthResponseAnim,
    //     prompt: instructions.intro2,
    //     tutorial: true,
    //     synth_type: 'legato'
    // };

    // const intro3 = {
    //     type: jsPsychImgSynthResponseAnim,
    //     prompt: instructions.intro3,
    //     tutorial: true,
    //     tutorial_arrows: [
    //         { startX: 0.1, startY: 0.8, endX: 0.9, endY: 0.8 }
    //     ],
    //     synth_type: 'legato'
    // };

    // const intro4 = {
    //     type: jsPsychImgSynthResponseAnim,
    //     prompt: instructions.intro4,
    //     tutorial: true,
    //     tutorial_arrows: [
    //         { startX: 0.3, startY: 0.95, endX: 0.3, endY: 0.05 }
    //     ],
    //     synth_type: 'legato'
    // };

    // const intro5 = {
    //     type: jsPsychImgSynthResponseAnim,
    //     prompt: instructions.intro5,
    //     tutorial: true,
    //     tutorial_arrows: [
    //         { startX: 0.96, startY: 0.04, endX: 0.04, endY: 0.96 },
    //         { startX: 0.7, startY: 0.6, endX: 0.96, endY: 0.8 }
    //     ],
    //     synth_type: 'legato'
    // };

    // const intro6 = {
    //     type: jsPsychHtmlButtonResponse,
    //     stimulus: instructions.intro6,
    //     choices: ['Continue'],
    //     on_load: function() {
    //         const buttons = document.querySelectorAll('.jspsych-btn');
    //         buttons.forEach(btn => btn.disabled = true);
    //         setTimeout(function() {
    //             buttons.forEach(btn => btn.disabled = false);
    //         }, 3000);
    //     }
    // };

    // // Instantiate timeline with instruction flow
    // const timeline = [intro1, intro2, intro3, intro4, intro5, intro6];

    // // Add full batch preview
    // timeline.push({
    //     type: jsPsychAnimationGridPreview,
    //     stimulus_json: stimulusFile,
    //     highlight_index: null,
    //     title: instructions.gridTitle,
    //     prompt: instructions.gridPrompt,
    //     button_label: 'Continue',
    //     cell_size: 150,
    //     animation_duration: 3000,
    //     on_load: function () {
    //         const buttons = document.querySelectorAll('.jspsych-btn');
    //         buttons.forEach(btn => btn.disabled = true);
    //         setTimeout(function () {
    //             buttons.forEach(btn => btn.disabled = false);
    //         }, 3000);
    //     }
    // });

    // // Final instruction screen
    // const intro7 = {
    //     type: jsPsychHtmlButtonResponse,
    //     stimulus: instructions.intro7,
    //     choices: ['Continue'],
    //     on_load: function() {
    //         const buttons = document.querySelectorAll('.jspsych-btn');
    //         buttons.forEach(btn => btn.disabled = true);
    //         setTimeout(function() {
    //             buttons.forEach(btn => btn.disabled = false);
    //         }, 3000);
    //     }
    // };
    
    // timeline.push(intro7);

    // // For each stimulus, add: highlighted preview -> scoring trial
    // stimulusIndices.forEach((index, i) => {
    //     // Preview screen showing which animation is next
    //     timeline.push({
    //         type: jsPsychAnimationGridPreview,
    //         stimulus_json: stimulusFile,
    //         highlight_index: index,
    //         title: `Clip ${i + 1} of ${stimulusIndices.length}`,
    //         prompt: instructions.previewPrompt,
    //         button_label: 'Continue',
    //         cell_size: 150,
    //         animation_duration: 3000
    //     });

    //     // Scoring trial
    //     timeline.push({
    //         type: jsPsychImgSynthResponseAnim,
    //         stimulus_json: stimulusFile,
    //         stimulus_index: index,
    //         synth_type: 'legato',
    //         prompt: instructions.trialPrompt,
    //         review_prompt: instructions.reviewPrompt,
    //         animation_canvas_size: 400,
    //         instrument_canvas_size: 400,
    //         animation_duration: 3000,
    //         countdown_duration: 3000
    //     });
    // });

    // // Add final gallery section where participants select their favorites
    // timeline.push({
    //     type: jsPsychAnimationGridPreview,
    //     stimulus_json: stimulusFile,
    //     highlight_index: null,
    //     title: 'Review Your Sounds',
    //     prompt: condition === 'referential' 
    //         ? '<p>Click on each clip to play it with your sound. Select your 2 favorites that best match their clips!</p>'
    //         : '<p>Click on each clip to play it with your sound. Select your 2 favorites!</p>',
    //     button_label: 'Submit',
    //     cell_size: 150,
    //     animation_duration: 3000,
    //     interactive_mode: true,
    //     max_favorites: 2,
    //     audio_recordings: function() {
    //         // Collect audio URLs from all completed trials
    //         const allData = jsPsych.data.get();
    //         const synthTrials = allData.filter({trial_type: 'img-synth-response-anim'});
            
    //         // Create an array indexed by stimulus_index
    //         const audioRecordings = new Array(stimulusIndices.length);
            
    //         synthTrials.values().forEach(trial => {
    //             if (trial.audio_url && trial.stimulus_index !== undefined) {
    //                 // Map the stimulus_index to the position in our array
    //                 const arrayIndex = stimulusIndices.indexOf(trial.stimulus_index);
    //                 if (arrayIndex !== -1) {
    //                     audioRecordings[arrayIndex] = trial.audio_url;
    //                 }
    //             }
    //         });
            
    //         return audioRecordings;
    //     }
    // });

    // // Add matching instruction
    // timeline.push({
    //     type: jsPsychHtmlButtonResponse,
    //     stimulus: instructions.matchingIntro,
    //     choices: ['Continue'],
    //     on_load: function() {
    //         const buttons = document.querySelectorAll('.jspsych-btn');
    //         buttons.forEach(btn => btn.disabled = true);
    //         setTimeout(function() {
    //             buttons.forEach(btn => btn.disabled = false);
    //         }, 3000);
    //     }
    // });

    // // Select 4 random stimuli for matching trials
    // const shuffled = [...stimulusIndices].sort(() => Math.random() - 0.5);
    // const matchingStimuli = shuffled.slice(0, 4);

    // // Add 4 matching trials
    // matchingStimuli.forEach((correctIndex, trialNum) => {
    //     // Generate 3 incorrect choices (different from correct)
    //     const incorrectChoices = stimulusIndices
    //         .filter(idx => idx !== correctIndex)
    //         .sort(() => Math.random() - 0.5)
    //         .slice(0, 3);
        
    //     // Combine and shuffle all 4 choices
    //     const allChoices = [correctIndex, ...incorrectChoices].sort(() => Math.random() - 0.5);
        
    //     timeline.push({
    //         type: jsPsychAnimationMatching,
    //         stimulus_json: stimulusFile,
    //         correct_index: correctIndex,
    //         choice_indices: allChoices,
    //         title: `Matching ${trialNum + 1} of 4`,
    //         prompt: instructions.matchingPrompt,
    //         button_label: 'Continue',
    //         cell_size: 150,
    //         animation_duration: 3000,
    //         audio_url: function() {
    //             const allData = jsPsych.data.get();
    //             const synthTrials = allData.filter({trial_type: 'img-synth-response-anim'});
    //             const trial = synthTrials.values().find(t => t.stimulus_index === correctIndex);
    //             return trial ? trial.audio_url : null;
    //         }
    //     });
    // });

    // //#endregion
    
    const timeline = [];

    // simple JSPsych slider response trial to test data pipeline
    const sliderTest = {
        type: jsPsychHtmlSliderResponse,
        stimulus: '<p>[test] On a scale from 0 to 100, how much do you like ice cream?</p>',
        labels: ['0', '50', '100'],
        min: 0,
        max: 100,
        start: 50,
        step: 1,
        require_movement: true,
        button_label: 'Submit'
    };
    timeline.push(sliderTest);

    jsPsych.run(timeline);
}
