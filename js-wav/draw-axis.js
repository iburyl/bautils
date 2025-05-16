"use strict";

function drawTimeAxisX(signalWindow, specCanvasWindow, tickLen, labelPadding, ctx) {
    // X-axis
    ctx.beginPath();
    ctx.moveTo(specCanvasWindow.x, specCanvasWindow.y);
    ctx.lineTo(specCanvasWindow.x + specCanvasWindow.width, specCanvasWindow.y);
    ctx.stroke();

    // Draw time ticks and labels
    const numTimeTicks = 10;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i <= numTimeTicks; i++) {
        const x = specCanvasWindow.x + (i / numTimeTicks) * specCanvasWindow.width;
        const time = signalWindow.start + (i / numTimeTicks) * signalWindow.duration;
        
        // Draw tick
        ctx.beginPath();
        ctx.moveTo(x, specCanvasWindow.y);
        ctx.lineTo(x, specCanvasWindow.y + tickLen);
        ctx.stroke();

        // Draw label
        ctx.fillText(time.toFixed(3) + 's', x, specCanvasWindow.y + tickLen + labelPadding);
    }
}

function drawFreqAxisY(signalWindow, specCanvasWindow, tickLen, labelPadding, ctx) {
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(specCanvasWindow.x, specCanvasWindow.y - specCanvasWindow.height);
    ctx.lineTo(specCanvasWindow.x, specCanvasWindow.y);
    ctx.stroke();

    // Draw frequency ticks and labels
    const numFreqTicks = 8;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const freqWidth = signalWindow.maxFreq - signalWindow.minFreq;

    let digits = (signalWindow.maxFreq > 15)?0:1;

    for (let i = 0; i <= numFreqTicks; i++) {
        const y = specCanvasWindow.y - (i / numFreqTicks) * specCanvasWindow.height;
        const freq = signalWindow.minFreq + (i / numFreqTicks) * freqWidth;
        
        // Draw tick
        ctx.beginPath();
        ctx.moveTo(specCanvasWindow.x - tickLen, y);
        ctx.lineTo(specCanvasWindow.x, y);
        ctx.stroke();

        // Draw label
        ctx.fillText(freq.toFixed(digits) + 'kHz', specCanvasWindow.x - tickLen - labelPadding, y);
    }
}
