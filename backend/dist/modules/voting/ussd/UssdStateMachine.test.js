"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const UssdStateMachine_js_1 = require("./UssdStateMachine.js");
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
(0, vitest_1.describe)('UssdStateMachine', () => {
    (0, vitest_1.it)('starts at welcome state', () => {
        const machine = new UssdStateMachine_js_1.UssdStateMachine();
        const result = machine.step({
            mode: 'START',
            userInput: '',
            state: 'WELCOME',
            context: {},
            contests,
        });
        (0, vitest_1.expect)(result.nextState).toBe('WELCOME');
        (0, vitest_1.expect)(result.responseLines.join(' ')).toContain('Vote now');
        (0, vitest_1.expect)(result.shouldEnd).toBe(false);
    });
    (0, vitest_1.it)('supports vote flow from contest selection to confirmation', () => {
        const machine = new UssdStateMachine_js_1.UssdStateMachine();
        const contestStep = machine.step({
            mode: 'MORE',
            userInput: '1',
            state: 'WELCOME',
            context: {},
            contests,
        });
        (0, vitest_1.expect)(contestStep.nextState).toBe('SELECT_CONTEST');
        const optionStep = machine.step({
            mode: 'MORE',
            userInput: '1',
            state: 'SELECT_CONTEST',
            context: {},
            contests,
        });
        (0, vitest_1.expect)(optionStep.nextState).toBe('SELECT_OPTION');
        const confirmStep = machine.step({
            mode: 'MORE',
            userInput: '1',
            state: 'SELECT_OPTION',
            context: optionStep.contextUpdates,
            contests,
        });
        (0, vitest_1.expect)(confirmStep.nextState).toBe('CONFIRM');
    });
    (0, vitest_1.it)('supports home and exit controls', () => {
        const machine = new UssdStateMachine_js_1.UssdStateMachine();
        const homeStep = machine.step({
            mode: 'MORE',
            userInput: '00',
            state: 'SELECT_OPTION',
            context: { selectedContestId: 'contest-1' },
            contests,
        });
        (0, vitest_1.expect)(homeStep.nextState).toBe('WELCOME');
        const exitStep = machine.step({
            mode: 'MORE',
            userInput: '99',
            state: 'WELCOME',
            context: {},
            contests,
        });
        (0, vitest_1.expect)(exitStep.shouldEnd).toBe(true);
    });
});
//# sourceMappingURL=UssdStateMachine.test.js.map