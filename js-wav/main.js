"use strict";

async function loadFile()
{
    const file = window.sharedFile;
    if (!file) {
        alert('Please select a WAV file first');
        return;
    }

    try {
        const arrayBuffer = await file.arrayBuffer();

        let {audioContext, info} = getAudioContext(arrayBuffer);
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        window.sharedAudioBuffer = audioBuffer;
        window.sharedAudioInfo   = info;

        fireNewAudioEvent();
    } 
    catch (error) {
        console.error('Error processing audio:');
        console.error(error);
        alert('Error processing audio file');
    }
}

function updateMainImage()
{
    const infoDiv = document.getElementById('info');
    const info = window.sharedAudioInfo;
    const file = window.sharedFile;
    const ctx = window.ctx;

    if(window.sharedData) {
        const {specData, timeData, freqData} = window.sharedData;

        const {image, specCanvasWindow} = drawSpectrogram(specData, timeData, freqData, window.sharedSignalWindow, params.main.minE.read(), ctx);

        window.sharedMainImage = image;
        window.sharedSpecCanvasWindow = specCanvasWindow;

        let summary = '<table>';
        summary += tableLine('Source:', file.name);
        if(info.duration) summary += tableLine('Duration:', info.duration.toFixed(2) + 's');
        if(info.sampleRate) summary += tableLine('Sampling rate:', (info.sampleRate/1000).toFixed(0) + 'KHz');
        if(info.dataFormat) summary += tableLine('Data format:', info.dataFormat);
        if(info.bitsPerSample) summary += tableLine('Bits per sample:', info.bitsPerSample);
        if(info.numChannels) summary += tableLine('Channels:', info.numChannels);
        if(info.guan)
        {
            summary += '<tr><td colspan=2><center>GUANO</center></td></tr>';
            info.guan.forEach((value,key) => {
                summary += tableLine(key, value);
            })

        }
        if(info.ixml)
        {
            summary += '<tr><td colspan=2><center>iXML</center></td></tr>';
            info.ixml.forEach((value,key) => {
                summary += tableLine(key, value);
            })

        }
        summary += '</table>';
    
        infoDiv.innerHTML = summary;
    }
}

function updatePeakOverlay()
{
    const peakStatsDiv = document.getElementById('peak_stats');

    if(window.sharedData) {
        console.log('ping 1');

        const signalWindow = window.sharedSignalWindow;
        const sampleRate = signalWindow.sampleRate;
        const specCanvasWindow = window.sharedSpecCanvasWindow;
        const image = window.sharedMainImage;
        const ctx = window.ctx;

        const {specData, timeData, freqData} = window.sharedData;

        const peak = calculatePeak(sampleRate, specData.data, freqData.data);

        const {overlayImage} = drawPeaksOverlay([peak],
            getSignalWindowMapping(sampleRate, specData.data.length, specData.data[0].length, signalWindow), specCanvasWindow, image, ctx, specData);

        window.sharedPeakImage = overlayImage;

        function addStats(name, div, peakData, signalWindow, numFrames, numBins)
        {
            getBoxStats(peakData);

            const binToKHz = 1 / numBins * signalWindow.sampleRate / 1000;
            
            let framesPerSec = signalWindow.duration / numFrames;
            div.innerHTML =
                '<table>' +
                tableLine(name, ''  ) +
                tableLine('Min mag. from peak:',  (peakData.box.magnitudeDrop).toFixed(1) + ' dB '  ) + 
                tableLine('Noise mag. from peak:',  (peakData.box.noiseThreshold).toFixed(1) + ' dB '  ) + 
                tableLine('Time (start):',  (signalWindow.start + peakData.box.left * framesPerSec).toFixed(4) + ' s' ) + 
                tableLine('Dur (duration):',  ((peakData.box.right - peakData.box.left) * framesPerSec).toFixed(4) + ' s  '  ) + 
                tableLine('Start to peak mag.:',  ( (peakData.frame - peakData.box.left) / (peakData.box.right - peakData.box.left) ).toFixed(2)  ) + 
                tableLine('Fmax (highest frequency):', (peakData.box.maxFreq * binToKHz).toFixed(1) + ' KHz  ' ) + 
                tableLine('FME (frequency of most energy):', (peakData.bin * binToKHz).toFixed(1) + ' KHz  '  ) + 
                tableLine('Fmean (mean frequency):', (peakData.box.meanFreq * binToKHz).toFixed(1) + ' KHz  '  ) + 
                tableLine('Fmin (lowest frequency):', (peakData.box.minFreq * binToKHz).toFixed(1) + ' KHz  ' ) + 
                '</table>';
        }
        
        addStats('Found peak', peakStatsDiv, peak, window.sharedSignalWindow, window.sharedData.timeData.data.length, window.sharedData.specData.data[0].length);
    }
}

function showCurrentImage()
{
    const peakTab = document.getElementById('peak-stats');
    const ctx = window.ctx;

    if(peakTab.classList.contains('active'))
    {
        console.log('ping 2');
        window.sharedImage = window.sharedPeakImage;
    }
    else
    {
        window.sharedImage = window.sharedMainImage;
    }
    ctx.putImageData(window.sharedImage, 0, 0);
}

function showFile()
{
    const peakTab = document.getElementById('peak-stats');
    const ctx = window.ctx;
    const peakStatsDiv = document.getElementById('peak_stats');
    const audioElement = document.getElementById('audioPlayer');

    //const file = fileInput.files[0];
    const file = window.sharedFile;
    if (!file) {
        alert('Please select a WAV file first');
        return;
    }

    try {
        const audioBuffer = window.sharedAudioBuffer;

        const sampleRate = audioBuffer.sampleRate;
        const duration   = audioBuffer.duration;

        const {signalWindow, params} = getUserParams(sampleRate, duration);
        window.sharedSignalWindow = signalWindow;

        // Generate spectrogram
        window.sharedData = generateSpectrogram(params.fftSize, params.hopSize, signalWindow, params, audioBuffer);

        updateMainImage();
        updatePeakOverlay();
        showCurrentImage();

        audioElement.currentTime = signalWindow.start;
    } 
    catch (error) {
        console.error('Error processing audio:');
        console.error(error);
        alert('Error processing audio file');
    }
}
