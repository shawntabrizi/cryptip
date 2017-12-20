async function getPrice () {
    let response = await fetch("https://api.coinmarketcap.com/v1/ticker/?limit=100");
    let data = await response.json();

    chrome.storage.local.set({
        'coinmarketcap': JSON.stringify(data),
        'time': (new Date()).getTime()
    }, function () {
        console.log('Set coinmarketcap data.');
    });
}

async function checkStorage() {
    var time

    chrome.storage.local.get('time', function (result) {
        time = result.time;
        console.log(time)

        if (time) {
            let currentTime = (new Date()).getTime()
            let diff = currentTime - time
            let min = ((diff / 1000) / 60)
            console.log(min)
            if (min > 1) {
                console.log('Over 1 minute has passed, getting new price data.')
                return getPrice();
            } else {
                console.log('No need to get data.')
            }
        } else {
            console.log('Getting price data for the first time')
            return getPrice();
        }
    });

}

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function addTooltip(coinmarketcap) {

    var coindict = {}
    var syms = []

    for (coin in coinmarketcap) {
        var sym = coinmarketcap[coin]['symbol'];
        if (!(sym in coindict)) {
            coindict[sym] = coinmarketcap[coin]
            syms.push(escapeRegExp(sym))
        }
    }

    console.log(coindict)

    var symsreg = syms.join('|')
    var re = new RegExp('\\b((' + symsreg + '))\\b', 'g')
    //var re = new RegExp('\\b((ETH|BTC|LTC))\\b', 'g')
    console.log(re)

    var elements = document.body.getElementsByTagName('*');

    elements = [].slice.call(elements, 0)

    for (var i = 0; i < elements.length; i++) {
        var element = elements[i];
        if (element.tagName.toLocaleLowerCase() != 'script') {
            for (var j = element.childNodes.length - 1; j >= 0; j--) {
                var node = element.childNodes[j];

                if (node.nodeType === 3) {
                    var text = node.nodeValue;

                    if (re.test(text)) {
                        console.log(text, element.tagName)
                        var replacementNode = document.createElement('span');
                        replacementNode.innerHTML = text.replace(re, function (a, b) {
                            console.log('match is:' + b)
                            return `<span class='cryptick-tooltip'>${b}<span class='cryptick-tooltiptext'>$${coindict[b]['price_usd']} (${(coindict[b]['percent_change_24h'] > 0 ? '+' : '') + coindict[b]['percent_change_24h']}%)</span></span>`;
                        });
                        node.parentNode.insertBefore(replacementNode, node);
                        node.parentNode.removeChild(node)
                    }
                }
            }
        }
    }
}

async function cryptick () {
    checkStorage().then(function () {
        var coinmarketcapdata;
        chrome.storage.local.get(['coinmarketcap','time'], function (result) {
            coinmarketcapdata = JSON.parse(result.coinmarketcap);
            console.log("time: " + result.time);
            console.log(coinmarketcapdata);
            addTooltip(coinmarketcapdata);
        })
    })
}

cryptick();
