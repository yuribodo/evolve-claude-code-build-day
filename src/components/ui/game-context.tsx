"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createGame, type Game } from "@/lib/game";
import type { GameState } from "@/lib/game-types";
import { useStoreValue } from "@/lib/store";

const GameContext = createContext<Game | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [game] = useState(() => createGame());
  useEffect(() => () => game.dispose(), [game]);
  return <GameContext.Provider value={game}>{children}</GameContext.Provider>;
}

export function useGame(): Game {
  const game = useContext(GameContext);
  if (!game) throw new Error("useGame must be used inside GameProvider");
  return game;
}

export function useGameState<S>(selector: (s: GameState) => S): S {
  const game = useGame();
  return useStoreValue(game.store, selector);
}
