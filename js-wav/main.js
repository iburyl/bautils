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

function showFile()
{
    const infoDiv = document.getElementById('info');
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
        /*
        const arrayBuffer = await file.arrayBuffer();

        let {audioContext, info} = getAudioContext(arrayBuffer);
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        window.sharedAudioBuffer = audioBuffer;
        */

        const audioBuffer = window.sharedAudioBuffer;
        const info = window.sharedAudioInfo;

        const sampleRate = audioBuffer.sampleRate;
        const duration   = audioBuffer.duration;

        const {signalWindow, params} = getUserParams(sampleRate, duration);

        // Generate spectrogram
        window.sharedData = generateSpectrogram(params.fftSize, params.hopSize, signalWindow, params, audioBuffer);
        const {specData, timeData, freqData, peak, foundPeaks} = window.sharedData;

        // Draw spectrogram with axes
        const {image, specCanvasWindow} = drawSpectrogram(specData, timeData, freqData, foundPeaks, signalWindow, params.minE, ctx);
        const {overlayImage} = drawPeaksOverlay([peak],
            getSignalWindowMapping(sampleRate, specData.data.length, specData.data[0].length, signalWindow), specCanvasWindow, image, ctx, specData);

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

        window.sharedMainImage = image;
        window.sharedPeakImage = overlayImage;
        window.sharedSpecCanvasWindow = specCanvasWindow;
        window.sharedSignalWindow = signalWindow;

        if(peakTab.classList.contains('active'))
        {
            window.sharedImage = window.sharedPeakImage;
        }
        else
        {
            window.sharedImage = window.sharedMainImage;
        }
        ctx.putImageData(window.sharedImage, 0, 0);

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
        
        addStats('Found peak', peakStatsDiv, window.sharedData.peak, window.sharedSignalWindow, window.sharedData.timeData.data.length, window.sharedData.specData.data[0].length);

        audioElement.currentTime = signalWindow.start;
    } 
    catch (error) {
        console.error('Error processing audio:');
        console.error(error);
        alert('Error processing audio file');
    }
}
