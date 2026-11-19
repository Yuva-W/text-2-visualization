const STORAGE_KEY = "t2v.sessionId";

let memorySessionId = null;

function createSessionId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return `t2v-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function getSessionId() {
    try {
        const existing = window.localStorage.getItem(STORAGE_KEY);

        if (existing) {
            return existing;
        }

        const nextId = createSessionId();
        window.localStorage.setItem(STORAGE_KEY, nextId);
        return nextId;
    } catch {
        if (!memorySessionId) {
            memorySessionId = createSessionId();
        }

        return memorySessionId;
    }
}
