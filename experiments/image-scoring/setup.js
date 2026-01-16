const studyInstructions = {
    referential: {
        intro1: '<div style="padding: 0 100px;"><img src="img/diagram-referential.png" style="max-width: 50%;"><p>Imagine you are a sound effect designer!</p><p>You\'ll be shown a few short video clips. Your goal is to create a matching sound effect for each one.</p></div>',
        intro2: '<p>We\'ve provided you with a tool you can use to make a variety of sounds. To make sound, click and drag inside the panel below. That\'s it!</p><p>Drag your mouse to different places to make different sounds. Once you\'ve had a chance to play around with this tool, click "Next" to continue.</p>',
        intro3: '<p>Now, let\'s see exactly how this tool works by making a few specific sounds.</p><p>Trace the arrow below and pay attention to what it sounds like.</p>',
        intro4: '<p>Now trace over this arrow and notice what that sounds like.</p>',
        intro5: '<p>What about these arrows? What do you notice?</p>',
        intro6: '<div style="padding: 0 100px;"><p>Great! Now let\'s take a look at the different video clips you\'ll be creating sound effects for.</p></div>',
        intro7: '<div style="padding: 0 100px;"><p>For each video clip, create a sound effect that goes with just that video clip, and not any of the other video clips.</p><p>Each sound effect should be different from the others, and it should be <b>easy for someone else to tell which of these video clips it goes with</b>.</p><p>At the end of the study, you’ll get a chance to hear all your sound effects again and see how easily you can match each sound effect to the video clip it originally went with!</p></div>',
        gridTitle: 'Here are the 9 video clips you will see today.',
        gridPrompt: 'You will make sounds for them one at a time.',
        previewPrompt: 'This is the clip you\'re about to make a sound for.',
        trialPrompt: '<p>Watch the clip and create a sound that matches it. You\'ll get to play along with the clip.</p>',
        reviewPrompt: '<p>Listen to your sound! Does it match the clip?</p>',
        matchingIntro: '<div style="padding: 0 100px;"><p>Great! In this next part, you\'ll match sounds you made to their clips.</p><p>Click on the clip that matches the sound.</p></div>',
        matchingTitle: 'Which clip does this sound go with?',
        matchingPrompt: '<p>Listen to the sound, then click on the clip it was made for.</p>'
    },
    musical: {
        intro1: '<div style="padding: 0 100px;"><img src="img/diagram-musical.png" style="max-width: 50%;"><p>Imagine you are a sound effect designer!</p><p>You\'ll be shown a few short video clips. Your goal is to create a pleasing sound effect for each one.</p></div>',
        intro2: '<p>We\'ve provided you with a tool you can use to make a variety of sounds. To make sound, click and drag inside the panel below. That\'s it!</p><p>Drag your mouse to different places to make different sounds. Once you\'ve had a chance to play around with this tool, click "Next" to continue.</p>',
        intro3: '<p>Now, let\'s see exactly how this tool works by making a few specific sounds.</p><p>Trace the arrow below and pay attention to what it sounds like.</p>',
        intro4: '<p>Now trace over this arrow and notice what that sounds like.</p>',
        intro5: '<p>What about these arrows? What do you notice?</p>',
        intro6: '<div style="padding: 0 100px;"><p>Great! Now let\'s take a look at the different video clips you\'ll be creating sound effects for.</p></div>',
        intro7: '<div style="padding: 0 100px;"><p>For each video clip, create a sound effect that you think is pleasing to listen to. Each sound effect should be different from the others, and it should be easy for someone else to tell which of these video clips it was supposed to go with.</p><p>But above all, <b>create sounds that you like</b>.</p><p>At the end of the study, you\'ll get a chance to hear all your sound effects again and tell us which ones were your favorites!</p></div>',
        gridTitle: 'Here are the 9 video clips you will see today.',
        gridPrompt: 'You will make sounds for them one at a time.',
        previewPrompt: 'This is the clip you\'re about to make a sound for.',
        trialPrompt: '<p>Watch the clip and create a sound for it. You\'ll get to play along with the clip.</p>',
        reviewPrompt: '<p>Listen to your sound! Do you like it?</p>',
        matchingIntro: '<div style="padding: 0 100px;"><p>Great! In this next part, you\'ll match sounds you made to their clips.</p><p>Click on the clip that matches the sound.</p></div>',
        matchingTitle: 'Which clip does this sound go with?',
        matchingPrompt: '<p>Listen to the sound, then click on the clip it was made for.</p>'
    }
};


function runStudy(stimulusFile) {
    let condition = '';
    
    var urlParams = new URLSearchParams(window.location.search);
    try {
        gs.prolific_info.prolificID = urlParams.get('PROLIFIC_PID');
        gs.prolific_info.prolificStudyID = urlParams.get('STUDY_ID');
        gs.prolific_info.prolificSessionID = urlParams.get('SESSION_ID');

        condition = urlParams.get('condition');
        if (!["referential", "musical"].includes(condition)) {
            throw new Error(`Invalid condition: ${condition}. Must be either "referential" or "musical".`);
        }
        gs.session_info.condition = condition;
    } catch (error) {
        console.error('Error obtaining prolific URL parameters:', error);
    }

    gs.session_info.send_data = function (data) {
        console.log("sending data to server...");
        json = _.extend({},
            { study_metadata: gs.study_metadata },
            { session_info: _.omit(gs.session_info, 'on_finish', 'stimuli') },
            { prolific: gs.prolific_info },
            data);
        socket.emit('currentData', json,
            gs.study_metadata.project, //dbname
            gs.study_metadata.experiment, //colname
            gs.session_info.gameID,
        );
        console.log(gs.study_metadata.project, gs.study_metadata.experiment, gs.session_info.gameID);
        console.log("data sent.");
    }

    const jsPsych = initJsPsych({
        on_finish: function(data) {
            socket.emit('helloEvent', 'Experiment complete signal from client');
            console.log("Experiment complete. Preparing to send data...");
            console.log(data);
            gs.session_info.send_data(data);
            jsPsych.data.displayData();
        }
    });

    const timeline = [];

    //#region CONSENT FORM
    const consent = {
        data: { study_phase: "consent" },
        type: jsPsychHtmlButtonResponse,
        stimulus:
            '<div style="padding: 0 100px;">' +
            '<h2>Make Some Sounds!</h2><div style="text-align: left">' +
            "<p>Welcome! In this study you will watch animated video clips and make sounds using a web interface. The session should take about <b>15–20 minutes</b>.</p>" +
            "<div class='consent'>" +
            "<p>By clicking below, you are agreeing to take part in a study being conducted by cognitive scientists in the <b>Department of Psychology at Stanford University</b>. If you have questions about this research, please contact us at <a href='mailto:cogtoolslab.requester@gmail.com?subject=Image Scoring Study'>cogtoolslab.requester@gmail.com</a>. We will do our best to respond promptly and professionally.</p>" +
            "<ul>" +
            "<li>You must be at least 18 years old to participate.</li>" +
            "<li>Your participation is voluntary.</li>" +
            "<li>You may decline to answer any question or stop the study at any time without penalty.</li>" +
            "<li>Your responses are anonymous and will be analyzed only in aggregate form.</li>" +
            "</ul>" +
            "</div></div>" +
            "<p>Do you consent to participate in this study as described above?</p>" +
            '</div>',
        choices: ["Yes, I agree to participate"],
        margin_vertical: "30px",
        on_start: function () {
            gs.session_timing.consent_start = Date.now();
        },
        on_finish: function () {
            // Record consent completion time
            gs.session_timing.consent_complete = Date.now();

            // Enter fullscreen immediately after consent
            const element = document.documentElement;
            if (element.requestFullscreen) {
                element.requestFullscreen();
            } else if (element.mozRequestFullScreen) {
                element.mozRequestFullScreen();
            } else if (element.webkitRequestFullscreen) {
                element.webkitRequestFullscreen();
            } else if (element.msRequestFullscreen) {
                element.msRequestFullscreen();
            }
        }
    };
    timeline.push(consent);
    //#endregion


    //#region STUDY TIMELINE

    // Shuffle order of the 3 rows of stimulus indices, and the order of the clips within the rows
    let stimulusIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const row1 = stimulusIndices.slice(0, 3).sort(() => Math.random() - 0.5);
    const row2 = stimulusIndices.slice(3, 6).sort(() => Math.random() - 0.5);
    const row3 = stimulusIndices.slice(6, 9).sort(() => Math.random() - 0.5);
    const shuffledRows = [row1, row2, row3].sort(() => Math.random() - 0.5);
    stimulusIndices = [].concat(...shuffledRows);

    // Get instruction text based on condition
    const instructions = studyInstructions[condition];

    const audioCheck = {
        type: jsPsychHtmlButtonResponse,
        stimulus: '<p>Make sure your sound is on and volume is up! To confirm, listen to this clip and click the word you hear.</p><audio src="delay-spoken.wav" controls style="margin-bottom:10px;"></audio>',
        choices: ['explain', 'orange', 'support', 'delay', 'table', 'guitar'],
        data: { study_phase: "audio_check" },
        on_load: function() {
            const buttons = document.querySelectorAll('.jspsych-btn');
            buttons.forEach(btn => btn.disabled = true);
            setTimeout(function() {
                buttons.forEach(btn => btn.disabled = false);
            }, 2000);
        }
    };

    const audioCheckLoop = {
        timeline: [audioCheck],
        loop_function: function(data) {
            return data.values()[0].response !== 3; // Keep looping until they select 'delay' (index 3)
        }
    };

    timeline.push(audioCheckLoop);

    // Instruction screens with 3-second delay on continue button
    const intro1 = {
        type: jsPsychHtmlButtonResponse,
        stimulus: instructions.intro1,
        choices: ['Continue'],
        on_load: function() {
            const buttons = document.querySelectorAll('.jspsych-btn');
            buttons.forEach(btn => btn.disabled = true);
            setTimeout(function() {
                buttons.forEach(btn => btn.disabled = false);
            }, 3000);
        }
    };

    const intro2 = {
        type: jsPsychImgSynthResponseAnim,
        prompt: instructions.intro2,
        tutorial: true,
        synth_type: 'legato'
    };

    const intro3 = {
        type: jsPsychImgSynthResponseAnim,
        prompt: instructions.intro3,
        tutorial: true,
        tutorial_arrows: [
            { startX: 0.1, startY: 0.8, endX: 0.9, endY: 0.8 }
        ],
        synth_type: 'legato'
    };

    const intro4 = {
        type: jsPsychImgSynthResponseAnim,
        prompt: instructions.intro4,
        tutorial: true,
        tutorial_arrows: [
            { startX: 0.3, startY: 0.95, endX: 0.3, endY: 0.05 }
        ],
        synth_type: 'legato'
    };

    const intro5 = {
        type: jsPsychImgSynthResponseAnim,
        prompt: instructions.intro5,
        tutorial: true,
        tutorial_arrows: [
            { startX: 0.96, startY: 0.04, endX: 0.04, endY: 0.96 },
            { startX: 0.7, startY: 0.6, endX: 0.96, endY: 0.8 }
        ],
        synth_type: 'legato'
    };

    const instrumentFreePlay = {
        type: jsPsychImgSynthResponseAnim,
        prompt: "Great job! Now it’s your turn to try making some sounds. Go ahead and play with the instrument until you feel comfortable with the instrument and feel like you know how to make whatever sound you like.",
        tutorial: true,
        synth_type: 'legato'
    };

    const intro6 = {
        type: jsPsychHtmlButtonResponse,
        stimulus: instructions.intro6,
        choices: ['Continue'],
        on_load: function() {
            const buttons = document.querySelectorAll('.jspsych-btn');
            buttons.forEach(btn => btn.disabled = true);
            setTimeout(function() {
                buttons.forEach(btn => btn.disabled = false);
            }, 1000);
        }
    };

    // Add instruction flow to timeline
    timeline.push(intro1, intro2, intro3, intro4, intro5, instrumentFreePlay, intro6);

    // Add full batch preview
    timeline.push({
        type: jsPsychAnimationGridPreview,
        stimulus_json: stimulusFile,
        highlight_index: null,
        title: instructions.gridTitle,
        prompt: instructions.gridPrompt,
        button_label: 'Continue',
        cell_size: 150,
        animation_duration: 3000,
        on_load: function () {
            const buttons = document.querySelectorAll('.jspsych-btn');
            buttons.forEach(btn => btn.disabled = true);
            setTimeout(function () {
                buttons.forEach(btn => btn.disabled = false);
            }, 3000);
        }
    });

    // Final instruction screen
    const intro7 = {
        type: jsPsychHtmlButtonResponse,
        stimulus: instructions.intro7,
        choices: ['Continue'],
        on_load: function() {
            const buttons = document.querySelectorAll('.jspsych-btn');
            buttons.forEach(btn => btn.disabled = true);
            setTimeout(function() {
                buttons.forEach(btn => btn.disabled = false);
            }, 3000);
        }
    };
    
    timeline.push(intro7);

    // For each stimulus, add: highlighted preview -> scoring trial
    stimulusIndices.forEach((index, i) => {
        // Preview screen showing which animation is next
        timeline.push({
            type: jsPsychAnimationGridPreview,
            stimulus_json: stimulusFile,
            highlight_index: index,
            title: `Clip ${i + 1} of ${stimulusIndices.length}`,
            prompt: instructions.previewPrompt,
            button_label: 'Continue',
            cell_size: 150,
            animation_duration: 3000
        });

        // Scoring trial
        timeline.push({
            type: jsPsychImgSynthResponseAnim,
            stimulus_json: stimulusFile,
            stimulus_index: index,
            synth_type: 'legato',
            prompt: instructions.trialPrompt,
            review_prompt: instructions.reviewPrompt,
            animation_canvas_size: 400,
            instrument_canvas_size: 400,
            animation_duration: 3000,
            countdown_duration: 3000,
            data: { study_phase: "scoring_trial", stimulus_index: index }
        });
    });

    const transitionToReview = {
        type: jsPsychHtmlButtonResponse,
        stimulus: "Great job! You've made sounds for all the clips. Next, you'll answer a few questions about the sounds you made.",
        choices: ['Continue'],
        on_load: function () {
            const buttons = document.querySelectorAll('.jspsych-btn');
            buttons.forEach(btn => btn.disabled = true);
            setTimeout(function () {
                buttons.forEach(btn => btn.disabled = false);
            }, 1000);
        }
    }
    timeline.push(transitionToReview);

    // Add final gallery section where participants select their favorites
    timeline.push({
        type: jsPsychAnimationGridPreview,
        stimulus_json: stimulusFile,
        highlight_index: null,
        title: 'Review Your Sounds',
        prompt: '<p>Click each clip to hear the sound you made for it. Select the two sounds you like most!</p>',
        button_label: 'Continue',
        cell_size: 150,
        animation_duration: 3000,
        interactive_mode: true,
        max_favorites: 2,
        audio_recordings: function() {
            // Collect audio URLs from all completed trials
            const allData = jsPsych.data.get();
            const synthTrials = allData.filter({trial_type: 'img-synth-response-anim'});
            
            // Create an array indexed by stimulus_index
            const audioRecordings = new Array(stimulusIndices.length);
            
            synthTrials.values().forEach(trial => {
                if (trial.audio_url && trial.stimulus_index !== undefined) {
                    // Map the stimulus_index to the position in our array
                    const arrayIndex = stimulusIndices.indexOf(trial.stimulus_index);
                    if (arrayIndex !== -1) {
                        audioRecordings[arrayIndex] = trial.audio_url;
                    }
                }
            });
            return audioRecordings;
        },
        data: { study_phase: "favorite_selection" }
    });

    // Add matching instruction
    timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: instructions.matchingIntro,
        choices: ['Continue'],
        on_load: function() {
            const buttons = document.querySelectorAll('.jspsych-btn');
            buttons.forEach(btn => btn.disabled = true);
            setTimeout(function() {
                buttons.forEach(btn => btn.disabled = false);
            }, 3000);
        }
    });

    // Select 4 random stimuli for matching trials
    const shuffled = [...stimulusIndices].sort(() => Math.random() - 0.5);
    const matchingStimuli = shuffled.slice(0, 4);

    // Add 4 matching trials
    matchingStimuli.forEach((correctIndex, trialNum) => {
        // Generate 3 incorrect choices (different from correct)
        const incorrectChoices = stimulusIndices
            .filter(idx => idx !== correctIndex)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);
        
        // Combine and shuffle all 4 choices
        const allChoices = [correctIndex, ...incorrectChoices].sort(() => Math.random() - 0.5);
        
        timeline.push({
            type: jsPsychAnimationMatching,
            stimulus_json: stimulusFile,
            correct_index: correctIndex,
            choice_indices: allChoices,
            title: `Matching ${trialNum + 1} of 4`,
            prompt: instructions.matchingPrompt,
            button_label: 'Continue',
            cell_size: 150,
            animation_duration: 3000,
            audio_recordings: function() {
                const allData = jsPsych.data.get();
                const synthTrials = allData.filter({trial_type: 'img-synth-response-anim'});
                // Check for truthy audio_url to skip tutorial trials (which have null audio_url)
                const trial = synthTrials.values().find(t => 
                    t.stimulus_index === correctIndex && t.audio_url
                );
                return trial ? [trial.audio_url] : [null];
            },
            data: { study_phase: "matching_trial", trial_number: trialNum + 1 }
        });
    });
    //#endregion

    const transitionToExitSurvey = {
        type: jsPsychHtmlButtonResponse,
        stimulus: "Answer a few final questions to complete the study.",
        choices: ['Continue'],
        on_load: function () {
            const buttons = document.querySelectorAll('.jspsych-btn');
            buttons.forEach(btn => btn.disabled = true);
            setTimeout(function () {
                buttons.forEach(btn => btn.disabled = false);
            }, 1000);
        }
    }
    timeline.push(transitionToExitSurvey);

    //#region EXIT SURVEY
    const exitSurvey1 = {
        type: jsPsychHtmlSliderResponse,
        stimulus: '<p>How enjoyable did you find the task?</p>',
        labels: ['1<br>Not at all', '2', '3', '4', '5', '6', '7', '8', '9', '10<br>Very much'],
        min: 1,
        max: 10,
        slider_start: 5,
        step: 1,
        slider_width: 500,
        require_movement: true,
        data: { study_phase: "exit_survey", question: "enjoyment" }
    };

    const exitSurvey2 = {
        type: jsPsychHtmlSliderResponse,
        stimulus: '<p>How comfortable did you feel with the sound-making tool you used?</p>',
        labels: ['1<br>Not at all', '2', '3', '4', '5', '6', '7', '8', '9', '10<br>Very much'],
        min: 1,
        max: 10,
        slider_start: 5,
        step: 1,
        slider_width: 500,
        require_movement: true,
        data: { study_phase: "exit_survey", question: "comfort" }
    };

    const exitSurvey3 = {
        type: jsPsychHtmlSliderResponse,
        stimulus: '<p>How much did you think about <b>how well your sound matched the clip</b> when you created your sounds?</p>',
        labels: ['1<br>Not at all', '2', '3', '4', '5', '6', '7', '8', '9', '10<br>Very much'],
        min: 1,
        max: 10,
        slider_start: 5,
        step: 1,
        slider_width: 500,
        require_movement: true,
        data: { study_phase: "exit_survey", question: "matching_focus" }
    };

    const exitSurvey4 = {
        type: jsPsychHtmlSliderResponse,
        stimulus: '<p>How much did you think about <b>how pleasing or enjoyable your sounds were</b> when you created your sounds?</p>',
        labels: ['1<br>Not at all', '2', '3', '4', '5', '6', '7', '8', '9', '10<br>Very much'],
        min: 1,
        max: 10,
        slider_start: 5,
        step: 1,
        slider_width: 500,
        require_movement: true,
        data: { study_phase: "exit_survey", question: "aesthetics_focus" }
    };

    const musicalExperience = {
        type: jsPsychHtmlSliderResponse,
        stimulus: '<p>How many years of formal musical training (lessons, classes, etc.) have you had?</p>',
        labels: ['0<br>No musical training', '', '2', '', '4', '', '6', '', '8', '', '10+'],
        min: 0,
        max: 10,
        slider_start: 0,
        step: 1,
        slider_width: 500,
        require_movement: true,
        data: { study_phase: "exit_survey", question: "musical_experience" }
    };

    timeline.push(exitSurvey1, exitSurvey2, exitSurvey3, exitSurvey4, musicalExperience);
    //#endregion

    jsPsych.run(timeline);
}
