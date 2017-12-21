function saveOptions(e) {
    var storageItem = browser.storage.local.set({
        'top': document.querySelector("#top").value,
        'currency': document.querySelector("#currency").value,
        'period': document.querySelector("#period").value,
        'time': null
    });

    e.preventDefault();
}

function setCurrentChoice(settings) {
    document.querySelector("#top").value = settings.top || '100';
    document.querySelector("#currency").value = settings.currency || 'usd';
    document.querySelector("#period").value = settings.period || '24h';
}

function onError(error) {
    console.error("Cryptip Error: " + error)
}

function restoreOptions() {
    var storageItem = browser.storage.local.get();
    storageItem.then(setCurrentChoice, onError);
}


function resetOptions() {
    var clearing = browser.storage.local.clear();
}

//document.addEventListener('DOMContentLoaded', restoreOptions);
restoreOptions();
document.querySelector("form").addEventListener("submit", saveOptions);
document.querySelector("form").addEventListener("reset", resetOptions);