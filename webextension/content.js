async function getPrice(top, currency) {
    try {
        let response = await fetch("https://api.coinmarketcap.com/v1/ticker/?limit=" + top + "&convert=" + currency);
        let data = await response.json();

        return data;
    } catch (error) {
        console.error("Cryptip Error: " + error);
    }
}

async function storePrice(top = 100, currency = 'usd') {
    try {
        var price = await getPrice(top, currency);
        var time = (new Date()).getTime();

        console.log('Cryptip: Storing coinmarketcap data at ' + (new Date(time).toString()));

        return browser.storage.local.set({
            'coinmarketcap': JSON.stringify(price),
            'time': time
        });

    } catch (error) {
        console.error("Cryptip Error: " + error);
    }
}


async function checkStorage() {
    var time
    try {
        var result = await browser.storage.local.get();

        if (result.time) {
            let currentTime = (new Date()).getTime();
            let diff = currentTime - result.time;
            let min = ((diff / 1000) / 60);

            if (min > 1) {
                console.log('Cryptip: Over 1 minute has passed, getting new price data.');
                await storePrice(result.top, result.currency);
            } else {
                console.log('Cryptip: No need to get new data for another ' + Math.round(60 * (1 - min)) + ' seconds.');
            }

        } else {
            console.log('Getting price data for the first time.');
            await storePrice(result.top, result.currency);
        }
    } catch (error) {
        console.error("Cryptip Error: " + error);
    }
}

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function createPriceString(coindict, sym, currency, time) {
    try {
        sym = sym.toUpperCase()
        var priceString = "";
        var afterString = currency.toUpperCase() + " ";
        //add currency symbol
        switch (currency) {
            case 'usd':
                priceString += '&dollar;';
                afterString = '';
                break;
            case 'eur':
                priceString += '&euro;';
                break;
        }

        //adjust for relative size of price
        var price = parseFloat(coindict[sym][('price_' + currency)])
        if (price > 1000) {
            price = price.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })
        } else if (price > 1) {
            price = price.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
        }
        priceString += price + " "

        //add currency text
        priceString += afterString;

        //add percent change
        priceString += "("
        if (coindict[sym][('percent_change_' + time)] > 0) {
            //add plus sign if positive
            priceString += "+"
        }
        priceString += coindict[sym][('percent_change_' + time)] + "%)"

        return priceString
    } catch (error) {
        console.error("Cryptip Error: " + error)
    }
}

function addTooltip(coinmarketcap, currency = 'usd', time = '24h', checkNames = false, ignoreCase = false) {
    try {
        var coindict = {}
        var coins = []

        for (coin in coinmarketcap) {
            var sym = coinmarketcap[coin]['symbol'].toUpperCase();
            var name = coinmarketcap[coin]['name'].toUpperCase();

            //Remove meta information in the name surrounded by () or []
            name = name.replace(/ \[.*?\]/g, '');
            name = name.replace(/ \(.*?\)/g, '');

            if (!(sym in coindict)) {
                coindict[sym] = coinmarketcap[coin]
                coins.push((escapeRegExp(sym)))
            }
            if (checkNames) {
                if (!(name in coindict)) {
                    coindict[name] = coinmarketcap[coin]
                    coins.push(escapeRegExp(name))
                }
            }
        }

        if (ignoreCase) {
            regSettings = 'gi'
        } else {
            regSettings = 'g'
        }

        //sort by name length so things like "bitcoin cash" aren't accentially marked as bitcoin
        coins.sort(function (a, b) {
            return b.length - a.length;
        });

        var coinsreg = coins.join('|')
        var reCoins = new RegExp('\\b((' + coinsreg + '))\\b', regSettings)


        var elements = document.body.getElementsByTagName('*');

        elements = [].slice.call(elements, 0)

        var skipTags = ['script', 'style', 'input', 'noscript']

        for (var i = 0; i < elements.length; i++) {
            var element = elements[i];
            //check that the tag is not in the skipTags array
            if (skipTags.indexOf(element.tagName.toLowerCase()) === -1) {
                for (var j = element.childNodes.length - 1; j >= 0; j--) {
                    var node = element.childNodes[j];

                    if (node.nodeType === 3) {
                        var text = node.nodeValue;
                        var change = false;

                        if (reCoins.test(text)) {
                            text = text.replace(reCoins, function (a, b) {
                                //console.info('Adding cryptip to:' + b, element.tagName)
                                let priceString = createPriceString(coindict, b, currency, time);
                                return `<span class="cryptip" title="${priceString}">${b}</span>`;
                            });
                            change = true;
                        }

                        if (change) {
                            var replacementNode = document.createElement('span');
                            replacementNode.innerHTML = text;
                            node.parentNode.insertBefore(replacementNode, node);
                            node.parentNode.removeChild(node)
                        }

                    }
                }
            }
        }
    } catch (error) {
        console.error("Cryptip Error: " + error)
    }
}


async function cryptip() {
    try {
        await checkStorage();
        let data = await browser.storage.local.get();
        let coins = JSON.parse(data.coinmarketcap);
        addTooltip(coins, data.currency, data.period, data.checkNames, data.ignoreCase);
        tippy('.cryptip');
    } catch (error) {
        console.error("Cryptip Error: " + error)
    }
}

async function cryptipEmbedded() {
    try {
        let data = {
            'currency': 'usd',
            'top': '100',
            'period': '24h',
            'checkNames': true,
            'ignoreCase': true
        }
        let coins = await getPrice(data.top, data.currency);

        addTooltip(coins, data.currency, data.period, data.checkNames, data.ignoreCase);
        tippy('.cryptip');
    } catch (error) {
        console.error("Cryptip Error: " + error)
    }
}

if (this.browser) {
    cryptip();
} else {
    console.log('Cryptip: Detected embedded plugin.')
    cryptipEmbedded();
}