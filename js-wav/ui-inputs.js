"use strict";

function getInputFPValue(el) { return Number(el.value); }
function fireNewAudioEvent() {
    const event = new CustomEvent("new-audio", {});
    document.dispatchEvent(event);

    fireSignalWindowUpdateEvent();
}
function fireSignalWindowUpdateEvent() {
    const event = new CustomEvent("params-update", {});
    document.dispatchEvent(event);
}

function getUserParams(sampleRate, duration)
{
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
    
    //if(paramStart.value == "") paramStart.value = 0;
    //if(paramStop.value == "") paramStop.value = duration - Number(paramStart.value);
    //if(paramMinFreq.value == "") paramMinFreq.value = 0;
    //if(paramMaxFreq.value == "") paramMaxFreq.value = sampleRate / 1000 / 2;

    let userStart =    Number(paramStart.value);
    let userStop  =    Number(paramStop.value);
    let userDuration = Math.min(userStop - userStart, duration);
    let userMinFreq =  Number(paramMinFreq.value);
    let userMaxFreq =  Number(paramMaxFreq.value);
    let userFreqDiff = userMaxFreq - userMinFreq;

    /*
    let pixelWidth = mainCanvas.width;
    let userPoints = userDuration * sampleRate;

    const targetFFT = Math.sqrt((sampleRate*sampleRate * mainCanvas.height / mainCanvas.width * userDuration / userFreqDiff)) / 10;
    const targetFFT2based = Math.pow(2, Math.round(Math.log2(targetFFT)));
    const defaultFFT = Math.max(Math.min(targetFFT2based, 4096), 128);
    
    if(paramFFT.value == "") paramFFT.value = defaultFFT;
    if(paramHop.value == "") paramHop.value = Math.ceil(userPoints/pixelWidth/5);
    if(paramMinE.value == "") paramMinE.value = -5;
    if(paramKaiserBeta.value == "") paramKaiserBeta.value = 10;
    */

    const fftSize = Number(paramFFT.value);
    let hopSize   = Number(paramHop.value);
    const minE    = Number(paramMinE.value);
    const kaiserBeta = Number(paramKaiserBeta.value);

    //if(paramPeakMinFreq.value == "") paramPeakMinFreq.value = (userMaxFreq>30)?16:1;

    let userPeakMinFreq =  Number(paramPeakMinFreq.value);
    let userPeakMaxFreq =  (paramPeakMaxFreq.value == "")?userMaxFreq:Number(paramPeakMaxFreq.value);

    if( userPeakMinFreq > userMaxFreq ) {paramPeakMinFreq.value = ""; userPeakMinFreq=0;}
    if( userPeakMaxFreq < userMinFreq ) {userPeakMaxFreq.value = ""; userPeakMaxFreq=userMaxFreq;}

    return {
        signalWindow: {start: userStart, stop: userStop, duration: userDuration, minFreq: userMinFreq, maxFreq: userMaxFreq, freqDiff: userFreqDiff, sampleRate: sampleRate, fullDuration: duration},
        params: {fftSize: fftSize, hopSize: hopSize, minE: minE, kaiserBeta: kaiserBeta, peakMinFreq:userPeakMinFreq, peakMaxFreq: userPeakMaxFreq}
        };
}


function initParam(name, defaultValue, deps, onChange)
{
    const el = document.getElementById(name);
    el.value = defaultValue

    if(Array.isArray(deps)) {
        deps.push(el);
        deps.forEach((dep) => {
            if(dep instanceof Element) {
                dep.addEventListener('change', () =>
                {
                    if( window.sharedAudioBuffer && onChange )
                    {
                        onChange(el, dep);
                    }
                    else
                    {
                        el.value = defaultValue;
                    }
                } );
            }
            if(typeof dep === "string") {
                document.addEventListener(dep, () =>
                {
                    if( window.sharedAudioBuffer && onChange )
                    {
                        if(dep == 'new-audio') el.value = defaultValue;

                        onChange(el, dep);
                    }
                    else
                    {
                        el.value = defaultValue;
                    }
                } );
            }
        } );
    }

    return el;
}

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('wavFile');
    const mainCanvas = document.getElementById('mainCanvas');

    // Main Tab
    const paramStart  = initParam('start', 0, ['new-audio'], (el) =>
    {
        const duration = window.sharedAudioBuffer.duration;
        const old_value = getInputFPValue(el);
        const new_value = Math.max(0, Math.min(old_value, duration-0.001));
        el.value = new_value;
    });
    const paramStop   = initParam('stop', '', ['new-audio',paramStart], (el) =>
    {
        const start = getInputFPValue(paramStart);
        const duration = window.sharedAudioBuffer.duration;
        if(el.value == '') el.value=duration;
        else
        {
            const old_value = getInputFPValue(el);
            const new_value = Math.max(start+0.001, Math.min(old_value, duration));
            el.value = new_value;
        }
    });
    const paramMinFreq= initParam('min_freq', 0, ['new-audio'], (el) =>
    {
        const maxFreq = window.sharedAudioBuffer.sampleRate / 1000 / 2;
        const old_value = getInputFPValue(el);
        const new_value = Math.max(0, Math.min(old_value, maxFreq-1));
        el.value = new_value;
    });
    const paramMaxFreq= initParam('max_freq', '', ['new-audio',paramMinFreq], (el) =>
    {
        const minFreq = getInputFPValue(paramMinFreq);
        const maxFreq = window.sharedAudioBuffer.sampleRate / 1000 / 2;
        if(el.value == '') el.value=maxFreq;
        else
        {
            const old_value = getInputFPValue(el);
            const new_value = Math.max(minFreq+1, Math.min(old_value, maxFreq));
            el.value = new_value;
        }
    });
    const paramFFT    = initParam('fft', '', ['params-update',paramStart,paramStop,paramMinFreq,paramMaxFreq], (el, dep) =>
    {
        const sampleRate = window.sharedAudioBuffer.sampleRate;
        const userDuration = getInputFPValue(paramStop) - getInputFPValue(paramStart);
        const userFreqDiff = getInputFPValue(paramMaxFreq) - getInputFPValue(paramMinFreq);

        const targetFFT = Math.sqrt((sampleRate*sampleRate * mainCanvas.height / mainCanvas.width * userDuration / userFreqDiff)) / 10;
        const targetFFT2based = Math.pow(2, Math.round(Math.log2(targetFFT)));
        const defaultFFT = Math.max(Math.min(targetFFT2based, 4096), 128);

        if(el !== dep || el.value =='') el.value = defaultFFT;
    } );
    const paramHop    = initParam('hop', '', ['params-update',paramStart,paramStop,paramMinFreq,paramMaxFreq], (el, dep) =>
    {
        const sampleRate = window.sharedAudioBuffer.sampleRate;
        const userDuration = getInputFPValue(paramStop) - getInputFPValue(paramStart);
        let pixelWidth = mainCanvas.width;
        let userPoints = userDuration * sampleRate;

        if(el !== dep || el.value =='') el.value = Math.ceil(userPoints/pixelWidth);
    } );
    const paramMinE   = initParam('min_e', -5);
    const paramKaiserBeta = initParam('kaiser_beta', 10);

    // Peak Tab
    const paramPeakMinFreq= initParam('peak_min_freq', '', ['new-audio',paramMinFreq,paramMaxFreq], (el, dep) =>
    {
        const userMaxFreq = getInputFPValue(paramMaxFreq);
        const userMinFreq = getInputFPValue(paramMinFreq);

        const targetValue = (userMaxFreq>30)?16:1;

        if(el.value =='') el.value = targetValue;

        const currentValue = getInputFPValue(el);

        if(currentValue >= userMaxFreq)
        {
            if( targetValue < userMaxFreq ) el.value = targetValue; else el.value = (userMaxFreq+userMinFreq)/2;
        }        
    } );
    const paramPeakMaxFreq= initParam('peak_max_freq', '');
    
    fileInput.addEventListener('change', async function() {
        const file = fileInput.files[0];
        if (!file) {
            return;
        }

        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

        const audioURL = URL.createObjectURL(file);
        document.getElementById('audioPlayer').src = audioURL;

        window.sharedFile = file;

        await loadFile();
        showFile();
    });

}); 
