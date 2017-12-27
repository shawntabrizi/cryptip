async function getPrice(top, currency) {
    try {
        let response = await fetch("https://api.coinmarketcap.com/v1/ticker/?limit=" + top + "&convert=" + currency);
        let data = await response.json();

        return data;
    } catch (error) {
        console.error("Cryptip Error: " + error);
    }
}

function filterCoinName(name) {
    //Remove meta information in the name surrounded by () or []
    name = name.replace(/ \[.*?\]/g, '');
    name = name.replace(/ \(.*?\)/g, '');

    return name;
}

function createCoinDictionary(coinMarketCapData, checkNames = true) {
    var coinDictionary = {};

    for (coin in coinMarketCapData) {
        //Note that we make the whole dictionary keys uppercase
        var coinSymbol = coinMarketCapData[coin]['symbol'].toUpperCase();

        if (!(coinSymbol in coinDictionary)) {
            coinDictionary[coinSymbol] = [];
        }

        coinDictionary[coinSymbol].push(coinMarketCapData[coin]);

        if (checkNames) {
            var coinName = coinMarketCapData[coin]['name'].toUpperCase();

            //remove meta information from coin name
            coinName = filterCoinName(coinName);
            if (!(coinName in coinDictionary)) {
                coinDictionary[coinName] = [];
            }

            // dont want to double up on the array when it is the same coin
            if (coinName != coinSymbol) {
                coinDictionary[coinName].push(coinMarketCapData[coin]);
            }
        }
    }

    return coinDictionary;
}

async function storePrice(top = 100, currency = 'usd') {
    try {
        var coinMarketCapData = await getPrice(top, currency);
        var coinDictionary = createCoinDictionary(coinMarketCapData);
        var time = (new Date()).getTime();

        console.log('Cryptip: Storing new CoinMarketCap data at ' + (new Date(time).toString()));

        return browser.storage.local.set({
            'coinDictionary': JSON.stringify(coinDictionary),
            'time': time
        });

    } catch (error) {
        console.error("Cryptip Error: " + error);
    }
}


async function checkStorage() {
    try {
        var storage = await browser.storage.local.get();

        if (storage.time) {
            let currentTime = (new Date()).getTime();
            let timeDiff = currentTime - storage.time;
            let min = ((timeDiff / 1000) / 60);

            if (min > 1) {
                console.log('Cryptip: Over 1 minute has passed, getting new price data.');
                await storePrice(storage.top, storage.currency);
            } else {
                console.log('Cryptip: No need to get new data for another ' + Math.round(60 * (1 - min)) + ' seconds.');
            }

        } else {
            console.log('Getting price data for the first time.');
            await storePrice(storage.top, storage.currency);
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

        console.log(coins)

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

        var skipTags = ['script', 'style', 'input', 'noscript', 'code']

        for (var i = 0; i < elements.length; i++) {
            var element = elements[i];
            //check that the tag is not in the skipTags array
            if (skipTags.indexOf(element.tagName.toLowerCase()) === -1) {
                for (var j = element.childNodes.length - 1; j >= 0; j--) {
                    var node = element.childNodes[j];

                    if (node.nodeType === 3) {
                        var text = node.nodeValue;

                        if (reCoins.test(text)) {
                            text = text.replace(reCoins, function (a, b) {
                                console.info('Adding cryptip to:' + b, element.tagName)
                                let priceString = createPriceString(coindict, b, currency, time);
                                var advanceTooltip = document.createElement('div')
                                advanceTooltip.id = 'cryptip-' + b;
                                advanceTooltip.style.display = 'none';
                                advanceTooltip.innerHTML = `<p>Symbol: ${b}</p><p>Price: ${priceString}</p>`
                                document.body.appendChild(advanceTooltip);
                                console.log(advanceTooltip)
                                return `<cryptip class="cryptip">${b}</cryptip>`;
                            });
                            if (!document.querySelector('#'))
                            var replacementNode = document.createElement('cryptip-container');
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

async function addTooltipAdvance(element) {
    let symbol = element.innerText;
    symbol = symbol.toUpperCase();

    let data = await browser.storage.local.get();
    let coins = JSON.parse(data.coinmarketcap);

    var price = 0;

    for (coin in coins) {
        let sym = coins[coin]['symbol'].toUpperCase();
        let name = coins[coin]['name'].toUpperCase();

        if (symbol == sym || symbol == name) {
            price = coins[coin]['price_usd'];
            break;
        }
    }

    var tip = document.createElement('div');
    tip.innerText = "Symbol: " + symbol + "<br>Price: " + price

    return tip;

}

async function cryptip() {
    try {
        await checkStorage();
        let storage = await browser.storage.local.get();
        let coinDictionary = JSON.parse(storage.coinDictionary);
        console.log(coinDictionary)
        //addTooltip(coins, storage.currency, storage.period, storage.checkNames, storage.ignoreCase);


        const tip = tippy('.cryptip',
            {
                animation: 'shift-toward',
                arrow: true,
                html: function (el) {
                    var element = document.querySelector("#cryptip-" + el.innerText)
                    console.log(element)
                    return element;
                }
            });


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