# Audio-Amoeba Matching Experiment

A jsPsych plugin for audio-visual matching experiments using animated amoeba shapes.

## Files

- `jspsych-audio-amoeba-match.js` - The main jsPsych plugin
- `amoeba-renderer.js` - The animation rendering engine
- `experiment-demo.html` - A working example/demo

## Features

- **Audio playback**: Play audio clips from buffer data with a styled play button
- **3x3 animation grid**: Display 9 animated amoeba shapes simultaneously
- **Interactive selection**: Click to select an animation
- **Visual feedback**: Selected animation is highlighted with a blue border
- **Data collection**: Records selected choice, correctness, and response time

## Usage

### 1. Include the required files in your HTML:

```html
<script src="https://unpkg.com/jspsych@7.3.4"></script>
<link href="https://unpkg.com/jspsych@7.3.4/css/jspsych.css" rel="stylesheet" />
<script src="amoeba-renderer.js"></script>
<script src="jspsych-audio-amoeba-match.js"></script>
```

### 2. Create a trial:

```javascript
const trial = {
    type: jsPsychAudioAmoebaMatch,
    audio: {
        type: "Buffer",
        data: [26, 69, 223, ...] // Your audio buffer data
    },
    choices: [
        {
            start_state: {
                irregularity: 0,
                aspect_ratio: 0.2,
                color: "red"
            },
            end_state: {
                irregularity: 0.4,
                aspect_ratio: 0.2,
                color: "red"
            },
            correct_answer: false
        },
        // ... 8 more choices for 3x3 grid
    ],
    anim_length: 3000,  // Animation duration in ms
    canvas_size: 200,   // Size of each canvas in pixels
    prompt: 'Listen to the audio and select the matching animation'
};
```

## Plugin Parameters

- **audio** (required): Object with `type: "Buffer"` and `data: [array of bytes]`
- **choices** (required): Array of 9 choice objects, each with:
  - `start_state`: Initial animation state (irregularity, aspect_ratio, color)
  - `end_state`: Final animation state
  - `correct_answer`: Boolean indicating if this is the correct choice
- **anim_length** (optional): Animation duration in milliseconds (default: 3000)
- **canvas_size** (optional): Size of each animation canvas in pixels (default: 200)
- **prompt** (optional): Instruction text displayed at top

## Animation Parameters

Each animation state includes:
- **irregularity**: 0-1, controls bumpiness of the amoeba shape
- **aspect_ratio**: 0.2-1, controls width of the amoeba
- **color**: String color name (red, green, blue, yellow, purple, orange, cyan, magenta)

## Data Collected

Each trial records:
- `selected_choice`: Index of the selected animation (0-8)
- `correct`: Boolean indicating if the correct choice was selected
- `rt`: Response time in milliseconds

## Running the Demo

1. Open `experiment-demo.html` in a web browser
2. Note: The demo uses placeholder audio data - you'll need to replace it with actual audio buffer data from your audio files

## Next Steps

To use with real data:
1. Load your audio files and convert them to buffer format
2. Create multiple trials with different audio/choice combinations
3. Customize styling as needed
4. Add practice trials, feedback, etc.

## Notes

- Audio must be in webm format as buffer data
- The 3x3 grid requires exactly 9 choices
- Animations loop continuously until the participant advances
- All animations are synchronized to start at the same time
