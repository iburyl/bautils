"use strict";

document.addEventListener('DOMContentLoaded', () => {
    const paramStart= document.getElementById('start');
    const paramStop= document.getElementById('stop');

    // Add file navigation button handlers
    document.getElementById('prevFile').addEventListener('click', function() {
        window.navigateToFile(-1);
    });

    document.getElementById('nextFile').addEventListener('click', function() {
        window.navigateToFile(1);
    });

    document.getElementById('updateButton').addEventListener('click', async () => {
        showFile();
    });

    document.getElementById('resetButton').addEventListener('click', async () => {
        fireNewAudioEvent();
        showFile();
    });

    document.getElementById('zoom_peak').addEventListener('click', function () {
        const signalWindow = window.sharedSignalWindow;

        const sampleRate = signalWindow.sampleRate;
        const numFrames = window.sharedData.timeData.data.length;
        const framesPerSec = window.sharedSignalWindow.duration / numFrames;
        
        const {specData, timeData, freqData} = window.sharedData;
        const peak = calculatePeak(sampleRate, specData.data, freqData.data);

        let left  = peak.box.leftFrame;
        let right = peak.box.rightFrame;

        let len = right - left;
        if( len < numFrames / 20 ) len = Math.ceil(numFrames / 100);

        let leftBound = Math.max(0, left - len*3);
        let rightBound = Math.min(numFrames-1, right + len*3);

        paramStart.value = (signalWindow.start + leftBound * framesPerSec).toFixed(4);
        paramStop.value = (signalWindow.start + rightBound * framesPerSec).toFixed(4);

        fireSignalWindowUpdateEvent();
        showFile();
    });

    function moveCoeff(coeff)
    {
        const left = Math.max(0, window.sharedSignalWindow.start + window.sharedSignalWindow.duration*coeff);
        paramStart.value = left.toFixed(4);
        paramStop.value = Math.min(window.sharedSignalWindow.fullDuration, left + window.sharedSignalWindow.duration).toFixed(4);
        fireSignalWindowUpdateEvent();
        showFile();
    }
    
    document.getElementById('move_left_fast').addEventListener('click', function () {
        moveCoeff(-1);
    });

    document.getElementById('move_left').addEventListener('click', function () {
        moveCoeff(-1/5);
    });

    document.getElementById('move_right').addEventListener('click', function () {
        moveCoeff(+1/5);
    });

    document.getElementById('move_right_fast').addEventListener('click', function () {
        moveCoeff(+1);
    });

    document.getElementById('zoom_in').addEventListener('click', function () {
        paramStart.value = Math.max(0, (window.sharedSignalWindow.start + window.sharedSignalWindow.duration/3).toFixed(4));
        paramStop.value = Math.min(window.sharedSignalWindow.fullDuration, (window.sharedSignalWindow.stop - window.sharedSignalWindow.duration/3).toFixed(4));

        fireSignalWindowUpdateEvent();
        showFile();
    });

    document.getElementById('zoom_out').addEventListener('click', function () {
        paramStart.value = Math.max(0, (window.sharedSignalWindow.start - window.sharedSignalWindow.duration).toFixed(4));
        paramStop.value = Math.min(window.sharedSignalWindow.fullDuration, (window.sharedSignalWindow.stop + window.sharedSignalWindow.duration).toFixed(4));

        fireSignalWindowUpdateEvent();
        showFile();
    });

    
    function setCanvasRatio(ratio)
    {
        mainCanvas.width = Math.floor(500*ratio);
        mainCanvas.height = 500;

        fireSignalWindowUpdateEvent();
        showFile();

        mainCanvas.style.width = mainCanvas.width + 'px';
        mainCanvas.style.height = mainCanvas.height + 'px';
    }

    document.getElementById('ratio_1_1').addEventListener('click', function () {
        setCanvasRatio(1);
    });

    document.getElementById('ratio_3_2').addEventListener('click', function () {
        setCanvasRatio(3/2);
    });

    document.getElementById('ratio_max').addEventListener('click', function () {
        setCanvasRatio(1600/500);
    });
}); 
