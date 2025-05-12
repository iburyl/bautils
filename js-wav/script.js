"use strict";

const tableLine = (name, value) => {return '<tr><td>' + name + '</td><td>' + value + '</td></tr>';};

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('wavFile');
    const mainCanvas = document.getElementById('mainCanvas');
    const audioElement = document.getElementById('audioPlayer');
    const ctx = mainCanvas.getContext('2d', { willReadFrequently: true });
    const infoDiv = document.getElementById('info');
    const peakStatsDiv = document.getElementById('peak_stats');

    const peakTab = document.getElementById('peak-stats');

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.display = 'none';
    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '5px 10px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '12px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '1000';
    document.body.appendChild(tooltip);

    // Add mouse move handler for tooltip
    mainCanvas.addEventListener('mousemove', (e) => {
        if (!sharedSpecCanvasWindow || !sharedSignalWindow) return;

        const rect = mainCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if mouse is within the spectrogram area
        if (x >= sharedSpecCanvasWindow.x &&
            x <= sharedSpecCanvasWindow.x + sharedSpecCanvasWindow.width &&
            y >= sharedSpecCanvasWindow.y - sharedSpecCanvasWindow.height &&
            y <= sharedSpecCanvasWindow.y) {
            
            // Calculate time and frequency
            const time = sharedSignalWindow.start + 
                ((x - sharedSpecCanvasWindow.x) / sharedSpecCanvasWindow.width) * sharedSignalWindow.duration;
            
            const freqRange = sharedSignalWindow.maxFreq - sharedSignalWindow.minFreq;
            const freq = sharedSignalWindow.minFreq + 
                ((sharedSpecCanvasWindow.y - y) / sharedSpecCanvasWindow.height) * freqRange;

            // Update tooltip position and content
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 10) + 'px';
            tooltip.style.top = (e.clientY + 10) + 'px';
            tooltip.textContent = `Time: ${time.toFixed(4)}s, Freq: ${freq.toFixed(1)}kHz`;
        } else {
            tooltip.style.display = 'none';
        }
    });

    mainCanvas.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });

    const paramStart= document.getElementById('start');
    const paramStop= document.getElementById('stop');
    const paramMinFreq= document.getElementById('min_freq');
    const paramMaxFreq= document.getElementById('max_freq');
    const paramFFT = document.getElementById('fft');
    const paramHop = document.getElementById('hop');
    const paramMinE= document.getElementById('min_e');
    const paramKaiserBeta = document.getElementById('kaiser_beta');
    const paramPeakMinFreq= document.getElementById('peak_min_freq');
    const paramPeakMaxFreq= document.getElementById('peak_max_freq');
    
    // Set canvas size
    mainCanvas.width = 1600;
    mainCanvas.height = 500;

    let sharedFile;
    let sharedImage;
    let sharedMainImage;
    let sharedPeakImage;

    let sharedSpecCanvasWindow;
    let sharedSignalWindow;
    let sharedAudioBuffer;
    let sharedData;

    audioElement.addEventListener('timeupdate', () => {
        
        drawPlaybackLine(audioElement.currentTime, sharedSignalWindow, sharedSpecCanvasWindow, sharedImage, ctx);

        if(audioElement.currentTime > sharedSignalWindow.start + sharedSignalWindow.duration)
        {
            audioElement.pause();
            audioElement.currentTime = sharedSignalWindow.start;
        }
    });

    
    function zeroFFT() {
        paramFFT.value = "";
        paramHop.value = "";
    }

    paramStart.addEventListener('change', function() {zeroFFT();} );
    paramStop.addEventListener('change', function() {zeroFFT();} );
    paramMinFreq.addEventListener('change', function() {zeroFFT();} );
    paramMaxFreq.addEventListener('change', function() {zeroFFT();} );
    
    function getUserParams(sampleRate, duration)
    {
        if(paramStart.value == "") paramStart.value = 0;
        if(paramStop.value == "") paramStop.value = duration - Number(paramStart.value);
        if(paramMinFreq.value == "") paramMinFreq.value = 0;
        if(paramMaxFreq.value == "") paramMaxFreq.value = sampleRate / 1000 / 2;

        let userStart =    Number(paramStart.value);
        let userStop  =    Number(paramStop.value);
        let userDuration = Math.min(userStop - userStart, duration);
        let userMinFreq =  Number(paramMinFreq.value);
        let userMaxFreq =  Number(paramMaxFreq.value);
        let userFreqDiff = userMaxFreq - userMinFreq;

        let pixelWidth = mainCanvas.width;
        let userPoints = userDuration * sampleRate;

        const targetFFT = Math.sqrt((sampleRate*sampleRate * mainCanvas.height / mainCanvas.width * userDuration / userFreqDiff)) / 10;
        const targetFFT2based = Math.pow(2, Math.round(Math.log2(targetFFT)));
        const defaultFFT = Math.max(Math.min(targetFFT2based, 4096), 128);
        
        if(paramFFT.value == "") paramFFT.value = defaultFFT;
        if(paramHop.value == "") paramHop.value = Math.ceil(userPoints/pixelWidth/5);
        if(paramMinE.value == "") paramMinE.value = -5;
        if(paramKaiserBeta.value == "") paramKaiserBeta.value = 10;

        const fftSize = Number(paramFFT.value);
        let hopSize   = Number(paramHop.value);
        const minE    = Number(paramMinE.value);
        const kaiserBeta = Number(paramKaiserBeta.value);

        if(paramPeakMinFreq.value == "") paramPeakMinFreq.value = 10;

        let userPeakMinFreq =  Number(paramPeakMinFreq.value);
        let userPeakMaxFreq =  (paramPeakMaxFreq.value == "")?userMaxFreq:Number(paramPeakMaxFreq.value);

        return {
            signalWindow: {start: userStart, stop: userStop, duration: userDuration, minFreq: userMinFreq, maxFreq: userMaxFreq, freqDiff: userFreqDiff, sampleRate: sampleRate, fullDuration: duration},
            params: {fftSize: fftSize, estimatedFFTSize: targetFFT2based, hopSize: hopSize, minE: minE, kaiserBeta: kaiserBeta, peakMinFreq:userPeakMinFreq, peakMaxFreq: userPeakMaxFreq}
            };
    }
    
 
    async function showFile()
    {
        //const file = fileInput.files[0];
        const file = sharedFile;
        if (!file) {
            alert('Please select a WAV file first');
            return;
        }

        try {
            const arrayBuffer = await file.arrayBuffer();

            //const audioURL = URL.createObjectURL(arrayBuffer);
            //document.getElementById('audioPlayer').src = audioURL;

            let {audioContext, info} = getAudioContext(arrayBuffer, infoDiv);
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            sharedAudioBuffer = audioBuffer;

            const sampleRate = audioBuffer.sampleRate;
            const duration   = audioBuffer.duration;

            const {signalWindow, params} = getUserParams(sampleRate, duration);

            // Generate spectrogram
            sharedData = generateSpectrogram(params.fftSize, params.hopSize, signalWindow, params, audioBuffer, audioContext);
            const {specData, timeData, freqData, peak, foundPeaks} = sharedData;

            // Draw spectrogram with axes
            const {image, specCanvasWindow} = drawSpectrogram(specData, timeData, freqData, foundPeaks, signalWindow, params.minE, ctx);
            const {overlayImage} = drawPeaksOverlay([peak],
                getSignalWindowMapping(sampleRate, specData.data.length, specData.data[0].length, signalWindow), specCanvasWindow, image, ctx);

            let summary = '<table>';
            summary += tableLine('Source:', file.name);
            if(info.duration) summary += tableLine('Duration:', info.duration.toFixed(2) + 's');
            if(info.sampleRate) summary += tableLine('Sampling rate:', (info.sampleRate/1000).toFixed(0) + 'KHz');
            if(info.dataFormat) summary += tableLine('Data format:', info.dataFormat);
            if(info.bitsPerSample) summary += tableLine('Bits per sample:', info.bitsPerSample);
            if(info.numChannels) summary += tableLine('Channels:', info.numChannels);
            summary += '</table>';

            infoDiv.innerHTML = summary;

            function addStats(name, div, peakData, signalWindow, numFrames, numBins)
            {
                let framesPerSec = signalWindow.duration / numFrames;
                div.innerHTML =
                    '<table>' +
                    tableLine(name, ''  ) + 
                    tableLine('Time:',  (signalWindow.start + peakData.box.left_10 * framesPerSec).toFixed(4) + '-' + (signalWindow.start + peakData.box.right_10 * framesPerSec).toFixed(4) + ' s' ) + 
                    tableLine('Duration:',  ((peakData.box.right_10 - peakData.box.left_10) * framesPerSec).toFixed(4) + ' s  '  ) + 
                    tableLine('Start to peak mag.:',  ( (peakData.frame - peakData.box.left_10) / (peakData.box.right_10 - peakData.box.left_10) ).toFixed(2)  ) + 
                    tableLine('Left Freq:', (peakData.box.left_10_freq / numBins * signalWindow.sampleRate / 1000).toFixed(1) + ' KHz  ' ) + 
                    tableLine('Peak Freq:', (peakData.bin / numBins * signalWindow.sampleRate / 1000).toFixed(1) + ' KHz  '  ) + 
                    tableLine('Right Freq:', (peakData.box.right_10_freq / numBins * signalWindow.sampleRate / 1000).toFixed(1) + ' KHz  ' ) + 
                    '</table>';
            }
            
            addStats('Found peak', peakStatsDiv, peak, signalWindow, timeData.data.length, params.fftSize);

            sharedMainImage = image;
            sharedPeakImage = overlayImage;
            sharedSpecCanvasWindow = specCanvasWindow;
            sharedSignalWindow = signalWindow;

            if(peakTab.classList.contains('active'))
            {
                sharedImage = sharedPeakImage;
            }
            else
            {
                sharedImage = sharedMainImage;
            }
            ctx.putImageData(sharedImage, 0, 0);

            audioElement.currentTime = signalWindow.start;
        } 
        catch (error) {
            console.error('Error processing audio:');
            console.error(error);
            alert('Error processing audio file');
        }
    }
    
    fileInput.addEventListener('change', function() {
        const file = fileInput.files[0];
        if (!file) {
            return;
        }

        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

        zeroFFT();
        paramMinE.value = "";
        paramKaiserBeta.value = "";
        paramStart.value = "";
        paramStop.value = "";
        paramMinFreq.value = "";
        paramMaxFreq.value = "";

        const audioURL = URL.createObjectURL(file);
        document.getElementById('audioPlayer').src = audioURL;

        sharedFile = file;

        showFile();
    });


    document.getElementById('updateButton').addEventListener('click', async () => {
        showFile();
    });

    document.getElementById('resetButton').addEventListener('click', async () => {
        zeroFFT();
        paramMinE.value = "";
        paramKaiserBeta.value = "";
        paramStart.value = "";
        paramStop.value = "";
        paramMinFreq.value = "";
        paramMaxFreq.value = "";

        showFile();
    });

    document.getElementById('zoom_peak').addEventListener('click', function () {
        const numFrames = sharedData.timeData.data.length;
        const framesPerSec = sharedSignalWindow.duration / numFrames;
        
        let left  = sharedData.peak.box.leftFrame;
        let right = sharedData.peak.box.rightFrame;

        let len = right - left;
        if( len < numFrames / 20 ) len = Math.ceil(numFrames / 100);

        let leftBound = Math.max(0, left - len*3);
        let rightBound = Math.min(numFrames-1, right + len*3);

        paramStart.value = (sharedSignalWindow.start + leftBound * framesPerSec).toFixed(4);
        paramStop.value = (sharedSignalWindow.start + rightBound * framesPerSec).toFixed(4);
        zeroFFT();
        showFile();
    });

    function moveCoeff(coeff)
    {
        const left = Math.max(0, sharedSignalWindow.start + sharedSignalWindow.duration*coeff);
        paramStart.value = left.toFixed(4);
        paramStop.value = Math.min(sharedSignalWindow.fullDuration, left + sharedSignalWindow.duration).toFixed(4);
        zeroFFT();
        showFile();
    }
    
    document.getElementById('move_left_fast').addEventListener('click', function () {
        moveCoeff(-1);
    });

    document.getElementById('move_left').addEventListener('click', function () {
        moveCoeff(-1/3);
    });

    document.getElementById('move_right').addEventListener('click', function () {
        moveCoeff(+1/3);
    });

    document.getElementById('move_right_fast').addEventListener('click', function () {
        moveCoeff(+1);
    });

    document.getElementById('zoom_in').addEventListener('click', function () {
        paramStart.value = Math.max(0, (sharedSignalWindow.start + sharedSignalWindow.duration/3).toFixed(4));
        paramStop.value = Math.min(sharedSignalWindow.fullDuration, (sharedSignalWindow.stop - sharedSignalWindow.duration/3).toFixed(4));
        zeroFFT();
        showFile();
    });

    document.getElementById('zoom_out').addEventListener('click', function () {
        paramStart.value = Math.max(0, (sharedSignalWindow.start - sharedSignalWindow.duration).toFixed(4));
        paramStop.value = Math.min(sharedSignalWindow.fullDuration, (sharedSignalWindow.stop + sharedSignalWindow.duration).toFixed(4));
        zeroFFT();
        showFile();
    });

    
    function setCanvasRatio(ratio)
    {
        mainCanvas.width = Math.floor(500*ratio);
        mainCanvas.height = 500;

        zeroFFT();
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

    // Tab functionality
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            document.getElementById(button.dataset.tab).classList.add('active');

            if(peakTab.classList.contains('active'))
            {
                sharedImage = sharedPeakImage;
            }
            else
            {
                sharedImage = sharedMainImage;
            }
            ctx.putImageData(sharedImage, 0, 0);
            console.log('here');
        });
    });

}); 
