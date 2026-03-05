type ContestOption = {
    id: string;
    name: string;
    totalVotes?: number;
};
type Contest = {
    id: string;
    title: string;
    options: ContestOption[];
};
export type UssdMachineContext = {
    selectedContestId?: string;
    selectedOptionId?: string;
    optionsPage?: number;
};
export type UssdState = 'WELCOME' | 'SELECT_CONTEST' | 'SELECT_OPTION' | 'CONFIRM' | 'SUCCESS' | 'LEADERBOARD';
export type UssdStateMachineInput = {
    mode: 'START' | 'MORE' | 'END';
    userInput: string;
    state: UssdState;
    context: UssdMachineContext;
    contests: Contest[];
};
export type UssdStateMachineResult = {
    nextState: UssdState;
    responseLines: string[];
    shouldEnd: boolean;
    contextUpdates: UssdMachineContext;
};
export declare class UssdStateMachine {
    step(input: UssdStateMachineInput): UssdStateMachineResult;
    private enterContestSelection;
    private enterOptionSelection;
    private showLeaderboard;
}
export {};
//# sourceMappingURL=UssdStateMachine.d.ts.map