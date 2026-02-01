# Stock Analyst Skill

A professional-grade stock analysis tool using Yahoo Finance data (via `yahoo-finance2`) and technical indicators.

## Features
- **Real-time Quote**: Price, change, currency.
- **Technical Analysis**: 
  - RSI (14)
  - MACD (12, 26, 9)
  - Bollinger Bands (20, 2)
  - SMA 50 & 200
- **Sentiment Analysis**: Scans recent news headlines for bullish/bearish keywords.
- **Signal Generation**: BUY/SELL/HOLD recommendation based on composite score.

## Usage

```bash
node skills/stock-analyst/analyze.js <TICKER>
```

## Example
```bash
node skills/stock-analyst/analyze.js AAPL
```

## Dependencies
- Node.js
- `yahoo-finance2`
- `technicalindicators`
