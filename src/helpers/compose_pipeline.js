import { compose } from "underscore";

const composePipeline = (...fns) => (x) => fns.reduce((y, f) => f(y), x);

export default composePipeline;
