"use strict";

function getSignalWindowMapping(sampleRate, numFrames, numBins, signalWindow)
{
    const binsPerKHz = numBins/sampleRate*1000;
    const firstBin = Math.floor(signalWindow.minFreq * binsPerKHz);
    const lastBin = Math.min(firstBin + Math.floor((signalWindow.maxFreq - signalWindow.minFreq) * binsPerKHz), numBins);

    return {startFrame: 0, stopFrame: numFrames, firstBin:firstBin, lastBin:lastBin};
}

function generateSpectrogram(fftSize, hopSize, signalWindow, params, audioBuffer) {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = signalWindow.sampleRate;
    const kaiserBeta = params.kaiserBeta;
    const windowFunction = document.getElementById('window_function').value;

    // Process audio data in chunks
    let spectrogramData = [];
    let peakTime = [];
    let maxSpectrogramValue = 0;

    let start = Math.floor(signalWindow.start * sampleRate);
    let stop  = Math.min(Math.floor((signalWindow.start + signalWindow.duration) * sampleRate) + fftSize, channelData.length);

    // Create window based on selected function
    let window;
    switch (windowFunction) {
        case 'blackman-harris-7th':
            window = blackmanHarris7thOrderWindow(fftSize);
            break;
        case 'kaiser':
            window = kaiserWindow(fftSize, kaiserBeta);
            break;
        case 'none':
        default:
            window = new Array(fftSize).fill(1);
            break;
    }

    const numBins = fftSize+1;
    const binsPerKHz = numBins/sampleRate*1000;        
    const firstBin = Math.floor(signalWindow.minFreq * binsPerKHz);
    const lastBin = Math.min(firstBin + Math.floor((signalWindow.maxFreq - signalWindow.minFreq) * binsPerKHz), numBins);

    let minInTime;
    let maxInTime;

    // Pre-allocate reusable arrays to avoid repeated memory allocation
    const peakFreq = new Array(numBins).fill(0);
    const magnitude = new Array(numBins);
    const inputChunk = new Array(fftSize);
    
    // Reuse FFT object and complex array
    const fft = new FFT(fftSize);
    const complexArray = fft.createComplexArray();
    
    // Calculate number of frames beforehand for unit increment loop
    const numFrames = Math.floor((stop - start) / hopSize);
    
    for (let frame = 0; frame < numFrames; frame++) {
        const i = start + frame * hopSize;
        
        // Avoid array slice by copying data directly
        const remainingLength = Math.min(fftSize, channelData.length - i);
        if (remainingLength < fftSize) break;
        
        // Copy and apply window
        for(let j = 0; j < fftSize; j++) {
            inputChunk[j] = channelData[i + j] * window[j];
        }

        // Reuse existing FFT object and complex array
        fft.realTransform(complexArray, inputChunk);

        let frameBoundedPeak = 0;
        const isFirst = frame === 0;

        // Combined magnitude calculation and peak finding in single loop
        for(let j = 0; j < fftSize; j++) {
            const real = complexArray[j * 2];
            const imag = complexArray[j * 2 + 1];
            const mag = Math.sqrt(real * real + imag * imag);
            
            magnitude[j] = mag;
            
            // Update frequency peaks
            peakFreq[j] = isFirst ? mag : Math.max(mag, peakFreq[j]);
            
            // Update frame peaks only for frequency range of interest
            if (j >= firstBin && j < lastBin) {
                frameBoundedPeak = Math.max(mag, frameBoundedPeak);
                maxSpectrogramValue = Math.max(mag, maxSpectrogramValue);
            }
        }

        // Store results
        spectrogramData.push(magnitude.slice()); // Copy array to avoid reference issues
        peakTime.push(frameBoundedPeak);

        // Update time bounds
        if (isFirst) {
            minInTime = maxInTime = frameBoundedPeak;
        } else {
            minInTime = Math.min(minInTime, frameBoundedPeak);
            maxInTime = Math.max(maxInTime, frameBoundedPeak);
        }
    }

    // Calculate frequency bounds in single loop
    let minInFreq = peakFreq[firstBin];
    let maxInFreq = peakFreq[firstBin];

    for(let j = firstBin + 1; j < lastBin; j++) {
        const freq = peakFreq[j];
        minInFreq = Math.min(minInFreq, freq);
        maxInFreq = Math.max(maxInFreq, freq);
    }

    return {
        specData:{data: spectrogramData, maxValue: maxSpectrogramValue},
        timeData:{data: peakTime, minValue: minInTime, maxValue: maxInTime},
        freqData:{data: peakFreq, minValue: minInFreq, maxValue: maxInFreq},
    };
}
