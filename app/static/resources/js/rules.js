// MAIN CODE
$(document).ready(() => {
    // Define a ShowDown markdown converter
    let converter = new showdown.Converter();

    // Parse the markdown and show the content of the question
    document.getElementById("rules").innerHTML = converter.makeHtml(RULES);

    // Disable the heartbeat interval
    clearInterval(heartbeat);
});
