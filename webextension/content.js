var global = {
    //default settings
    'settings': {
        //use all tokens
        'top': 0,
        //output currency
        'currency': 'usd',
        //period for price change
        'period': '24h',
        //also look for the coin name
        'checkNames': true,
        //also ignore case
        'ignoreCase': true,
        //minimal mode or widget mode
        'style': 'minimal',
        //theme dark or light
        'theme': 'dark',
        //logging prints in console which matches are detected
        'logging': false
    }
}

//Get the price from coinmarketcap api
async function getPrice() {
    try {
        let top = global.settings.top
        let currency = global.settings.currency

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

function createCoinDictionary(coinMarketCapData) {
    var coinDictionary = {};
    var checkNames = global.settings.checkNames;

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

//store price information into local storage
async function storePrice() {
    try {
        var coinMarketCapData = await getPrice();
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

//Check if plugin is enabled
function checkBlacklist() {
    if (global.blacklist) {
        var site = window.location.hostname
        if (global.blacklist.includes(site)) {
            return false;
        }
    }

    return true;
}

async function checkStorage() {
    try {
        //Get whatever is in the local storage
        var storage = await browser.storage.local.get();

        //check blacklist
        if (storage.blacklist) {
            global.blacklist = JSON.parse(storage.blacklist);
            global.enabled = checkBlacklist();

            //if not enabled, no need to do anything more
            if (!global.enabled) {
                return null;
            }
        } else {
            global.enabled = true;
        }

        //Set the settings
        if (storage.settings) {
            global.settings = JSON.parse(storage.settings);
        }

        //check time
        if (storage.time) {
            let currentTime = (new Date()).getTime();
            let timeDiff = currentTime - storage.time;
            let min = ((timeDiff / 1000) / 60);

            //if more than a minute, then get new price information
            if (min > 1) {
                console.log('Cryptip: Over 1 minute has passed, getting new price data.');
                await storePrice();
            } else {
                global.coinDictionary = JSON.parse(storage.coinDictionary)
                console.log('Cryptip: No need to get new data for another ' + Math.round(60 * (1 - min)) + ' seconds.');
            }
        //if no time information, get data for the first time
        } else {
            console.log('Cryptip: Getting price data for the first time.');
            await storePrice();
        }

    } catch (error) {
        console.error("Cryptip Error: " + error);
    }
}

//convert symbols which affect regular expressions into regular expression safe symbols
function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function createPriceString(sym) {
    try {
        var coinDictionary = global.coinDictionary
        var currency = global.settings.currency
        var period = global.settings.period

        sym = sym.toUpperCase()

        var priceString = "";
        var afterString = currency.toUpperCase() + " ";

        //add currency symbol, more work can be done here, probably not worth
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
        if (coinDictionary[sym][0][('percent_change_' + period)] > 0) {
            //add plus sign if positive
            priceString += "+"
        }
        priceString += coinDictionary[sym][0][('percent_change_' + period)] + "%)"

        return priceString
    } catch (error) {
        console.error("Cryptip Error: " + error)
    }
}

function createRegularExpression() {
    var coins = Object.keys(global.coinDictionary)
    var ignoreCase = global.settings.ignoreCase

    //sort by name length so things like "bitcoin cash" aren't accentially marked as bitcoin
    coins.sort(function (a, b) {
        return b.length - a.length;
    });

    //fix any problems in the string that may affect the regular expression
    coins = coins.map(escapeRegExp)

    //should regex ignore case?
    var reSettings = ignoreCase ? 'gi' : 'g'

    //turn all coins into a giant 'or' statement
    var coinsreg = coins.join('|')
    var reCoins = new RegExp('\\b(' + coinsreg + ')\\b', reSettings)

    return reCoins
}

function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

//widget, aka minimal = false
function createWidget(sym, priceString) {
    try {
        if (!(document.getElementById('template-' + sym.replace(/[\W_]/g, '-').toLowerCase()))) {
            sym = sym.toUpperCase();
            var coins = global.coinDictionary[sym]

            for (c in coins) {
                var coin = coins[c]
                var template = document.createElement('div');

                //template support for same symbol
                template.id = 'template-' + sym.replace(/[\W_]/g, '-').toLowerCase() + (c > 0 ? c : '');

                template.style.display = 'none';
                template.innerHTML = `
                                <div class="cryptip-container">
                                    <div class="cryptip-row">
                                        <div class="cryptip-image cryptip-col-3"><img class="cryptip-img-responsive" src="https://files.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png"></div>
                                        <div class="cryptip-main cryptip-col-9">
                                                <div class="cryptip-title"><a class="cryptip-link" target="_blank" href="https://coinmarketcap.com/currencies/${coin.id}/?utm_source=cryptip">${coin.name} (${coin.symbol})</a></div>
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

//tooltip aka style = true
function createTip(sym, priceString) {
    try {
        if (!(document.getElementById('template-' + sym.replace(/[\W_]/g, '-').toLowerCase()))) {
            sym = sym.toUpperCase();
            var coins = global.coinDictionary[sym]

            for (c in coins) {
                var coin = coins[c]
                var template = document.createElement('div');

                //template support for same symbol
                template.id = 'template-' + sym.replace(/[\W_]/g, '-').toLowerCase() + (c > 0 ? c : '');

                template.style.display = 'none';
                template.innerHTML = priceString
                document.body.appendChild(template);
            }
        } else {
            //console.log("Already made a cryptip for this: " + sym)
        }

    } catch (error) {
        console.error("Cryptip Error: " + error)
    }
}

function addTooltip() {
    try {
        var logging = global.settings.logging

        var regularExpressionCoins = createRegularExpression()

        findAndReplaceDOMText(document.body, {
            preset: 'prose',
            find: regularExpressionCoins,
            replace: function (portion, match) {
                //portion is the full text in the node
                //match is the specific regex match
                if (logging) {
                    console.info('Adding cryptip to:' + portion.text)
                }

                let priceString = createPriceString(match[0]);

                if (global.settings.style == 'minimal') {
                    createTip(match[0], priceString)
                } else if (global.settings.style == 'widget') {
                    createWidget(match[0], priceString)
                } else {
                    console.error("Cryptip Error: Reset your Cryptip style.")
                }

                let cryptipWrapper = document.createElement('cryptip')
                cryptipWrapper.setAttribute("data-tippy-interactive", "true")
                cryptipWrapper.setAttribute("class", "cryptip")
                cryptipWrapper.setAttribute("data-coin", match[0])
                cryptipWrapper.innerText = portion.text;

                return cryptipWrapper;
            }
        });


        //checkPageElementsForCoins(elements, regularExpressionCoins, addCryptipToText)

    } catch (error) {
        console.error("Cryptip Error: " + error)
    }
}

function checkSettings() {
    let result = global.settings
    result.enabled = global.enabled
    return result
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

async function addToBlacklist() {

    if (!global.blacklist) {
        global.blacklist = []
    }

    var site = window.location.hostname

    if (!(global.blacklist.includes(site))) {
        global.blacklist.push(site)

        disableTippy();
        global.enabled = false;

        return await browser.storage.local.set({
            'blacklist': JSON.stringify(global.blacklist),
        });
    }
}

async function removeFromBlacklist() {
    if (global.blacklist) {

        var site = window.location.hostname

        if (global.blacklist.includes(site)) {
            var index = global.blacklist.indexOf(site);
            global.blacklist.splice(index, 1);

            var result = await browser.storage.local.set({
                'blacklist': JSON.stringify(global.blacklist),
            });
            global.enabled = true;

            await cryptip();

            return result
        }
    }
}

async function cryptip() {
    try {
        //Retrieves and sets settings, then checks for stale coin data and queries coinmarket cap API
        await checkStorage();
        //Check cryptip is enabled
        if (global.enabled) {
            //Check we have coin data
            if (global.coinDictionary) {
                addTooltip();

                // for each element with cryptip
                const tip = tippy('.cryptip', {
                    theme: global.settings.theme,
                    html: function (element) {
                        //find what coin it represents
                        var sym = element.dataset.coin;

                        //get the cryptip for that coin
                        var template = '#template-' + sym.replace(/[\W_]/g, '-').toLowerCase();

                        return template
                    }
                });
            } else {
                console.error("Cryptip Error: Something went wrong getting the coin information. Try refreshing.")
            }
        } else {
            console.log("Cryptip is disabled for this site.")
        }

    } catch (error) {
        console.error("Cryptip Error: " + error)
    }
}

async function cryptipEmbedded() {
    var coinMarketCapData = await getPrice();
    global.coinDictionary = createCoinDictionary(coinMarketCapData);
    addTooltip();
    // for each element with cryptip
    const tip = tippy('.cryptip', {
        theme: global.settings.theme,
        html: function (element) {
            //find what coin it represents
            var sym = element.dataset.coin;

            //get the cryptip for that coin
            var template = '#template-' + sym.replace(/[\W_]/g, '-').toLowerCase();

            return template
        }
    });
}

function disableTippy() {

    var tips = document.querySelectorAll('.cryptip');
    for (t in tips) {
        var tip = tips[t];
        if (tip._tippy) {
            tip._tippy.destroy();
        }
    }
}

async function setStyle(style) {

    global.settings.style = style;

    var result = await browser.storage.local.set({
        'settings': JSON.stringify(global.settings)
    });

}

async function setTheme(theme = 'dark') {

    global.settings.theme = theme;

    var result = await browser.storage.local.set({
        'settings': JSON.stringify(global.settings)
    });

}

if (this.browser) {
    cryptip();

    browser.runtime.onMessage.addListener(request => {

        if (request.message == 'addToBlacklist') {
            addToBlacklist();
            return Promise.resolve({ response: "Site Added to Blacklist" })
        }

        if (request.message == 'removeFromBlacklist') {
            removeFromBlacklist();
            return Promise.resolve({ response: "Site Added to Whitelist" })
        }

        if (request.message == 'checkSettings') {
            var result = checkSettings();
            return Promise.resolve({ response: JSON.stringify(result) })
        }

        if (request.message == 'setWidget') {
            var result = setStyle('widget');
            return Promise.resolve({ response: "Style set to Widget. Refresh the page." })
        }

        if (request.message == 'setMinimal') {
            var result = setStyle('minimal');
            return Promise.resolve({ response: "Style set to Minimal. Refresh the page." })
        }

        if (request.message == 'setDark') {
            var result = setTheme('dark');
            return Promise.resolve({ response: "Theme set to Dark. Refresh the page." })
        }

        if (request.message == 'setLight') {
            var result = setTheme('light');
            return Promise.resolve({ response: "Theme set to Light. Refresh the page." })
        }

        return Promise.resolve({ response: "Didn't perform any action" });
    });
} else {
    console.log('Cryptip: Detected embedded plugin.')
    cryptipEmbedded();
}

