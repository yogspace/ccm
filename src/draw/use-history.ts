import { useRef, useState } from "react";

/** How many steps back are kept. */
const LIMIT = 40;

/**
 * Undo and redo: states to go back to, and – after going back – forward
 * again. Every new step (`remember`) drops the way forward.
 */
export const useHistory = <T>() => {
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const push = (entry: T) => {
    past.current.push(entry);
    if (past.current.length > LIMIT) past.current.shift();
    setCanUndo(true);
  };

  /** A new step: `before` is the state it started from. */
  const remember = (before: T) => {
    push(before);
    future.current = [];
    setCanRedo(false);
  };

  /** Back from `current`: the state to restore – or none left. */
  const back = (current: T) => {
    const previous = past.current.pop();
    if (previous === undefined) return null;
    future.current.push(current);
    setCanUndo(past.current.length > 0);
    setCanRedo(true);
    return previous;
  };

  /** Forward again from `current`: the state to restore – or none left. */
  const forward = (current: T) => {
    const next = future.current.pop();
    if (next === undefined) return null;
    push(current);
    setCanRedo(future.current.length > 0);
    return next;
  };

  return { canUndo, canRedo, remember, back, forward };
};
