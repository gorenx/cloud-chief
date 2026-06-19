export class AiGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiGatewayError";
  }
}
