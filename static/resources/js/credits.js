// MAIN CODE
$(document).ready(() => {
    // Define the markdown converter
    let converter = new showdown.Converter();

    // Parse the rules and display it
    document.getElementById("credits-area").innerHTML = converter.makeHtml(CREDITS);
});
