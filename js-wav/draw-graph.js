"use strict";

// Draw favicon in upper right corner
const favicon_image = new Image();
let favicon_read = false;
favicon_image.onload = function() { favicon_read = true; };
favicon_image.src = favicon_base64;

function drawSpectrogramWindow(firstFrame, lastFrame, firstBin, lastBin, specCanvasWindow, specData, minE, ctx) {
    let numFrames = lastFrame - firstFrame;
    let numBins   = lastBin - firstBin;

    // Pre-calculate values to avoid repeated calculations
    const framesPerPixel = Math.max(Math.floor(numFrames / specCanvasWindow.width), 1);
    const binsPerPixel = Math.max(Math.floor(numBins / (specCanvasWindow.height-1)), 1);
    const minLog = minE;
    const logMaxValue = Math.log(specData.maxValue);
    const logRange = logMaxValue - minLog;
    
    // Create ImageData for direct pixel manipulation (much faster than fillRect)
    const imageData = ctx.createImageData(specCanvasWindow.width, specCanvasWindow.height);
    const data = imageData.data;

    for(let x = 0; x < specCanvasWindow.width; x++) {
        const firstPixelFrame = firstFrame + Math.floor(x * numFrames / specCanvasWindow.width);
        
        for(let y = 0; y < specCanvasWindow.height-1; y++) {
            const firstPixelBin = firstBin + Math.floor(y * numBins / specCanvasWindow.height);
            
            let value = specData.data[firstPixelFrame][firstPixelBin];

            // Aggregate values if multiple bins/frames per pixel
            if(framesPerPixel * binsPerPixel > 1) {
                for(let xx = 0; xx < framesPerPixel; xx++) {
                    for(let yy = 0; yy < binsPerPixel; yy++) {
                        value = Math.max(value, specData.data[firstPixelFrame + xx][firstPixelBin + yy]);
                    }
                }
            }

            // Normalize value
            let normalizedValue = Math.log(value);
            if(normalizedValue < minLog) normalizedValue = minLog;
            normalizedValue = (normalizedValue - minLog) / logRange;

            // Convert to RGB using magnitudeToRGBDark function
            const rgbColor = magnitudeToRGBDarkArray(normalizedValue, 0, 1);
            
            // Calculate pixel index (note: y is flipped for canvas coordinates)
            const pixelIndex = ((specCanvasWindow.height - 1 - y) * specCanvasWindow.width + x) * 4;
            
            // Set RGBA values directly
            data[pixelIndex] = rgbColor[0];       // Red
            data[pixelIndex + 1] = rgbColor[1];   // Green  
            data[pixelIndex + 2] = rgbColor[2];   // Blue
            data[pixelIndex + 3] = 255; // Alpha (fully opaque)
        }
    }
    
    // Draw the entire ImageData at once (much faster than individual fillRect calls)
    ctx.putImageData(imageData, specCanvasWindow.x, specCanvasWindow.y - specCanvasWindow.height);
}

function drawTimeWindow(firstFrame, lastFrame, timeCanvasWindow, timeData, ctx) {
    let numFrames = lastFrame - firstFrame;

    const framesPerPixel = Math.max(Math.floor(numFrames / timeCanvasWindow.width), 1);

    ctx.fillStyle = magnitudeToRGBDark(0, 0, 1);
    ctx.fillRect(timeCanvasWindow.x, timeCanvasWindow.y-timeCanvasWindow.height, timeCanvasWindow.width, timeCanvasWindow.height);

    const bar_color = magnitudeToRGBDark(1, 0, 1);

    ctx.fillStyle = bar_color;

    for(let x=0; x<timeCanvasWindow.width; x++) {
        let firstPixelFrame = firstFrame + Math.floor(x * numFrames / timeCanvasWindow.width);

        let value = timeData.data[firstPixelFrame];

        if(framesPerPixel > 1)
        {
            for(let xx=0; xx<framesPerPixel; xx++) {
                value = Math.max(value, timeData.data[firstPixelFrame + xx]);
            }
        }

        const normalizedValue = (value - timeData.minValue)/(timeData.maxValue - timeData.minValue);
        const barHeight = normalizedValue*timeCanvasWindow.height;

        ctx.fillRect(timeCanvasWindow.x+x, timeCanvasWindow.y-barHeight, 1, barHeight);
    }
}

function drawFreqWindow(firstBin, lastBin, freqCanvasWindow, freqData, ctx) {
    let numBins   = lastBin - firstBin;

    const binsPerPixel = Math.max(Math.floor(numBins / freqCanvasWindow.height), 1);

    ctx.fillStyle = magnitudeToRGBDark(0, 0, 1);
    ctx.fillRect(freqCanvasWindow.x, freqCanvasWindow.y-freqCanvasWindow.height+1, freqCanvasWindow.width, freqCanvasWindow.height);

    const bar_color = magnitudeToRGBDark(1, 0, 1);

    ctx.fillStyle = bar_color;

    for(let y=0; y<freqCanvasWindow.height; y++) {
        let firstPixelBin = firstBin + Math.floor(y * numBins / freqCanvasWindow.height);

        let value = freqData.data[firstPixelBin];

        if(binsPerPixel > 1)
        {
            for(let yy=0; yy<binsPerPixel; yy++) {
                value = Math.max(value, freqData.data[firstPixelBin + yy]);
            }
        }

        const normalizedValue = (value - freqData.minValue)/(freqData.maxValue - freqData.minValue);
        const barWidth = normalizedValue*freqCanvasWindow.width;

        ctx.fillRect(freqCanvasWindow.x, freqCanvasWindow.y - y, barWidth, 1);
    }
}

function drawSpectrogram(specData, timeData, freqData, signalWindow, minE, ctx) {
    const duration = signalWindow.duration;
    const sampleRate = signalWindow.sampleRate;

    // Constants for axis drawing
    const AXIS_Y_PADDING = 50;
    const AXIS_X_PADDING = 30;
    const TICK_LENGTH = 5;
    const LABEL_PADDING = 5;

    const AXIS_X_TIME_PADDING = 60;
    const AXIS_Y_FREQ_PADDING = 60;

    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const numFrames = specData.data.length;
    const numBins = specData.data[0].length;

    // Calculate spectrogram dimensions
    const spectrogramWidth = width - AXIS_Y_PADDING - AXIS_Y_FREQ_PADDING;
    const spectrogramHeight = height - AXIS_X_PADDING - AXIS_X_TIME_PADDING;
    const spectrogramX = AXIS_Y_PADDING;
    const spectrogramY = height - AXIS_X_PADDING;

    const timeWidth = spectrogramWidth;
    const timeHeight = AXIS_X_TIME_PADDING;
    const timeX = spectrogramX;
    const timeY = AXIS_X_TIME_PADDING;

    const freqWidth = AXIS_Y_FREQ_PADDING;
    const freqHeight = spectrogramHeight;
    const freqX = spectrogramX + spectrogramWidth;
    const freqY = spectrogramY;

    let specCanvasWindow = {x: spectrogramX, y:spectrogramY, width:spectrogramWidth, height:spectrogramHeight};
    let timeCanvasWindow = {x: timeX, y: timeY, width:timeWidth, height:timeHeight};
    let freqCanvasWindow = {x: freqX+1, y: freqY, width:freqWidth, height:freqHeight};

    // Clear mainCanvas
    ctx.clearRect(0, 0, width, height);
    // Fill background with white color to avoid transparent background when saving
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width, height);


    const binsPerKHz = numBins/sampleRate*1000;
    
    const firstBin = Math.floor(signalWindow.minFreq * binsPerKHz);
    const lastBin = Math.min(firstBin + Math.floor((signalWindow.maxFreq - signalWindow.minFreq) * binsPerKHz), numBins);

    // Use the optimized version for performance comparison
    // Change this line to switch between versions:
    drawSpectrogramWindow(0, numFrames, firstBin, lastBin, specCanvasWindow, specData, minE, ctx);  // Original
    drawTimeWindow(0, numFrames, timeCanvasWindow, timeData, ctx);
    drawFreqWindow(firstBin, lastBin, freqCanvasWindow, freqData, ctx);

    // Draw axes
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
            
    ctx.font = '10px Arial';
    ctx.fillStyle = `#000`;

    drawTimeAxisX(signalWindow, specCanvasWindow, TICK_LENGTH, LABEL_PADDING, ctx);
    drawFreqAxisY(signalWindow, specCanvasWindow, TICK_LENGTH, LABEL_PADDING, ctx);

    if(favicon_read) {
        const margin = 1; // Margin from edges
        const faviconSize = freqWidth - margin*2; // Size of the favicon
        const x = width - freqWidth - margin + 2 ;
        const y = margin - 1;

        // Apply grayscale filter and set opacity
        ctx.filter = 'grayscale(100%) invert(100%)';
        ctx.globalAlpha = 0.15;
        ctx.drawImage(favicon_image, x, y, faviconSize, faviconSize);
        
        // Reset filter and opacity back to defaults
        ctx.filter = 'none';
        ctx.globalAlpha = 1.0;
    }

    return {image: ctx.getImageData(0, 0, width, height), specCanvasWindow: specCanvasWindow};
}
