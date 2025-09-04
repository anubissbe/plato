import React from 'react';
import { render } from 'ink';
import { App, runTui as runKeyboardTui } from './keyboard-handler.js';

export async function runTui() {
  return runKeyboardTui();
}

export { App };