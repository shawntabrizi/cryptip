function saveOptions(e) {

    var settings = {
        'top': document.querySelector("#top").value,
        'currency': document.querySelector("#currency").value,
        'period': document.querySelector("#period").value,
        'checkNames': document.querySelector("#checkNames").checked,
        'ignoreCase': document.querySelector("#ignoreCase").checked,
        'style': document.querySelector("#tipStyle").value,
        'theme': document.querySelector("#tipTheme").value,
        'logging': false
    }

    var storageItem = browser.storage.local.set({
        'settings': JSON.stringify(settings),
        'time': null
    });

    document.getElementById("output").innerText = "Saved Settings!"

    e.preventDefault();
}

function setCurrentChoice(settings) {
    document.querySelector("#top").value = settings.top || '0';
    document.querySelector("#currency").value = settings.currency || 'usd';
    document.querySelector("#period").value = settings.period || '24h';
    document.querySelector("#checkNames").checked = settings.checkNames || true;
    document.querySelector("#ignoreCase").checked = settings.ignoreCase || true;
    document.querySelector("#tipStyle").value = settings.style || 'widget';
    document.querySelector("#tipTheme").value = settings.theme || 'dark';
}

function onError(error) {
    console.error("Cryptip Error: " + error)
}

async function restoreOptions() {
    var storage = await browser.storage.local.get();
    if (storage.settings) {
        setCurrentChoice(JSON.parse(storage.settings))
    }

    document.getElementById("blacklist").innerText = storage.blacklist || 'None';
}

function resetOptions() {
    var clearing = browser.storage.local.clear();
    document.getElementById("output").innerText = "Reset Settings"
    restoreOptions();
}

//document.addEventListener('DOMContentLoaded', restoreOptions);
restoreOptions();
document.querySelector("form").addEventListener("submit", saveOptions);
document.querySelector("form").addEventListener("reset", resetOptions);