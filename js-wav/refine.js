"use strict";

document.addEventListener('DOMContentLoaded', () => {
    const refineButton = document.getElementById('do-refine');
    const fileInput = document.getElementById('wavFile');
    const startInput = document.getElementById('start');
    const stopInput = document.getElementById('stop');
    const volumeInput = document.getElementById('volume');
    const refinedAudio = document.getElementById('audioPlayerRefined');

    refineButton.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) {
            alert('Please select a WAV file first');
            return;
        }

        try {
            // Read the file
            const arrayBuffer = await file.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Get parameters
            const startTime = parseFloat(startInput.value) || 0;
            const stopTime = parseFloat(stopInput.value) || audioBuffer.duration;
            const volumeDb = parseFloat(volumeInput.value) || 0;
            const volume = Math.pow(10, volumeDb / 20); // Convert dB to amplitude ratio

            // Create new buffer with the selected time window
            const newDuration = stopTime - startTime;
            const newBuffer = audioContext.createBuffer(
                audioBuffer.numberOfChannels,
                Math.ceil(newDuration * audioBuffer.sampleRate),
                audioBuffer.sampleRate
            );

            // Copy and adjust the selected portion
            for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                const channelData = audioBuffer.getChannelData(channel);
                const newChannelData = newBuffer.getChannelData(channel);
                
                const startSample = Math.floor(startTime * audioBuffer.sampleRate);
                const stopSample = Math.floor(stopTime * audioBuffer.sampleRate);
                
                // Copy the selected portion and apply volume
                for (let i = 0; i < newChannelData.length; i++) {
                    const sourceIndex = startSample + i;
                    if (sourceIndex < stopSample) {
                        newChannelData[i] = channelData[sourceIndex] * volume;
                    }
                }
            }

            // Convert to WAV
            const wavBlob = audioBufferToWav(newBuffer);
            const wavUrl = URL.createObjectURL(wavBlob);

            // Update the audio player
            refinedAudio.src = wavUrl;
            refinedAudio.load();

        } catch (error) {
            console.error('Error processing audio:', error);
            alert('Error processing audio file');
        }
    });
});

// Helper function to convert AudioBuffer to WAV
function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // RIFF chunk length
    view.setUint32(4, totalSize - 8, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, format, true);
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, byteRate, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, blockAlign, true);
    // bits per sample
    view.setUint16(34, bitDepth, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, dataSize, true);

    // Write the PCM samples
    const offset = 44;
    const channelData = [];
    for (let i = 0; i < numChannels; i++) {
        channelData.push(buffer.getChannelData(i));
    }

    let pos = 0;
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
            const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset + pos, value, true);
            pos += 2;
        }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// Helper function to write strings to DataView
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
} 