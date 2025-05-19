"use strict";

document.addEventListener('DOMContentLoaded', () => {
    const peakTab = document.getElementById('peak-stats');

    // Tab functionality
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            document.getElementById(button.dataset.tab).classList.add('active');

            if(peakTab.classList.contains('active'))
            {
                window.sharedImage = window.sharedPeakImage;
            }
            else
            {
                window.sharedImage = window.sharedMainImage;
            }

            if(window.sharedImage) ctx.putImageData(window.sharedImage, 0, 0);
        });
    });

}); 
