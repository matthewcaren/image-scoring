gs = {
    study_metadata: {
        project: "image-scoring", // mongo dbname
        experiment: "image-scoring-pilot", // mongo colname
        iteration: "pilot",
        version: '1.0.0',
        study_description: 'generating sounds from visual cues',
        date: new Date().toISOString().split('T')[0],
        dev_mode: false,// Change this to TRUE if testing in dev mode or FALSE for real experiment
    },
    session_timing: { // placeholders for jspsych to write
        // startInstructionTS: undefined,
        // startPracticeTS: undefined,
        // startPreTS: undefined,
        // startMainTS: undefined,
        // startPostTS: undefined,
        // startSurveyTS: undefined,
        experiment_start: undefined, //Date.now(),
        consent_start: undefined,
        consent_complete: undefined,
        instructions_start: undefined,
        instructions_complete: undefined,
        preload_complete: undefined,
        main_task_start: undefined,
        main_task_complete: undefined,
        exit_survey_start: undefined,
        experiment_complete: undefined,
    },
    session_info: {
        gameID: undefined,
        participantID: undefined,
        numTrials: undefined,
        agentOrderCondition: undefined,
        colorOrderCondition: undefined,
        damageOrderCondition: undefined,
        trials: undefined,
        send_data: undefined
    },
    prolific_info: {
        prolificPID: undefined,
        prolificStudyID: undefined,
        prolificSessionID: undefined
    }
}