export const store = {
  _state: {
    profile: null as any,
    currentRoom: null as string | null,
    players: [] as any[],
    connectionStatus: 'disconnected',
    publicRooms: [] as { code: string; playerCount: number; public: boolean }[],
    theme: '' as '' | 'dark' | 'warm' | 'earth' | 'water',
  },
  _listeners: new Set<() => void>(),

  get state() {
    return this._state;
  },

  setState(partial: Partial<typeof this._state>) {
    Object.assign(this._state, partial);
    this._listeners.forEach(fn => fn());
  },

  subscribe(fn: () => void) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }
};