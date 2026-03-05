import { describe, expect, it } from 'vitest';
import { UssdStateMachine } from './UssdStateMachine.js';

const contests = [
  {
    id: 'contest-1',
    title: 'Best Artist',
    options: [
      { id: 'opt-1', name: 'Alice', totalVotes: 10 },
      { id: 'opt-2', name: 'Bob', totalVotes: 8 },
    ],
  },
];

describe('UssdStateMachine', () => {
  it('starts at welcome state', () => {
    const machine = new UssdStateMachine();
    const result = machine.step({
      mode: 'START',
      userInput: '',
      state: 'WELCOME',
      context: {},
      contests,
    });
    expect(result.nextState).toBe('WELCOME');
    expect(result.responseLines.join(' ')).toContain('Vote now');
    expect(result.shouldEnd).toBe(false);
  });

  it('supports vote flow from contest selection to confirmation', () => {
    const machine = new UssdStateMachine();
    const contestStep = machine.step({
      mode: 'MORE',
      userInput: '1',
      state: 'WELCOME',
      context: {},
      contests,
    });
    expect(contestStep.nextState).toBe('SELECT_CONTEST');

    const optionStep = machine.step({
      mode: 'MORE',
      userInput: '1',
      state: 'SELECT_CONTEST',
      context: {},
      contests,
    });
    expect(optionStep.nextState).toBe('SELECT_OPTION');

    const confirmStep = machine.step({
      mode: 'MORE',
      userInput: '1',
      state: 'SELECT_OPTION',
      context: optionStep.contextUpdates,
      contests,
    });
    expect(confirmStep.nextState).toBe('CONFIRM');
  });

  it('supports home and exit controls', () => {
    const machine = new UssdStateMachine();
    const homeStep = machine.step({
      mode: 'MORE',
      userInput: '00',
      state: 'SELECT_OPTION',
      context: { selectedContestId: 'contest-1' },
      contests,
    });
    expect(homeStep.nextState).toBe('WELCOME');

    const exitStep = machine.step({
      mode: 'MORE',
      userInput: '99',
      state: 'WELCOME',
      context: {},
      contests,
    });
    expect(exitStep.shouldEnd).toBe(true);
  });
});

