import type {
  ScanMlFieldResult,
} from "./scan-ml-analyzer";


export class ScanMlResultStore {
  private readonly results =
    new Map<
      string,
      ScanMlFieldResult
    >();


  set(
    result:
      ScanMlFieldResult,
  ): void {
    this.results.set(
      result.fieldId,
      result,
    );
  }


  get(
    fieldId: string,
  ): ScanMlFieldResult | null {
    return (
      this.results.get(
        fieldId,
      ) ??
      null
    );
  }


  require(
    fieldId: string,
  ): ScanMlFieldResult {
    const result =
      this.get(
        fieldId,
      );


    if (
      !result
    ) {
      throw new Error(
        `No ML result exists for scan field "${fieldId}".`,
      );
    }


    return result;
  }


  has(
    fieldId: string,
  ): boolean {
    return this.results.has(
      fieldId,
    );
  }


  list():
    ScanMlFieldResult[] {
    return [
      ...this.results.values(),
    ];
  }


  getFieldCount():
    number {
    return this.results.size;
  }


  getCandidateCount():
    number {
    return this.list().reduce(
      (
        total,
        result,
      ) =>
        total +
        result.inference
          .candidates.length,
      0,
    );
  }


  clear():
    void {
    this.results.clear();
  }
}