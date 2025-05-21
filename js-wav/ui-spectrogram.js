"use strict";

document.addEventListener('DOMContentLoaded', () => {
    const mainCanvas = document.getElementById('mainCanvas');
    const audioElement = document.getElementById('audioPlayer');
    const ctx = mainCanvas.getContext('2d', { willReadFrequently: true });

    window.ctx = ctx;

    // Set canvas size
    mainCanvas.width = 1600;
    mainCanvas.height = 500;

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.classList.add('tooltip');
    document.body.appendChild(tooltip);

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    mainCanvas.addEventListener('mousedown', (e) => {
        if (!window.sharedSpecCanvasWindow || !window.sharedSignalWindow) return;

        const rect = mainCanvas.getBoundingClientRect();
        const cssToCanvasScale = mainCanvas.width / rect.width;
        const x = (e.clientX - rect.left) * cssToCanvasScale;
        const y = (e.clientY - rect.top) * cssToCanvasScale;

        // Check if mouse is within the spectrogram area
        if (x >= window.sharedSpecCanvasWindow.x &&
            x <= window.sharedSpecCanvasWindow.x + window.sharedSpecCanvasWindow.width &&
            y >= window.sharedSpecCanvasWindow.y - window.sharedSpecCanvasWindow.height &&
            y <= window.sharedSpecCanvasWindow.y) {
            
            isDragging = true;
            dragStartX = x;
            dragStartY = y;
        }
    });

    mainCanvas.addEventListener('mousemove', (e) => {
        if (!window.sharedSpecCanvasWindow || !window.sharedSignalWindow) return;

        const rect = mainCanvas.getBoundingClientRect();
        const cssToCanvasScale = mainCanvas.width / rect.width;
        const x = (e.clientX - rect.left) * cssToCanvasScale;
        const y = (e.clientY - rect.top) * cssToCanvasScale;

        // Check if mouse is within the spectrogram area
        if (x >= window.sharedSpecCanvasWindow.x &&
            x <= window.sharedSpecCanvasWindow.x + window.sharedSpecCanvasWindow.width &&
            y >= window.sharedSpecCanvasWindow.y - window.sharedSpecCanvasWindow.height &&
            y <= window.sharedSpecCanvasWindow.y) {
            
            // Calculate time and frequency
            const time = window.sharedSignalWindow.start + 
                ((x - window.sharedSpecCanvasWindow.x) / window.sharedSpecCanvasWindow.width) * window.sharedSignalWindow.duration;
            
            const freqRange = window.sharedSignalWindow.maxFreq - window.sharedSignalWindow.minFreq;
            const freq = window.sharedSignalWindow.minFreq + 
                ((window.sharedSpecCanvasWindow.y - y) / window.sharedSpecCanvasWindow.height) * freqRange;

            // Update tooltip position and content
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + window.scrollX + 10) + 'px';
            tooltip.style.top = (e.clientY + window.scrollY + 10) + 'px';
            tooltip.textContent = `Time: ${time.toFixed(4)}s, Freq: ${freq.toFixed(1)}kHz`;

            // Draw selection rectangle while dragging
            if (isDragging) {
                const ctx = mainCanvas.getContext('2d');
                ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
                ctx.putImageData(window.sharedImage, 0, 0);
                
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                
                // Draw only vertical lines for time selection
                const startX = Math.min(dragStartX, x);
                const stopX = Math.max(dragStartX, x);
                const topY = window.sharedSpecCanvasWindow.y - window.sharedSpecCanvasWindow.height;
                const bottomY = window.sharedSpecCanvasWindow.y;
                
                // Left vertical line
                ctx.beginPath();
                ctx.moveTo(startX, topY);
                ctx.lineTo(startX, bottomY);
                ctx.stroke();
                
                // Right vertical line
                ctx.beginPath();
                ctx.moveTo(stopX, topY);
                ctx.lineTo(stopX, bottomY);
                ctx.stroke();
                
                ctx.setLineDash([]);
            }
        } else {
            tooltip.style.display = 'none';
        }
    });

    mainCanvas.addEventListener('mouseup', (e) => {
        if (!isDragging || !window.sharedSpecCanvasWindow || !window.sharedSignalWindow) return;

        const rect = mainCanvas.getBoundingClientRect();
        const cssToCanvasScale = mainCanvas.width / rect.width;
        const x = (e.clientX - rect.left) * cssToCanvasScale;
        const y = (e.clientY - rect.top) * cssToCanvasScale;

        // Calculate start and stop times
        const startX = Math.min(dragStartX, x);
        const stopX = Math.max(dragStartX, x);
        
        const startTime = window.sharedSignalWindow.start + 
            ((startX - window.sharedSpecCanvasWindow.x) / window.sharedSpecCanvasWindow.width) * window.sharedSignalWindow.duration;
        const stopTime = window.sharedSignalWindow.start + 
            ((stopX - window.sharedSpecCanvasWindow.x) / window.sharedSpecCanvasWindow.width) * window.sharedSignalWindow.duration;

        // Set the values in the input fields
        paramStart.value = startTime.toFixed(4);
        paramStop.value = stopTime.toFixed(4);
        
        // Reset canvas and update
        isDragging = false;
        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        ctx.putImageData(window.sharedImage, 0, 0);
        
        // Update the display
        fireSignalWindowUpdateEvent();
        showFile();
    });

    mainCanvas.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
        if (isDragging) {
            isDragging = false;
            ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
            ctx.putImageData(window.sharedImage, 0, 0);
        }
    });

    const paramStart= document.getElementById('start');
    const paramStop= document.getElementById('stop');
    
    audioElement.addEventListener('timeupdate', () => {
        
        drawPlaybackLine(audioElement.currentTime, window.sharedSignalWindow, window.sharedSpecCanvasWindow, window.sharedImage, ctx);

        if(audioElement.currentTime > window.sharedSignalWindow.start + window.sharedSignalWindow.duration)
        {
            audioElement.pause();
            audioElement.currentTime = window.sharedSignalWindow.start;
        }
    });
}); 
