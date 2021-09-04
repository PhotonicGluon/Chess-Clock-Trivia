// CONSTANTS
const HEARTBEAT_INTERVAL = 150;  // Every 150 seconds, a heartbeat is sent to the server

// GLOBAL VARIABLES
let sessionID = null;  // Will need to be updated within the pages
let sessionPasscode = null;  // Will also need to be updated within the pages
let heartbeat = null;  // Heartbeat interval object; will be assigned later

// HELPER FUNCTIONS
function randrange(min, max) {
    return Math.random() * (max - min) + min;
}

function randint(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

// MAIN CODE
// Code to be run once the document is loaded
$(document).ready(() => {
    // Set up the heartbeat interval object
    heartbeat = setInterval(() => {
        // Call the heartbeat function on the server
        $.ajax({
            url: "/code-only/heartbeat",
            method: "POST",
            data: {"session_id": sessionID}
        }).done((data) => {
            console.log(data);
        });
    }, HEARTBEAT_INTERVAL * 1000);  // `timeout` is in milliseconds, so multiply by 1000
});
