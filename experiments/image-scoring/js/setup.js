/* global io, initJsPsych, jsPsychBrowserCheck, jsPsychPreload, jsPsychInstructions, jsPsychSurvey, TangramPrepPlugin, TangramConstructPlugin, TangramAFCPlugin, TangramGridPlugin, TangramPrepWTargetsPlugin */
/*
 * setup.js
 *
 * Initialize jsPsych and trial timeline for tangram construction prepcook
 * experiments.
 *
 * SPA, 10/30/25, cogtoolslab
 */
import { getConsentInfo } from './consent.js';
import { getInstructions } from './instructions.js';

/**
 * REQUIRES: window, io and initJsPsych globals present; EXP_CONFIG valid
 * MODIFIES: none
 * EFFECTS: Requests stimuli from server and initializes experiment timeline
 */
export function setupExperiment(expConfig) {
    const startTime = new Date(Date.now());

    let prolificParams = getURLParams();
    prolificParams['startTime'] = startTime.toUTCString();

    // get stimuli from database
    let socket = io.connect();
    console.log("requesting stims");
    socket.emit("getStims", {
        proj_name: expConfig.dbname,
        exp_name: expConfig.collname,
        iter_name: expConfig.iterName,
    });
    socket.on("stims", (stimuliConfig) => {
        console.log("got stims, loading experiment");
        console.log(stimuliConfig);
        // gameId assigned by app.js
        let gameID = stimuliConfig.gameid;
        // todo: align with app.js / store.js (remove extra stuff)
        let allStims = stimuliConfig.stims;
        initRunTimeline(expConfig, gameID, allStims, prolificParams, socket);
    });
}

/**
 * REQUIRES: window.location is a valid URL
 * MODIFIES: none
 * EFFECTS: parse url params relevant to Prolific
 */
function getURLParams() {
    // https://stackoverflow.com/a/55127831
    let url = new URL(window.location.href);
    let urlParams = new URLSearchParams(url.search);

    // prolific params
    let urlParamConfig = {
        subjID: urlParams.get("PROLIFIC_PID") ?? undefined,
        studyID: urlParams.get("STUDY_ID") ?? undefined,
        sessionID: urlParams.get("SESSION_ID") ?? undefined,
    };
    return urlParamConfig;
}

/**
 *
 * REQUIRES:
 * MODIFIES: none
 * EFFECTS:  samples numTangrams from setStims such that primitive piece
 *           combinations are balanced. If not possible, falls back to
 *           unbalanced random sampling with warning.
 * @param {*} setStims
 * @param {*} numUniqueCombos
 * @param {*} numTangrams
 * @param {*} jsPsychInstance
 * @returns
 */
function sampleTangramsBalancedPrimitiveCombos(setStims, numUniqueCombos,
                                               numTangrams, jsPsychInstance) {
    // Helper function to get sorted tan kind combination string for a tangram
    function getTanKindCombination(tangram) {
        const kinds = tangram.solutionTans.map(tan => tan.kind);
        return kinds.sort().join(',');
    }

    // Group stimuli by their tan kind combinations
    const stimsByCombo = {};
    setStims.forEach(stim => {
        const combo = getTanKindCombination(stim);
        if (!stimsByCombo[combo]) {
            stimsByCombo[combo] = [];
        }
        stimsByCombo[combo].push(stim);
    });

    let selectedStims = [];

    // Check if numTangrams is divisible by numUniqueCombos
    if (numTangrams % numUniqueCombos !== 0) {
        console.error(`Warning: numTangrams (${numTangrams}) is not divisible by ` +
                     `numUniqueCombos (${numUniqueCombos}). Using unbalanced fallback.`);
        const shuffledStims = jsPsychInstance.randomization.shuffle(setStims);
        selectedStims = shuffledStims.slice(0, numTangrams);
        return selectedStims
    } else {
        // Calculate how many of each combination we need
        const stimsPerCombo = numTangrams / numUniqueCombos;

        // Shuffle stimuli within each combination group and select balanced subset
        const comboKeys = Object.keys(stimsByCombo);
        if (comboKeys.length !== numUniqueCombos) {
            console.error(`Warning: Found ${comboKeys.length} unique combinations ` +
                         `but expected ${numUniqueCombos}. Using unbalanced fallback.`);
            const shuffledStims = jsPsychInstance.randomization.shuffle(setStims);
            selectedStims = shuffledStims.slice(0, numTangrams);
            return selectedStims
        } else {
            comboKeys.forEach(combo => {
                const shuffledCombo = jsPsychInstance.randomization.shuffle(stimsByCombo[combo]);
                selectedStims.push(...shuffledCombo.slice(0, stimsPerCombo));
            });
            // Final shuffle to randomize order across combinations
            selectedStims = jsPsychInstance.randomization.shuffle(selectedStims);
            return selectedStims
        }
    }
}

/**
 * REQUIRES: initJsPsych, jsPsych plugins and socket available globally
 * MODIFIES: config.rng_seed
 * EFFECTS: configure jsPsych, build timeline and run experiment
 */
function initRunTimeline(expConfig, gameID, allStims, prolificParams, socket) {

    function emitData(data, extrafields, incrementalFlag = false) {
        // experiment-wide identifiers we want on every piece of data sent
        data['dbname'] = expConfig.dbname + '_output';
        data['collname'] = expConfig.collname;
        data['iterName'] = expConfig.iterName;
        data['prolific'] = prolificParams;
        data['gameID'] = gameID;
        data['incrementalData'] = incrementalFlag;
        data['expConfig'] = expConfig;
        if (extrafields) {
            for (const [key, value] of Object.entries(extrafields)) {
                data[key] = value;
            }
        }

        // Log payload size in KB and MB before sending to help identify size issues
        const BYTES_IN_KB = 1024;
        const payloadSize = JSON.stringify(data).length;
        const payloadSizeKB = (payloadSize / BYTES_IN_KB).toFixed(2);
        const payloadSizeMB = (payloadSize / (BYTES_IN_KB * BYTES_IN_KB)).toFixed(2);

        if (expConfig.devMode || !incrementalFlag) {
            console.log(`sending ${(incrementalFlag) ? 'incremental ' : 'trial '}data of size` +
                        ` ${payloadSizeKB} KB (${payloadSizeMB} MB):`, data);
        }
        socket.emit("currentData", data);
    }

    const jsPsych = initJsPsych({
        show_progress_bar: true,
        auto_update_progress_bar: false,
        message_progress_bar: '',
        on_finish: function() {
            // can't submit to prolific here because this runs when user fails browserCheck
            //window.location = `https://app.prolific.com/submissions/complete?cc=${expConfig.prolificCompletionCode}`;
        }
    });

    const consentInfo = getConsentInfo(expConfig);
    const instructions = getInstructions(expConfig);

    // generate and record random seed
    if (expConfig.rng_seed !== undefined && expConfig.rng_seed !== null) {
        jsPsych.randomization.setSeed(expConfig.rng_seed);
    } else {
        // weirdly, this is a string seed
        const rng_seed = jsPsych.randomization.setSeed();
        expConfig.rng_seed = rng_seed;
    }

    // randomize rotation and set label from nested allStims structure
    // Collect all valid rotation-setLabel combinations from expConfig
    const validCombinations = [];

    // Add patterned sets
    for (const [rotation, setLabels] of Object.entries(expConfig.patternedSets)) {
        for (const setLabel of setLabels) {
            validCombinations.push({
                rotation: rotation,
                setLabel: setLabel,
                condition: 'patterned',
                numUniqueCombos: expConfig.patternedUniqueCombinations
            });
        }
    }

    // Add control sets
    for (const [rotation, setLabels] of Object.entries(expConfig.controlSets)) {
        for (const setLabel of setLabels) {
            validCombinations.push({
                rotation: rotation,
                setLabel: setLabel,
                condition: 'control',
                numUniqueCombos: expConfig.controlUniqueCombinations
            });
        }
    }

    // Filter to only combinations that exist in allStims
    const availableCombinations = validCombinations.filter(combo => {
        const exists = allStims[combo.rotation] && allStims[combo.rotation][combo.setLabel];
        if (!exists) {
            console.error(`Warning: Rotation "${combo.rotation}" with setLabel "${combo.setLabel}" ` +
                         `specified in expConfig but not found in allStims from database.`);
        }
        return exists;
    });

    if (availableCombinations.length === 0) {
        console.error('Error: No valid rotation-setLabel combinations found in allStims that match expConfig!');
        throw new Error('No valid stimuli combinations available');
    }

    // Randomly select one combination
    const selectedCombo = jsPsych.randomization.sampleWithoutReplacement(availableCombinations, 1)[0];
    const selectedRotation = selectedCombo.rotation;
    const selectedSetLabel = selectedCombo.setLabel;
    const selectedCondition = selectedCombo.condition;
    const setStims = allStims[selectedRotation][selectedSetLabel];

    // randomize tan dock locations for this game == subject.
    const tanTypes = ["square", "parallelogram", "smalltriangle", "medtriangle", "largetriangle"];
    let tanDockOrder = jsPsych.randomization.shuffle(tanTypes);
    let tanColorOrder = jsPsych.randomization.shuffle([...Array(tanTypes.length).keys()]);

    // Utility to get data from last trial
    function getFromLastTrial(trialType, selector) {
        return jsPsych.data.get().filter({ trial_type: trialType }).last().select(selector).values[0];
    }

    // select numTangrams from setStims such that primitive combinations are balanced
    const numTangrams = expConfig.numRounds * expConfig.numTangramsInRound;
    const numUniqueCombos = selectedCombo.numUniqueCombos;
    const subjStims = sampleTangramsBalancedPrimitiveCombos(
        setStims,
        numUniqueCombos,
        numTangrams,
        jsPsych
    );

    // build timeline
    const tangramtrials = [];
    const TRIAL_ID_LENGTH = 32;

    // === Build study phase (tangram-grid) ===
    const shuffledStudyTangrams = jsPsych.randomization.shuffle(subjStims);
    const studyGridTrialID = jsPsych.randomization.randomID(TRIAL_ID_LENGTH);

    const studyGridRows = 3;
    const studyGridCols = 5;
    const studyGridTrial = {
        type: TangramGridPlugin,
        tangrams: shuffledStudyTangrams.slice(0, studyGridRows * studyGridCols),
        n_rows: studyGridRows,
        n_cols: studyGridCols,
        prompt_text: "What pattern or patterns do you notice in these shapes?",
        button_text: "Submit",
        show_tangram_decomposition: expConfig.showTangramDecomposition,
        use_primitive_colors: expConfig.primitiveColors,
        primitive_color_indices: tanColorOrder,
        on_load: function() {
            jsPsych.progressBar.progress = 1.0;
            const progressBarMsg = ``;
            document.querySelector('#jspsych-progressbar-container span').innerHTML = progressBarMsg;
        },
        onTrialEnd: (trialdata) => {
            let trialInfo = {
                condition: selectedCondition,
                rotation: selectedRotation,
                setLabel: selectedSetLabel,
                trialNum: 1,
                trialID: studyGridTrialID,
                phase: 'study',
                trialType: 'grid',
            };
            emitData(trialdata, trialInfo, false);
        }
    };

    // === Build all rounds ===
    let stim_offset = 0;
    for (let round_num = 1; round_num <= expConfig.numRounds; round_num++) {
        // FIXME: trial numbers here are off if study trials are included?
        const construct_trial_num = (round_num - 1) * 2 + 1;
        const prep_trial_num = (round_num - 1) * 2 + 2;

        const roundStims = subjStims.slice(stim_offset, stim_offset + expConfig.numTangramsInRound);
        stim_offset += expConfig.numTangramsInRound;

        const roundID = jsPsych.randomization.randomID(TRIAL_ID_LENGTH);
        const constructTrialID = jsPsych.randomization.randomID(TRIAL_ID_LENGTH);

        // Construct trial
        const constructTrial = {
            type: TangramConstructPlugin,
            tangrams: roundStims,
            primitive_order: tanDockOrder,
            quickstash_macros: (round_num === 1) ? [] : () => {
                const macros = getFromLastTrial('tangram-prep-wtargets', 'quickstashMacros');
                return macros;
            },
            show_tangram_decomposition: expConfig.showTangramDecomposition,
            use_primitive_colors_blueprints: expConfig.primitiveColors,
            use_primitive_colors_targets: expConfig.primitiveColors,
            primitive_color_indices: tanColorOrder,
            time_limit_ms: expConfig.constructTimeLimit * 1000,
            target: expConfig.targetMode,
            input: expConfig.inputMode,
            layout: expConfig.layout,
            instructions: "Make those shapes!",
            onInteraction: (event) => {
                let trialInfo = {
                    condition: selectedCondition,
                    rotation: selectedRotation,
                    setLabel: selectedSetLabel,
                    trialNum: construct_trial_num,
                    roundNum: round_num,
                    trialID: constructTrialID,
                    roundID: roundID,
                    phase: 'build',
                };
                emitData(event, trialInfo, true);
            },
            onTrialEnd: (trialdata) => {
                let trialInfo = {
                    condition: selectedCondition,
                    rotation: selectedRotation,
                    setLabel: selectedSetLabel,
                    trialNum: construct_trial_num,
                    roundNum: round_num,
                    trialID: constructTrialID,
                    roundID: roundID,
                    phase: 'build',
                };
                emitData(trialdata, trialInfo, false);
            },
            on_load: function() {
                jsPsych.progressBar.progress = round_num / expConfig.numRounds;
                const progressBarMsg = `Round ${round_num} / ${expConfig.numRounds}`;
                document.querySelector('#jspsych-progressbar-container span').innerHTML = progressBarMsg;
            }
        };
        tangramtrials.push(constructTrial);

        // Feedback trial
        if (expConfig.provideFeedback) {
            const feedbackTrial = {
                type: jsPsychConfetti,
                duration: expConfig.feedbackDuration,
                confetti_count: 300,
                show_button: false,
                positive: () => {
                    // Show positive feedback (confetti) if user completed all tangrams early
                    const constructEndReason = getFromLastTrial('tangram-construct', 'endReason');
                    return constructEndReason === 'auto_complete';
                },
                onTrialEnd: (trialdata) => {
                    let trialInfo = {
                        condition: selectedCondition,
                        rotation: selectedRotation,
                        setLabel: selectedSetLabel,
                        //trialNum: construct_trial_num,  // this is confusing
                        roundNum: round_num,
                        trialID: jsPsych.randomization.randomID(TRIAL_ID_LENGTH),
                        roundID: roundID,
                        phase: 'build',
                        trialType: 'feedback',
                    };
                    emitData(trialdata, trialInfo, false);
                }
            };
            tangramtrials.push(feedbackTrial);
        }

        // Prep trial
        const prepTrialID = jsPsych.randomization.randomID(TRIAL_ID_LENGTH);
        const prepTrial = {
            type: TangramPrepWTargetsPlugin,
            snapshot: () => {
                return getFromLastTrial('tangram-construct', 'finalSnapshot');
            },
            show_tangram_decomposition: expConfig.showTangramDecomposition,
            show_reconstructions: expConfig.showReconstructionsInPrep,
            primitive_order: tanDockOrder,
            primitive_color_indices: tanColorOrder,
            use_primitive_colors_blueprints: expConfig.primitiveColors,
            use_primitive_colors_reconstructions: expConfig.primitiveColors,
            num_quickstash_slots: expConfig.numQuickstashSlots,
            max_pieces_per_macro: expConfig.numTansInMacro,
            min_pieces_per_macro: 0,
            input: expConfig.inputMode,
            layout: expConfig.layout,
            require_all_slots: false,
            quickstash_macros: (round_num === 1) ? [] : () => {
                const macros = getFromLastTrial('tangram-construct', 'quickstashMacros');
                return macros;
            },
            instructions: `Prepare your piece${(expConfig.num_quickstash_slots > 1) ? 's' : ''}!`,
            onInteraction: (event) => {
                let trialInfo = {
                    condition: selectedCondition,
                    rotation: selectedRotation,
                    setLabel: selectedSetLabel,
                    trialNum: prep_trial_num,
                    roundNum: round_num,
                    trialID: prepTrialID,
                    roundID: roundID,
                    phase: 'build',
                };
                emitData(event, trialInfo, true);
            },
            onTrialEnd: (trialdata) => {
                let trialInfo = {
                    condition: selectedCondition,
                    rotation: selectedRotation,
                    setLabel: selectedSetLabel,
                    trialNum: prep_trial_num,
                    roundNum: round_num,
                    trialID: prepTrialID,
                    roundID: roundID,
                    phase: 'build',
                };
                emitData(trialdata, trialInfo, false);
            },
            on_load: function() {
                jsPsych.progressBar.progress = round_num / expConfig.numRounds;
                const progressBarMsg = `Round ${round_num} / ${expConfig.numRounds}`;
                document.querySelector('#jspsych-progressbar-container span').innerHTML = progressBarMsg;
            }
        };
        tangramtrials.push(prepTrial);
    }

    // Insert prep instructions after first construct trial
    const prepInstructions = {
        type: jsPsychInstructions,
        pages: instructions.firstPrepInstructions,
        show_clickable_nav: true,
        on_finish: (trialdata) => {
            emitData(trialdata, {'trialType': trialdata.trial_type}, false);
        }
    };
    const insertIndex = expConfig.provideFeedback ? 2 : 1;
    tangramtrials.splice(insertIndex, 0, prepInstructions);

    // === Build familiarity phase (AFC) ===
    const afcTrials = [];
    const macroPairs = [];
    for (let i = 0; i < expConfig.macros.length; i++) {
        for (let j = i + 1; j < expConfig.macros.length; j++) {
            macroPairs.push([expConfig.macros[i], expConfig.macros[j]]);
        }
    }

    // Shuffle the pairs order
    const shuffledPairs = jsPsych.randomization.shuffle(macroPairs);

    shuffledPairs.forEach((pair, index) => {
        const afcTrialID = jsPsych.randomization.randomID(TRIAL_ID_LENGTH);
        const trialNum = index + 1;

        // Randomize left/right
        const isLeft0 = jsPsych.randomization.sampleWithoutReplacement([true, false], 1)[0];
        const leftMacro = isLeft0 ? pair[0] : pair[1];
        const rightMacro = isLeft0 ? pair[1] : pair[0];

        const afcTrial = {
            type: TangramAFCPlugin,
            tangram_left: leftMacro,
            tangram_right: rightMacro,
            instructions: "Which arrangement of pieces did you see more often in the tangrams?",
            button_text_left: "This arrangement (Left)",
            button_text_right: "This arrangement (Right)",
            show_tangram_decomposition: expConfig.showTangramDecomposition,
            use_primitive_colors: expConfig.primitiveColors,
            primitive_color_indices: tanColorOrder,
            on_load: function() {
                jsPsych.progressBar.progress = trialNum / shuffledPairs.length;
                const progressBarMsg = `Trial ${trialNum} / ${shuffledPairs.length}`;
                document.querySelector('#jspsych-progressbar-container span').innerHTML = progressBarMsg;
            },
            onTrialEnd: (trialdata) => {
                let trialInfo = {
                    // FIXME: this should be saved by plugin!!
                    leftTangramID: leftMacro.tangramID,
                    rightTangramID: rightMacro.tangramID,
                    condition: selectedCondition,
                    rotation: selectedRotation,
                    setLabel: selectedSetLabel,
                    trialNum: trialNum,
                    trialID: afcTrialID,
                    phase: 'familiarity',
                    trialType: 'afc',
                };
                emitData(trialdata, trialInfo, false);
            }
        };
        afcTrials.push(afcTrial);
    });


    // browser info
    let browserCheck = {
        type: jsPsychBrowserCheck,
        minimum_width: expConfig.minBrowserWidth,
        minimum_height: expConfig.minBrowserHeight,
        allow_window_resize: true,
        inclusion_function: (data) => {
            return data.mobile === false;
        },
        exclusion_message: (data) => {
            return `<p>You must use a desktop or laptop computer, and have a window of minimum size,` +
                   ` to participate in this experiment.</p>`;
        },
        on_finish: (trialdata) => {
            emitData(trialdata, {'trialType': trialdata.trial_type}, false);
        }
    };

    /* preload images */
    const asset_imgs = [
        //'./assets/locked.png',
        //'./assets/unlocked.png',
        instructions.studyDemoPath,
        instructions.constructDemoPath,
        instructions.prepDemoPath
    ];
    //let allStimImgs = allStims.map((c) => [c.stimImgPath, c.stimSilhouetteImgPath]).flat();
    let preload = {
        type: jsPsychPreload,
        images: asset_imgs,
        on_finish: (trialdata) => {
            emitData(trialdata, {'trialType': trialdata.trial_type}, false);
        }
    };

    // consent and instructions
    let studyInstructionsTrial = {
        type: jsPsychInstructions,
        pages: instructions.studyInstructions,
        show_clickable_nav: true,
        on_finish: (trialdata) => {
            emitData(trialdata, {'trialType': trialdata.trial_type}, false);
        }
    };
    let buildInstructionsTrial = {
        type: jsPsychInstructions,
        pages: instructions.expInstructions,
        show_clickable_nav: true,
        // reset progress bar
        on_start: () => {
            jsPsych.progressBar.progress = 0;
            const progressBarMsg = ``;
            document.querySelector('#jspsych-progressbar-container span').innerHTML = progressBarMsg;
        },
        on_finish: (trialdata) => {
            emitData(trialdata, {'trialType': trialdata.trial_type}, false);
        }
    };

    // debrief trials
    let survey_pages = [
        { elements: consentInfo.commonSurveyQuestions },
    ];
    survey_pages.push(...instructions.experimentSurveyQuestions_pages.map(questions => ({ elements: questions })));
    const surveyTrial = {
        type: jsPsychSurvey,
        survey_json: {
            pages: survey_pages,
        },
        button_label_next: "Continue",
        on_finish: (trialdata) => {
            emitData(trialdata, {'trialType': trialdata.trial_type}, false);
        }
    };
    const debriefTrial = {
        type: jsPsychInstructions,
        pages: consentInfo.debriefInstructions,
        show_clickable_nav: true,
        allow_backward: false,
        allow_keys: false,
        button_label_next: "Submit!",
        // only submit with completion code if all timeline items completed
        on_finish: function(trialdata) {
            emitData(trialdata, {'trialType': trialdata.trial_type}, false);
            window.location.href = `https://app.prolific.com/submissions/complete?cc=${expConfig.prolificCompletionCode}`;
        }
    };
    const consentTrial = {
        type: jsPsychInstructions,
        pages: consentInfo.consentInstructions,
        show_clickable_nav: true,
        button_label_next: "I Agree",
        on_finish: (trialdata) => {
            emitData(trialdata, {'trialType': trialdata.trial_type}, false);
        }
    };

    const full_timeline = [
        browserCheck,
        preload,
        consentTrial,
        studyInstructionsTrial,
        studyGridTrial,
        buildInstructionsTrial,
        ...tangramtrials,
        ...afcTrials,
        surveyTrial,
        debriefTrial
    ];
    const dev_timeline = [
        studyGridTrial,
        ...tangramtrials,
        ...afcTrials
    ];

    if (expConfig.devMode) {
        console.log("DEV MODE: running dev timeline");
        jsPsych.run(dev_timeline);
        return;
    } else {
        jsPsych.run(full_timeline);
    }
}
