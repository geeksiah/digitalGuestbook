'use client';

import { createContext, useContext } from 'react';

/**
 * The mobile top app bar exposes a DOM node that page headers portal into.
 * Kept in its own module so the shell and the primitives do not import each
 * other in a cycle.
 */
export const AppBarSlotContext = createContext<HTMLElement | null>(null);

export const useAppBarSlot = () => useContext(AppBarSlotContext);
