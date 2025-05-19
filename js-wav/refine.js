"use strict";

document.addEventListener('DOMContentLoaded', () => {
    const refineButton = document.getElementById('do-refine');
    const refineLoadButton = document.getElementById('load-refined');
    const fileInput = document.getElementById('wavFile');
    const startInput = document.getElementById('start');
    const stopInput = document.getElementById('stop');
    const volumeInput = document.getElementById('volume');
    const highPassInput = document.getElementById('high-pass');
    const lowPassInput = document.getElementById('low-pass');

    //let sharedRefined;

    refineLoadButton.addEventListener('click', async () => {
        window.sharedFile = window.sharedRefined;
        fileInput.value = "";

        cleanInput();
        showFile();
    } );

    refineButton.addEventListener('click', async () => {
        const file = window.sharedFile;
        if (!file) {
            alert('Please select a WAV file first');
            return;
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            let {audioContext, info} = getAudioContext(arrayBuffer);
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Read the file
            //const arrayBuffer = await file.arrayBuffer();
            //const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            //const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Get parameters
            const startTime = parseFloat(startInput.value) || 0;
            const stopTime = parseFloat(stopInput.value) || audioBuffer.duration;
            const volumeDb = parseFloat(volumeInput.value) || 0;
            const volume = Math.pow(10, volumeDb / 20); // Convert dB to amplitude ratio
            const highPassFreq = parseFloat(highPassInput.value) * 1000 || 0; // Convert KHz to Hz
            const lowPassFreq = parseFloat(lowPassInput.value) * 1000 || 0; // Convert KHz to Hz

            // Create new buffer with the selected time window
            const newDuration = stopTime - startTime;
            const newBuffer = audioContext.createBuffer(
                audioBuffer.numberOfChannels,
                Math.ceil(newDuration * audioBuffer.sampleRate),
                audioBuffer.sampleRate
            );

            // Copy and process the selected portion
            for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                const channelData = audioBuffer.getChannelData(channel);
                const newChannelData = newBuffer.getChannelData(channel);
                
                const startSample = Math.floor(startTime * audioBuffer.sampleRate);
                const stopSample = Math.floor(stopTime * audioBuffer.sampleRate);
                
                // Extract the selected portion
                const selectedData = new Float32Array(stopSample - startSample);
                for (let i = 0; i < selectedData.length; i++) {
                    selectedData[i] = channelData[startSample + i];
                }

                // Apply filters if specified
                let filteredData = selectedData;
                if (highPassFreq > 0) {
                    const highPassFilter = new FIRFilter('highpass', highPassFreq, audioBuffer.sampleRate);
                    filteredData = highPassFilter.applyFilter(filteredData);
                }
                if (lowPassFreq > 0 && lowPassFreq < audioBuffer.sampleRate / 2) {
                    const lowPassFilter = new FIRFilter('lowpass', lowPassFreq, audioBuffer.sampleRate);
                    filteredData = lowPassFilter.applyFilter(filteredData);
                }

                // Apply volume and copy to new buffer
                for (let i = 0; i < filteredData.length; i++) {
                    newChannelData[i] = filteredData[i] * volume;
                }
            }

            // Convert to WAV
            const wavBlob = audioBufferToWav(newBuffer);
            const wavUrl = URL.createObjectURL(wavBlob);

            // refined-container;
            
            // Update the audio player
            const refinedContainer = document.getElementById('refined-container');
            refinedContainer.innerHTML = '';

            const refinedAudio = document.createElement("audio");
            refinedAudio.controls = true;
            refinedAudio.src = wavUrl;
            refinedAudio.load();

            refinedContainer.appendChild(refinedAudio);

            window.sharedRefined = wavBlob;

        } catch (error) {
            console.error('Error processing audio:', error);
            alert('Error processing audio file');
        }
    });
});
