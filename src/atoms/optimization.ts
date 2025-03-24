import { focusAtom } from "jotai-optics";
import { optimAtom } from ".";
import { Regularization } from "~/lib";

export const objectiveAtom = focusAtom(optimAtom, (o) => o.prop("objective"));
objectiveAtom.debugLabel = "optimization.objective";

export const regularizationAtom = focusAtom(objectiveAtom, (o) =>
  o.prop("regularization").valueOr({} as Regularization),
);

export const metaheuristicAtom = focusAtom(optimAtom, (o) =>
  o.prop("metaheuristic"),
);
metaheuristicAtom.debugLabel = "optimization.metaheuristic";

export const constraintsAtom = focusAtom(optimAtom, (o) =>
  o.prop("constraints"),
);
constraintsAtom.debugLabel = "optimization.constraints";
