const YahooFinance = require('yahoo-finance2').default;
const { RSI, MACD, SMA, BollingerBands } = require('technicalindicators');

const args = process.argv.slice(2);
const ticker = args[0] || 'AAPL';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

async function analyze(symbol) {
    try {
        // 1. Fetch Quote (Realtime-ish)
        const quote = await yahooFinance.quote(symbol);
        
        // 2. Fetch History for TA
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 14); // Grab 14 months for EMA200 safety (trading days)
        const period1 = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Use chart() instead of historical()
        const chartResult = await yahooFinance.chart(symbol, {
            period1: period1,
            interval: '1d'
        });
        
        // chart() returns { meta: {...}, quotes: [...] }
        const history = chartResult.quotes;

        if (!history || history.length < 50) {

            throw new Error('Insufficient historical data');
        }

        // Prepare data for technicalindicators
        const closes = history.map(candle => candle.close);
        // technicalindicators usually expects array of numbers
        
        // 3. Calculate Indicators
        
        // RSI (14)
        const rsiValues = RSI.calculate({ values: closes, period: 14 });
        const currentRSI = rsiValues[rsiValues.length - 1];

        // MACD (12, 26, 9)
        const macdValues = MACD.calculate({
            values: closes,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false
        });
        const currentMACD = macdValues[macdValues.length - 1];

        // Bollinger Bands (20, 2)
        const bbValues = BollingerBands.calculate({
            period: 20, 
            values: closes,
            stdDev: 2
        });
        const currentBB = bbValues[bbValues.length - 1];

        // SMA (50)
        const sma50Values = SMA.calculate({ period: 50, values: closes });
        const currentSMA50 = sma50Values[sma50Values.length - 1];
        
        // SMA (200)
        const sma200Values = SMA.calculate({ period: 200, values: closes });
        const currentSMA200 = sma200Values.length > 0 ? sma200Values[sma200Values.length - 1] : null;

        // 4. Fetch News
        let newsItems = [];
        let sentimentLabel = 'Neutral';
        let sentimentScore = 0;

        try {
            const searchResult = await yahooFinance.search(symbol, { newsCount: 5 });
            newsItems = searchResult.news || [];
            
            const posWords = ['surge', 'jump', 'gain', 'buy', 'bull', 'growth', 'record', 'up', 'beat', 'profit', 'upgrade', 'high'];
            const negWords = ['drop', 'fall', 'loss', 'bear', 'crash', 'down', 'miss', 'risk', 'warn', 'debt', 'downgrade', 'low'];

            const headlines = newsItems.map(n => n.title).join(' . ');
            const lowerHeadlines = headlines.toLowerCase();
            
            posWords.forEach(w => { if(lowerHeadlines.includes(w)) sentimentScore++; });
            negWords.forEach(w => { if(lowerHeadlines.includes(w)) sentimentScore--; });

            if (sentimentScore > 0) sentimentLabel = 'Bullish';
            if (sentimentScore < 0) sentimentLabel = 'Bearish';
        } catch (e) {
            // News fetch might fail, ignore
        }

        // 5. Signal Logic
        let signal = 'HOLD';
        let signalReason = [];

        // RSI Logic
        if (currentRSI < 30) {
            signalReason.push('RSI Oversold (<30)');
        } else if (currentRSI > 70) {
            signalReason.push('RSI Overbought (>70)');
        }

        // MACD Logic
        if (currentMACD && currentMACD.histogram > 0) {
             signalReason.push('MACD Bullish');
        } else if (currentMACD && currentMACD.histogram < 0) {
             signalReason.push('MACD Bearish');
        }

        // Price vs SMA
        if (currentSMA50 && quote.regularMarketPrice > currentSMA50) {
            signalReason.push('Price > SMA50');
        } else if (currentSMA50) {
            signalReason.push('Price < SMA50');
        }
        
        if (currentSMA200 && quote.regularMarketPrice > currentSMA200) {
            signalReason.push('Price > SMA200 (Long term bull)');
        }

        // Composite decision
        let bullPoints = 0;
        let bearPoints = 0;

        if (currentRSI < 30) bullPoints += 2; // Strong buy signal
        if (currentRSI > 70) bearPoints += 2; // Strong sell signal
        if (currentRSI > 50) bullPoints += 0.5; else bearPoints += 0.5;

        if (currentMACD.histogram > 0) bullPoints += 1; else bearPoints += 1;
        if (quote.regularMarketPrice > currentSMA50) bullPoints += 1; else bearPoints += 1;
        if (currentSMA200 && quote.regularMarketPrice > currentSMA200) bullPoints += 1;

        if (sentimentScore > 2) bullPoints += 1;
        if (sentimentScore < -2) bearPoints += 1;

        if (bullPoints > bearPoints + 2) signal = 'BUY';
        else if (bearPoints > bullPoints + 2) signal = 'SELL';
        
        // Refine 'Strong' signals
        if (signal === 'BUY' && currentRSI < 40) signal = 'STRONG BUY'; // Dip buy
        if (signal === 'SELL' && currentRSI > 60) signal = 'STRONG SELL'; // Top sell

        const result = {
            symbol: symbol.toUpperCase(),
            price: quote.regularMarketPrice,
            currency: quote.currency,
            changePercent: quote.regularMarketChangePercent,
            technical: {
                rsi: parseFloat(currentRSI.toFixed(2)),
                macd: {
                    histogram: parseFloat(currentMACD.histogram.toFixed(4)),
                    signal: parseFloat(currentMACD.signal.toFixed(4)),
                    macd: parseFloat(currentMACD.MACD.toFixed(4))
                },
                bb: {
                   upper: parseFloat(currentBB.upper.toFixed(2)),
                   lower: parseFloat(currentBB.lower.toFixed(2))
                },
                sma50: parseFloat(currentSMA50.toFixed(2)),
                sma200: currentSMA200 ? parseFloat(currentSMA200.toFixed(2)) : null
            },
            news: {
                sentiment: sentimentLabel,
                score: sentimentScore,
                headlines: newsItems.map(n => n.title).slice(0, 3)
            },
            signal: signal,
            reasons: signalReason
        };

        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error(JSON.stringify({ error: error.message }));
        process.exit(1);
    }
}

analyze(ticker);
