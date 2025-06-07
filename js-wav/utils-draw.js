"use strict";

function magnitudeToRGBDarkArray(mag, minMag, maxMag) {
    let gradient = [
        {point: 0   ,r:  0,g:  0,b:0},
        {point: 0.5 ,r:  0,g:180,b:0},
        {point: 0.95,r:255,g:255,b:0},
        {point: 1   ,r:255,g:  0,b:0},
        ];

    let i;
    for(i=1; i<gradient.length-1; i++)
    {
        if(mag<gradient[i].point) break;
    }
    mag = Math.max(mag, gradient[0].point);
    mag = Math.min(mag, gradient[gradient.length-1].point);

    let inner_point = (mag - gradient[i-1].point)/(gradient[i].point - gradient[i-1].point);

    const r = Math.round(gradient[i-1].r + inner_point*(gradient[i].r - gradient[i-1].r));
    const g = Math.round(gradient[i-1].g + inner_point*(gradient[i].g - gradient[i-1].g));
    const b = Math.round(gradient[i-1].b + inner_point*(gradient[i].b - gradient[i-1].b));
    
    return [r,g,b];
}

function magnitudeToRGBDark(mag, minMag, maxMag, opacity) {
    // Reuse magnitudeToRGBDarkArray for the color calculation
    const [r, g, b] = magnitudeToRGBDarkArray(mag, minMag, maxMag);
    
    if(!opacity) return `rgb(${r} ${g} ${b})`;

    const css_opac = opacity.toFixed(2);

    return `rgb(${r} ${g} ${b} / ${css_opac})`;
}

