// Fixture: Good cocok desain, Bad props-nya beda, Stub masih kerangka, Missing tidak di-export.
export function Good(props: { variant?: 'a' | 'b'; children?: string; testId?: string }) { return props.children ?? null; }
export function Bad(props: { variant?: 'a'; size?: number }) { return String(props.variant ?? props.size ?? ''); }
export function Stub() { return null; }
Stub.midasStub = true;
