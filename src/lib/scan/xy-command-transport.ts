export interface XYCommandTransport {
  connect():
    Promise<void>;

  disconnect():
    Promise<void>;

  isConnected():
    boolean;

  request(
    command:
      string,

    signal?:
      AbortSignal,
  ): Promise<string>;
}