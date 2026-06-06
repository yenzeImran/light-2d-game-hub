import { sendGameEvent } from '../../websocket';
import { store } from '../../store';
import { PillowTalk } from './pillow-talk';
import { ConnectFour } from './connect-four';
import { Othello } from './othello';
import { Chess } from './chess';
import { Memory } from './memory';
import { Checkers } from './checkers';
import { TicTacToe } from './tictactoe';

export interface GameInterface {
  render(container: HTMLElement): void;
  destroy(): void;
  handleEvent(event: string, payload: any): void;
}

const gameConstructors: Record<string, new () => GameInterface> = {
  pillow: PillowTalk,
  c4: ConnectFour,
  othello: Othello,
  chess: Chess,
  memory: Memory,
  checkers: Checkers,
  tictactoe: TicTacToe,
};

let currentGame: GameInterface | null = null;

export function renderGameSelector() {
  const selector = document.getElementById('gameSelector');
  if (!selector) return;
  selector.innerHTML = Object.keys(gameConstructors).map(key => `
    <button class="game-select-btn" data-game="${key}">${key.toUpperCase()}</button>
  `).join('');

  selector.querySelectorAll('.game-select-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const gameKey = (e.currentTarget as HTMLElement).dataset.game!;
      activateGame(gameKey);
    });
  });
}

export function activateGame(key: string) {
  const container = document.getElementById('activeGameContainer');
  if (!container) return;
  container.innerHTML = '';

  if (currentGame) {
    currentGame.destroy();
    currentGame = null;
  }

  const GameClass = gameConstructors[key];
  if (!GameClass) return;

  currentGame = new GameClass();
  currentGame.render(container);
}