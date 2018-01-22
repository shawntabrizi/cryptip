//Open the full options menu
function openOptions() {
    browser.runtime.openOptionsPage();
}

//Send a message from Popup to Content Script
async function sendMessageToContentScript(message) {

    //get active tabs
    var activeTabs = await browser.tabs.query({
        currentWindow: true,
        active: true
    });


    for (let tab of activeTabs) {
        var response = await browser.tabs.sendMessage(
            tab.id,
            { message: message }
        )

        return response.response;
    }
}

//get the settings from Content.js
async function checkSettings() {
    var settings = JSON.parse(await sendMessageToContentScript("checkSettings"))


    document.getElementById("enabled").checked = settings.enabled

    document.getElementById("tipStyle").value = settings.style

    document.getElementById("tipTheme").value = settings.theme

}

//Button opens up the full options menu
document.querySelector("#linkToOptions").addEventListener("click", openOptions)

//When popup opens check settings
checkSettings();


// Listen for the user enabling/disabling cryptip
document.getElementById("enabled").addEventListener("change", async function () {
    if (this.checked) {

        var response = await sendMessageToContentScript("removeFromBlacklist")

        document.getElementById("output").innerText = response;
    } else {

        var response = await sendMessageToContentScript("addToBlacklist")

        document.getElementById("output").innerText = response;
    }
});


//Listen for the user changing the tip style
document.getElementById("tipStyle").addEventListener("change", async function () {
    if (this.value == "minimal") {
        var response = await sendMessageToContentScript("setMinimal")
        document.getElementById("output").innerText = response;
    } else if (this.value == "widget") {
        var response = await sendMessageToContentScript("setWidget")
        document.getElementById("output").innerText = response;
    } else {
        document.getElementById("output").innerText = "Huh?";
    }
});

//Listen for the user changing the tip style
document.getElementById("tipTheme").addEventListener("change", async function () {
    if (this.value == "dark") {
        var response = await sendMessageToContentScript("setDark")
        document.getElementById("output").innerText = response;
    } else {
        var response = await sendMessageToContentScript("setLight")
        document.getElementById("output").innerText = response;
    }
});

//Make links in tooltip clickable, and open in a new tab
document.addEventListener('DOMContentLoaded', function () {
    var links = document.getElementsByTagName("a");
    for (var i = 0; i < links.length; i++) {
        (function () {
            var ln = links[i];
            var location = ln.href;
            ln.onclick = function () {
                browser.tabs.create({ active: true, url: location });
            };
        })();
    }
});