var global = {}

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

async function storePrice(top = 0, currency = 'usd') {
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

function createPriceString(sym, currency = 'usd', time = '24h') {
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

function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

function marketCapString(value) {
    value = parseFloat(value)

    if (value >= 1e12) {
        return (value / 1e12).toFixed(2) + "T"
    } else if (value >= 1e9) {
        return (value / 1e9).toFixed(2) + "B"
    } else if (value >= 1e6) {
        return (value / 1e6).toFixed(2) + "M"
    } else if (value >= 1e3) {
        return (value / 1e3).toFixed(2) + "K"
    } else {
        return value.toFixed(2)
    }
}

function symbolToId(symbol) {
    return symbol.replace(/[\W_]/g, '-')
}

function createWidget(sym, priceString) {
    try {
        if (!(document.getElementById('template-' + sym.replace(/[\W_]/g, '-').toLowerCase()))) {
            sym = sym.toUpperCase();
            var coins = global.coinDictionary[sym]

            for (c in coins) {
                var coin = coins[c]
                var template = document.createElement('div');
                
                template.id = 'template-' + sym.replace(/[\W_]/g, '-').toLowerCase() + (c > 0 ? c : '');
                console.log(template.id)
                template.style.display = 'none';
                template.innerHTML = `
                                <div class="cryptip-container">
                                    <div class="cryptip-row">
                                        <div class="cryptip-image cryptip-col-3"><img class="cryptip-img-responsive" src="https://files.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png"></div>
                                        <div class="cryptip-main cryptip-col-9">

                                                <div class="cryptip-title"><a class="cryptip-link" href="https://coinmarketcap.com/currencies/${coin.id}/?utm_source=cryptip">${coin.name} (${coin.symbol})</a></div>
                                                <div class="cryptip-price">${priceString}</div>
                                                <div class="cryptip-btc">${coin.price_btc} BTC</div>

                                        </div>
                                    </div>
                                    <div class="cryptip-row">
                                        <div class="cryptip-rank cryptip-col-4">
                                            <div class="cryptip-subtitle">RANK</div>
                                            <div class="cryptip-subvalue">${coin.rank}</div>
                                        </div>
                                        <div class="cryptip-rank cryptip-col-4">
                                            <div class="cryptip-subtitle">MARKET CAP</div>
                                            <div class="cryptip-subvalue">${marketCapString(coin.market_cap_usd)}</div>
                                        </div>
                                        <div class="cryptip-rank cryptip-col-4">
                                            <div class="cryptip-subtitle">24H VOLUME</div>
                                            <div class="cryptip-subvalue">${marketCapString(coin['24h_volume_usd'])}</div>
                                        </div>
                                    </div>
                                </div>
                                `
                document.body.appendChild(template);
            }
        } else {
            //console.log("Already made a cryptip for this: " + sym)
        }

    } catch (error) {
        console.error("Cryptip Error: " + error)
    }
}

function addCryptipToText(node, regularExpression) {
    try {
        var text = node.nodeValue;
        //text might have HTML elements, so we convert them to text html elements
        text = htmlEntities(text)

        text = text.replace(regularExpression, function (fullText, match) {
            console.info('Adding cryptip to:' + match, node.parentNode.tagName)
            let priceString = createPriceString(match);
            createWidget(match, priceString)
            return `<cryptip class="cryptip" data-tippy-interactive="true">${match}</cryptip>`;
        });

        var replacementNode = document.createElement('cryptip-wrapper');
        replacementNode.innerHTML = text;
        node.parentNode.replaceChild(replacementNode, node);


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

        const tip = tippy('.cryptip', {
            html: function (element) {
                var sym = element.innerHTML
                var template = '#template-' + element.innerHTML.replace(/[\W_]/g, '-').toLowerCase();
                //console.log(template)
                return template
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