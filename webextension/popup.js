function openOptions() {
    browser.runtime.openOptionsPage();
}

function notifyExtension(e) {
    if (e.target.tagName != "A") {
        return;
    }
    browser.runtime.sendMessage({ "url": e.target.href });
}

async function sendMessageToContentScript(message) {

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

async function checkSettings() {
    var response = await sendMessageToContentScript("checkSettings")

    var enabled = response[0]
    var minimal = response[1]

    document.getElementById("enabled").checked = enabled

    if (minimal) {
        document.getElementById("tipStyle").value = "minimal";
    } else {
        document.getElementById("tipStyle").value = "widget";
    }
}

document.querySelector("#linkToOptions").addEventListener("click", openOptions)

checkSettings();


document.getElementById("enabled").addEventListener("change", async function () {
    if (this.checked) {

        var response = await sendMessageToContentScript("removeFromBlacklist")

        document.getElementById("output").innerText = response;
    } else {

        var response = await sendMessageToContentScript("addToBlacklist")

        document.getElementById("output").innerText = response;
    }
});

document.getElementById("tipStyle").addEventListener("change", async function () {
    if (this.value == "minimal") {
        var response = await sendMessageToContentScript("setMinimal")
        document.getElementById("output").innerText = response;
    } else {
        var response = await sendMessageToContentScript("setWidget")
        document.getElementById("output").innerText = response;
    }
});

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