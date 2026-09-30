// Pure dispatch policy. Not wired into Paseo Session.

export interface DispatchCheck {
  actor: string;
  effect: "read" | "write";
  revision: number;
  expectedRevision: number;
  epoch: number;
  expectedEpoch: number;
  resourceWriter: string | null;
  actorIsWriter: boolean;
  commandId: string;
  alreadyDispatched: boolean;
}

export type DispatchDecision =
  | { allow: true }
  | { allow: false; reason: "revision" | "epoch" | "writer" | "duplicate" };

export function evaluateDispatch(input: DispatchCheck): DispatchDecision {
  if (input.effect === "read") return { allow: true };
  if (input.revision !== input.expectedRevision) return { allow: false, reason: "revision" };
  if (input.epoch !== input.expectedEpoch) return { allow: false, reason: "epoch" };
  if (!input.actorIsWriter || input.resourceWriter !== input.actor) {
    return { allow: false, reason: "writer" };
  }
  if (input.alreadyDispatched) return { allow: false, reason: "duplicate" };
  return { allow: true };
}
