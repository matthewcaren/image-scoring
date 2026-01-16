gs = {
    study_metadata: {
        project: "image-scoring", // mongo dbname
        experiment: "image-scoring-pilot", // mongo colname
        version: '1.0.0',
        study_description: 'generating sounds from visual cues',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toISOString().split('T')[1].split('.')[0],
    },
    session_info: {
        condition: undefined,
        stimulus: undefined,
        send_data: undefined
    },
    prolific_info: {
        prolificPID: undefined,
        prolificStudyID: undefined,
        prolificSessionID: undefined
    }
}