"use strict";

function getSignalWindowMapping(sampleRate, numFrames, numBins, signalWindow)
{
    const binsPerKHz = numBins/sampleRate*1000;
    const firstBin = Math.floor(signalWindow.minFreq * binsPerKHz);
    const lastBin = Math.min(firstBin + Math.floor((signalWindow.maxFreq - signalWindow.minFreq) * binsPerKHz), numBins);

    return {startFrame: 0, stopFrame: numFrames, firstBin:firstBin, lastBin:lastBin};
}

function generateSpectrogram(fftSize, hopSize, signalWindow, params, audioBuffer, audioContext) {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = signalWindow.sampleRate;
    const kaiserBeta = params.kaiserBeta;

    // Process audio data in chunks
    let spectrogramData = [];
    let peakTime = [];
    let searchPeakTime = [];
    let maxSpectrogramValue = 0;

    let start = Math.floor(signalWindow.start * sampleRate);
    let stop  = Math.min(Math.floor((signalWindow.start + signalWindow.duration) * sampleRate) + fftSize, channelData.length);

    const beta = kaiserBeta;
    const window = (beta>=0)?kaiserWindow(fftSize, beta):[];

    const numBins = fftSize+1;
    const binsPerKHz = numBins/sampleRate*1000;        
    const firstBin = Math.floor(signalWindow.minFreq * binsPerKHz);
    const lastBin = Math.min(firstBin + Math.floor((signalWindow.maxFreq - signalWindow.minFreq) * binsPerKHz), numBins);

    let minInTime;
    let maxInTime;

    let peakFreq = new Array(numBins);
    let count = 0;

    let searchFreqPeak={value:0, frame:0, bin:0};

    let searchFirstBin = Math.min(Math.floor(binsPerKHz * params.peakMinFreq), fftSize);
    let searchLastBin = Math.min(searchFirstBin + Math.floor((params.peakMaxFreq - params.peakMinFreq) * binsPerKHz), numBins);

    for (let i = start; i < stop; i += hopSize) {
        const chunk = channelData.slice(i, i + fftSize);
        if (chunk.length < fftSize) break;

        if(beta>=0) for(let j = 0; j < fftSize; j++) chunk[j] *= window[j];

        const f = new FFT(fftSize);
        const out = f.createComplexArray();
        f.realTransform(out, chunk);

        const magnitude = new Array(numBins);

        let frameLowPeak = 0;
        let frameBoundedPeak = 0;
        let frameHighPeak = 0;

        for(let j=0;j<fftSize;j++)
        {
            magnitude[j] = Math.sqrt(out[j*2]*out[j*2] + out[j*2+1]*out[j*2+1]);

            peakFreq[j] = (i == start)?magnitude[j]:Math.max(magnitude[j], peakFreq[j]);
        }

        for(let j=firstBin;j<lastBin;j++)
        {
            frameBoundedPeak = Math.max(magnitude[j], frameBoundedPeak);
            //frameBoundedPeak += magnitude[j] / (lastBin-firstBin);
            maxSpectrogramValue = Math.max(magnitude[j], maxSpectrogramValue);
        }

        for(let j=searchFirstBin;j<searchLastBin;j++)
        {
            frameHighPeak = Math.max(magnitude[j], frameHighPeak);
            if(magnitude[j] > searchFreqPeak.value) searchFreqPeak = {value:magnitude[j], frame:count, bin:j};
        }

        spectrogramData.push(magnitude);
        peakTime.push(frameBoundedPeak);
        searchPeakTime.push(frameHighPeak);

        minInTime = (i == start)?frameBoundedPeak:Math.min(minInTime, frameBoundedPeak);
        maxInTime = (i == start)?frameBoundedPeak:Math.max(maxInTime, frameBoundedPeak);
        count++;
    }

    //let foundCalls = searchForPeaks2(searchPeakTime, spectrogramData, searchFirstBin, searchLastBin);
    const sortedFreq = peakFreq.toSorted((a, b) => a - b);
    const magNoiseThreshold = sortedFreq[ Math.round(0.1 * (sortedFreq.length - 1)) ] * 10;

    searchFreqPeak.box = getBox(searchFreqPeak, spectrogramData, searchFirstBin, searchLastBin, magNoiseThreshold); 

    let minInFreq;
    let maxInFreq;

    for(let j=firstBin;j<lastBin;j++)
    {
        minInFreq = (j==firstBin)?peakFreq[j]:Math.min(minInFreq, peakFreq[j]);
        maxInFreq = (j==firstBin)?peakFreq[j]:Math.max(maxInFreq, peakFreq[j]);
    }

    return {
        specData:{data: spectrogramData, maxValue: maxSpectrogramValue},
        timeData:{data: peakTime, minValue: minInTime, maxValue: maxInTime},
        freqData:{data: peakFreq, minValue: minInFreq, maxValue: maxInFreq},
        peak: searchFreqPeak,
        //foundPeaks: foundCalls
    };
}
