function renderAmoebaClip(jsonString, canvas) {
    const animationData = JSON.parse(jsonString);
    const ctx = canvas.getContext('2d');
    
    const AMOEBA_BASE_RADIUS = 50;
    const BUMP_FREQUENCY = 10;
    const BUMP_MAX_AMPLITUDE = 0.3;
    
    // Use anim_length from JSON
    const animDuration = animationData.anim_length || 3000;
    
    let animationFrame = null;
    let isRunning = true;
    let animationStartTime = null;

    // Helper: lerp
    const lerp = (start, end, t) => start + (end - start) * t;

    // Helper: color string to RGB array
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

    // Helper: RGB to HSV
    const rgbToHsv = (r, g, b) => {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        
        let h = 0;
        if (delta !== 0) {
            if (max === r) {
                h = ((g - b) / delta) % 6;
            } else if (max === g) {
                h = (b - r) / delta + 2;
            } else {
                h = (r - g) / delta + 4;
            }
            h *= 60;
            if (h < 0) h += 360;
        }
        
        const s = max === 0 ? 0 : delta / max;
        const v = max;
        
        return [h, s, v];
    };

    // Helper: HSV to RGB
    const hsvToRgb = (h, s, v) => {
        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;
        
        let r, g, b;
        if (h < 60) {
            [r, g, b] = [c, x, 0];
        } else if (h < 120) {
            [r, g, b] = [x, c, 0];
        } else if (h < 180) {
            [r, g, b] = [0, c, x];
        } else if (h < 240) {
            [r, g, b] = [0, x, c];
        } else if (h < 300) {
            [r, g, b] = [x, 0, c];
        } else {
            [r, g, b] = [c, 0, x];
        }
        
        return [
            Math.round((r + m) * 255),
            Math.round((g + m) * 255),
            Math.round((b + m) * 255)
        ];
    };

    // Helper: Interpolate colors in HSV color space
    const lerpColor = (color1, color2, t) => {
        const c1 = parseColor(color1);
        const c2 = parseColor(color2);
        
        const hsv1 = rgbToHsv(c1[0], c1[1], c1[2]);
        const hsv2 = rgbToHsv(c2[0], c2[1], c2[2]);
        
        // Interpolate hue by choosing shorter path around color wheel
        let h1 = hsv1[0];
        let h2 = hsv2[0];
        let hDiff = h2 - h1;
        
        if (hDiff > 180) {
            h1 += 360;
        } else if (hDiff < -180) {
            h2 += 360;
        }
        
        const h = (lerp(h1, h2, t) % 360 + 360) % 360;
        const s = lerp(hsv1[1], hsv2[1], t);
        const v = lerp(hsv1[2], hsv2[2], t);
        
        return hsvToRgb(h, s, v);
    };

    // Get interpolated animation parameters at time t (0 to 1)
    const getAnimationParams = (t) => {
        const start = animationData.start_state;
        const end = animationData.end_state;
        
        return {
            color: start.color === end.color 
                ? parseColor(start.color)
                : lerpColor(start.color, end.color, t),
            aspect_ratio: lerp(start.aspect_ratio, end.aspect_ratio, t),
            irregularity: lerp(start.irregularity, end.irregularity, t)
        };
    };

    // Draw amoeba shape
    const drawAmoeba = (ctx, centerX, centerY, params) => {
        const { color, aspect_ratio, irregularity } = params;
        const baseRadius = AMOEBA_BASE_RADIUS;
        const numPoints = 128;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(aspect_ratio, 1.0);
        
        ctx.beginPath();
        
        for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            let radius = baseRadius;
            
            // Add irregularity (random round displacement)
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
        
        // Handle both RGB arrays and color names
        const rgb = Array.isArray(color) ? color : parseColor(color);
        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        ctx.fill();
        
        ctx.restore();
    };

    // Draw progress bar on canvas
    const drawProgressBar = (ctx, canvas, progress) => {
        const barHeight = 2;
        const barWidth = canvas.width * progress;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, canvas.height - barHeight, barWidth, barHeight);
    };

    // Render a single frame
    const renderFrame = (progress) => {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const params = getAnimationParams(progress);
        drawAmoeba(ctx, centerX, centerY, params);
        drawProgressBar(ctx, canvas, progress);
    };

    // Animation loop
    const animate = () => {
        if (!isRunning) return;
        
        const elapsed = performance.now() - animationStartTime;
        const progress = Math.min(elapsed / animDuration, 1.0);
        
        renderFrame(progress);
        
        if (progress < 1.0) {
            animationFrame = requestAnimationFrame(animate);
        }
    };

    // Start animation
    animationStartTime = performance.now();
    animate();

    // Return control object
    return {
        stop: () => {
            isRunning = false;
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
                animationFrame = null;
            }
        }
    };
}
