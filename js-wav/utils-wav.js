async function urlToFile(url, filename, mimeType) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  console.log(buffer);
  return new File([buffer], filename, { type: mimeType });
}

function findWavChunk(name, dataView) {
    let offset = 12;
    while (offset < dataView.byteLength) {
        const chunkID = String.fromCharCode(
            dataView.getUint8(offset),
            dataView.getUint8(offset + 1),
            dataView.getUint8(offset + 2),
            dataView.getUint8(offset + 3)
        );
        const chunkSize = dataView.getUint32(offset + 4, true);

        if (chunkID === name) {
            return offset; // start of "fmt " chunk
        }
        offset += 8 + chunkSize + (chunkSize % 2); // align to even
    }
    return -1;
}

function getAudioContext(arrayBuffer, infoDiv)
{
    const dataView = new DataView(arrayBuffer);

    let audioContext;
    let info = {};
    const fmtSectionOffset = findWavChunk('fmt ', dataView);
    const dataSectionOffset = findWavChunk('data', dataView);
    if(fmtSectionOffset != -1 && dataSectionOffset != -1)
    {
        format = dataView.getUint16(fmtSectionOffset + 8, true);
        numChannels = dataView.getUint16(fmtSectionOffset + 8 + 2, true);
            sampleRate = dataView.getUint32(fmtSectionOffset + 8 + 4, true);
        bitsPerSample = dataView.getUint16(fmtSectionOffset + 8 + 14, true);
     
        dataSize = dataView.getUint32(dataSectionOffset + 4, true);

        durationSeconds = dataSize / (sampleRate * numChannels * (bitsPerSample / 8));

        info.duration = durationSeconds;
        info.sampleRate = sampleRate;
        info.dataFormat = (format==1)?'PCM':(format==3)?'Floating-point':'unknown';
        info.bitsPerSample = bitsPerSample;
        info.numChannels = numChannels;
        
        audioContext = new window.OfflineAudioContext({numberOfChannels:numChannels, length:dataSize, sampleRate: sampleRate});

    }
    else
    {
        audioContext = new window.AudioContext();
    }

    return {audioContext:audioContext, info:info};
}
