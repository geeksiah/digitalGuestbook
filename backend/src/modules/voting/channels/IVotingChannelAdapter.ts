export interface IVotingChannelAdapter<TIn, TOut> {
  handleRequest(input: TIn): Promise<TOut>;
}

