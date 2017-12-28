var global = {
}

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
    //Remove spaces from the front and back
    name = name.trim();
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

        //only run this if the user also wants to add cryptip to coin names
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
        global.coinDictionary = createCoinDictionary(coinMarketCapData);
        var time = (new Date()).getTime();

        console.log('Cryptip: Storing new CoinMarketCap data at ' + (new Date(time).toString()));

        return await browser.storage.local.set({
            'coinDictionary': JSON.stringify(global.coinDictionary),
            'time': time
        });

    } catch (error) {
        console.error("Cryptip Error: " + error);
    }
}


async function checkStorage() {
    try {
        //Get whatever is in the local storage
        var storage = await browser.storage.local.get();

        //check time
        if (storage.time) {
            let currentTime = (new Date()).getTime();
            let timeDiff = currentTime - storage.time;
            let min = ((timeDiff / 1000) / 60);

            //if more than a minute, then get new price information
            if (min > 1) {
                console.log('Cryptip: Over 1 minute has passed, getting new price data.');
                await storePrice(storage.top, storage.currency);
            } else {
                global.coinDictionary = JSON.parse(storage.coinDictionary)
                console.log('Cryptip: No need to get new data for another ' + Math.round(60 * (1 - min)) + ' seconds.');
            }
            //if no time information, get data for the first time
        } else {
            console.log('Getting price data for the first time.');
            await storePrice(storage.top, storage.currency);
        }

    } catch (error) {
        console.error("Cryptip Error: " + error);
    }
}

//convert symbols which affect regular expressions into regular expression safe symbols
function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function createPriceString(sym, currency = 'usd', time= '24h') {
    try {
        var coinDictionary = global.coinDictionary
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
        var price = parseFloat(coinDictionary[sym][0][('price_' + currency)])
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
        if (coinDictionary[sym][0][('percent_change_' + time)] > 0) {
            //add plus sign if positive
            priceString += "+"
        }
        priceString += coinDictionary[sym][0][('percent_change_' + time)] + "%)"

        return priceString
    } catch (error) {
        console.error("Cryptip Error: " + error)
    }
}

function createRegularExpression(coinDictionary, ignoreCase = true) {
    var coins = Object.keys(coinDictionary)

    //sort by name length so things like "bitcoin cash" aren't accentially marked as bitcoin
    coins.sort(function (a, b) {
        return b.length - a.length;
    });

    //fix any problems in the string that may affect the regular expression
    coins = coins.map(escapeRegExp)

    var reSettings = ignoreCase ? 'gi' : 'g'


    var coinsreg = coins.join('|')
    var reCoins = new RegExp('\\b((' + coinsreg + '))\\b', reSettings)

    return reCoins
}

function checkPageElementsForCoins(elements, regularExpression, callback) {
    try {
        var elementsCopy = Array.prototype.slice.call(elements, 0)

        var skipTags = ['script', 'style', 'input', 'noscript', 'code']

        for (var i = 0; i < elementsCopy.length; i++) {
            var element = elementsCopy[i];
            //check that the tag is not in the skipTags array
            if (skipTags.indexOf(element.tagName.toLowerCase()) === -1) {
                for (var j = element.childNodes.length - 1; j >= 0; j--) {
                    var node = element.childNodes[j];
                    if (node.nodeType === 3) {
                        if (regularExpression.test(node.nodeValue)) {
                            if (typeof callback == "function") {
                                callback(node, regularExpression)
                            } else {
                                console.error("Not a callback function.")
                            }
                        }

                    }
                }
            }
        }
    } catch (error) {
        console.error("Cryptip Error: " + error)
    }
}

function createWidget(sym) {
    if (!(document.getElementById('template-' + sym.toLowerCase()))) {
        sym = sym.toUpperCase();
        var coin = global.coinDictionary[sym][0]

        var template = document.createElement('div');


        template.id = 'template-' + sym.toLowerCase();
        template.style.display = 'none';

        template.innerHTML = `
                                <div class="cryptip-container">
                                    <div class="cryptip-image"><img src="https://files.coinmarketcap.com/static/img/coins/32x32/${coin.id}.png"></div>
                                    <div class="cryptip-main">
                                        <div class="cryptip-title">${coin.name} (${coin.symbol})</div>
                                        <div class="cryptip-price">${coin.price_usd} (${coin.percent_change_24h})</div>
                                    </div>
                                    <div class="cryptip-rank"><p>RANK</p><p>${coin.rank}</p></div>
                                    <div class="cryptip-market"><p>MARKET CAP</p><p>${coin.market_cap_usd}</p></div>
                                </div>
                                `
        document.body.appendChild(template);
    }
}

function addCryptipToText(node, regularExpression) {
    try {
        var text = node.nodeValue;

        text = text.replace(regularExpression, function (fullText, match) {
            console.info('Adding cryptip to:' + match, node.parentNode.tagName)
            let priceString = createPriceString(match);
            createWidget(match)
            return `<cryptip class="cryptip" >${match}</cryptip>`;
        });

        var replacementNode = document.createElement('cryptip-wrapper');
        replacementNode.innerHTML = text;
        node.parentNode.insertBefore(replacementNode, node);
        node.parentNode.removeChild(node)


    } catch (error) {
        console.error("Cryptip Error: " + error)
    }
}

function addTooltip(currency = 'usd', time = '24h', checkNames = true, ignoreCase = true) {
    try {

        var coinDictionary = global.coinDictionary;

        var regularExpressionCoins = createRegularExpression(coinDictionary, ignoreCase)

        var elements = document.body.getElementsByTagName('*');

        checkPageElementsForCoins(elements, regularExpressionCoins, addCryptipToText)

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
        if (global.coinDictionary) {
            addTooltip();
        }

        //const template1 = document.querySelector('#template')
        //const clonedTemplate = template1.cloneNode(true)

        //const initialText = template.textContent

        const tip = tippy('.cryptip', {
            html: function (element) {
                return '#template-' + element.innerText.toLowerCase()
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