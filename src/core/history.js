/** Bounded undo/redo over immutable state snapshots. */
export class History {
  constructor(limit = 400) {
    this.limit = limit;
    this.past = [];
    this.future = [];
  }

  record(state) {
    this.past.push(state);
    if (this.past.length > this.limit) this.past.shift();
    this.future.length = 0;
  }

  undo(currentState) {
    if (!this.past.length) return null;
    this.future.push(currentState);
    return this.past.pop();
  }

  redo(currentState) {
    if (!this.future.length) return null;
    this.past.push(currentState);
    return this.future.pop();
  }

  clear() {
    this.past.length = 0;
    this.future.length = 0;
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }
}
