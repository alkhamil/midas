import { generatedNavItems } from './generated/navigation';
import type { NavItemType } from '../shared/types/navigation';

/** Menu sidebar. Item di bawah ini ditulis tangan; menu module hasil Code Builder ada di `generated/navigation.tsx`. */
export const navItems: NavItemType[] = [...generatedNavItems];
