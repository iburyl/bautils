
function drawPlaybackLine(currentTime, signalWindow, specCanvasWindow, image, ctx) {

    ctx.putImageData(image, 0, 0);

    ctx.strokeStyle = magnitudeToRGBDark(0.9, 0, 1);
    ctx.lineWidth = 1;

    const duration = signalWindow.duration;

    let currentX = Math.floor(specCanvasWindow.width / duration * (currentTime-signalWindow.start)) + specCanvasWindow.x;

    ctx.beginPath();
    ctx.moveTo(currentX, specCanvasWindow.y);
    ctx.lineTo(currentX, specCanvasWindow.y - specCanvasWindow.height);
    ctx.stroke();
}