# PAC-MAN Arcade

Remake fedele dell'arcade originale PAC-MAN, realizzato in HTML5 canvas puro, senza dipendenze esterne né asset: tutto (labirinto, sprite, audio) è generato via codice.

![Platform](https://img.shields.io/badge/platform-browser-blue)

## Come giocare

### Avvio rapido
1. Scarica o clona la repository:
   ```bash
   git clone https://github.com/sandrodream2/pacman-arcade.git
   ```
2. Apri `index.html` con un doppio click: il gioco parte subito nel browser.

Non è richiesto alcun server: il gioco è interamente contenuto nei tre file del progetto.

### Server locale (opzionale)
```bash
cd pacman-arcade
python -m http.server 8000
```
Poi apri `http://localhost:8000` nel browser.

## Controlli

| Tasto | Azione |
|---|---|
| Frecce / WASD | Movimento |
| P | Pausa |
| Enter | Avvia la partita |
| Pulsanti touch | Controllo su mobile |

## Meccaniche

- **Vite**: 10 a partita (rimanenti visualizzate in basso a sinistra)
- **Puntini**: 20 punti ciascuno
- **Power pellet**: rende i fantasmi vulnerabili ( lampeggiano in blu)
- **Fantasmi mangiati**: 200, 400, 800, 1600 punti in sequenza
- **Vita extra**: al superamento di 10.000 punti (solo se hai meno di 5 vite)
- **Livelli**: la velocità aumenta a ogni livello completato

## Struttura del progetto

| File | Descrizione |
|---|---|
| `index.html` | Pagina con canvas 224×288 (risoluzione arcade originale) e controlli touch |
| `game.js` | Motore completo: labirinto, IA dei 4 fantasmi, punteggio, livelli, audio Web Audio API |
| `style.css` | Stile della pagina e dei pulsanti touch |

## Riconoscimenti

PAC-MAN è un marchio di Bandai Namco Entertainment. Questo progetto è un esercizio educativo non commerciale.
