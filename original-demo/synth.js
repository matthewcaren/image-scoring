// CONSTANTS
const NOTE_LENGTH = 1.5; // duration in seconds
const MIN_FREQ = 110;    // minimum frequency in hz
const MAX_FREQ = 880;    // maximum frequency in hz
const MIN_FILTER_FREQ = 100;   // minimum filter cutoff in Hz
const MAX_FILTER_FREQ = 10000; // maximum filter cutoff in Hz
const CIRCLE_SIZE_START = 12; // px
const CIRCLE_SIZE_END = 20;  // px


// init audio context on user interaction
let audioContext;
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Legato synth state
let legatoState = {
    active: false,
    oscillator: null,
    filter: null,
    masterGain: null,
    currentFrequency: 440,
    currentFilterCutoff: 1000
};

// function to start legato synth
function startLegatoSynth(frequency, filterCutoff) {
    if (legatoState.active) return;
    
    initAudio();
    legatoState.active = true;
    
    // Create sawtooth oscillator
    legatoState.oscillator = audioContext.createOscillator();
    legatoState.oscillator.type = 'sawtooth';
    legatoState.oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    
    // Create lowpass filter
    legatoState.filter = audioContext.createBiquadFilter();
    legatoState.filter.type = 'lowpass';
    legatoState.filter.frequency.setValueAtTime(filterCutoff, audioContext.currentTime);
    legatoState.filter.Q.setValueAtTime(1, audioContext.currentTime); // resonance
    
    // Create gain node
    legatoState.masterGain = audioContext.createGain();
    legatoState.masterGain.gain.setValueAtTime(0.3, audioContext.currentTime);
    
    // Build audio graph
    legatoState.oscillator.connect(legatoState.filter);
    legatoState.filter.connect(legatoState.masterGain);
    legatoState.masterGain.connect(audioContext.destination);
    
    // Start oscillator
    legatoState.oscillator.start();
    
    // Store current parameters
    legatoState.currentFrequency = frequency;
    legatoState.currentFilterCutoff = filterCutoff;
}

// function to update legato synth parameters
function updateLegatoSynth(frequency, filterCutoff) {
    if (!legatoState.active) return;
    
    const now = audioContext.currentTime;
    const glideTime = 0.05; // 50ms glide between notes
    
    // Update frequency with glide
    legatoState.oscillator.frequency.linearRampToValueAtTime(frequency, now + glideTime);
    
    // Update filter cutoff
    legatoState.filter.frequency.linearRampToValueAtTime(filterCutoff, now + glideTime);
    
    legatoState.currentFrequency = frequency;
    legatoState.currentFilterCutoff = filterCutoff;
}

// function to stop legato synth
function stopLegatoSynth() {
    if (!legatoState.active) return;
    
    const now = audioContext.currentTime;
    const fadeTime = 0.1; // 100ms fade out
    
    // Fade out smoothly
    legatoState.masterGain.gain.cancelScheduledValues(now);
    legatoState.masterGain.gain.setValueAtTime(legatoState.masterGain.gain.value, now);
    legatoState.masterGain.gain.linearRampToValueAtTime(0, now + fadeTime);
    
    // Schedule oscillator stop after fade completes
    if (legatoState.oscillator) {
        legatoState.oscillator.stop(now + fadeTime);
    }
    
    // Clean up after fade
    setTimeout(() => {
        legatoState.oscillator = null;
        legatoState.active = false;
    }, fadeTime * 1000 + 50);
}

// function to play a lowpass filtered sawtooth note (discrete mode)
function playNote(frequency = 440, filterCutoff = 1000) {
    initAudio();
    
    // create sawtooth oscillator
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    
    // create lowpass filter
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterCutoff, audioContext.currentTime);
    filter.Q.setValueAtTime(1, audioContext.currentTime); // resonance
    
    // create gain node
    const masterGain = audioContext.createGain();
    
    // set master volume and fade out
    masterGain.gain.setValueAtTime(0.3, audioContext.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + NOTE_LENGTH);
    
    // build audio graph
    oscillator.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(audioContext.destination);
    
    // start and stop the oscillator
    oscillator.start();
    oscillator.stop(audioContext.currentTime + NOTE_LENGTH);
}


// synth circle management
const activeCircles = [];
let legatoCircle = null; // single circle for legato mode

class Circle {
    constructor(x, y, isLegato = false) {
        this.x = x;
        this.y = y;
        this.opacity = 1;
        this.active = true;
        this.isLegato = isLegato;
        this.radius = CIRCLE_SIZE_START;
    }

    update() {
        const assumed_fps = 40;

        if (this.isLegato) {
            // Legato mode: no fading, no expanding
            return;
        }
        
        // Discrete mode: expand and fade
        const totalExpandPixels = CIRCLE_SIZE_END - CIRCLE_SIZE_START;
        const expandStep = (totalExpandPixels / (NOTE_LENGTH * assumed_fps));
        this.radius += expandStep;

        const fadeStep = (1 / (NOTE_LENGTH * assumed_fps));
        this.opacity -= fadeStep;
        if (this.opacity <= 0) {
            this.active = false;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 0, 0, ${this.opacity})`;
        ctx.fill();
    }
}

// animation frame handler for all circles
function animateCircles() {
    const canvas = document.getElementById('instrumentCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // draw legato circle first if active
    if (legatoCircle) {
        legatoCircle.draw(ctx);
    }
    
    // update and draw all active circles
    for (let i = activeCircles.length - 1; i >= 0; i--) {
        const circle = activeCircles[i];
        circle.update();
        
        if (circle.active) {
            circle.draw(ctx);
        } else {
            activeCircles.splice(i, 1);
        }
    }
    
    // continue animation if there are active circles or legato circle
    if (activeCircles.length > 0 || legatoCircle) {
        requestAnimationFrame(animateCircles);
    }
}

// helper to add a new circle
function addCircle(x, y) {
    const circle = new Circle(x, y);
    activeCircles.push(circle);
    
    // start animation loop if this is the first circle
    if (activeCircles.length === 1) {
        requestAnimationFrame(animateCircles);
    }
}

// event listener for mouse down (both discrete and legato modes)
document.getElementById('instrumentCanvas').addEventListener('mousedown', (event) => {
    const legatoCheckbox = document.getElementById('legatoCheckbox');
    const isLegato = legatoCheckbox ? legatoCheckbox.checked : false;
    
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // calculate frequency (log scale) and filter cutoff (log scale)
    const normalizedX = x / canvas.width;
    const logFrequency = MIN_FREQ * Math.pow(2, Math.log2(MAX_FREQ/MIN_FREQ) * normalizedX);
    const normalizedY = 1 - y / canvas.height; // invert so higher = brighter
    const logFilterCutoff = MIN_FILTER_FREQ * Math.pow(MAX_FILTER_FREQ/MIN_FILTER_FREQ, normalizedY);
    
    if (isLegato) {
        // Legato mode: create following circle and start continuous sound
        legatoCircle = new Circle(x, y, true);
        
        // start animation loop if needed
        if (activeCircles.length === 0) {
            requestAnimationFrame(animateCircles);
        }
        
        startLegatoSynth(logFrequency, logFilterCutoff);
    } else {
        // Discrete mode: add expanding/fading circle and play note
        addCircle(x, y);
        playNote(logFrequency, logFilterCutoff);
    }
});

// Legato mode: mouse up stops continuous sound
document.getElementById('instrumentCanvas').addEventListener('mouseup', (event) => {
    const legatoCheckbox = document.getElementById('legatoCheckbox');
    const isLegato = legatoCheckbox ? legatoCheckbox.checked : false;
    if (!isLegato) return;
    
    legatoCircle = null; // remove legato circle
    stopLegatoSynth();
});

// Also stop legato if mouse leaves canvas
document.getElementById('instrumentCanvas').addEventListener('mouseleave', (event) => {
    const legatoCheckbox = document.getElementById('legatoCheckbox');
    const isLegato = legatoCheckbox ? legatoCheckbox.checked : false;
    if (!isLegato) return;
    
    legatoCircle = null; // remove legato circle
    stopLegatoSynth();
});


// mouse tracking + event listener for spacebar to play note at last mouse position
let lastMouseX = null;
let lastMouseY = null;
const instrumentCanvas = document.getElementById('instrumentCanvas');
instrumentCanvas.addEventListener('mousemove', (event) => {
    const rect = instrumentCanvas.getBoundingClientRect();
    lastMouseX = event.clientX - rect.left;
    lastMouseY = event.clientY - rect.top;
    
    // Update moving tick marks
    const movingXTick = document.querySelector('.moving-x-tick');
    const movingYTick = document.querySelector('.moving-y-tick');
    
    // Check if mouse is within canvas bounds
    if (lastMouseX >= 0 && lastMouseX <= instrumentCanvas.width &&
        lastMouseY >= 0 && lastMouseY <= instrumentCanvas.height) {
        movingXTick.style.opacity = '1';
        movingYTick.style.opacity = '1';
        movingXTick.style.left = `${lastMouseX}px`;
        movingYTick.style.top = `${lastMouseY + 75}px`; // Add header height + controls offset
    } else {
        movingXTick.style.opacity = '0';
        movingYTick.style.opacity = '0';
    }
    
    // In legato mode, update synth parameters and circle position while holding mouse down
    const legatoCheckbox = document.getElementById('legatoCheckbox');
    const isLegato = legatoCheckbox ? legatoCheckbox.checked : false;
    if (isLegato && legatoState.active) {
        const normalizedX = lastMouseX / instrumentCanvas.width;
        const logFrequency = MIN_FREQ * Math.pow(2, Math.log2(MAX_FREQ/MIN_FREQ) * normalizedX);
        const normalizedY = 1 - lastMouseY / instrumentCanvas.height;
        const logFilterCutoff = MIN_FILTER_FREQ * Math.pow(MAX_FILTER_FREQ/MIN_FILTER_FREQ, normalizedY);
        updateLegatoSynth(logFrequency, logFilterCutoff);
        
        // Update legato circle position to follow mouse
        if (legatoCircle) {
            legatoCircle.x = lastMouseX;
            legatoCircle.y = lastMouseY;
        }
    }
});

instrumentCanvas.addEventListener('mouseleave', () => {
    const movingXTick = document.querySelector('.moving-x-tick');
    const movingYTick = document.querySelector('.moving-y-tick');
    movingXTick.style.opacity = '0';
    movingYTick.style.opacity = '0';
});

document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        const canvas = instrumentCanvas;
        
        // only make sound if we have a valid mouse position inside the canvas (with 2px border)
        const borderWidth = 5;
        const isMouseInCanvas = lastMouseX !== null && lastMouseY !== null && 
            lastMouseX >= borderWidth && lastMouseX <= canvas.width - borderWidth &&
            lastMouseY >= borderWidth && lastMouseY <= canvas.height - borderWidth;
            
        if (isMouseInCanvas) {
            addCircle(lastMouseX, lastMouseY);
            // calculate frequency and filter cutoff based on position
            const normalizedX = lastMouseX / canvas.width;
            const logFrequency = MIN_FREQ * Math.pow(2, Math.log2(MAX_FREQ/MIN_FREQ) * normalizedX);
            const normalizedY = 1 - lastMouseY / canvas.height;
            const logFilterCutoff = MIN_FILTER_FREQ * Math.pow(MAX_FILTER_FREQ/MIN_FILTER_FREQ, normalizedY);
            playNote(logFrequency, logFilterCutoff);
        }
    }
});