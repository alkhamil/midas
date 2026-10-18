export interface GoodProps { variant?: 'a' | 'b'; children?: string; testId?: string }
export interface BadProps { variant?: 'a' | 'b'; size?: 'sm' | 'lg'; label?: string; testId?: string }
export interface StubProps { testId?: string }
export interface MissingProps { testId?: string }
