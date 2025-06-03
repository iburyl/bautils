"use strict";

document.addEventListener('DOMContentLoaded', () => {
    const mainCanvas = document.getElementById('mainCanvas');
    const audioElement = document.getElementById('audioPlayer');
    const ctx = mainCanvas.getContext('2d', { willReadFrequently: true });
    const selectTab = document.getElementById('selection');


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
                
                const startX = Math.min(dragStartX, x);
                const stopX = Math.max(dragStartX, x);
                const topY = window.sharedSpecCanvasWindow.y - window.sharedSpecCanvasWindow.height;
                const bottomY = window.sharedSpecCanvasWindow.y;
                
                if(selectTab.classList.contains('active'))
                {
                    // Box selection for selection tab
                    const startY = Math.min(dragStartY, y);
                    const stopY = Math.max(dragStartY, y);
                    
                    ctx.strokeStyle = 'white';
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    
                    // Draw selection box
                    ctx.beginPath();
                    ctx.rect(startX, startY, stopX - startX, stopY - startY);
                    ctx.fill();
                    ctx.stroke();
                    
                    ctx.setLineDash([]);
                }
                else
                {
                    // Original vertical line selection for other tabs
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                
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

        // Reset canvas and update
        isDragging = false;
        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        ctx.putImageData(window.sharedImage, 0, 0);

        if(stopTime - startTime < 0.001) return;

        if(!selectTab.classList.contains('active'))
        {
            // Set the values in the input fields
            paramStart.value = startTime.toFixed(4);
            paramStop.value = stopTime.toFixed(4);
        
            // Update the display
            fireSignalWindowUpdateEvent();
            showFile();
        }
        else
        {
            // Calculate frequency boundaries for box selection
            const startY = Math.min(dragStartY, y);
            const stopY = Math.max(dragStartY, y);
            
            const freqRange = window.sharedSignalWindow.maxFreq - window.sharedSignalWindow.minFreq;
            const startFreq = window.sharedSignalWindow.minFreq + 
                ((window.sharedSpecCanvasWindow.y - stopY) / window.sharedSpecCanvasWindow.height) * freqRange;
            const stopFreq = window.sharedSignalWindow.minFreq + 
                ((window.sharedSpecCanvasWindow.y - startY) / window.sharedSpecCanvasWindow.height) * freqRange;

            // Set the values in the input fields
            params.selection.start.value = startTime.toFixed(4);
            params.selection.stop.value = stopTime.toFixed(4);
            params.selection.min_freq.value = startFreq.toFixed(1);
            params.selection.max_freq.value = stopFreq.toFixed(1);

            // Create selection box object
            const selectionBox = {
                startX: Math.min(dragStartX, x),
                stopX: Math.max(dragStartX, x),
                startY: Math.min(dragStartY, y),
                stopY: Math.max(dragStartY, y)
            };

            // Draw selection overlay
            const {overlayImage} = drawSelectionOverlay(
                window.sharedData.specData,
                getSignalWindowMapping(window.sharedAudioBuffer.sampleRate, 
                    window.sharedData.specData.data.length, 
                    window.sharedData.specData.data[0].length, 
                    window.sharedSignalWindow),
                window.sharedSpecCanvasWindow,
                selectionBox,
                window.sharedMainImage,
                ctx
            );

            // Update the display
            window.sharedImage = overlayImage;
            ctx.putImageData(overlayImage, 0, 0);
        }
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
