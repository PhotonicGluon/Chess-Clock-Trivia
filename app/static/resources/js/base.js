// CONSTANTS
const HEARTBEAT_INTERVAL = 240;  // Every 240 seconds, a heartbeat is sent to the server

// GLOBAL VARIABLES
let sessionID = null;  // Will need to be updated within the pages

// MAIN CODE
// Code to be run once the document is loaded
$(document).ready(() => {
    // Set up the heartbeat interval
    setInterval(() => {
        // Call the heartbeat function on the server
        $.ajax({
            url: "/code-only/heartbeat",
            method: "POST",
            data: {"session_id": sessionID}
        }).done((data) => {
            console.log(data);
        });
    }, HEARTBEAT_INTERVAL * 1000);  // `timeout` is in ms
});
