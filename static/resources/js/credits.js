// MAIN CODE
$(document).ready(() => {
    // Disable the heartbeat interval for this page
    clearInterval(heartbeat);

    // Define the markdown converter
    let converter = new showdown.Converter();

    // Parse the rules and display it
    document.getElementById("credits-area").innerHTML = converter.makeHtml(CREDITS);
});
