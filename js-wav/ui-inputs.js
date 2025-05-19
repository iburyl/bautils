"use strict";

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

    if(paramPeakMinFreq.value == "") paramPeakMinFreq.value = (userMaxFreq>30)?16:1;

    let userPeakMinFreq =  Number(paramPeakMinFreq.value);
    let userPeakMaxFreq =  (paramPeakMaxFreq.value == "")?userMaxFreq:Number(paramPeakMaxFreq.value);

    if( userPeakMinFreq > userMaxFreq ) {paramPeakMinFreq.value = ""; userPeakMinFreq=0;}
    if( userPeakMaxFreq < userMinFreq ) {userPeakMaxFreq.value = ""; userPeakMaxFreq=userMaxFreq;}

    return {
        signalWindow: {start: userStart, stop: userStop, duration: userDuration, minFreq: userMinFreq, maxFreq: userMaxFreq, freqDiff: userFreqDiff, sampleRate: sampleRate, fullDuration: duration},
        params: {fftSize: fftSize, estimatedFFTSize: targetFFT2based, hopSize: hopSize, minE: minE, kaiserBeta: kaiserBeta, peakMinFreq:userPeakMinFreq, peakMaxFreq: userPeakMaxFreq}
        };
}

function cleanInput()
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

    paramFFT.value = "";
    paramHop.value = "";
    paramMinE.value = "";
    paramKaiserBeta.value = "";
    paramStart.value = "";
    paramStop.value = "";
    paramMinFreq.value = "";
    paramMaxFreq.value = "";
}

function zeroFFT() {
    const paramFFT = document.getElementById('fft');
    const paramHop = document.getElementById('hop');

    paramFFT.value = "";
    paramHop.value = "";
}

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('wavFile');

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
    
    paramStart.addEventListener('change', function() {zeroFFT();} );
    paramStop.addEventListener('change', function() {zeroFFT();} );
    paramMinFreq.addEventListener('change', function() {zeroFFT();} );
    paramMaxFreq.addEventListener('change', function() {zeroFFT();} );
    
    fileInput.addEventListener('change', function() {
        const file = fileInput.files[0];
        if (!file) {
            return;
        }

        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

        cleanInput();

        const audioURL = URL.createObjectURL(file);
        document.getElementById('audioPlayer').src = audioURL;

        window.sharedFile = file;

        showFile();
    });

}); 
