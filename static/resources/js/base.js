// GLOBAL VARIABLES
let sessionID = null;  // Will need to be updated within the pages
let sessionPasscode = null;  // Will also need to be updated within the pages

// HELPER FUNCTIONS
function randrange(min, max) {
    return Math.random() * (max - min) + min;
}

function randint(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}
