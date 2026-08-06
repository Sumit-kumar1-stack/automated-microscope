type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
};

type SerialNavigator = Navigator & {
  serial?: {
    requestPort(): Promise<SerialPortLike>;
  };
};

export class SerialMicroscopeController {
  private port: SerialPortLike | null = null;

  supported() {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  async connect() {
    const serialNavigator = navigator as SerialNavigator;
    if (!serialNavigator.serial) {
      throw new Error("Web Serial is unavailable in this browser.");
    }

    this.port = await serialNavigator.serial.requestPort();
    await this.port.open({ baudRate: 115200 });
    await this.send("PING");
  }

  async disconnect() {
    if (!this.port) return;
    await this.port.close();
    this.port = null;
  }

  async moveZ(steps: number) {
    await this.send(`MOVE_Z ${Math.trunc(steps)}`);
  }

  async stop() {
    await this.send("STOP");
  }

  private async send(command: string) {
    if (!this.port?.writable) {
      throw new Error("Microscope controller is not connected.");
    }

    const writer = this.port.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(`${command}\n`));
    } finally {
      writer.releaseLock();
    }
  }
}
