# Crypto Terminal

A Bloomberg Terminal-style Electron desktop app for crypto futures trading signals from Telegram channels.

## Features

- **Live market data** from Binance, Bybit, and OKX futures (WebSocket streaming)
- **Telegram signal feed** — connect to public and private channels via MTProto
- **Auto-parsed signals** — extracts entry, take profit (TP1/2/3), stop loss, and leverage
- **Order book visualization** for any selected instrument
- **Signal history** with manual status tracking (Pending / Active / TP Hit / SL Hit)
- Bloomberg-inspired dark terminal UI with live price flash animations

## Setup

### 1. Install dependencies

```bash
cd crypto-terminal
npm install
```

### 2. Get Telegram API credentials

1. Go to **https://my.telegram.org**
2. Log in → API Development Tools
3. Create an app and note your **API ID** and **API Hash**

### 3. Run in dev mode

```bash
npm run dev
```

The app opens with live exchange data immediately. To connect Telegram:

1. Press **F1** (or click ⚙ SETTINGS)
2. Enter your **API ID**, **API Hash**, and **phone number** (with country code, e.g. +1...)
3. Submit the verification code sent to your Telegram app
4. Go to **Channels** tab, select which channels to monitor

### 4. Build for production

```bash
npm run package:mac    # macOS DMG
npm run package        # Current platform
```

## Layout

```
┌──────────────────────────────────────────────────┐
│  CRYPTO TERMINAL  [clock] [exchange status]  ⚙   │
├──────────┬───────────────────────┬────────────────┤
│          │  PRICE TICKER         │  ORDER BOOK    │
│  SIGNAL  │  Top 20 futures       │  Depth for     │
│  FEED    │  from all 3 exchanges │  selected      │
│          │                       │  symbol        │
├──────────┴───────────────────────┴────────────────┤
│  SIGNAL HISTORY TABLE                             │
└──────────────────────────────────────────────────┘
```

## Signal Parser

Messages are auto-parsed for these patterns:

| Field | Example |
|-------|---------|
| Direction | `LONG`, `SHORT`, `BUY`, `SELL` |
| Symbol | `BTC/USDT`, `ETHUSDT`, `SOL-USDT` |
| Entry | `Entry: 42000-42500` |
| Take Profits | `TP1: 43500`, `Target 1: 44000` |
| Stop Loss | `SL: 41000`, `Stop Loss: 40500` |
| Leverage | `10x`, `Leverage: 20x` |

## Tech Stack

- Electron 31 + electron-vite
- React 18 + TypeScript
- Zustand + immer (state management)
- `telegram` npm package (MTProto client)
- Native WebSockets (exchange data)
- electron-store (settings persistence)
- Custom CSS (Bloomberg dark theme)
