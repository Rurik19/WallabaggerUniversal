/* global savePageToWallabag */
if (typeof (browser) === 'undefined' && typeof (chrome) === 'object') {
    browser = chrome;
}

function onCommandsCommand (command) {
    if (command === 'wallabag-it') {
        browser.tabs.query({ 'active': true, 'currentWindow': true }, function (tabs) {
            if (tabs[0] != null) {
                savePageToWallabag(tabs[0].url, false);
            }
        });
    }
}

browser.commands.onCommand.addListener(onCommandsCommand);
