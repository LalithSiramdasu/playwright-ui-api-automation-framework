export class TestDataScope {
  constructor(label: string);
  readonly namespace: string;
  readonly label: string;
  unique(prefix?: string): string;
  onCleanup(callback: () => void | Promise<void>): void;
  close(): Promise<void>;
}
