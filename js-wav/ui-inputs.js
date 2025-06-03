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

const params = {main:{}, peak:{}, selection:{}};

function getUserParams(sampleRate, duration)
{
    let userStart =    params.main.start.read();
    let userStop  =    params.main.stop.read();
    let userDuration = Math.min(userStop - userStart, duration);
    let userMinFreq =  params.main.minFreq.read();
    let userMaxFreq =  params.main.maxFreq.read();
    let userFreqDiff = userMaxFreq - userMinFreq;

    const fftSize = params.main.fft.read();
    let hopSize   = params.main.hop.read();
    const minE    = params.main.minE.read();
    const kaiserBeta = params.main.kaiserBeta.read();

    let userPeakMinFreq =  params.peak.minFreq.read();
    let userPeakMaxFreq =  (params.peak.maxFreq.value == "")?userMaxFreq:Number(params.peak.maxFreq.value);

    if( userPeakMinFreq > userMaxFreq ) {params.peak.minFreq.value = ""; userPeakMinFreq=0;}
    if( userPeakMaxFreq < userMinFreq ) {params.peak.maxFreq.value = ""; userPeakMaxFreq=userMaxFreq;}

    return {
        signalWindow: {start: userStart, stop: userStop, duration: userDuration, minFreq: userMinFreq, maxFreq: userMaxFreq, freqDiff: userFreqDiff, sampleRate: sampleRate, fullDuration: duration},
        params: {fftSize: fftSize, hopSize: hopSize, minE: minE, kaiserBeta: kaiserBeta, peakMinFreq:userPeakMinFreq, peakMaxFreq: userPeakMaxFreq}
        };
}

function initParam(name, defaultValue, deps, onChange, onRead)
{
    const el = document.getElementById(name);
    el.value = defaultValue

    if(onRead) {el.read = onRead;} else {el.read = () => {return Number(el.value);};}
    //el.myCustomFunction = function () {return el.value;};

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
    params.main.start  = initParam('start', 0, ['new-audio'], (el) =>
    {
        const duration = window.sharedAudioBuffer.duration;
        const old_value = el.read();
        const new_value = Math.max(0, Math.min(old_value, duration-0.001));
        el.value = new_value;
    });
    params.main.stop   = initParam('stop', '', ['new-audio',params.main.start], (el) =>
    {
        const start = params.main.start.read();
        const duration = window.sharedAudioBuffer.duration;
        if(el.value == '') el.value=duration;
        else
        {
            const old_value = el.read();
            const new_value = Math.max(start+0.001, Math.min(old_value, duration));
            el.value = new_value;
        }
    });
    params.main.minFreq= initParam('min_freq', 0, ['new-audio'], (el) =>
    {
        const maxFreq = window.sharedAudioBuffer.sampleRate / 1000 / 2;
        const old_value = el.read();
        const new_value = Math.max(0, Math.min(old_value, maxFreq-1));
        el.value = new_value;
    });
    params.main.maxFreq= initParam('max_freq', '', ['new-audio',params.main.minFreq], (el) =>
    {
        const minFreq = params.main.minFreq.read();
        const maxFreq = window.sharedAudioBuffer.sampleRate / 1000 / 2;
        if(el.value == '') el.value=maxFreq;
        else
        {
            const old_value = el.read();
            const new_value = Math.max(minFreq+1, Math.min(old_value, maxFreq));
            el.value = new_value;
        }
    });
    params.main.fft    = initParam('fft', '', ['params-update',params.main.start,params.main.stop,params.main.minFreq,params.main.maxFreq], (el, dep) =>
    {
        const sampleRate = window.sharedAudioBuffer.sampleRate;
        const userDuration = params.main.stop.read() - params.main.start.read();
        const userFreqDiff = params.main.maxFreq.read() - params.main.minFreq.read();

        const targetFFT = Math.sqrt((sampleRate*sampleRate * mainCanvas.height / mainCanvas.width * userDuration / userFreqDiff)) / 10;
        const targetFFT2based = Math.pow(2, Math.round(Math.log2(targetFFT)));
        const defaultFFT = Math.max(Math.min(targetFFT2based, 4096), 128);

        if(el !== dep || el.value =='') el.value = defaultFFT;
    } );
    params.main.hop    = initParam('hop', '', ['params-update',params.main.start,params.main.stop,params.main.minFreq,params.main.maxFreq], (el, dep) =>
    {
        const sampleRate = window.sharedAudioBuffer.sampleRate;
        const userDuration = params.main.stop.read() - params.main.start.read();
        let pixelWidth = mainCanvas.width;
        let userPoints = userDuration * sampleRate;

        if(el !== dep || el.value =='') el.value = Math.ceil(userPoints/pixelWidth);
    } );
    params.main.minE   = initParam('min_e', -5);
    params.main.kaiserBeta = initParam('kaiser_beta', 10);

    // Peak Tab
    params.peak.minFreq= initParam('peak_min_freq', '', ['new-audio',params.main.minFreq,params.main.maxFreq], (el, dep) =>
    {
        const userMaxFreq = params.main.maxFreq.read();
        const userMinFreq = params.main.minFreq.read();

        const targetValue = (userMaxFreq>30)?16:1;

        if(el.value =='') el.value = targetValue;

        const currentValue = el.read();

        if(currentValue >= userMaxFreq)
        {
            if( targetValue < userMaxFreq ) el.value = targetValue; else el.value = (userMaxFreq+userMinFreq)/2;
        }        
    } );
    params.peak.maxFreq      = initParam('peak_max_freq', '');
    params.peak.leftMagFall  = initParam('left_mag_fall', '');
    params.peak.rightMagFall = initParam('right_mag_fall', '');
    
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

    // Select Tab
    params.selection.start  = initParam('selection_start', '', ['new-audio']);
    params.selection.stop   = initParam('selection_stop', '', ['new-audio']);
    params.selection.min_freq= initParam('selection_min_freq', '', ['new-audio']);
    params.selection.max_freq= initParam('selection_max_freq', '', ['new-audio']);


}); 
