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

export type UssdState =
  | 'WELCOME'
  | 'SELECT_CONTEST'
  | 'SELECT_OPTION'
  | 'CONFIRM'
  | 'SUCCESS'
  | 'LEADERBOARD';

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

const PAGE_SIZE = 7;

const normalizeInput = (value: string) => String(value || '').trim();

const findContest = (contests: Contest[], id: string | undefined) =>
  contests.find((contest) => contest.id === id);

const paginate = <T>(items: T[], page: number, size: number) => {
  const safePage = Math.max(0, page);
  const start = safePage * size;
  return {
    page: safePage,
    items: items.slice(start, start + size),
    hasNext: start + size < items.length,
    hasPrev: safePage > 0,
  };
};

export class UssdStateMachine {
  step(input: UssdStateMachineInput): UssdStateMachineResult {
    if (input.mode === 'END') {
      return {
        nextState: 'SUCCESS',
        responseLines: ['Session ended. Thank you.'],
        shouldEnd: true,
        contextUpdates: input.context,
      };
    }

    const raw = normalizeInput(input.userInput);
    if (raw === '99') {
      return {
        nextState: 'SUCCESS',
        responseLines: ['Thank you for using EventPeepo voting.'],
        shouldEnd: true,
        contextUpdates: {},
      };
    }
    if (raw === '00') {
      return {
        nextState: 'WELCOME',
        responseLines: ['Welcome to EventPeepo Voting', '1 Vote now', '2 Leaderboard', '99 Exit'],
        shouldEnd: false,
        contextUpdates: {},
      };
    }

    if (input.state === 'WELCOME' || input.mode === 'START') {
      if (!raw) {
        return {
          nextState: 'WELCOME',
          responseLines: ['Welcome to EventPeepo Voting', '1 Vote now', '2 Leaderboard', '99 Exit'],
          shouldEnd: false,
          contextUpdates: {},
        };
      }
      if (raw === '1') {
        return this.enterContestSelection(input.contests);
      }
      if (raw === '2') {
        return this.showLeaderboard(input.contests);
      }
      return {
        nextState: 'WELCOME',
        responseLines: ['Invalid selection', '1 Vote now', '2 Leaderboard', '99 Exit'],
        shouldEnd: false,
        contextUpdates: {},
      };
    }

    if (input.state === 'LEADERBOARD') {
      return {
        nextState: 'WELCOME',
        responseLines: ['1 Vote now', '00 Home', '99 Exit'],
        shouldEnd: false,
        contextUpdates: input.context,
      };
    }

    if (input.state === 'SELECT_CONTEST') {
      if (raw === '0') {
        return {
          nextState: 'WELCOME',
          responseLines: ['Welcome to EventPeepo Voting', '1 Vote now', '2 Leaderboard', '99 Exit'],
          shouldEnd: false,
          contextUpdates: {},
        };
      }

      const selectedIndex = Number(raw);
      if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || selectedIndex > input.contests.length) {
        return this.enterContestSelection(input.contests, 'Invalid contest. Pick a number.');
      }

      const contest = input.contests[selectedIndex - 1];
      if (!contest) return this.enterContestSelection(input.contests, 'Contest unavailable.');

      return this.enterOptionSelection(contest, { selectedContestId: contest.id, optionsPage: 0 });
    }

    if (input.state === 'SELECT_OPTION') {
      const contest = findContest(input.contests, input.context.selectedContestId);
      if (!contest) return this.enterContestSelection(input.contests, 'Contest not found.');

      const page = Number.isFinite(input.context.optionsPage) ? Number(input.context.optionsPage) : 0;
      const currentPage = paginate(contest.options, page, PAGE_SIZE);

      if (raw === '0') {
        return this.enterContestSelection(input.contests);
      }
      if (raw === '8' && currentPage.hasPrev) {
        return this.enterOptionSelection(contest, {
          selectedContestId: contest.id,
          optionsPage: page - 1,
        });
      }
      if (raw === '9' && currentPage.hasNext) {
        return this.enterOptionSelection(contest, {
          selectedContestId: contest.id,
          optionsPage: page + 1,
        });
      }

      const selectedIndex = Number(raw);
      if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || selectedIndex > currentPage.items.length) {
        return this.enterOptionSelection(contest, input.context, 'Invalid nominee. Pick a number.');
      }

      const option = currentPage.items[selectedIndex - 1];
      if (!option) return this.enterOptionSelection(contest, input.context, 'Nominee unavailable.');
      return {
        nextState: 'CONFIRM',
        responseLines: [`${contest.title}`, `Nominee: ${option.name}`, '1 Confirm vote', '0 Back', '99 Exit'],
        shouldEnd: false,
        contextUpdates: {
          ...input.context,
          selectedContestId: contest.id,
          selectedOptionId: option.id,
        },
      };
    }

    if (input.state === 'CONFIRM') {
      const contest = findContest(input.contests, input.context.selectedContestId);
      const option = contest?.options.find((entry) => entry.id === input.context.selectedOptionId);
      if (!contest || !option) {
        return this.enterContestSelection(input.contests, 'Selection expired. Start again.');
      }
      if (raw === '0') {
        return this.enterOptionSelection(contest, {
          selectedContestId: contest.id,
          optionsPage: input.context.optionsPage || 0,
        });
      }
      if (raw !== '1') {
        return {
          nextState: 'CONFIRM',
          responseLines: [`${contest.title}`, `Nominee: ${option.name}`, '1 Confirm vote', '0 Back', '99 Exit'],
          shouldEnd: false,
          contextUpdates: input.context,
        };
      }

      return {
        nextState: 'SUCCESS',
        responseLines: ['Vote received successfully.', 'Thank you for participating.'],
        shouldEnd: true,
        contextUpdates: input.context,
      };
    }

    return {
      nextState: 'WELCOME',
      responseLines: ['Welcome to EventPeepo Voting', '1 Vote now', '2 Leaderboard', '99 Exit'],
      shouldEnd: false,
      contextUpdates: {},
    };
  }

  private enterContestSelection(contests: Contest[], lead?: string): UssdStateMachineResult {
    const lines = [lead || 'Select contest'];
    contests.slice(0, 7).forEach((contest, index) => {
      lines.push(`${index + 1} ${contest.title}`);
    });
    lines.push('0 Back');
    lines.push('00 Home');
    lines.push('99 Exit');
    return {
      nextState: 'SELECT_CONTEST',
      responseLines: lines,
      shouldEnd: false,
      contextUpdates: {},
    };
  }

  private enterOptionSelection(
    contest: Contest,
    context: UssdMachineContext,
    lead?: string
  ): UssdStateMachineResult {
    const page = Number.isFinite(context.optionsPage) ? Number(context.optionsPage) : 0;
    const currentPage = paginate(contest.options, page, PAGE_SIZE);
    const lines = [lead || contest.title];

    currentPage.items.forEach((option, index) => {
      lines.push(`${index + 1} ${option.name}`);
    });

    if (currentPage.hasPrev) lines.push('8 Prev');
    if (currentPage.hasNext) lines.push('9 Next');
    lines.push('0 Back');
    lines.push('00 Home');
    lines.push('99 Exit');

    return {
      nextState: 'SELECT_OPTION',
      responseLines: lines,
      shouldEnd: false,
      contextUpdates: {
        ...context,
        selectedContestId: contest.id,
        optionsPage: currentPage.page,
      },
    };
  }

  private showLeaderboard(contests: Contest[]): UssdStateMachineResult {
    const lines = ['Leaderboard'];
    contests.slice(0, 2).forEach((contest) => {
      const ranked = [...contest.options]
        .sort((a, b) => Number(b.totalVotes || 0) - Number(a.totalVotes || 0))
        .slice(0, 1)[0];
      if (ranked) {
        lines.push(`${contest.title}: ${ranked.name}`);
      }
    });
    lines.push('00 Home');
    lines.push('99 Exit');
    return {
      nextState: 'LEADERBOARD',
      responseLines: lines,
      shouldEnd: false,
      contextUpdates: {},
    };
  }
}

